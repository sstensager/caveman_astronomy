import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { AstronomyModel, BodyId, SimulationTime } from "../../astronomy/types";
import type { Observer } from "../../observers/Observer";
import { eclipticToWorld } from "../../astronomy/frames";
import { subVectors } from "../../astronomy/vectorMath";

export interface SkyPathLineLayerOptions {
  id: string;
  label: string;
  group: LayerGroup;
  /** The body whose apparent path across the sky this line traces. */
  bodyId: BodyId;
  /** The body the apparent direction is measured from (Earth). */
  relativeToId: BodyId;
  /** Real orbital period, in simulation days - one full lap is sampled over this span. */
  periodDays: number;
  getModel: () => AstronomyModel;
  getObserver: () => Observer;
  getSimulationTime: () => SimulationTime;
  /** The sky-tier display radius (see CELESTIAL_SPHERE_RADIUS) - purely a
   *  display choice, same as CelestialMarkerLayer's sky-tier radius. */
  radius: number;
  color?: number;
  opacity?: number;
  segments?: number;
}

/**
 * The path a body traces across the immersive sky over one full orbital
 * period - e.g. the Sun's ecliptic, or the Moon's apparent path - drawn on
 * the sky tier (see CelestialMarkerLayer's sky-tier instances, which this
 * sits alongside). Unlike OrbitLineLayer (the small explanatory-globe
 * diagram's real-eccentricity ellipse), this is DIRECTION-only: every point
 * on the sky tier sits at the same fixed display radius regardless of a
 * body's actual distance (see projectDirectionToSphere), so a real ellipse
 * shape isn't meaningful here - only the apparent SHAPE the path traces
 * against the fixed stars is. This is exactly the same simplification the
 * sky-tier markers already make.
 *
 * Each sampled point is bodyPos - relativeToPos, rotated into world space
 * via eclipticToWorld and normalized - precisely the same computation
 * GroundObserver.getDirectionTo performs, and therefore (see
 * modelEquivalence.test.ts) identical under either AstronomyModel. Offset
 * by the observer's current world position, matching every other
 * observer-centered sky-tier layer (CelestialMarkerLayer's sky instances,
 * AltAzGridLayer, ZenithLayer) - the path is drawn EXACTLY where the body's
 * own marker sits at each sampled instant, never a separate approximation.
 *
 * Resamples every update() from the CURRENT simulation time, same rationale
 * as OrbitLineLayer: cheap, and keeps the Moon's path honest as its
 * ascending node slowly regresses.
 */
export class SkyPathLineLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D: THREE.LineLoop;

  private readonly bodyId: BodyId;
  private readonly relativeToId: BodyId;
  private readonly periodDays: number;
  private readonly getModel: () => AstronomyModel;
  private readonly getObserver: () => Observer;
  private readonly getSimulationTime: () => SimulationTime;
  private readonly segments: number;
  private readonly positions: Float32Array;
  private radius: number;

  constructor(options: SkyPathLineLayerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.group = options.group;
    this.bodyId = options.bodyId;
    this.relativeToId = options.relativeToId;
    this.periodDays = options.periodDays;
    this.getModel = options.getModel;
    this.getObserver = options.getObserver;
    this.getSimulationTime = options.getSimulationTime;
    this.radius = options.radius;
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
    this.object3D.name = `SkyPathLineLayer.${options.id}`;
    this.recompute();
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  update(): void {
    this.recompute();
  }

  /** Matches CelestialMarkerLayer.setRadius/OrbitLineLayer.setRadius. */
  setRadius(radius: number): void {
    this.radius = radius;
    this.recompute();
  }

  private recompute(): void {
    const model = this.getModel();
    const t0 = this.getSimulationTime();
    const observerWorldPosition = this.getObserver().getFrame().worldPosition;
    const step = this.periodDays / this.segments;

    const direction = new THREE.Vector3();
    for (let i = 0; i < this.segments; i++) {
      const state = model.getState(t0 + i * step);
      const body = state.bodies[this.bodyId].position;
      const ref = state.bodies[this.relativeToId].position;
      const worldRelative = eclipticToWorld(subVectors(body, ref));
      direction.set(worldRelative.x, worldRelative.y, worldRelative.z).normalize();

      const offset = i * 3;
      this.positions[offset] = observerWorldPosition.x + direction.x * this.radius;
      this.positions[offset + 1] = observerWorldPosition.y + direction.y * this.radius;
      this.positions[offset + 2] = observerWorldPosition.z + direction.z * this.radius;
    }

    const attribute = this.object3D.geometry.getAttribute("position") as THREE.BufferAttribute;
    attribute.needsUpdate = true;
    this.object3D.geometry.computeBoundingSphere();
  }
}
