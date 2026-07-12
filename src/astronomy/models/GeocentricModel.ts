import { BodyIds, type AstronomyModel, type BodyState, type SimulationTime, type UniverseState } from "../types";
import { circularOrbitPosition, inclinedOrbitPosition } from "../vectorMath";
import {
  EARTH_ORBIT_PERIOD_DAYS,
  EARTH_ORBIT_RADIUS,
  MOON_ORBIT_INCLINATION_DEG,
  MOON_ORBIT_PERIOD_DAYS,
  MOON_ORBIT_RADIUS,
} from "../constants";

const TWO_PI = Math.PI * 2;
const IDENTITY_ORIENTATION = { x: 0, y: 0, z: 0, w: 1 };

// Placeholder display radii - unused this iteration (markers are fixed-size
// dots, not true-scale bodies); present only to satisfy BodyState's schema.
// Matches ModernHeliocentricModel's values so swapping models doesn't change
// unrelated rendering.
const SUN_BODY_RADIUS = 10;
const EARTH_BODY_RADIUS = 3;
const MOON_BODY_RADIUS = 1;

/**
 * A Ptolemaic-style geocentric model: Earth fixed at the model origin, Sun
 * on a circular orbit around Earth, Moon on a circular, inclined orbit
 * around Earth - the ancient "everything orbits a stationary Earth" picture.
 *
 * The Sun's orbit uses the SAME period and radius as
 * ModernHeliocentricModel's Earth-around-Sun orbit, phase-shifted by pi.
 * This is not a coincidence or approximation: circularOrbitPosition(R, angle)
 * is an odd/even function of angle under a pi shift (cos(a+pi)=-cos(a),
 * sin(a+pi)=-sin(a)), which makes this geocentric Sun's direction-from-Earth
 * algebraically IDENTICAL, for all t, to the heliocentric model's
 * Sun-direction-from-Earth (sun.position - earth.position, with the
 * heliocentric Sun fixed at the origin and Earth orbiting it). Both models
 * predict the exact same apparent sky position - the whole pedagogical
 * point of pairing them.
 *
 * The Moon needs no such trick: its orbit is already Earth-relative and
 * never referenced the Sun in ModernHeliocentricModel, so reusing the same
 * inclinedOrbitPosition formula here (without adding a moving-Earth offset,
 * since Earth is fixed at the origin) reproduces an identical Moon direction
 * automatically.
 */
export class GeocentricModel implements AstronomyModel {
  readonly id = "geocentric";
  readonly name = "Geocentric";

  getState(time: SimulationTime): UniverseState {
    const earth: BodyState = {
      id: BodyIds.Earth,
      position: { x: 0, y: 0, z: 0 },
      orientation: IDENTITY_ORIENTATION,
      radius: EARTH_BODY_RADIUS,
    };

    const earthAngle = (time / EARTH_ORBIT_PERIOD_DAYS) * TWO_PI;
    const sun: BodyState = {
      id: BodyIds.Sun,
      parentId: BodyIds.Earth,
      position: circularOrbitPosition(EARTH_ORBIT_RADIUS, earthAngle + Math.PI),
      orientation: IDENTITY_ORIENTATION,
      radius: SUN_BODY_RADIUS,
    };

    const moonAngle = (time / MOON_ORBIT_PERIOD_DAYS) * TWO_PI;
    const moon: BodyState = {
      id: BodyIds.Moon,
      parentId: BodyIds.Earth,
      position: inclinedOrbitPosition(MOON_ORBIT_RADIUS, moonAngle, MOON_ORBIT_INCLINATION_DEG),
      orientation: IDENTITY_ORIENTATION,
      radius: MOON_BODY_RADIUS,
    };

    return {
      time,
      bodies: {
        [BodyIds.Sun]: sun,
        [BodyIds.Earth]: earth,
        [BodyIds.Moon]: moon,
      },
    };
  }
}
