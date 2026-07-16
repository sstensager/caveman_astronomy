import { GeocentricModel } from "./models/GeocentricModel";
import { BodyIds, type SimulationTime } from "./types";
import { length } from "./vectorMath";

const RAD_TO_DEG = 180 / Math.PI;
const geocentricModel = new GeocentricModel();

export interface EclipseAlignment {
  day: SimulationTime;
  kind: "solar" | "lunar";
  /** Sun-Moon angular separation as seen from Earth: ~0deg for a solar
   *  (new-moon) alignment, ~180deg for a lunar (full-moon) alignment. */
  separationDeg: number;
  /** Moon's angle above/below the ecliptic plane - near 0 means near one of
   *  its orbital nodes, a prerequisite for either kind of eclipse. */
  moonLatitudeDeg: number;
}

/**
 * Scans simulated days in [centerDay - windowDays, centerDay + windowDays]
 * for whichever moment the model comes closest to a Sun-Earth-Moon syzygy
 * near one of the Moon's orbital nodes. This is NOT a real eclipse
 * predictor (this sim isn't ephemeris-grade - see SIMULATION_EPOCH_UTC_MS's
 * doc comment) - it's a way to pick a demo date where the alignment looks
 * eclipse-like, using the model's own real orbital-mechanics inputs
 * (inclination, nodal regression) rather than hand-tuning them to force one.
 *
 * Uses GeocentricModel specifically because Sun and Moon positions are both
 * already Earth-relative there (Earth fixed at the model origin), so no
 * subtraction is needed to get each body's direction from Earth - see
 * GeocentricModel's own doc comment for why its Sun direction is
 * algebraically identical to the heliocentric model's.
 */
export function findNearestEclipseAlignment(
  centerDay: SimulationTime,
  windowDays: number,
  stepDays = 0.25,
): EclipseAlignment | undefined {
  let best: EclipseAlignment | undefined;
  let bestError = Infinity;

  for (let day = centerDay - windowDays; day <= centerDay + windowDays; day += stepDays) {
    const state = geocentricModel.getState(day);
    const sun = state.bodies[BodyIds.Sun].position;
    const moon = state.bodies[BodyIds.Moon].position;

    const dot = sun.x * moon.x + sun.y * moon.y + sun.z * moon.z;
    const cosSeparation = dot / (length(sun) * length(moon));
    const separationDeg = Math.acos(Math.min(1, Math.max(-1, cosSeparation))) * RAD_TO_DEG;
    const moonLatitudeDeg = Math.asin(Math.min(1, Math.max(-1, moon.y / length(moon)))) * RAD_TO_DEG;

    const isNearNew = separationDeg <= 90;
    const syzygyErrorDeg = isNearNew ? separationDeg : 180 - separationDeg;
    const error = syzygyErrorDeg + Math.abs(moonLatitudeDeg);

    if (error < bestError) {
      bestError = error;
      best = { day, kind: isNearNew ? "solar" : "lunar", separationDeg, moonLatitudeDeg };
    }
  }

  return best;
}
