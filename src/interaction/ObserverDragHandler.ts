import * as THREE from "three";
import type { ObserverEntry } from "../observers/ObserverRegistry";
import { POINT_SIZE_PX } from "../observers/ObserverMarker";

/** Screen-space hover/pick radius in CSS pixels. ObserverMarker draws at a
 *  FIXED gl_PointSize regardless of distance (see ObserverMarker.ts - no
 *  distance attenuation), so hit-testing has to be a screen-space distance
 *  check against the marker's projected position, not a 3D raycast against
 *  world-space geometry - a fixed world-space threshold would drift out of
 *  sync with the always-fixed-size marker as the camera zooms. Derived from
 *  POINT_SIZE_PX (not a second hardcoded number) so bumping the marker's
 *  size can't silently leave the grab target the old, smaller size -
 *  slightly larger than the marker's own visual radius for a more forgiving
 *  grab target. */
const HOVER_THRESHOLD_PX = POINT_SIZE_PX * 0.7;

/**
 * Direct-manipulation observer placement: hover any observer's pin to get a
 * hand cursor, then click-and-drag it to reposition that observer - no
 * separate "arm" checkbox, unlike this class's predecessor (ObserverPlacer).
 * Works for whichever entry's marker you're actually hovering, not just the
 * currently-"active" observer, and doesn't change which one is active -
 * grabbing a pin only moves it.
 *
 * Hit-testing is screen-space (see HOVER_THRESHOLD_PX); repositioning during
 * an active drag still raycasts against Earth's mesh in 3D, exactly like
 * ObserverPlacer did, since "where does this screen point land on the
 * globe's surface" is a real 3D question once you're past the initial
 * screen-space pick.
 *
 * Never calls stopPropagation, so it coexists with OrbitControls/
 * GroundLookControls on the same canvas - see setDragActive's caller in
 * main.ts for how those get suspended for the duration of an actual drag
 * (hovering alone doesn't suspend anything, only picking up a marker does).
 */
export class ObserverDragHandler {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly ndc = new THREE.Vector3();
  private hoveredEntry: ObserverEntry | undefined;
  private draggingEntry: ObserverEntry | undefined;

  private readonly getCamera: () => THREE.Camera;
  private readonly domElement: HTMLElement;
  private readonly earthMesh: THREE.Mesh;
  private readonly rotationGroup: THREE.Object3D;
  private readonly getObserverEntries: () => ObserverEntry[];
  private readonly onHoverChange: (hovering: boolean) => void;
  private readonly onDragStateChange: (dragging: boolean) => void;

  constructor(
    getCamera: () => THREE.Camera,
    domElement: HTMLElement,
    earthMesh: THREE.Mesh,
    rotationGroup: THREE.Object3D,
    getObserverEntries: () => ObserverEntry[],
    onHoverChange: (hovering: boolean) => void,
    onDragStateChange: (dragging: boolean) => void,
  ) {
    this.getCamera = getCamera;
    this.domElement = domElement;
    this.earthMesh = earthMesh;
    this.rotationGroup = rotationGroup;
    this.getObserverEntries = getObserverEntries;
    this.onHoverChange = onHoverChange;
    this.onDragStateChange = onDragStateChange;
    this.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  private findMarkerUnderPointer(event: PointerEvent): ObserverEntry | undefined {
    const rect = this.domElement.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      return undefined;
    }
    const camera = this.getCamera();
    let closest: { entry: ObserverEntry; distancePx: number } | undefined;
    for (const entry of this.getObserverEntries()) {
      if (!entry.marker.object3D.visible) continue;
      this.ndc.copy(entry.observer.getFrame().worldPosition).project(camera);
      if (this.ndc.z < -1 || this.ndc.z > 1) continue; // behind camera or outside near/far
      const screenX = rect.left + ((this.ndc.x + 1) / 2) * rect.width;
      const screenY = rect.top + ((1 - this.ndc.y) / 2) * rect.height;
      const distancePx = Math.hypot(event.clientX - screenX, event.clientY - screenY);
      if (distancePx <= HOVER_THRESHOLD_PX && (!closest || distancePx < closest.distancePx)) {
        closest = { entry, distancePx };
      }
    }
    return closest?.entry;
  }

  private onPointerDown = (event: PointerEvent): void => {
    const entry = this.findMarkerUnderPointer(event);
    if (!entry) return;
    this.draggingEntry = entry;
    this.onDragStateChange(true);
    this.dragTo(event);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.draggingEntry) {
      this.dragTo(event);
      return;
    }
    const entry = this.findMarkerUnderPointer(event);
    const wasHovering = this.hoveredEntry !== undefined;
    this.hoveredEntry = entry;
    const isHovering = entry !== undefined;
    if (isHovering !== wasHovering) this.onHoverChange(isHovering);
  };

  private onPointerUp = (): void => {
    if (!this.draggingEntry) return;
    this.draggingEntry = undefined;
    this.onDragStateChange(false);
  };

  private dragTo(event: PointerEvent): void {
    if (!this.draggingEntry) return;
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.getCamera());
    const hits = this.raycaster.intersectObject(this.earthMesh, false);
    if (hits.length === 0) return;

    const localPoint = this.rotationGroup.worldToLocal(hits[0].point.clone());
    this.draggingEntry.station.setLocalSurfacePoint(localPoint);
  }

  dispose(): void {
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
  }
}
