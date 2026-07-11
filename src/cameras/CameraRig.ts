import type * as THREE from "three";

// A camera paired with whatever controls drive it. Space and Ground views
// each own a different control scheme internally (free orbit vs. local
// look), so this interface only exposes what CameraManager needs.
export interface CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  setActive(active: boolean): void;
  update(): void;
  setAspect(aspect: number): void;
}
