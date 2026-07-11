import * as THREE from "three";
import { TIME_SPEED_DEFAULT } from "../config/constants";

// Wraps THREE.Clock with a user-controlled speed multiplier so every
// time-driven entity (Earth's spin today, orbits/moon phases later)
// reads from one shared notion of "simulated time".
export class SimulationClock {
  private readonly clock = new THREE.Clock();
  public timeSpeed = TIME_SPEED_DEFAULT;

  /** Real-world seconds since last tick, scaled by timeSpeed. */
  tick(): number {
    const realDelta = this.clock.getDelta();
    return realDelta * this.timeSpeed;
  }
}
