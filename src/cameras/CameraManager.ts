import * as THREE from "three";
import { CameraMode } from "./CameraMode";
import type { CameraRig } from "./CameraRig";
import { SpaceCameraRig } from "./SpaceCameraRig";
import { GroundCameraRig } from "./GroundCameraRig";

/** Owns both camera rigs and switches which one is active/rendered. */
export class CameraManager {
  private readonly rigs: Record<CameraMode, CameraRig>;
  private mode: CameraMode;

  constructor(groundStation: THREE.Object3D, domElement: HTMLElement, initialMode = CameraMode.Space) {
    this.rigs = {
      [CameraMode.Space]: new SpaceCameraRig(domElement),
      [CameraMode.Ground]: new GroundCameraRig(groundStation, domElement),
    };
    this.mode = initialMode;
    this.rigs[this.mode].setActive(true);
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.rigs[this.mode].setActive(false);
    this.mode = mode;
    this.rigs[this.mode].setActive(true);
  }

  getMode(): CameraMode {
    return this.mode;
  }

  getActiveCamera(): THREE.PerspectiveCamera {
    return this.rigs[this.mode].camera;
  }

  update(): void {
    this.rigs[this.mode].update();
  }

  setAspect(aspect: number): void {
    for (const mode of Object.values(CameraMode)) {
      this.rigs[mode].setAspect(aspect);
    }
  }
}
