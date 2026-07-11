import * as THREE from "three";
import type { Observer, ObserverFrame } from "./Observer";
import { BodyIds } from "../astronomy/types";
import type { BodyId, UniverseState, Vector3Like } from "../astronomy/types";

const WORLD_POLAR_AXIS = new THREE.Vector3(0, 1, 0);

function toVector3(v: Vector3Like): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

/**
 * An observer standing on Earth's surface, wired to EarthBase's live,
 * spin-affected groundStation transform for its local horizon frame (up/
 * north/east). Direction-to-body approximates the observer's position as
 * Earth's model center - diurnal parallax is negligible for the Sun and
 * small (~1deg max) for the Moon, an acceptable simplification for a
 * non-ephemeris tool. `getFrame().worldPosition` remains the correct
 * extension point if a future teaching layer wants to demonstrate parallax
 * explicitly.
 */
export class GroundObserver implements Observer {
  readonly id = "ground";

  private readonly groundStation: THREE.Object3D;

  constructor(groundStation: THREE.Object3D) {
    this.groundStation = groundStation;
  }

  getFrame(): ObserverFrame {
    const worldPosition = this.groundStation.getWorldPosition(new THREE.Vector3());
    const worldQuaternion = this.groundStation.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQuaternion).normalize();

    // North: project the world polar axis onto the tangent plane at this
    // point. Degenerate exactly at the poles (up parallel to the polar
    // axis); falls back to an arbitrary tangent there rather than NaN.
    const northCandidate = WORLD_POLAR_AXIS.clone().sub(up.clone().multiplyScalar(WORLD_POLAR_AXIS.dot(up)));
    const north = northCandidate.lengthSq() > 1e-8 ? northCandidate.normalize() : new THREE.Vector3(1, 0, 0);

    // East completes a right-handed (East, North, Up) frame: Up x North = East.
    const east = new THREE.Vector3().crossVectors(up, north).normalize();

    return { worldPosition, up, north, east };
  }

  getDirectionTo(bodyId: BodyId, state: UniverseState): THREE.Vector3 {
    const earth = state.bodies[BodyIds.Earth];
    const body = state.bodies[bodyId];
    if (!earth || !body) {
      throw new Error(`GroundObserver.getDirectionTo: unknown body "${bodyId}"`);
    }
    return toVector3(body.position).sub(toVector3(earth.position)).normalize();
  }
}
