import * as THREE from "three";

/**
 * Shared "place a rigid prop on the curved Earth surface" math - factored
 * out after the same two-step technique (tangent-plane offset, then
 * renormalize back onto the sphere) was independently written for
 * GroundScatterLayer and is about to be needed a third time for
 * StonehengeLayer. Both callers already derive their own `north`/`east`
 * tangent basis via `geo.ts`'s `computeNorthEast` - these functions take
 * that basis as input rather than recomputing it, so they stay agnostic to
 * whichever origin/frame the caller is working in.
 */

/** Point at a compass bearing/radius from a tangent-plane `origin` - still
 *  OFF the sphere (a straight tangent step from a point on a sphere lands
 *  slightly outside it - a chord, not an arc - see embedOnSphere, which
 *  fixes this). `bearingDeg` is clockwise from north (0 = north, 90 = east),
 *  matching the compass-bearing convention `sunHorizon.ts`/`hengeLayout.ts`
 *  use. */
export function tangentPolarPoint(
  origin: THREE.Vector3,
  north: THREE.Vector3,
  east: THREE.Vector3,
  bearingDeg: number,
  radiusUnits: number,
): THREE.Vector3 {
  const bearingRad = THREE.MathUtils.degToRad(bearingDeg);
  return origin
    .clone()
    .addScaledVector(north, Math.cos(bearingRad) * radiusUnits)
    .addScaledVector(east, Math.sin(bearingRad) * radiusUnits);
}

/** Renormalizes an off-sphere point (e.g. from tangentPolarPoint) back onto
 *  a sphere of `sphereRadius`, then sinks it a further `embedDepth` below
 *  that - two independent fixes bundled into one call:
 *
 *  1. The renormalize itself: a raw tangent-plane offset point sits OUTSIDE
 *     the curved sphere by construction. Left unfixed, this is exactly what
 *     made every GroundScatterLayer prop visibly hover above the ground
 *     instead of sitting on it (found live, via screenshot, before this
 *     function existed) - the same fix ObserverStation.applyLocalDirection
 *     already uses for WASD movement.
 *  2. `embedDepth`: even a prop placed EXACTLY on the sphere still shows a
 *     gap at its own edges, because a rigid flat-bottomed shape doesn't
 *     follow the sphere's curvature across its own footprint. Cheaper than
 *     building actually-curved prop bases - just sink the origin slightly
 *     so that residual gap reads as "sitting in the ground a little"
 *     instead of "floating above it." Pass 0 (the default) to skip this,
 *     e.g. for objects with no meaningful footprint.
 *
 *  Returns the derived "up" direction at the final position too, for
 *  orienting the placed object (`quaternion.setFromUnitVectors(WORLD_UP, up)`). */
export function embedOnSphere(
  offsetPoint: THREE.Vector3,
  sphereRadius: number,
  embedDepth = 0,
): { position: THREE.Vector3; up: THREE.Vector3 } {
  const up = offsetPoint.clone().normalize();
  const position = up.clone().multiplyScalar(sphereRadius - embedDepth);
  return { position, up };
}
