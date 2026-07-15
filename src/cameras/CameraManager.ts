import * as THREE from "three";
import { CameraMode } from "./CameraMode";
import type { CameraRig } from "./CameraRig";
import { OrbitCameraRig } from "./OrbitCameraRig";
import { GroundCameraRig } from "./GroundCameraRig";
import type { CameraUpMode } from "./CameraUpMode";
import { EARTH_RADIUS } from "../config/constants";

/** Owns all camera rigs and switches which one is active/rendered. Space is
 *  a single free-roam orbit rig covering everything from a close Earth flyby
 *  out to the celestial-sphere diagram scale - there used to be a second
 *  "Celestial Sphere" mode/rig here, but it was the exact same OrbitCameraRig
 *  with a different zoom-range preset, not a different camera or rendering
 *  path. Its range is folded into Space's below instead of gating content
 *  visibility by which "mode" you're in. */
export class CameraManager {
  private readonly rigs: Record<CameraMode, CameraRig>;
  // Typed separately from `rigs` (rather than cast/instanceof at each call
  // site) since "up mode" is a capability only the free-roam Space rig has -
  // Ground's camera is locked to the observer's real local zenith instead.
  private readonly spaceRig: OrbitCameraRig;
  private mode: CameraMode;

  constructor(getActiveStationObject3D: () => THREE.Object3D, domElement: HTMLElement, initialMode = CameraMode.Space) {
    this.spaceRig = new OrbitCameraRig({
      domElement,
      initialPosition: [EARTH_RADIUS * 3, EARTH_RADIUS * 2, EARTH_RADIUS * 3],
      minDistance: EARTH_RADIUS * 1.5,
      // 200x (not 40x) so the Sun & Moon section's Sun-Earth distance
      // slider (config/constants.ts's SUN_DISTANCE_DEFAULT_RADII, main.ts's
      // setSunDistanceRadii) can actually be zoomed out to and comfortably
      // framed with margin, not just barely reached.
      maxDistance: EARTH_RADIUS * 200,
    });
    this.rigs = {
      [CameraMode.Space]: this.spaceRig,
      [CameraMode.Ground]: new GroundCameraRig(getActiveStationObject3D, domElement),
    };
    this.mode = initialMode;
    this.rigs[this.mode].setActive(true);
  }

  /** Only meaningful in Space View - see the class doc comment on spaceRig. */
  setSpaceUpMode(mode: CameraUpMode): void {
    this.spaceRig.setUpMode(mode);
  }

  getSpaceUpMode(): CameraUpMode {
    return this.spaceRig.getUpMode();
  }

  /** Only meaningful in Space View - see the class doc comment on spaceRig.
   *  Lets the Sun & Moon section's Sun-Earth distance slider (main.ts) keep
   *  the zoom-out range comfortably ahead of the orbit's actual size. */
  setSpaceMaxDistance(distance: number): void {
    this.spaceRig.setMaxDistance(distance);
  }

  /** Only meaningful in Space View - see OrbitCameraRig.setFollowTarget.
   *  Ground View's camera is anchored to the observer station instead and
   *  has no notion of a follow target; setting one here while in Ground
   *  View is harmless and takes effect silently the next time Space View
   *  becomes active. */
  setSpaceFollowTarget(getter: (() => THREE.Vector3) | undefined): void {
    this.spaceRig.setFollowTarget(getter);
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.rigs[this.mode].setActive(false);
    this.mode = mode;
    this.rigs[this.mode].setActive(true);
  }

  /** Suspends/restores the ACTIVE rig's own pointer interaction (e.g.
   *  OrbitControls' drag-to-orbit) so a drag gesture can be repurposed for
   *  observer placement instead - see ObserverDragHandler. */
  setPlacementModeActive(active: boolean): void {
    this.rigs[this.mode].setInteractionEnabled(!active);
  }

  getMode(): CameraMode {
    return this.mode;
  }

  getActiveCamera(): THREE.PerspectiveCamera {
    return this.rigs[this.mode].camera;
  }

  update(): void {
    this.rigs[this.mode].update();
  }

  setAspect(aspect: number): void {
    for (const mode of Object.values(CameraMode)) {
      this.rigs[mode].setAspect(aspect);
    }
  }
}
