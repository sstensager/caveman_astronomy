import type * as THREE from "three";
import type { BodyId, UniverseState } from "../astronomy/types";

export interface ObserverFrame {
  worldPosition: THREE.Vector3;
  up: THREE.Vector3;
  north?: THREE.Vector3;
  east?: THREE.Vector3;
}

/**
 * The boundary between the pure domain model and Three.js: implementations
 * may freely use THREE.Vector3/Object3D. Only GroundObserver exists this
 * iteration; the shape is set up so EarthCenterObserver/SpaceObserver/
 * SunObserver/MoonObserver can be added later with no interface change.
 */
export interface Observer {
  readonly id: string;
  getFrame(): ObserverFrame;
  /** Normalized, world-space direction from this observer to the given body. */
  getDirectionTo(bodyId: BodyId, state: UniverseState): THREE.Vector3;
}
