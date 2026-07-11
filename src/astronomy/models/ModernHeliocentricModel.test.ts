import { describe, expect, it } from "vitest";
import { ModernHeliocentricModel } from "./ModernHeliocentricModel";
import { BodyIds } from "../types";
import { EARTH_ORBIT_PERIOD_DAYS, EARTH_ORBIT_RADIUS, MOON_ORBIT_PERIOD_DAYS, MOON_ORBIT_RADIUS } from "../constants";
import { length, subVectors } from "../vectorMath";

describe("ModernHeliocentricModel", () => {
  const model = new ModernHeliocentricModel();

  it("is a pure function of time - same time in, same state out", () => {
    const a = model.getState(42);
    const b = model.getState(42);
    expect(a).toEqual(b);
  });

  it("keeps the Sun fixed at the model origin regardless of time", () => {
    for (const t of [0, 10, 365.25, 10000]) {
      const sun = model.getState(t).bodies[BodyIds.Sun];
      expect(sun.position).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  it("places Earth at a constant distance from the Sun (circular orbit)", () => {
    for (const t of [0, 91.3, 200, 500]) {
      const earth = model.getState(t).bodies[BodyIds.Earth];
      expect(length(earth.position)).toBeCloseTo(EARTH_ORBIT_RADIUS);
    }
  });

  it("returns Earth to (approximately) its starting position after one full orbit", () => {
    const start = model.getState(0).bodies[BodyIds.Earth].position;
    const afterOneYear = model.getState(EARTH_ORBIT_PERIOD_DAYS).bodies[BodyIds.Earth].position;
    expect(afterOneYear.x).toBeCloseTo(start.x, 5);
    expect(afterOneYear.y).toBeCloseTo(start.y, 5);
    expect(afterOneYear.z).toBeCloseTo(start.z, 5);
  });

  it("keeps the Moon at a constant distance from Earth's current position", () => {
    for (const t of [0, 50, 123.4]) {
      const state = model.getState(t);
      const earth = state.bodies[BodyIds.Earth];
      const moon = state.bodies[BodyIds.Moon];
      const relative = subVectors(moon.position, earth.position);
      expect(length(relative)).toBeCloseTo(MOON_ORBIT_RADIUS);
    }
  });

  it("returns the Moon to (approximately) the same position relative to Earth after one sidereal month", () => {
    const relativeAt = (t: number) => {
      const state = model.getState(t);
      return subVectors(state.bodies[BodyIds.Moon].position, state.bodies[BodyIds.Earth].position);
    };
    const start = relativeAt(0);
    const afterOneMonth = relativeAt(MOON_ORBIT_PERIOD_DAYS);
    expect(afterOneMonth.x).toBeCloseTo(start.x, 5);
    expect(afterOneMonth.y).toBeCloseTo(start.y, 5);
    expect(afterOneMonth.z).toBeCloseTo(start.z, 5);
  });

  it("sets parentId to reflect Sun<-Earth<-Moon hierarchy", () => {
    const state = model.getState(0);
    expect(state.bodies[BodyIds.Earth].parentId).toBe(BodyIds.Sun);
    expect(state.bodies[BodyIds.Moon].parentId).toBe(BodyIds.Earth);
    expect(state.bodies[BodyIds.Sun].parentId).toBeUndefined();
  });
});
