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

  /** Real-world seconds since last tick, scaled by timeSpeed. */
  tick(): number {
    const realDelta = this.clock.getDelta();
    const scaledDelta = realDelta * this.timeSpeed;
    this.elapsedSeconds += scaledDelta;
    return scaledDelta;
  }

  /** Total simulated time elapsed so far, in days - see astronomy/types.ts. */
  getElapsedDays(): SimulationTime {
    return this.elapsedSeconds / SIMULATED_DAY_DURATION_SECONDS;
  }
}
