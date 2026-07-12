import * as THREE from "three";
import { CameraMode } from "./CameraMode";
import type { CameraRig } from "./CameraRig";
import { OrbitCameraRig } from "./OrbitCameraRig";
import { GroundCameraRig } from "./GroundCameraRig";
import { EARTH_RADIUS } from "../config/constants";

/** Owns all camera rigs and switches which one is active/rendered. Space is
 *  a single free-roam orbit rig covering everything from a close Earth flyby
 *  out to the celestial-sphere diagram scale - there used to be a second
 *  "Celestial Sphere" mode/rig here, but it was the exact same OrbitCameraRig
 *  with a different zoom-range preset, not a different camera or rendering
 *  path. Its range is folded into Space's below instead of gating content
 *  visibility by which "mode" you're in. */
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
   *  observer placement instead - see ObserverDragHandler. */
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
