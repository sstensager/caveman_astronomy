import { describe, expect, it } from "vitest";
import { SimulationClock } from "./SimulationClock";

describe("SimulationClock", () => {
  it("addElapsedDays jumps simulated time without touching the real clock", () => {
    const clock = new SimulationClock();
    clock.addElapsedDays(1);
    expect(clock.getElapsedDays()).toBeCloseTo(1, 10);

    clock.addElapsedDays(-0.5);
    expect(clock.getElapsedDays()).toBeCloseTo(0.5, 10);
  });

  it("reset zeroes elapsed simulated time", () => {
    const clock = new SimulationClock();
    clock.addElapsedDays(10);
    clock.reset();
    expect(clock.getElapsedDays()).toBe(0);
  });

  it("tick returns 0 and does not advance elapsed time while paused", () => {
    const clock = new SimulationClock();
    clock.paused = true;
    const delta = clock.tick();
    expect(delta).toBe(0);
    expect(clock.getElapsedDays()).toBe(0);
  });
});
