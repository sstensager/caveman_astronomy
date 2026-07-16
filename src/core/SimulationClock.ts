import * as THREE from "three";
import { SIMULATED_DAY_DURATION_SECONDS, TIME_SPEED_DEFAULT } from "../config/constants";
import type { SimulationTime } from "../astronomy/types";

// Wraps THREE.Clock with a user-controlled speed multiplier so every
// time-driven entity (Earth's spin, and now the astronomy model's orbital
// motion) reads from one shared notion of "simulated time".
export class SimulationClock {
  private readonly clock = new THREE.Clock();
  private elapsedSeconds = 0;
  public timeSpeed = TIME_SPEED_DEFAULT;
  public paused = false;

  /** Real-world seconds since last tick, scaled by timeSpeed. Drains the
   *  real clock even while paused so resuming doesn't jump forward. */
  tick(): number {
    const realDelta = this.clock.getDelta();
    if (this.paused) return 0;
    const scaledDelta = realDelta * this.timeSpeed;
    this.elapsedSeconds += scaledDelta;
    return scaledDelta;
  }

  /** Total simulated time elapsed so far, in days - see astronomy/types.ts. */
  getElapsedDays(): SimulationTime {
    return this.elapsedSeconds / SIMULATED_DAY_DURATION_SECONDS;
  }

  /** Jumps simulated time forward (or back) by the given number of days -
   *  used by the Time section's Step Hour/Day/Month/Year controls. */
  addElapsedDays(days: number): void {
    this.elapsedSeconds += days * SIMULATED_DAY_DURATION_SECONDS;
  }

  /** Jumps simulated time to an ABSOLUTE day count (as opposed to
   *  addElapsedDays' relative jump) - used by the date picker to set the
   *  clock directly to whatever day a chosen calendar date maps to. */
  setElapsedDays(days: number): void {
    this.elapsedSeconds = days * SIMULATED_DAY_DURATION_SECONDS;
  }

  reset(): void {
    this.elapsedSeconds = 0;
  }
}
