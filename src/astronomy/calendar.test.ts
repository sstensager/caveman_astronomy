import { describe, expect, it } from "vitest";
import { MS_PER_SIMULATION_DAY, dateToSimulationDay, simulationDayToDate } from "./calendar";
import { SIMULATION_EPOCH_UTC_MS } from "./constants";

describe("calendar", () => {
  it("maps simulated day 0 to the epoch instant", () => {
    expect(simulationDayToDate(0).getTime()).toBe(SIMULATION_EPOCH_UTC_MS);
  });

  it("maps the epoch instant back to simulated day 0", () => {
    expect(dateToSimulationDay(new Date(SIMULATION_EPOCH_UTC_MS))).toBe(0);
  });

  it("advances one simulated day per 86,400,000ms", () => {
    const oneDayLater = simulationDayToDate(1);
    expect(oneDayLater.getTime()).toBe(SIMULATION_EPOCH_UTC_MS + MS_PER_SIMULATION_DAY);
  });

  it("round-trips arbitrary fractional and negative days", () => {
    for (const day of [365.25, -10.5, 6798.38, 0.25]) {
      const date = simulationDayToDate(day);
      expect(dateToSimulationDay(date)).toBeCloseTo(day, 9);
    }
  });
});
