import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CameraRig } from "./CameraRig";

/**
 * "Standing on Earth" camera. Parented under Earth's ground-station anchor,
 * so it rotates rigidly with the planet - the horizon (Earth's surface)
 * stays fixed in the camera's own frame while the world-space star sphere
 * appears to sweep overhead. OrbitControls here only lets the observer
 * look around (no zoom/pan), like turning your head on a tripod.
 */
export class GroundCameraRig implements CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  constructor(groundStation: THREE.Object3D, domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 20000);
    this.camera.position.set(0, 0, 0);
    groundStation.add(this.camera);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.target.set(0, 0, -1);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.5;
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
