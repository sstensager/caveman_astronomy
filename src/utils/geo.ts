import * as THREE from "three";

/** Point on a sphere of the given radius for a lat/lon in degrees. */
export function latLonToSurfacePoint(latDeg: number, lonDeg: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - latDeg); // polar angle from +Y
  const theta = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Inverse of latLonToSurfacePoint - radius-agnostic, only direction matters. */
export function surfacePointToLatLon(point: THREE.Vector3): { latDeg: number; lonDeg: number } {
  const n = point.clone().normalize();
  const phi = Math.acos(THREE.MathUtils.clamp(n.y, -1, 1));
  return {
    latDeg: 90 - THREE.MathUtils.radToDeg(phi),
    lonDeg: THREE.MathUtils.radToDeg(Math.atan2(n.z, n.x)),
  };
}

/** North/east tangent-plane basis at a given "up" direction, derived by
 *  projecting `polarAxis` onto the tangent plane at `up`. Degenerate near
 *  the poles (up parallel to polarAxis) falls back to an arbitrary tangent
 *  rather than NaN. East completes a right-handed (East, North, Up) frame:
 *  Up x North = East. Shared by GroundObserver (world-space frame) and
 *  ObserverStation (local-space tangent movement) - same math, different
 *  space, since local +Y is the polar axis regardless of parent spin. */
export function computeNorthEast(
  up: THREE.Vector3,
  polarAxis: THREE.Vector3,
): { north: THREE.Vector3; east: THREE.Vector3 } {
  const northCandidate = polarAxis.clone().sub(up.clone().multiplyScalar(polarAxis.dot(up)));
  const north = northCandidate.lengthSq() > 1e-8 ? northCandidate.normalize() : new THREE.Vector3(1, 0, 0);
  const east = new THREE.Vector3().crossVectors(up, north).normalize();
  return { north, east };
}
