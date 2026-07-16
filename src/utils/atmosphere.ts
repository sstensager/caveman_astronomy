import * as THREE from "three";

/**
 * Ground-observer sky day/night blend, expressed purely as a function of two
 * world-space directions - the observer's local zenith ("up") and the
 * current Sun direction (both already computed once per frame in main.ts's
 * render loop, the same inputs ContinentsLayer's ground terminator uses).
 * Kept THREE.Vector3-based (not the plain {x,y,z} convention vectorMath.ts
 * uses for ephemeris math) since both call sites already hold live
 * THREE.Vector3 instances - see hemisphereFade.ts for the same style choice
 * on a different, unrelated fade concept (do not confuse the two: that one
 * fades stars by camera-relative hemisphere in the Celestial Sphere view,
 * this one fades/tints by the observer's actual day/night state).
 */

/** 0 = sun fully below the observer's horizon (night), 1 = fully above
 *  (day), smoothstepped across a +-softness dot-product band around the
 *  horizon (dot === 0) instead of an instant flip. */
export function computeDayFactor(observerUp: THREE.Vector3, sunDirectionWorld: THREE.Vector3, softness: number): number {
  const dot = observerUp.dot(sunDirectionWorld);
  const t = THREE.MathUtils.clamp(dot / (2 * softness) + 0.5, 0, 1);
  return t * t * (3 - 2 * t);
}

/** 0..1, peaked at 1 exactly when the sun sits at the observer's horizon
 *  (dot === 0) and falling to 0 once |dot| >= band - a symmetric window
 *  around sunrise/sunset with no directional distinction between the two,
 *  independent of computeDayFactor's own softness so the two widths can be
 *  tuned separately. */
export function computeSunsetFactor(observerUp: THREE.Vector3, sunDirectionWorld: THREE.Vector3, band: number): number {
  const dot = observerUp.dot(sunDirectionWorld);
  const t = THREE.MathUtils.clamp(Math.abs(dot) / band, 0, 1);
  return 1 - t * t * (3 - 2 * t);
}
