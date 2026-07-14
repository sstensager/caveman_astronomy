import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { AstronomyModel, BodyId, SimulationTime } from "../../astronomy/types";
import type { Observer } from "../../observers/Observer";
import { projectDirectionToSphere } from "../../observers/projection";
import { CELESTIAL_MARKER_SIZE_RATIO } from "../../config/constants";

export interface CelestialMarkerOptions {
  id: string;
  label: string;
  color: number;
  /** The celestial sphere radius to project this marker onto. */
  radius: number;
  /** When true, the marker is offset by the observer's live world position
   *  instead of assuming it sits at the scene origin - exact rather than a
   *  negligible approximation once the sphere radius isn't huge relative to
   *  the observer's distance from Earth's center. See GroundObserver. */
  observerCentered?: boolean;
  /** Fraction (0-1] of `radius` this marker actually projects onto, default
   *  1 (flattened onto the sphere's surface, matching the fixed stars -
   *  correct for the sky tier, where real Sun/Moon parallax against the
   *  effectively-infinite backdrop is genuinely negligible). Set below 1 to
   *  place the marker visibly INSIDE the sphere instead - used for the
   *  globe tier, where Sun/Moon are meant to read as orbiting bodies within
   *  a fixed-star backdrop, not smeared onto its surface alongside the
   *  stars. This is a pure display choice, independent of which
   *  AstronomyModel is active - both models produce the same apparent
   *  direction, so this fraction applies identically either way. */
  orbitRadiusFraction?: number;
  /** Optional image (served from public/, e.g. "/textures/moon1.png") mapped
   *  onto the marker sphere instead of a flat color. */
  textureUrl?: string;
  /** Default false (unlit `MeshBasicMaterial`, correct for a self-luminous
   *  body like the Sun - it shouldn't visibly darken depending on view
   *  angle). Set true for a body that should be genuinely SHADED by the
   *  scene's real keyLight (main.ts) instead - e.g. the Moon, whose real
   *  phases are exactly this: the same sphere, lit from one real direction,
   *  read from a changing angle. Uses `MeshStandardMaterial` (roughness 1,
   *  metalness 0 - matching EarthBase's own material) so it responds to
   *  the SAME ambient+directional lights already lighting Earth - no new
   *  light source needed, `THREE.DirectionalLight` has no falloff/range,
   *  so it lights every object in the scene identically regardless of
   *  where that object is parented or how far from Earth it sits. */
  lit?: boolean;
  /** How the marker's own mesh is oriented as it orbits, independent of the
   *  body's ORBITAL direction (which update() always computes correctly
   *  regardless of this setting). Default "still" - the mesh never rotates,
   *  correct for a flat-colored/unmapped marker where orientation is
   *  invisible anyway. "tidalLocked" keeps a fixed mesh-local face pointed
   *  at Earth (world origin - see EarthBase, never repositioned) as the body
   *  orbits, the way the Moon's real near side always faces Earth. Only
   *  these two exist for now; per-body rotation (a body spinning on its own
   *  axis independent of its orbit) is a planned addition, not implemented
   *  here yet. */
  spinMode?: "still" | "tidalLocked";
}

/**
 * A generic, body-agnostic marker on a celestial sphere. NEVER computes its
 * own orbital position - each update() call is exactly:
 * getModel().getState() -> getObserver().getDirectionTo() -> projectDirectionToSphere().
 * Instantiated once per (body, sphere radius) pair - see main.ts, where
 * "Show Sun"/"Show Moon" each fuse a sky-scale and globe-scale instance of
 * this same class under one CompositeLayer.
 *
 * Takes LAZY getModel/getObserver getters rather than fixed instances -
 * this is what makes "exactly one AstronomyModel governs the universe at a
 * time" and "the active observer drives every observer-relative
 * calculation" actually true: every marker (sky and globe tier alike)
 * resolves the same shared getters fresh each frame, so switching the
 * active model or active observer changes every marker in lockstep, with
 * no marker ever holding a stale reference to a no-longer-active model or
 * observer. See AstronomyModelRegistry / ObserverRegistry in main.ts.
 */
export class CelestialMarkerLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup = "Sky.Observation";
  readonly object3D: THREE.Mesh;

  private readonly bodyId: BodyId;
  private readonly getModel: () => AstronomyModel;
  private readonly getObserver: () => Observer;
  private readonly getSimulationTime: () => SimulationTime;
  private readonly baseRadius: number;
  private readonly observerCentered: boolean;
  private readonly orbitRadiusFraction: number;
  private readonly spinMode: "still" | "tidalLocked";
  private radius: number;

  constructor(
    bodyId: BodyId,
    getModel: () => AstronomyModel,
    getObserver: () => Observer,
    getSimulationTime: () => SimulationTime,
    options: CelestialMarkerOptions,
  ) {
    this.bodyId = bodyId;
    this.getModel = getModel;
    this.getObserver = getObserver;
    this.getSimulationTime = getSimulationTime;
    this.baseRadius = options.radius;
    this.radius = options.radius;
    this.observerCentered = options.observerCentered ?? false;
    this.orbitRadiusFraction = options.orbitRadiusFraction ?? 1;
    this.spinMode = options.spinMode ?? "still";
    this.id = options.id;
    this.label = options.label;

    const markerSize = options.radius * CELESTIAL_MARKER_SIZE_RATIO;
    const geometry = new THREE.SphereGeometry(markerSize, 16, 12);
    const color = options.textureUrl ? 0xffffff : options.color;
    const material = options.lit
      ? new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 })
      : new THREE.MeshBasicMaterial({ color });
    if (options.textureUrl) {
      const texture = new THREE.TextureLoader().load(options.textureUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
    }
    this.object3D = new THREE.Mesh(geometry, material);
    this.object3D.name = `CelestialMarker.${options.id}`;
  }

  update(): void {
    const time = this.getSimulationTime();
    const state = this.getModel().getState(time);
    const observer = this.getObserver();
    const direction = observer.getDirectionTo(this.bodyId, state);
    const offset = projectDirectionToSphere(direction, this.radius * this.orbitRadiusFraction);
    if (this.observerCentered) {
      this.object3D.position.copy(observer.getFrame().worldPosition).add(offset);
    } else {
      this.object3D.position.copy(offset);
    }
    if (this.spinMode === "tidalLocked") {
      this.object3D.lookAt(0, 0, 0);
    }
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  /** Rescales the marker dot to stay proportionally sized as the parent
   *  celestial sphere's display radius changes, and updates the radius
   *  future projectDirectionToSphere() calls use. */
  setRadius(radius: number): void {
    this.radius = radius;
    this.object3D.scale.setScalar(radius / this.baseRadius);
  }
}
