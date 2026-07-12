import * as THREE from "three";
import type { ObserverStation } from "../observers/ObserverStation";

/**
 * Drag-to-place the active observer: while armed (via the "Move Observer"
 * checkbox), raycasts against Earth's mesh on pointerdown/pointermove and
 * repositions the active observer's station there. Unlike StarPicker, this
 * is gated entirely by the explicit "armed" flag rather than a click/drag
 * heuristic - while unarmed, every listener here is a no-op, so
 * OrbitControls/StarPicker behave exactly as if this class didn't exist.
 * While armed, the caller is responsible for calling
 * CameraManager.setPlacementModeActive(true) so this drag doesn't fight
 * OrbitControls' own drag-to-orbit for the same gesture.
 *
 * Requires "Show Earth" to be on (raycasts earthBase.mesh directly) - no
 * invisible hitbox proxy; dragging onto invisible geometry isn't
 * pedagogically meaningful anyway.
 */
export class ObserverPlacer {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private armed = false;
  private isPointerDown = false;

  private readonly getCamera: () => THREE.Camera;
  private readonly domElement: HTMLElement;
  private readonly earthMesh: THREE.Mesh;
  private readonly rotationGroup: THREE.Object3D;
  private readonly getActiveStation: () => ObserverStation;

  constructor(
    getCamera: () => THREE.Camera,
    domElement: HTMLElement,
    earthMesh: THREE.Mesh,
    rotationGroup: THREE.Object3D,
    getActiveStation: () => ObserverStation,
  ) {
    this.getCamera = getCamera;
    this.domElement = domElement;
    this.earthMesh = earthMesh;
    this.rotationGroup = rotationGroup;
    this.getActiveStation = getActiveStation;
    this.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  setArmed(armed: boolean): void {
    this.armed = armed;
    this.isPointerDown = false;
    // Only actively claims the cursor while armed - doesn't reset it to
    // "default" on disarm, since that would clobber whichever camera rig's
    // own idle cursor (e.g. GroundCameraRig's "grab" for look-drag) is
    // meant to be showing instead. See CameraManager.setPlacementModeActive
    // / GroundCameraRig.setInteractionEnabled for the other side of this.
    if (armed) this.domElement.style.cursor = "crosshair";
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.armed) return;
    this.isPointerDown = true;
    this.place(event);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.armed || !this.isPointerDown) return;
    this.place(event);
  };

  private onPointerUp = (): void => {
    this.isPointerDown = false;
  };

  private place(event: PointerEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.getCamera());
    const hits = this.raycaster.intersectObject(this.earthMesh, false);
    if (hits.length === 0) return;

    const localPoint = this.rotationGroup.worldToLocal(hits[0].point.clone());
    this.getActiveStation().setLocalSurfacePoint(localPoint);
  }

  dispose(): void {
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
  }
}
