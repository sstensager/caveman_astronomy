import * as THREE from "three";
import type { Observer, ObserverFrame } from "./Observer";
import { BodyIds } from "../astronomy/types";
import type { BodyId, UniverseState, Vector3Like } from "../astronomy/types";
import { computeNorthEast } from "../utils/geo";
import { subVectors } from "../astronomy/vectorMath";
import { eclipticToWorld } from "../astronomy/frames";

const WORLD_POLAR_AXIS = new THREE.Vector3(0, 1, 0);

function toVector3(v: Vector3Like): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

/**
 * An observer standing on Earth's surface, wired to a live, spin-affected
 * ground-station transform (an ObserverStation's object3D) for its local
 * horizon frame (up/north/east). `id` is a constructor param rather than a
 * fixed literal so multiple independent observers can coexist. Direction-
 * to-body approximates the observer's position as Earth's model center -
 * diurnal parallax is negligible for the Sun and small (~1deg max) for the
 * Moon, an acceptable simplification for a non-ephemeris tool, and means
 * different observer stations currently see identical body directions
 * (positional parallax between stations is not modeled). `getFrame().
 * worldPosition` remains the correct extension point if a future teaching
 * layer wants to demonstrate parallax explicitly.
 */
export class GroundObserver implements Observer {
  readonly id: string;

  private readonly groundStation: THREE.Object3D;

  constructor(id: string, groundStation: THREE.Object3D) {
    this.id = id;
    this.groundStation = groundStation;
  }

  getFrame(): ObserverFrame {
    const worldPosition = this.groundStation.getWorldPosition(new THREE.Vector3());
    const worldQuaternion = this.groundStation.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQuaternion).normalize();
    const { north, east } = computeNorthEast(up, WORLD_POLAR_AXIS);
    return { worldPosition, up, north, east };
  }

  getDirectionTo(bodyId: BodyId, state: UniverseState): THREE.Vector3 {
    const earth = state.bodies[BodyIds.Earth];
    const body = state.bodies[bodyId];
    if (!earth || !body) {
      throw new Error(`GroundObserver.getDirectionTo: unknown body "${bodyId}"`);
    }
    // Models express position in the ecliptic frame (see vectorMath.ts) -
    // rotate into the fixed world/equatorial frame every other direction
    // (stars, this observer's own up/north/east) already uses before
    // treating it as a world-space direction. See frames.ts's doc comment.
    const relativeEcliptic = subVectors(body.position, earth.position);
    return toVector3(eclipticToWorld(relativeEcliptic)).normalize();
  }
}
