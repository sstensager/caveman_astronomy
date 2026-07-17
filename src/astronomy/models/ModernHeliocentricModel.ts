import { BodyIds, type AstronomyModel, type BodyState, type PlanetId, type SimulationTime, type UniverseState } from "../types";
import { addVectors, ellipticalOrbitPosition, inclinedEllipticalOrbitPosition } from "../vectorMath";
import {
  EARTH_ARGUMENT_OF_PERIHELION_DEG,
  EARTH_AXIAL_TILT_DEG,
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
import { planetHeliocentricPosition } from "../planetPositions";

// Placeholder display radius shared by every planet marker - unused this
// iteration, same rationale as SUN_BODY_RADIUS/EARTH_BODY_RADIUS/
// MOON_BODY_RADIUS below (schema-only slot, markers are fixed-size dots).
const PLANET_BODY_RADIUS = 1;

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
const IDENTITY_ORIENTATION = { x: 0, y: 0, z: 0, w: 1 };

// Placeholder display radii - unused this iteration (markers are fixed-size
// dots, not true-scale bodies); present only to satisfy BodyState's schema.
const SUN_BODY_RADIUS = 10;
const EARTH_BODY_RADIUS = 3;
const MOON_BODY_RADIUS = 1;

const earthTiltRad = (EARTH_AXIAL_TILT_DEG * Math.PI) / 180;
// Unused this iteration - EarthBase's own render-space spin is the sole
// source of diurnal rotation today. Present as an architecture slot for a
// future model (e.g. tidally-locked Earth) that needs to drive spin from
// model state; see the "known future fork" note in EarthBase.ts.
const EARTH_ROTATION_AXIS = { x: Math.sin(earthTiltRad), y: Math.cos(earthTiltRad), z: 0 };

const EARTH_ARGUMENT_OF_PERIHELION_RAD = EARTH_ARGUMENT_OF_PERIHELION_DEG * DEG_TO_RAD;
const MOON_ARGUMENT_OF_PERIGEE_RAD = MOON_ARGUMENT_OF_PERIGEE_DEG * DEG_TO_RAD;

/**
 * A simplified but consistent modern heliocentric model: Sun fixed near the
 * model origin, Earth on a real (eccentric) elliptical orbit around it,
 * Moon on a real elliptical, inclined orbit around Earth's current
 * position, with the Moon's ascending node regressing over time (real
 * ~18.6yr period) so eclipse-favorable alignments cycle realistically
 * instead of recurring every orbit. Distances are not to physical scale -
 * see astronomy/constants.ts for the documented simplifications;
 * eccentricities and the nodal regression rate ARE real values.
 */
export class ModernHeliocentricModel implements AstronomyModel {
  readonly id = "modern-heliocentric";
  readonly name = "Modern Heliocentric";

  getState(time: SimulationTime): UniverseState {
    const sun: BodyState = {
      id: BodyIds.Sun,
      position: { x: 0, y: 0, z: 0 },
      orientation: IDENTITY_ORIENTATION,
      radius: SUN_BODY_RADIUS,
    };

    const earthMeanAnomaly = (time / EARTH_ORBIT_PERIOD_DAYS) * TWO_PI;
    const earth: BodyState = {
      id: BodyIds.Earth,
      parentId: BodyIds.Sun,
      position: ellipticalOrbitPosition(EARTH_ORBIT_RADIUS, EARTH_ORBIT_ECCENTRICITY, EARTH_ARGUMENT_OF_PERIHELION_RAD, earthMeanAnomaly),
      orientation: IDENTITY_ORIENTATION,
      radius: EARTH_BODY_RADIUS,
      rotationAxis: EARTH_ROTATION_AXIS,
    };

    const moonMeanAnomaly = (time / MOON_ORBIT_PERIOD_DAYS) * TWO_PI;
    const moonAscendingNodeRad = (MOON_ASCENDING_NODE_DEG_AT_EPOCH * DEG_TO_RAD) - (time / MOON_NODAL_REGRESSION_PERIOD_DAYS) * TWO_PI;
    const moonRelativePosition = inclinedEllipticalOrbitPosition(
      MOON_ORBIT_RADIUS,
      MOON_ORBIT_ECCENTRICITY,
      MOON_ARGUMENT_OF_PERIGEE_RAD,
      moonMeanAnomaly,
      MOON_ORBIT_INCLINATION_DEG,
      moonAscendingNodeRad,
    );
    const moon: BodyState = {
      id: BodyIds.Moon,
      parentId: BodyIds.Earth,
      position: addVectors(earth.position, moonRelativePosition),
      orientation: IDENTITY_ORIENTATION,
      radius: MOON_BODY_RADIUS,
    };

    const planetBodies = Object.fromEntries(
      Object.entries(PLANET_ORBITAL_ELEMENTS).map(([id, elements]) => {
        const body: BodyState = {
          id: id as PlanetId,
          parentId: BodyIds.Sun,
          position: planetHeliocentricPosition(elements, time),
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
