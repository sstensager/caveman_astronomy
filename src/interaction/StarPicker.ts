import * as THREE from "three";
import type { StarRecord } from "../astronomy/starCatalog";
import { POINTS_PICK_THRESHOLD_RATIO } from "../config/constants";

const CLICK_DRAG_THRESHOLD_PX = 5;

export interface PickableStars {
  readonly object3D: THREE.Points;
  getStarAt(index: number): StarRecord | undefined;
}

/**
 * Click-to-select stars: raycasts against one or more THREE.Points targets
 * on click (not drag), resolving hits back to StarRecords via each target's
 * getStarAt(). Distinguishes click from drag by pointerdown/pointerup
 * position delta, mirroring GroundLookControls' own dragging-flag pattern.
 * This listener never calls stopPropagation, so it coexists with
 * OrbitControls/GroundLookControls' own pointer handling on the same canvas.
 *
 * Per-target raycast threshold: THREE.Points.raycast() divides
 * raycaster.params.Points.threshold by the object's average scale to get a
 * LOCAL threshold (see three/src/objects/Points.js). Since every StarsLayer
 * builds its geometry at unit radius regardless of display radius, setting
 * threshold = object3D.scale.x * POINTS_PICK_THRESHOLD_RATIO always yields
 * the same local threshold (= POINTS_PICK_THRESHOLD_RATIO) - i.e. the same
 * angular pick tolerance on both the sky-scale (radius 2000) and globe-scale
 * (radius 25) star fields, despite their ~80x difference in display radius.
 */
export class StarPicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private downX = 0;
  private downY = 0;

  private readonly getCamera: () => THREE.Camera;
  private readonly domElement: HTMLElement;
  private readonly targets: PickableStars[];
  private readonly onSelect: (star: StarRecord | undefined, worldPosition: THREE.Vector3 | undefined) => void;

  constructor(
    getCamera: () => THREE.Camera,
    domElement: HTMLElement,
    targets: PickableStars[],
    onSelect: (star: StarRecord | undefined, worldPosition: THREE.Vector3 | undefined) => void,
  ) {
    this.getCamera = getCamera;
    this.domElement = domElement;
    this.targets = targets;
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

    let closest: { distance: number; star: StarRecord; point: THREE.Vector3 } | undefined;
    for (const target of this.targets) {
      if (!target.object3D.visible) continue;
      this.raycaster.params.Points = { threshold: target.object3D.scale.x * POINTS_PICK_THRESHOLD_RATIO };
      const hits = this.raycaster.intersectObject(target.object3D, false);
      if (hits.length === 0) continue;
      const hit = hits[0];
      if (hit.index === undefined) continue;
      const star = target.getStarAt(hit.index);
      if (!star) continue;
      if (!closest || hit.distance < closest.distance) {
        closest = { distance: hit.distance, star, point: hit.point };
      }
    }

    this.onSelect(closest?.star, closest?.point);
  }

  dispose(): void {
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.domElement.removeEventListener("pointerup", this.onPointerUp);
  }
}
