import * as THREE from "three";

const MAX_PITCH = Math.PI / 2 - 0.01;

/**
 * Click-drag look-around for a camera nested inside a rotating/offset
 * parent (Earth's ground station). Deliberately NOT OrbitControls:
 * OrbitControls' `lookAt(target)` call treats `target` as a world-space
 * point, but a nested camera's natural "target" is local to its parent -
 * those two spaces don't mix, so orbiting breaks once the camera has a
 * non-trivial parent transform.
 *
 * Instead this drives the camera's LOCAL quaternion directly from
 * yaw/pitch, like turning your head while standing still. Because the
 * parent (ground station) already encodes "which way is up" at that
 * point on Earth, yaw=0/pitch=0 always faces the local horizon.
 */
export class GroundLookControls {
  private yaw = 0;
  private pitch = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private enabled = false;
  rotateSpeed = 0.005;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.applyRotation();
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled) return;
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.domElement.style.cursor = "grabbing";
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.enabled || !this.dragging) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;

    this.yaw -= dx * this.rotateSpeed;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * this.rotateSpeed, -MAX_PITCH, MAX_PITCH);
    this.applyRotation();
  };

  private onPointerUp = (): void => {
    this.dragging = false;
    if (this.enabled) this.domElement.style.cursor = "grab";
  };

  private applyRotation(): void {
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
  }

  setActive(active: boolean): void {
    this.enabled = active;
    this.dragging = false;
    this.domElement.style.cursor = active ? "grab" : "default";
  }

  update(): void {}

  dispose(): void {
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
  }
}
