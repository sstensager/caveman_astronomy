import { BodyIds, type AstronomyModel, type BodyState, type SimulationTime, type UniverseState } from "../types";
import { addVectors, circularOrbitPosition, inclinedOrbitPosition } from "../vectorMath";
import {
  EARTH_AXIAL_TILT_DEG,
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
const SUN_BODY_RADIUS = 10;
const EARTH_BODY_RADIUS = 3;
const MOON_BODY_RADIUS = 1;

const earthTiltRad = (EARTH_AXIAL_TILT_DEG * Math.PI) / 180;
// Unused this iteration - EarthBase's own render-space spin is the sole
// source of diurnal rotation today. Present as an architecture slot for a
// future model (e.g. tidally-locked Earth) that needs to drive spin from
// model state; see the "known future fork" note in EarthBase.ts.
const EARTH_ROTATION_AXIS = { x: Math.sin(earthTiltRad), y: Math.cos(earthTiltRad), z: 0 };

/**
 * A simplified but consistent modern heliocentric model: Sun fixed near the
 * model origin, Earth on a circular orbit around it, Moon on a circular,
 * inclined orbit around Earth's current position. Not to physical scale -
 * see astronomy/constants.ts for the documented simplifications.
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

    const earthAngle = (time / EARTH_ORBIT_PERIOD_DAYS) * TWO_PI;
    const earth: BodyState = {
      id: BodyIds.Earth,
      parentId: BodyIds.Sun,
      position: circularOrbitPosition(EARTH_ORBIT_RADIUS, earthAngle),
      orientation: IDENTITY_ORIENTATION,
      radius: EARTH_BODY_RADIUS,
      rotationAxis: EARTH_ROTATION_AXIS,
    };

    const moonAngle = (time / MOON_ORBIT_PERIOD_DAYS) * TWO_PI;
    const moonRelativePosition = inclinedOrbitPosition(MOON_ORBIT_RADIUS, moonAngle, MOON_ORBIT_INCLINATION_DEG);
    const moon: BodyState = {
      id: BodyIds.Moon,
      parentId: BodyIds.Earth,
      position: addVectors(earth.position, moonRelativePosition),
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
