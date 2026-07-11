import type { Vector3Like } from "./types";

// Small, pure Vector3Like helpers so models never need THREE.Vector3 (which
// is mutable and explicitly disallowed in the domain layer - see types.ts).

export function addVectors(a: Vector3Like, b: Vector3Like): Vector3Like {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subVectors(a: Vector3Like, b: Vector3Like): Vector3Like {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function length(v: Vector3Like): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Position on a circular orbit of the given radius at the given angle,
 * measured in the X-Z plane (Y is the "north pole" axis, matching
 * utils/geo.ts's latLonToSurfacePoint convention). This is the model's
 * shared notion of "the ecliptic plane" - Earth's orbit uses this directly.
 */
export function circularOrbitPosition(radius: number, angleRad: number): Vector3Like {
  return { x: radius * Math.cos(angleRad), y: 0, z: radius * Math.sin(angleRad) };
}

/**
 * Position on a circular orbit tilted by `inclinationDeg` relative to the
 * X-Z ecliptic plane (rotated about the X axis) - used for the Moon's orbit,
 * whose plane is inclined relative to Earth's orbital plane rather than
 * permanently coincident with it.
 */
export function inclinedOrbitPosition(radius: number, angleRad: number, inclinationDeg: number): Vector3Like {
  const flat = circularOrbitPosition(radius, angleRad);
  const inclinationRad = (inclinationDeg * Math.PI) / 180;
  return {
    x: flat.x,
    y: -flat.z * Math.sin(inclinationRad),
    z: flat.z * Math.cos(inclinationRad),
  };
}
