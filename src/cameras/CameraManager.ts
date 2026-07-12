import * as THREE from "three";
import { CameraMode } from "./CameraMode";
import type { CameraRig } from "./CameraRig";
import { OrbitCameraRig } from "./OrbitCameraRig";
import { GroundCameraRig } from "./GroundCameraRig";
import { CELESTIAL_GLOBE_RADIUS, EARTH_RADIUS } from "../config/constants";

/** Owns all camera rigs and switches which one is active/rendered. */
export class CameraManager {
  private readonly rigs: Record<CameraMode, CameraRig>;
  private mode: CameraMode;

  constructor(getActiveStationObject3D: () => THREE.Object3D, domElement: HTMLElement, initialMode = CameraMode.Space) {
    this.rigs = {
      [CameraMode.Space]: new OrbitCameraRig({
        domElement,
        initialPosition: [EARTH_RADIUS * 3, EARTH_RADIUS * 2, EARTH_RADIUS * 3],
        minDistance: EARTH_RADIUS * 1.5,
        maxDistance: EARTH_RADIUS * 40,
      }),
      [CameraMode.Ground]: new GroundCameraRig(getActiveStationObject3D, domElement),
      [CameraMode.CelestialSphere]: new OrbitCameraRig({
        domElement,
        initialPosition: [CELESTIAL_GLOBE_RADIUS * 1.8, CELESTIAL_GLOBE_RADIUS * 1.2, CELESTIAL_GLOBE_RADIUS * 1.8],
        minDistance: CELESTIAL_GLOBE_RADIUS * 1.1,
        maxDistance: CELESTIAL_GLOBE_RADIUS * 5,
      }),
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

  /** Suspends/restores the ACTIVE rig's own pointer interaction (e.g.
   *  OrbitControls' drag-to-orbit) so a drag gesture can be repurposed for
   *  observer placement instead - see ObserverPlacer. */
  setPlacementModeActive(active: boolean): void {
    this.rigs[this.mode].setInteractionEnabled(!active);
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
