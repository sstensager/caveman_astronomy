import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CameraRig } from "./CameraRig";
import { CameraUpMode } from "./CameraUpMode";
import { ECLIPTIC_POLE_IN_WORLD } from "../astronomy/frames";

const EQUATORIAL_UP = new THREE.Vector3(0, 1, 0);
const ECLIPTIC_UP = new THREE.Vector3(ECLIPTIC_POLE_IN_WORLD.x, ECLIPTIC_POLE_IN_WORLD.y, ECLIPTIC_POLE_IN_WORLD.z);

// Per-frame ease-in factor for controls.target chasing a follow target's
// live position (see setFollowTarget) - NOT OrbitControls' own
// dampingFactor, which only smooths user rotate/zoom input, never a
// target set externally. Small enough to read as a deliberate swing-to-
// center over several frames on the initial jump to a far body, close
// enough to 1 that it's imperceptible lag once actually tracking a slowly
// orbiting body frame to frame.
const FOLLOW_TARGET_EASE = 0.12;

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
 * entity, so it stays fixed in world space. Backs Space View - see
 * CameraManager.
 */
export class OrbitCameraRig implements CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  private readonly domElement: HTMLElement;
  private readonly minDistance: number;
  // NOT readonly - see setMaxDistance(), which lets the Sun & Moon section's
  // Sun-Earth distance slider (main.ts's setSunDistanceRadii) keep the
  // zoom-out range in sync as the orbit itself grows/shrinks, without
  // needing a full controls rebuild.
  private maxDistance: number;
  private upMode: CameraUpMode = CameraUpMode.Equatorial;
  private followTargetGetter?: () => THREE.Vector3;
  private lookAtTargetGetter?: () => THREE.Vector3;

  constructor(options: OrbitCameraRigOptions) {
    this.camera = new THREE.PerspectiveCamera(options.fov ?? 50, 1, options.near ?? 0.1, options.far ?? 20000);
    this.camera.position.set(...options.initialPosition);
    this.domElement = options.domElement;
    this.minDistance = options.minDistance;
    this.maxDistance = options.maxDistance;

    this.controls = this.createControls();
  }

  private createControls(): OrbitControls {
    const controls = new OrbitControls(this.camera, this.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = this.minDistance;
    controls.maxDistance = this.maxDistance;
    controls.enabled = false;
    controls.update();
    return controls;
  }

  /** Switches which fixed world direction reads as "up" on screen -
   *  Equatorial (world +Y, Polaris/spin-axis - the default) or Ecliptic
   *  (the fixed ecliptic pole from astronomy/frames.ts). OrbitControls
   *  derives its spherical-coordinate math from a quaternion computed from
   *  camera.up at construction time, so mutating camera.up on a live
   *  instance doesn't re-orient anything by itself - the controls instance
   *  has to be rebuilt. Camera position and orbit target are carried over
   *  so the view doesn't jump; only the on-screen "roll" (which direction
   *  reads as vertical) changes. */
  setUpMode(mode: CameraUpMode): void {
    if (mode === this.upMode) return;
    this.upMode = mode;
    this.camera.up.copy(mode === CameraUpMode.Ecliptic ? ECLIPTIC_UP : EQUATORIAL_UP);

    const wasEnabled = this.controls.enabled;
    const target = this.controls.target.clone();
    this.controls.dispose();
    this.controls = this.createControls();
    this.controls.target.copy(target);
    this.controls.enabled = wasEnabled;
    this.controls.update();
  }

  getUpMode(): CameraUpMode {
    return this.upMode;
  }

  /** Live zoom-out range change - unlike setUpMode, OrbitControls reads
   *  `maxDistance` fresh each update() call (no cached quaternion issue),
   *  so mutating the live controls instance directly is enough - no
   *  dispose/rebuild needed. Also updates the stored field so a LATER
   *  setUpMode rebuild (which reads `this.maxDistance` in createControls())
   *  doesn't silently revert to the original constructor value. */
  setMaxDistance(distance: number): void {
    this.maxDistance = distance;
    this.controls.maxDistance = distance;
  }

  /** "Center on and follow this body" - see main.ts's BodyTargetPicker/
   *  setAnchorBody. Each update() eases controls.target toward the
   *  getter's current world position instead of snapping instantly, which
   *  reads as the camera smoothly swinging to re-center on the body while
   *  preserving whatever distance/angle the user was already viewing from:
   *  OrbitControls reconstructs camera.position from target + its existing
   *  spherical offset every update(), so translating target translates the
   *  camera rigidly with it - no separate camera-position math needed
   *  here, and the user's own drag-to-orbit/zoom keeps working normally
   *  around the moving target. Pass undefined to release tracking; the
   *  target is left wherever it last eased to, matching a manual
   *  escape/click-away release leaving the view exactly where it is. */
  setFollowTarget(getter: (() => THREE.Vector3) | undefined): void {
    this.followTargetGetter = getter;
  }

  /** Independent of setFollowTarget: while the follow target (if any) drives
   *  controls.target - i.e. WHERE the camera orbits around/sits relative to
   *  - this drives WHERE the camera actually points, overriding the
   *  lookAt(target) that controls.update() performs internally every frame.
   *  Lets you anchor position near one body (e.g. orbit-drag out from the
   *  Sun) while facing a completely different one (e.g. Earth, to watch its
   *  day/night terminator). Safe to override camera.quaternion like this
   *  because OrbitControls' own spherical state (used to derive next
   *  frame's camera.position from drag deltas) never reads camera.quaternion
   *  back - only controls.target and its accumulated spherical offset - so
   *  this doesn't corrupt future drag/zoom behavior. Pass undefined to
   *  release, leaving the camera facing wherever it last pointed (matching
   *  setFollowTarget's own release behavior). */
  setLookAtTarget(getter: (() => THREE.Vector3) | undefined): void {
    this.lookAtTargetGetter = getter;
  }

  setActive(active: boolean): void {
    this.controls.enabled = active;
  }

  // Reclaims the idle cursor when enabled, mirroring GroundCameraRig - see
  // ObserverDragHandler for why "pointer"/"grabbing" are only ever actively
  // claimed, never reset to "default" directly, which would otherwise leave
  // whichever cursor was showing stuck after the drag/hover ends.
  setInteractionEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
    if (enabled) this.domElement.style.cursor = "default";
  }

  update(): void {
    if (this.followTargetGetter) {
      this.controls.target.lerp(this.followTargetGetter(), FOLLOW_TARGET_EASE);
    }
    this.controls.update();
    if (this.lookAtTargetGetter) {
      this.camera.lookAt(this.lookAtTargetGetter());
    }
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
