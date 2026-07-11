import type * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// A camera paired with the controls that drive it. Space and Ground views
// both implement this so CameraManager can treat them identically.
export interface CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  setActive(active: boolean): void;
  update(): void;
  setAspect(aspect: number): void;
}
