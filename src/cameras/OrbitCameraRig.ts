import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CameraRig } from "./CameraRig";

export interface OrbitCameraRigOptions {
  domElement: HTMLElement;
  initialPosition: [number, number, number];
  minDistance: number;
  maxDistance: number;
  fov?: number;
  near?: number;
  far?: number;
}

/**
 * Free-orbiting camera looking at the world origin. Not attached to any
 * entity, so it stays fixed in world space. Generalized (not Earth-specific)
 * so it can back both Space View (distances relative to EARTH_RADIUS) and
 * the external Celestial Sphere View (distances relative to
 * CELESTIAL_GLOBE_RADIUS) via two differently-configured instances - see
 * CameraManager.
 */
export class OrbitCameraRig implements CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly domElement: HTMLElement;

  constructor(options: OrbitCameraRigOptions) {
    this.camera = new THREE.PerspectiveCamera(options.fov ?? 50, 1, options.near ?? 0.1, options.far ?? 20000);
    this.camera.position.set(...options.initialPosition);
    this.domElement = options.domElement;

    this.controls = new OrbitControls(this.camera, options.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = options.minDistance;
    this.controls.maxDistance = options.maxDistance;
    this.controls.enabled = false;
    this.controls.update();
  }

  setActive(active: boolean): void {
    this.controls.enabled = active;
  }

  // Reclaims the idle cursor when enabled, mirroring GroundCameraRig - see
  // ObserverPlacer.setArmed for why it only claims "crosshair" while armed
  // and never resets to "default" itself, which would otherwise leave
  // whichever cursor was showing at arm-time stuck after disarming.
  setInteractionEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
    if (enabled) this.domElement.style.cursor = "default";
  }

  update(): void {
    this.controls.update();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
