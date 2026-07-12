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

/**
 * Eccentric anomaly E solving Kepler's equation M = E - e*sin(E), via
 * Newton-Raphson. Converges in only a few iterations for the low
 * eccentricities used here (Earth ~0.017, Moon ~0.055) - 10 is a generous
 * cap, not a tuned requirement.
 */
function solveKeplerEquation(meanAnomalyRad: number, eccentricity: number): number {
  let E = meanAnomalyRad;
  for (let i = 0; i < 10; i++) {
    const delta = (E - eccentricity * Math.sin(E) - meanAnomalyRad) / (1 - eccentricity * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return E;
}

/**
 * Position on a Kepler ellipse in the X-Z plane (Y=0), generalizing
 * circularOrbitPosition (identical to it when eccentricity=0). `semiMajorAxis`
 * is `a`; the orbited focus sits at the origin, matching real two-body
 * orbits (Sun at a focus of Earth's orbit, not its center).
 * `argumentOfPeriapsisRad` orients the ellipse within the plane the same way
 * circularOrbitPosition's angle does for a circle - a pure angle offset.
 *
 * Negating this function's output is itself always a valid Kepler ellipse of
 * the SAME shape with a focus at the origin, achieved exactly by
 * ellipticalOrbitPosition(a, e, argumentOfPeriapsisRad + PI, meanAnomalyRad) -
 * see GeocentricModel's Sun position, which relies on this to keep the
 * apparent Sun direction identical to ModernHeliocentricModel's, the same
 * way the old circular-orbit `angle + PI` trick did for circular orbits.
 */
export function ellipticalOrbitPosition(
  semiMajorAxis: number,
  eccentricity: number,
  argumentOfPeriapsisRad: number,
  meanAnomalyRad: number,
): Vector3Like {
  const E = solveKeplerEquation(meanAnomalyRad, eccentricity);
  // Perifocal-frame coordinates (x toward periapsis, y 90 degrees ahead in
  // the direction of motion).
  const xPerifocal = semiMajorAxis * (Math.cos(E) - eccentricity);
  const yPerifocal = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(E);
  const cosOmega = Math.cos(argumentOfPeriapsisRad);
  const sinOmega = Math.sin(argumentOfPeriapsisRad);
  return {
    x: xPerifocal * cosOmega - yPerifocal * sinOmega,
    y: 0,
    z: xPerifocal * sinOmega + yPerifocal * cosOmega,
  };
}

/**
 * Full classical-orbital-elements position: an elliptical orbit
 * (semiMajorAxis, eccentricity, argumentOfPeriapsisRad, meanAnomalyRad, as
 * in ellipticalOrbitPosition) additionally inclined by `inclinationDeg`
 * about the X axis (as inclinedOrbitPosition does) and then precessed by
 * rotating the whole tilted orbit about the pole (Y axis) by
 * `ascendingNodeRad` - this is what lets the Moon's ascending node regress
 * over time (see MOON_NODAL_REGRESSION_PERIOD_DAYS) instead of staying
 * fixed along +X forever. `ascendingNodeRad` defaults to 0, reducing this
 * exactly to inclinedOrbitPosition's fixed-node behavior when omitted.
 */
export function inclinedEllipticalOrbitPosition(
  semiMajorAxis: number,
  eccentricity: number,
  argumentOfPeriapsisRad: number,
  meanAnomalyRad: number,
  inclinationDeg: number,
  ascendingNodeRad = 0,
): Vector3Like {
  const flat = ellipticalOrbitPosition(semiMajorAxis, eccentricity, argumentOfPeriapsisRad, meanAnomalyRad);
  const inclinationRad = (inclinationDeg * Math.PI) / 180;
  const tilted = {
    x: flat.x,
    y: -flat.z * Math.sin(inclinationRad),
    z: flat.z * Math.cos(inclinationRad),
  };
  if (ascendingNodeRad === 0) return tilted;
  const cosNode = Math.cos(ascendingNodeRad);
  const sinNode = Math.sin(ascendingNodeRad);
  return {
    x: tilted.x * cosNode + tilted.z * sinNode,
    y: tilted.y,
    z: -tilted.x * sinNode + tilted.z * cosNode,
  };
}
