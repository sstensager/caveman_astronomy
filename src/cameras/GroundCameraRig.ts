import * as THREE from "three";
import type { CameraRig } from "./CameraRig";
import { GroundLookControls } from "./GroundLookControls";
import { STAR_RADIUS_MAX } from "../config/constants";

// far only needs to comfortably exceed STAR_RADIUS_MAX (the most distant
// thing ever rendered, when the Sky radius slider is dialed up to its
// immersive maximum - stars/Sun/Moon sky markers), not an arbitrary huge
// number. near stays tiny (close terrain/observer proximity at Ground
// View's EARTH_RADIUS=5 scale), which makes the near:far RATIO the thing
// that actually matters for depth-buffer precision - an unnecessarily huge
// far (this used to be 20000) starves that precision budget, which was
// silently near/far-clipping nearby things like another observer's marker
// a couple of units away (see ObserverMarker) even though depthTest is off
// for it - hardware frustum clipping happens before depthTest ever runs, so
// no material setting can rescue a point whose clip-space z fell outside
// [-1,1] due to this precision loss.
const NEAR = 0.05;
const FAR = STAR_RADIUS_MAX * 1.25;

/**
 * "Standing on Earth" camera. Parented under Earth's ground-station anchor,
 * so it rotates rigidly with the planet - the horizon (Earth's surface)
 * stays fixed in the camera's own frame while the world-space star sphere
 * appears to sweep overhead. Local look controls (click-drag) let the
 * observer turn their head; see GroundLookControls for why OrbitControls
 * doesn't work here.
 */
export class GroundCameraRig implements CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private readonly lookControls: GroundLookControls;
  private readonly getActiveStation: () => THREE.Object3D;
  private currentParent?: THREE.Object3D;

  constructor(getActiveStation: () => THREE.Object3D, domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(60, 1, NEAR, FAR);
    this.camera.position.set(0, 0, 0);
    this.getActiveStation = getActiveStation;
    this.syncParent();

    this.lookControls = new GroundLookControls(this.camera, domElement);
  }

  /** Re-parents the camera onto whichever observer is currently active,
   *  cheap no-op in the common case (same station as last frame). Camera's
   *  local position always stays (0,0,0) - reparenting under a THREE.js
   *  Object3D preserves local transform, reinterpreting it in the new
   *  parent's space, which is exactly what's wanted here. */
  private syncParent(): void {
    const station = this.getActiveStation();
    if (station === this.currentParent) return;
    station.add(this.camera);
    this.currentParent = station;
  }

  setActive(active: boolean): void {
    this.lookControls.setActive(active);
  }

  /** Suspends/restores look-drag the same way OrbitCameraRig suspends
   *  orbit-drag - both drag-to-look and drag-to-place-observer are pointer-
   *  drag gestures on the same element, so they'd otherwise fight over the
   *  same event. WASD movement (GroundMoveControls) is unaffected either
   *  way, since it isn't a pointer gesture. */
  setInteractionEnabled(enabled: boolean): void {
    this.lookControls.setActive(enabled);
  }

  update(): void {
    this.syncParent();
    this.lookControls.update();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
