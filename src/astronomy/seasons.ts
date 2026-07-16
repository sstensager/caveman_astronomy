import { GeocentricModel } from "./models/GeocentricModel";
import { BodyIds, type SimulationTime } from "./types";
import { eclipticToWorld } from "./frames";
import { length } from "./vectorMath";
import { EARTH_ORBIT_PERIOD_DAYS } from "./constants";

const RAD_TO_DEG = 180 / Math.PI;
const geocentricModel = new GeocentricModel();

export interface SeasonalMarkers {
  juneSolstice: SimulationTime;
  decemberSolstice: SimulationTime;
  marchEquinox: SimulationTime;
  septemberEquinox: SimulationTime;
}

/** Declination (degrees above/below the celestial equator) of the Sun's
 *  direction from Earth on the given simulated day - world +Y after
 *  eclipticToWorld, NOT the ecliptic-frame latitude eclipseFinder.ts
 *  computes for the Moon (a different reference plane entirely). Uses
 *  GeocentricModel since its Sun position is already Earth-relative, same
 *  reason eclipseFinder.ts does. */
function declinationDegAt(day: SimulationTime): number {
  const sunEcliptic = geocentricModel.getState(day).bodies[BodyIds.Sun].position;
  const sunWorld = eclipticToWorld(sunEcliptic);
  const sinDec = sunWorld.y / length(sunWorld);
  return Math.asin(Math.max(-1, Math.min(1, sinDec))) * RAD_TO_DEG;
}

function interpolateZeroCrossing(dayA: SimulationTime, valueA: number, dayB: SimulationTime, valueB: number): SimulationTime {
  const t = valueA / (valueA - valueB);
  return dayA + t * (dayB - dayA);
}

/**
 * Finds the four real solstice/equinox simulated-days within
 * [centerDay - windowDays/2, centerDay + windowDays/2] via a SINGLE linear
 * scan of solar declination - pattern-matched on eclipseFinder.ts's
 * findNearestEclipseAlignment (same brute-force-scan-and-track-the-best
 * approach, same GeocentricModel choice), not a closed-form orbital
 * solution.
 *
 * Solstices are declination's two extrema (tracked as running max/min);
 * equinoxes are its two zero-crossings, refined by linear interpolation
 * between the two straddling samples for better-than-stepDays precision.
 * `windowDays` defaults to a full orbital period (unlike eclipseFinder's
 * much narrower window): over exactly one period there is guaranteed to be
 * exactly one of each of the four markers, so "first crossing/extremum
 * found" is unambiguous - a smaller window risks missing one entirely, a
 * much larger one risks finding a second, unwanted occurrence.
 *
 * EXISTS ONLY for the "jump the simulated clock to this date" UI
 * convenience (see main.ts) - the monument's own stone geometry
 * (hengeLayout.ts) does NOT depend on this function at all: solstice
 * declination is always exactly EARTH_AXIAL_TILT_DEG and equinox
 * declination is always exactly 0, both constants, no scan required for
 * the geometry itself. Keeping these decoupled avoids the monument
 * silently depending on `EarthBase.rotationGroup`'s per-frame delta
 * rotation, which is NOT a pure function of simulated time (see NOTES.md's
 * deferred "day-arc path" item).
 */
export function findSeasonalMarkers(
  centerDay: SimulationTime,
  windowDays: number = EARTH_ORBIT_PERIOD_DAYS,
  stepDays = 0.5,
): SeasonalMarkers {
  const startDay = centerDay - windowDays / 2;
  const endDay = centerDay + windowDays / 2;

  let juneSolstice = startDay;
  let maxDeclination = -Infinity;
  let decemberSolstice = startDay;
  let minDeclination = Infinity;
  let marchEquinox: SimulationTime | undefined;
  let septemberEquinox: SimulationTime | undefined;

  let previousDay = startDay;
  let previousDeclination = declinationDegAt(startDay);
  if (previousDeclination > maxDeclination) {
    maxDeclination = previousDeclination;
    juneSolstice = previousDay;
  }
  if (previousDeclination < minDeclination) {
    minDeclination = previousDeclination;
    decemberSolstice = previousDay;
  }

  for (let day = startDay + stepDays; day <= endDay; day += stepDays) {
    const declination = declinationDegAt(day);

    if (declination > maxDeclination) {
      maxDeclination = declination;
      juneSolstice = day;
    }
    if (declination < minDeclination) {
      minDeclination = declination;
      decemberSolstice = day;
    }
    if (marchEquinox === undefined && previousDeclination < 0 && declination >= 0) {
      marchEquinox = interpolateZeroCrossing(previousDay, previousDeclination, day, declination);
    }
    if (septemberEquinox === undefined && previousDeclination >= 0 && declination < 0) {
      septemberEquinox = interpolateZeroCrossing(previousDay, previousDeclination, day, declination);
    }

    previousDay = day;
    previousDeclination = declination;
  }

  if (marchEquinox === undefined || septemberEquinox === undefined) {
    throw new Error("findSeasonalMarkers: windowDays too small to find both equinoxes - use a full orbital period");
  }

  return { juneSolstice, decemberSolstice, marchEquinox, septemberEquinox };
}
