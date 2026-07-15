import * as THREE from "three";

const CLICK_DRAG_THRESHOLD_PX = 5;

export interface TargetableBody {
  id: string;
  label: string;
  object3D: THREE.Object3D;
}

/**
 * Click-to-target: raycasts against a fixed set of body meshes (Sun, Moon,
 * Earth - see main.ts's targetableBodies) on click (not drag), same
 * click-vs-drag distinction as StarPicker, so this coexists with
 * OrbitControls' own drag-to-orbit on the same canvas without either
 * fighting the other for a plain click.
 *
 * Clicking a body reports its id; clicking anywhere else (empty space, a
 * star, an observer marker, or a body currently hidden by its own layer
 * toggle) reports `undefined` - main.ts treats that as "release whatever's
 * currently targeted," so a plain click-out is enough to unlock camera
 * tracking with no separate confirmation step. See
 * OrbitCameraRig.setFollowTarget for what a target id actually does to the
 * camera.
 */
export class BodyTargetPicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private downX = 0;
  private downY = 0;

  private readonly getCamera: () => THREE.Camera;
  private readonly domElement: HTMLElement;
  private readonly bodies: TargetableBody[];
  private readonly onSelect: (bodyId: string | undefined) => void;

  constructor(
    getCamera: () => THREE.Camera,
    domElement: HTMLElement,
    bodies: TargetableBody[],
    onSelect: (bodyId: string | undefined) => void,
  ) {
    this.getCamera = getCamera;
    this.domElement = domElement;
    this.bodies = bodies;
    this.onSelect = onSelect;
    this.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.domElement.addEventListener("pointerup", this.onPointerUp);
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.downX = event.clientX;
    this.downY = event.clientY;
  };

  private onPointerUp = (event: PointerEvent): void => {
    const dx = event.clientX - this.downX;
    const dy = event.clientY - this.downY;
    if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) return;
    this.pick(event);
  };

  private pick(event: PointerEvent): void {
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
    if (hits.length === 0) {
      this.onSelect(undefined);
      return;
    }
    const hitBody = visible.find((body) => body.object3D === hits[0].object);
    this.onSelect(hitBody?.id);
  }

  dispose(): void {
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.domElement.removeEventListener("pointerup", this.onPointerUp);
  }
}
