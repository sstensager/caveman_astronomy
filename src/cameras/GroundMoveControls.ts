import * as THREE from "three";
import type { ObserverStation } from "../observers/ObserverStation";
import { OBSERVER_MOVE_SPEED } from "../config/constants";

const MOVE_KEYS = new Set(["w", "a", "s", "d"]);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * WASD ground movement: displaces the ACTIVE observer's station each frame
 * while active, sibling to GroundLookControls (same lifecycle/gating
 * concerns - both only matter in Ground camera mode) even though it
 * mutates observer-domain state rather than camera state directly. Since
 * GroundCameraRig parents the camera under the station, moving the station
 * moves the view too "for free."
 *
 * Camera-relative: "forward" is whichever way the camera is CURRENTLY
 * facing (from GroundLookControls' yaw/pitch), not a fixed geographic
 * direction - reads camera.quaternion directly rather than needing
 * GroundLookControls to expose yaw as a separate number, since the camera
 * is a child of the station with position always (0,0,0), so its local
 * quaternion already IS "facing direction expressed in station-local
 * space." Only the horizontal (yaw) component is used - looking up/down
 * doesn't tilt ground movement.
 *
 * Uses lazy getters (mirroring StarPicker's getCamera pattern) rather than
 * fixed references, so it automatically follows whichever observer/camera
 * is currently active if that changes mid-session.
 */
export class GroundMoveControls {
  private readonly pressedKeys = new Set<string>();
  private enabled = false;

  private readonly getActiveStation: () => ObserverStation;
  private readonly getCamera: () => THREE.Camera;

  constructor(getActiveStation: () => ObserverStation, getCamera: () => THREE.Camera) {
    this.getActiveStation = getActiveStation;
    this.getCamera = getCamera;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || isTypingTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (MOVE_KEYS.has(key)) this.pressedKeys.add(key);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.key.toLowerCase());
  };

  setActive(active: boolean): void {
    this.enabled = active;
    this.pressedKeys.clear();
  }

  update(deltaSeconds: number): void {
    if (!this.enabled || this.pressedKeys.size === 0) return;

    let forwardAmount = 0;
    let rightAmount = 0;
    if (this.pressedKeys.has("w")) forwardAmount += 1;
    if (this.pressedKeys.has("s")) forwardAmount -= 1;
    if (this.pressedKeys.has("d")) rightAmount += 1;
    if (this.pressedKeys.has("a")) rightAmount -= 1;
    if (forwardAmount === 0 && rightAmount === 0) return;

    const camera = this.getCamera();
    const forward = LOCAL_FORWARD.clone().applyQuaternion(camera.quaternion);
    forward.y = 0;
    // Looking straight up/down leaves no defined horizontal forward - skip
    // this frame rather than move in an arbitrary direction.
    if (forward.lengthSq() < 1e-8) return;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, LOCAL_UP).normalize();

    // Normalize so diagonal movement (e.g. W+D) isn't faster than straight.
    const magnitude = Math.sqrt(forwardAmount * forwardAmount + rightAmount * rightAmount);
    const step = OBSERVER_MOVE_SPEED * deltaSeconds;
    const direction = forward
      .multiplyScalar(forwardAmount / magnitude)
      .addScaledVector(right, rightAmount / magnitude);

    this.getActiveStation().moveInLocalDirection(direction, step);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
}
