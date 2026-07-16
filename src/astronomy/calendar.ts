// Rough calendar<->simulation-day conversion, anchored at
// SIMULATION_EPOCH_UTC_MS (see constants.ts for why that specific instant was
// chosen). Nearest-day precision only - this sim has no notion of leap
// seconds or sub-day ephemeris accuracy.

import { SIMULATION_EPOCH_UTC_MS } from "./constants";
import type { SimulationTime } from "./types";

export const MS_PER_SIMULATION_DAY = 86_400_000;

/** Converts elapsed simulated days into the real calendar date/time it
 *  represents, per the SIMULATION_EPOCH_UTC_MS anchor. */
export function simulationDayToDate(day: SimulationTime): Date {
  return new Date(SIMULATION_EPOCH_UTC_MS + day * MS_PER_SIMULATION_DAY);
}

/** Inverse of simulationDayToDate - how many simulated days (possibly
 *  fractional, possibly negative) a real calendar date/time is from the
 *  epoch. */
export function dateToSimulationDay(date: Date): SimulationTime {
  return (date.getTime() - SIMULATION_EPOCH_UTC_MS) / MS_PER_SIMULATION_DAY;
}
