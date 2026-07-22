import * as THREE from "three";
import type { Observer, ObserverFrame } from "./Observer";
import { BodyIds } from "../astronomy/types";
import type { BodyId, UniverseState } from "../astronomy/types";
import { subVectors } from "../astronomy/vectorMath";
import { eclipticToWorld } from "../astronomy/frames";

/**
 * A stand-in observer fixed at Earth's own center - anticipated by
 * Observer's own doc comment ("EarthCenterObserver... can be added later
 * with no interface change"). Used wherever a sky layer's "recenter the
 * faked-infinite-distance sphere on the viewer" trick (see StarsLayer/
 * MilkyWayPanoramaLayer/ConstellationLinesLayer/CelestialSphereShell/
 * SkyPathLineLayer's getObserver option) is driven by a camera that isn't
 * actually standing at any one GroundObserver's position - i.e. Space
 * View, which orbits Earth's CENTER, not a spot on the surface.
 * Recentering those layers on the real active GroundObserver instead (as
 * Ground View correctly does, since its camera IS essentially there) ties
 * the sky's position to that observer's small EARTH_RADIUS-scale orbit as
 * Earth spins - negligible next to a sky radius of thousands of units when
 * viewed from just above the surface, but readable as visible parallax
 * "vibration" of the star field from Space View's much closer orbit
 * distances (as low as 1.5x EARTH_RADIUS - see OrbitCameraRig's
 * minDistance). See main.ts's getSkyRecenterObserver for the camera-mode
 * switch that picks this over the real active observer.
 */
export class EarthCenterObserver implements Observer {
  readonly id = "earth-center";

  private readonly earthObject3D: THREE.Object3D;

  constructor(earthObject3D: THREE.Object3D) {
    this.earthObject3D = earthObject3D;
  }

  getFrame(): ObserverFrame {
    return {
      worldPosition: this.earthObject3D.getWorldPosition(new THREE.Vector3()),
      up: new THREE.Vector3(0, 1, 0),
    };
  }

  /** Same Earth-center approximation GroundObserver.getDirectionTo already
   *  uses (diurnal parallax is negligible) - see its own doc comment. */
  getDirectionTo(bodyId: BodyId, state: UniverseState): THREE.Vector3 {
    const earth = state.bodies[BodyIds.Earth];
    const body = state.bodies[bodyId];
    if (!earth || !body) {
      throw new Error(`EarthCenterObserver.getDirectionTo: unknown body "${bodyId}"`);
    }
    const relativeEcliptic = subVectors(body.position, earth.position);
    const worldRelative = eclipticToWorld(relativeEcliptic);
    return new THREE.Vector3(worldRelative.x, worldRelative.y, worldRelative.z).normalize();
  }
}
