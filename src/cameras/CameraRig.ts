import type * as THREE from "three";

// A camera paired with whatever controls drive it. Space and Ground views
// each own a different control scheme internally (free orbit vs. local
// look), so this interface only exposes what CameraManager needs.
export interface CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  setActive(active: boolean): void;
  update(): void;
  setAspect(aspect: number): void;
  /** Temporarily suspend/restore this rig's own pointer-driven interaction
   *  (e.g. OrbitControls' drag-to-orbit) without deactivating the rig
   *  entirely - used to free up drag gestures for observer placement.
   *  No-op for rigs with no conflicting pointer interaction (e.g. Ground,
   *  whose look-drag doesn't compete with placement). */
  setInteractionEnabled(enabled: boolean): void;
}
