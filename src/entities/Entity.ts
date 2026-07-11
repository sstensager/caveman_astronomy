import type * as THREE from "three";

// Common shape for everything that lives in the scene: Earth today,
// Sun/Moon/planets/atmosphere later. Keeping this interface tiny means
// new entities only need to satisfy three methods to plug into the
// render loop and the control panel.
export interface Entity {
  readonly object3D: THREE.Object3D;
  update(deltaSeconds: number): void;
  setVisible(visible: boolean): void;
}
