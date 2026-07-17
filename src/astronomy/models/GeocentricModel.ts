import { BodyIds, type AstronomyModel, type BodyState, type PlanetId, type SimulationTime, type UniverseState } from "../types";
import { ellipticalOrbitPosition, inclinedEllipticalOrbitPosition, subVectors } from "../vectorMath";
import {
  EARTH_ARGUMENT_OF_PERIHELION_DEG,
  EARTH_ORBIT_ECCENTRICITY,
  EARTH_ORBIT_PERIOD_DAYS,
  EARTH_ORBIT_RADIUS,
  MOON_ARGUMENT_OF_PERIGEE_DEG,
  MOON_ASCENDING_NODE_DEG_AT_EPOCH,
  MOON_NODAL_REGRESSION_PERIOD_DAYS,
  MOON_ORBIT_ECCENTRICITY,
  MOON_ORBIT_INCLINATION_DEG,
  MOON_ORBIT_PERIOD_DAYS,
  MOON_ORBIT_RADIUS,
  PLANET_ORBITAL_ELEMENTS,
} from "../constants";
import { earthHeliocentricPosition, planetHeliocentricPosition } from "../planetPositions";

// Placeholder display radius shared by every planet marker - unused this
// iteration, same rationale as SUN_BODY_RADIUS/EARTH_BODY_RADIUS/
// MOON_BODY_RADIUS below (schema-only slot, markers are fixed-size dots).
const PLANET_BODY_RADIUS = 1;

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
const IDENTITY_ORIENTATION = { x: 0, y: 0, z: 0, w: 1 };

// Placeholder display radii - unused this iteration (markers are fixed-size
// dots, not true-scale bodies); present only to satisfy BodyState's schema.
// Matches ModernHeliocentricModel's values so swapping models doesn't change
// unrelated rendering.
const SUN_BODY_RADIUS = 10;
const EARTH_BODY_RADIUS = 3;
const MOON_BODY_RADIUS = 1;

const EARTH_ARGUMENT_OF_PERIHELION_RAD = EARTH_ARGUMENT_OF_PERIHELION_DEG * DEG_TO_RAD;
const MOON_ARGUMENT_OF_PERIGEE_RAD = MOON_ARGUMENT_OF_PERIGEE_DEG * DEG_TO_RAD;

/**
 * A Ptolemaic-style geocentric model: Earth fixed at the model origin, Sun
 * on a real (eccentric) elliptical orbit around Earth, Moon on a real
 * elliptical, inclined, node-regressing orbit around Earth - the ancient
 * "everything orbits a stationary Earth" picture, with the same real
 * orbital shapes as ModernHeliocentricModel.
 *
 * The Sun's orbit uses the SAME period, semi-major axis, and eccentricity
 * as ModernHeliocentricModel's Earth-around-Sun orbit, with its argument of
 * periapsis phase-shifted by pi. This is not a coincidence or
 * approximation: ellipticalOrbitPosition(a, e, omega, M) negates exactly
 * under omega -> omega+pi (see vectorMath.ts's doc comment and
 * vectorMath.test.ts's mirror-trick test for the proof), which makes this
 * geocentric Sun's direction-from-Earth algebraically IDENTICAL, for all t,
 * to the heliocentric model's Sun-direction-from-Earth (sun.position -
 * earth.position, with the heliocentric Sun fixed at the origin and Earth
 * orbiting it). Both models predict the exact same apparent sky position -
 * the whole pedagogical point of pairing them. This generalizes the
 * original circular-orbit `angle + pi` trick used before elliptical orbits.
 *
 * The Moon needs no such trick: its orbit is already Earth-relative and
 * never referenced the Sun in ModernHeliocentricModel, so reusing the same
 * inclinedEllipticalOrbitPosition call here (without adding a moving-Earth
 * offset, since Earth is fixed at the origin) reproduces an identical Moon
 * direction automatically.
 *
 * The 5 planets have no such shortcut available: a planet's geocentric
 * position is NOT a simple mirror of anything, since it doesn't orbit Earth
 * on any real ellipse (that's precisely why Ptolemy needed epicycles). So
 * each planet's geocentric position is computed the honest way - its real
 * heliocentric position (planetHeliocentricPosition) minus Earth's real
 * heliocentric position (earthHeliocentricPosition, the same computation the
 * Sun's mirror trick above sidesteps) - real vector subtraction that
 * naturally reproduces retrograde apparent motion for the outer planets.
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

    const earthMeanAnomaly = (time / EARTH_ORBIT_PERIOD_DAYS) * TWO_PI;
    const sun: BodyState = {
      id: BodyIds.Sun,
      parentId: BodyIds.Earth,
      position: ellipticalOrbitPosition(
        EARTH_ORBIT_RADIUS,
        EARTH_ORBIT_ECCENTRICITY,
        EARTH_ARGUMENT_OF_PERIHELION_RAD + Math.PI,
        earthMeanAnomaly,
      ),
      orientation: IDENTITY_ORIENTATION,
      radius: SUN_BODY_RADIUS,
    };

    const moonMeanAnomaly = (time / MOON_ORBIT_PERIOD_DAYS) * TWO_PI;
    const moonAscendingNodeRad = (MOON_ASCENDING_NODE_DEG_AT_EPOCH * DEG_TO_RAD) - (time / MOON_NODAL_REGRESSION_PERIOD_DAYS) * TWO_PI;
    const moon: BodyState = {
      id: BodyIds.Moon,
      parentId: BodyIds.Earth,
      position: inclinedEllipticalOrbitPosition(
        MOON_ORBIT_RADIUS,
        MOON_ORBIT_ECCENTRICITY,
        MOON_ARGUMENT_OF_PERIGEE_RAD,
        moonMeanAnomaly,
        MOON_ORBIT_INCLINATION_DEG,
        moonAscendingNodeRad,
      ),
      orientation: IDENTITY_ORIENTATION,
      radius: MOON_BODY_RADIUS,
    };

    const earthHelio = earthHeliocentricPosition(time);
    const planetBodies = Object.fromEntries(
      Object.entries(PLANET_ORBITAL_ELEMENTS).map(([id, elements]) => {
        const body: BodyState = {
          id: id as PlanetId,
          parentId: BodyIds.Earth,
          position: subVectors(planetHeliocentricPosition(elements, time), earthHelio),
          orientation: IDENTITY_ORIENTATION,
          radius: PLANET_BODY_RADIUS,
        };
        return [id, body];
      }),
    ) as Record<PlanetId, BodyState>;

    return {
      time,
      bodies: {
        [BodyIds.Sun]: sun,
        [BodyIds.Earth]: earth,
        [BodyIds.Moon]: moon,
        ...planetBodies,
      },
    };
  }
}
