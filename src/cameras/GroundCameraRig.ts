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
  private readonly getActiveStation: () => THREE.Object3D;
  private currentParent?: THREE.Object3D;

  constructor(getActiveStation: () => THREE.Object3D, domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 20000);
    this.camera.position.set(0, 0, 0);
    this.getActiveStation = getActiveStation;
    this.syncParent();

    this.lookControls = new GroundLookControls(this.camera, domElement);
  }

  /** Re-parents the camera onto whichever observer is currently active,
   *  cheap no-op in the common case (same station as last frame). Camera's
   *  local position always stays (0,0,0) - reparenting under a THREE.js
   *  Object3D preserves local transform, reinterpreting it in the new
   *  parent's space, which is exactly what's wanted here. */
  private syncParent(): void {
    const station = this.getActiveStation();
    if (station === this.currentParent) return;
    station.add(this.camera);
    this.currentParent = station;
  }

  setActive(active: boolean): void {
    this.lookControls.setActive(active);
  }

  /** No-op: Ground's look-drag doesn't compete with observer placement -
   *  placement in Ground mode is WASD-driven (GroundMoveControls), not a
   *  pointer-drag gesture, so there's nothing here to suspend. */
  setInteractionEnabled(_enabled: boolean): void {}

  update(): void {
    this.syncParent();
    this.lookControls.update();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
