import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { AstronomyModel, BodyId, SimulationTime } from "../../astronomy/types";
import { eclipticToWorld } from "../../astronomy/frames";
import { subVectors } from "../../astronomy/vectorMath";

export interface OrbitLineLayerOptions {
  id: string;
  label: string;
  group: LayerGroup;
  /** The orbiting body whose path this line traces. */
  bodyId: BodyId;
  /** The body the path is drawn relative to (the ellipse's focus / diagram center). */
  relativeToId: BodyId;
  /** Real orbital period, in simulation days - one full lap is sampled over this span. */
  periodDays: number;
  /** Model-space semi-major axis of this relative orbit (see astronomy/constants.ts) -
   *  used only to scale the sampled ellipse into display units, never fed back into
   *  the model itself. */
  semiMajorAxis: number;
  getModel: () => AstronomyModel;
  getSimulationTime: () => SimulationTime;
  /** Current display radius, in the SAME local units the corresponding
   *  OrbitingBodyMarkerLayer's getPosition() returns (see setRadius). */
  radius: number;
  /** Fraction of `radius` the semi-major axis maps to - pass the SAME
   *  scale the corresponding OrbitingBodyMarkerLayer's getPosition() uses
   *  so the line and its marker read as one diagram. */
  orbitRadiusFraction: number;
  color?: number;
  opacity?: number;
  segments?: number;
}

/**
 * A closed ellipse tracing a body's real orbital path relative to another
 * body - e.g. the Sun's path around Earth, the Moon's path around Earth, or
 * Earth's own path around the Sun - meant to sit alongside the
 * corresponding OrbitingBodyMarkerLayer instance (see main.ts's
 * sunOrbitLine/moonOrbitLine/earthOrbitLine).
 *
 * Deliberately reads bodyPos - relativeToPos from the active model's raw
 * getState() output rather than Observer.getDirectionTo() - unlike the
 * sky-tier markers, a full ellipse needs real relative DISTANCE (to show its
 * true eccentricity), not just direction. That relative vector is provably
 * IDENTICAL under both GeocentricModel and ModernHeliocentricModel at every
 * t (same argument that makes main.ts's keyLight direction and
 * astronomy/models/modelEquivalence.test.ts's direction checks
 * model-agnostic, just carried one step further to the FULL vector, not
 * only its normalized direction) - so one instance, with a fixed
 * (bodyId, relativeToId) pair, draws the same correct ellipse no matter
 * which model is active, with no per-model branching needed here. It's then
 * rotated through eclipticToWorld (see frames.ts), exactly like
 * GroundObserver.getDirectionTo does, since the model's ecliptic frame is
 * NOT the render/world frame the Sun/Moon markers and every other direction
 * in the scene are drawn in - skipping that rotation would draw the line
 * tilted 23.44 degrees away from the markers it's meant to frame.
 *
 * Resamples the full ellipse every update() from the CURRENT simulation
 * time - cheap (segments x getState() calls, all pure trig) and keeps the
 * Moon's line honest as its ascending node slowly regresses over sim time,
 * with no separate cache-invalidation logic required.
 */
export class OrbitLineLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D: THREE.LineLoop;

  private readonly bodyId: BodyId;
  private readonly relativeToId: BodyId;
  private readonly periodDays: number;
  private readonly semiMajorAxis: number;
  private readonly getModel: () => AstronomyModel;
  private readonly getSimulationTime: () => SimulationTime;
  private readonly orbitRadiusFraction: number;
  private readonly segments: number;
  private readonly positions: Float32Array;
  private radius: number;

  constructor(options: OrbitLineLayerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.group = options.group;
    this.bodyId = options.bodyId;
    this.relativeToId = options.relativeToId;
    this.periodDays = options.periodDays;
    this.semiMajorAxis = options.semiMajorAxis;
    this.getModel = options.getModel;
    this.getSimulationTime = options.getSimulationTime;
    this.radius = options.radius;
    this.orbitRadiusFraction = options.orbitRadiusFraction;
    this.segments = options.segments ?? 180;

    this.positions = new Float32Array(this.segments * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: options.color ?? 0xffffff,
      transparent: true,
      opacity: options.opacity ?? 0.35,
    });
    this.object3D = new THREE.LineLoop(geometry, material);
    this.object3D.name = `OrbitLineLayer.${options.id}`;
    this.recompute();
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  update(): void {
    this.recompute();
  }

  /** Keeps the ellipse's scale in sync when the corresponding body's
   *  distance slider changes (see main.ts's setSunDistanceRadii/
   *  setMoonDistanceRadii). */
  setRadius(radius: number): void {
    this.radius = radius;
    this.recompute();
  }

  private recompute(): void {
    const model = this.getModel();
    const t0 = this.getSimulationTime();
    const scale = (this.radius * this.orbitRadiusFraction) / this.semiMajorAxis;
    const step = this.periodDays / this.segments;

    for (let i = 0; i < this.segments; i++) {
      const state = model.getState(t0 + i * step);
      const body = state.bodies[this.bodyId].position;
      const ref = state.bodies[this.relativeToId].position;
      // Models express position in the ecliptic frame - rotate into the
      // fixed world/equatorial frame every other body-relative direction in
      // the scene already uses (see GroundObserver.getDirectionTo) before
      // writing render-space coordinates, or this line would be drawn tilted
      // away from where the Sun/Moon markers it's meant to frame actually sit.
      const worldRelative = eclipticToWorld(subVectors(body, ref));
      const offset = i * 3;
      this.positions[offset] = worldRelative.x * scale;
      this.positions[offset + 1] = worldRelative.y * scale;
      this.positions[offset + 2] = worldRelative.z * scale;
    }

    const attribute = this.object3D.geometry.getAttribute("position") as THREE.BufferAttribute;
    attribute.needsUpdate = true;
    this.object3D.geometry.computeBoundingSphere();
  }
}
