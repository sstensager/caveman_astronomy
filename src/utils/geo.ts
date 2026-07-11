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
