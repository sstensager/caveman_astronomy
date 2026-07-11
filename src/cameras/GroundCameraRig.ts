import * as THREE from "three";
import type { CameraRig } from "./CameraRig";
import { GroundLookControls } from "./GroundLookControls";

/**
 * "Standing on Earth" camera. Parented under Earth's ground-station anchor,
 * so it rotates rigidly with the planet - the horizon (Earth's surface)
 * stays fixed in the camera's own frame while the world-space star sphere
 * appears to sweep overhead. Local look controls (click-drag) let the
 * observer turn their head; see GroundLookControls for why OrbitControls
 * doesn't work here.
 */
export class GroundCameraRig implements CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private readonly lookControls: GroundLookControls;

  constructor(groundStation: THREE.Object3D, domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 20000);
    this.camera.position.set(0, 0, 0);
    groundStation.add(this.camera);

    this.lookControls = new GroundLookControls(this.camera, domElement);
  }

  setActive(active: boolean): void {
    this.lookControls.setActive(active);
  }

  update(): void {
    this.lookControls.update();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
