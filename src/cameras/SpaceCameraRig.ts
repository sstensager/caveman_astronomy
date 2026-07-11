import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CameraRig } from "./CameraRig";
import { EARTH_RADIUS } from "../config/constants";

/**
 * Free-orbiting camera looking at Earth from space. Not attached to any
 * entity, so it stays fixed in world space - this is what makes Earth
 * visibly rotate beneath it.
 */
export class SpaceCameraRig implements CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  constructor(domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20000);
    this.camera.position.set(EARTH_RADIUS * 3, EARTH_RADIUS * 2, EARTH_RADIUS * 3);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = EARTH_RADIUS * 1.5;
    this.controls.maxDistance = EARTH_RADIUS * 40;
    this.controls.enabled = false;
    this.controls.update();
  }

  setActive(active: boolean): void {
    this.controls.enabled = active;
  }

  update(): void {
    this.controls.update();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
