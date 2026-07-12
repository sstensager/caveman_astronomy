import * as THREE from "three";
import { computeNorthEast, latLonToSurfacePoint, surfacePointToLatLon } from "../utils/geo";
import { EARTH_RADIUS, OBSERVER_HEIGHT } from "../config/constants";

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_POLAR_AXIS = new THREE.Vector3(0, 1, 0);

export interface ObserverStationOptions {
  id: string;
  label: string;
  latDeg: number;
  lonDeg: number;
  heightAboveSurface?: number;
}

/**
 * A single observer's position on Earth's surface, owned independently of
 * EarthBase - multiple instances can coexist, each self-parenting into
 * whatever rotationGroup-like Object3D is passed in (same pattern as
 * AxisLayer), so they all inherit Earth's spin correctly without EarthBase
 * needing to know how many observers exist.
 *
 * Position is the single source of truth (no separately-cached lat/lon) -
 * setLatLon, setLocalSurfacePoint, and moveTangent all funnel through
 * applyLocalDirection, and getLatLon derives from the live position via
 * surfacePointToLatLon. This avoids state ever drifting out of sync.
 */
export class ObserverStation {
  readonly id: string;
  label: string;
  readonly object3D: THREE.Object3D;
  private readonly radius: number;

  constructor(parent: THREE.Object3D, options: ObserverStationOptions) {
    this.id = options.id;
    this.label = options.label;
    this.radius = EARTH_RADIUS + (options.heightAboveSurface ?? OBSERVER_HEIGHT);

    this.object3D = new THREE.Object3D();
    this.object3D.name = `ObserverStation.${options.id}`;
    parent.add(this.object3D);

    this.setLatLon(options.latDeg, options.lonDeg);
  }

  private applyLocalDirection(direction: THREE.Vector3): void {
    const normal = direction.clone().normalize();
    this.object3D.position.copy(normal).multiplyScalar(this.radius);
    this.object3D.quaternion.setFromUnitVectors(WORLD_UP, normal);
  }

  setLatLon(latDeg: number, lonDeg: number): void {
    this.applyLocalDirection(latLonToSurfacePoint(latDeg, lonDeg, 1));
  }

  getLatLon(): { latDeg: number; lonDeg: number } {
    return surfacePointToLatLon(this.object3D.position);
  }

  /** Renormalizes `point` (in this station's PARENT's local space, e.g. a
   *  raycast hit transformed via parent.worldToLocal) onto this station's
   *  fixed radius and repositions there - used by drag-to-place. */
  setLocalSurfacePoint(point: THREE.Vector3): void {
    this.applyLocalDirection(point);
  }

  getLocalSurfacePoint(): THREE.Vector3 {
    return this.object3D.position.clone();
  }

  /** WASD-style tangent-plane step: displaces along the station's own
   *  local north/east by the given deltas, then reprojects onto the
   *  sphere. Operates in local (pre-spin) space - local +Y is the polar
   *  axis regardless of the parent's current spin angle, so this is valid
   *  even while Earth is rotating. Geographic-relative (always moves
   *  toward true north/east regardless of which way the observer is
   *  facing) - see moveInLocalDirection for camera-relative movement. */
  moveTangent(forwardDelta: number, eastDelta: number): void {
    const up = this.object3D.position.clone().normalize();
    const { north, east } = computeNorthEast(up, LOCAL_POLAR_AXIS);
    const displaced = this.object3D.position
      .clone()
      .addScaledVector(north, forwardDelta)
      .addScaledVector(east, eastDelta);
    this.applyLocalDirection(displaced);
  }

  /** Displaces the station by `distance` along an arbitrary LOCAL-space
   *  direction (e.g. the ground camera's own current facing, projected
   *  onto the horizontal plane), then reprojects onto the sphere. This is
   *  what makes WASD camera-relative: the caller supplies "whichever way
   *  I'm currently looking" instead of a fixed geographic direction. */
  moveInLocalDirection(direction: THREE.Vector3, distance: number): void {
    const displaced = this.object3D.position.clone().addScaledVector(direction, distance);
    this.applyLocalDirection(displaced);
  }
}
