import { describe, expect, it } from "vitest";
import { ModernHeliocentricModel } from "./ModernHeliocentricModel";
import { BodyIds } from "../types";
import {
  EARTH_ORBIT_ECCENTRICITY,
  EARTH_ORBIT_PERIOD_DAYS,
  EARTH_ORBIT_RADIUS,
  MOON_NODAL_REGRESSION_PERIOD_DAYS,
  MOON_ORBIT_ECCENTRICITY,
  MOON_ORBIT_PERIOD_DAYS,
  MOON_ORBIT_RADIUS,
} from "../constants";
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

  it("keeps Earth's distance from the Sun within its elliptical orbit's periapsis-apoapsis range", () => {
    const periapsis = EARTH_ORBIT_RADIUS * (1 - EARTH_ORBIT_ECCENTRICITY);
    const apoapsis = EARTH_ORBIT_RADIUS * (1 + EARTH_ORBIT_ECCENTRICITY);
    for (const t of [0, 91.3, 200, 500]) {
      const earth = model.getState(t).bodies[BodyIds.Earth];
      const distance = length(earth.position);
      expect(distance).toBeGreaterThanOrEqual(periapsis - 1e-9);
      expect(distance).toBeLessThanOrEqual(apoapsis + 1e-9);
    }
  });

  it("reaches perihelion (closest approach) at time 0", () => {
    // Mean anomaly 0 at t=0 is periapsis by construction (Kepler's equation
    // M=0 -> E=0 -> perifocal x = a(1-e), y=0).
    const earth = model.getState(0).bodies[BodyIds.Earth];
    expect(length(earth.position)).toBeCloseTo(EARTH_ORBIT_RADIUS * (1 - EARTH_ORBIT_ECCENTRICITY));
  });

  it("returns Earth to (approximately) its starting position after one full orbit", () => {
    const start = model.getState(0).bodies[BodyIds.Earth].position;
    const afterOneYear = model.getState(EARTH_ORBIT_PERIOD_DAYS).bodies[BodyIds.Earth].position;
    expect(afterOneYear.x).toBeCloseTo(start.x, 5);
    expect(afterOneYear.y).toBeCloseTo(start.y, 5);
    expect(afterOneYear.z).toBeCloseTo(start.z, 5);
  });

  it("keeps the Moon's distance from Earth within its elliptical orbit's perigee-apogee range", () => {
    const perigee = MOON_ORBIT_RADIUS * (1 - MOON_ORBIT_ECCENTRICITY);
    const apogee = MOON_ORBIT_RADIUS * (1 + MOON_ORBIT_ECCENTRICITY);
    for (const t of [0, 50, 123.4]) {
      const state = model.getState(t);
      const earth = state.bodies[BodyIds.Earth];
      const moon = state.bodies[BodyIds.Moon];
      const distance = length(subVectors(moon.position, earth.position));
      expect(distance).toBeGreaterThanOrEqual(perigee - 1e-9);
      expect(distance).toBeLessThanOrEqual(apogee + 1e-9);
    }
  });

  it("returns the Moon to the same DISTANCE from Earth after one sidereal month (mean anomaly is exactly periodic)", () => {
    const distanceAt = (t: number) => {
      const state = model.getState(t);
      return length(subVectors(state.bodies[BodyIds.Moon].position, state.bodies[BodyIds.Earth].position));
    };
    expect(distanceAt(MOON_ORBIT_PERIOD_DAYS)).toBeCloseTo(distanceAt(0), 5);
  });

  it("does NOT return the Moon to the exact same direction after one sidereal month - the ascending node has regressed slightly", () => {
    // Real nodal regression: over one month the node moves backward by
    // (MOON_ORBIT_PERIOD_DAYS / MOON_NODAL_REGRESSION_PERIOD_DAYS) * 360deg,
    // a small but real, non-zero shift - this is what makes eclipse seasons
    // drift year to year instead of recurring on a fixed schedule.
    const relativeAt = (t: number) => {
      const state = model.getState(t);
      return subVectors(state.bodies[BodyIds.Moon].position, state.bodies[BodyIds.Earth].position);
    };
    const start = relativeAt(0);
    const afterOneMonth = relativeAt(MOON_ORBIT_PERIOD_DAYS);
    const deviation = length(subVectors(afterOneMonth, start));
    expect(deviation).toBeGreaterThan(0.01);
    // But it's still a small effect over just one month - nowhere near a
    // full orbit's worth of displacement.
    expect(deviation).toBeLessThan(MOON_ORBIT_RADIUS * 0.2);
  });

  it("fully regresses the Moon's node by 360 degrees over one MOON_NODAL_REGRESSION_PERIOD_DAYS, returning to the same relative position", () => {
    const relativeAt = (t: number) => {
      const state = model.getState(t);
      return subVectors(state.bodies[BodyIds.Moon].position, state.bodies[BodyIds.Earth].position);
    };
    // Both the mean anomaly AND the node angle complete an integer number
    // of full cycles over this span (node: exactly 1 cycle; mean anomaly:
    // MOON_NODAL_REGRESSION_PERIOD_DAYS / MOON_ORBIT_PERIOD_DAYS orbits,
    // not necessarily an integer - so compare at a time that's an exact
    // multiple of BOTH periods instead: one full node cycle AND an integer
    // number of months).
    const monthsPerNodeCycle = Math.round(MOON_NODAL_REGRESSION_PERIOD_DAYS / MOON_ORBIT_PERIOD_DAYS);
    const t = monthsPerNodeCycle * MOON_ORBIT_PERIOD_DAYS;
    const start = relativeAt(0);
    const afterFullCycle = relativeAt(t);
    // Loose tolerance: t is only an approximate whole-months match to the
    // node period, so mean anomaly and node angle won't both land exactly
    // on a multiple of 2*PI, just close to it.
    expect(afterFullCycle.x).toBeCloseTo(start.x, 0);
    expect(afterFullCycle.z).toBeCloseTo(start.z, 0);
  });

  it("sets parentId to reflect Sun<-Earth<-Moon hierarchy", () => {
    const state = model.getState(0);
    expect(state.bodies[BodyIds.Earth].parentId).toBe(BodyIds.Sun);
    expect(state.bodies[BodyIds.Moon].parentId).toBe(BodyIds.Earth);
    expect(state.bodies[BodyIds.Sun].parentId).toBeUndefined();
  });
});
