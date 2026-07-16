import * as THREE from "three";

const CLICK_DRAG_THRESHOLD_PX = 5;
const LONG_PRESS_MS = 500;

export interface TargetableBody {
  id: string;
  label: string;
  object3D: THREE.Object3D;
}

/**
 * Click-to-target with two independent gestures sharing one raycast setup.
 *
 * A quick click (<CLICK_DRAG_THRESHOLD_PX movement) sets/releases the orbit
 * ANCHOR (see OrbitCameraRig.setFollowTarget) - same click-vs-drag
 * distinction as StarPicker, so this coexists with OrbitControls' own
 * drag-to-orbit on the same canvas without either fighting the other for a
 * plain click.
 *
 * A LONG PRESS (held >= LONG_PRESS_MS without moving past the same
 * threshold) sets/releases the independent LOOK-AT target (see
 * OrbitCameraRig.setLookAtTarget) instead. Any real movement before the
 * timer fires cancels it outright and defers entirely to OrbitControls'
 * drag - a slow drag-start is never misread as a long-press. Firing a long
 * press also suppresses that same gesture's eventual pointerup from ALSO
 * being read as a click (it isn't one).
 *
 * Either gesture over empty space (or a body hidden by its own layer
 * toggle) reports `undefined` - main.ts treats that as "release whatever's
 * currently targeted" for that gesture's own target, so a plain
 * click-out/press-out is enough to unlock camera tracking with no separate
 * confirmation step.
 */
export class BodyTargetPicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private downX = 0;
  private downY = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | undefined;
  private longPressFired = false;

  private readonly getCamera: () => THREE.Camera;
  private readonly domElement: HTMLElement;
  private readonly bodies: TargetableBody[];
  private readonly onSelectAnchor: (bodyId: string | undefined) => void;
  private readonly onSelectLookAt: (bodyId: string | undefined) => void;

  constructor(
    getCamera: () => THREE.Camera,
    domElement: HTMLElement,
    bodies: TargetableBody[],
    onSelectAnchor: (bodyId: string | undefined) => void,
    onSelectLookAt: (bodyId: string | undefined) => void,
  ) {
    this.getCamera = getCamera;
    this.domElement = domElement;
    this.bodies = bodies;
    this.onSelectAnchor = onSelectAnchor;
    this.onSelectLookAt = onSelectLookAt;
    this.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.domElement.addEventListener("pointermove", this.onPointerMove);
    this.domElement.addEventListener("pointerup", this.onPointerUp);
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.downX = event.clientX;
    this.downY = event.clientY;
    this.longPressFired = false;
    const candidateId = this.raycastBodyIdAt(event);
    clearTimeout(this.longPressTimer);
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = undefined;
      this.longPressFired = true;
      this.onSelectLookAt(candidateId);
    }, LONG_PRESS_MS);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.longPressTimer === undefined) return;
    if (!this.exceedsDragThreshold(event)) return;
    clearTimeout(this.longPressTimer);
    this.longPressTimer = undefined;
  };

  private onPointerUp = (event: PointerEvent): void => {
    clearTimeout(this.longPressTimer);
    this.longPressTimer = undefined;
    if (this.longPressFired) return;
    if (this.exceedsDragThreshold(event)) return;
    this.onSelectAnchor(this.raycastBodyIdAt(event));
  };

  private exceedsDragThreshold(event: PointerEvent): boolean {
    const dx = event.clientX - this.downX;
    const dy = event.clientY - this.downY;
    return Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX;
  }

  private raycastBodyIdAt(event: PointerEvent): string | undefined {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const camera = this.getCamera();
    this.raycaster.setFromCamera(this.pointer, camera);

    const visible = this.bodies.filter((body) => body.object3D.visible);
    const hits = this.raycaster.intersectObjects(
      visible.map((body) => body.object3D),
      false,
    );
    if (hits.length === 0) return undefined;
    return visible.find((body) => body.object3D === hits[0].object)?.id;
  }

  dispose(): void {
    clearTimeout(this.longPressTimer);
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.domElement.removeEventListener("pointerup", this.onPointerUp);
  }
}
