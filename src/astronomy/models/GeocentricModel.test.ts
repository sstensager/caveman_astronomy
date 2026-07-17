import { describe, expect, it } from "vitest";
import { GeocentricModel } from "./GeocentricModel";
import { BodyIds, type BodyId } from "../types";
import {
  EARTH_ORBIT_ECCENTRICITY,
  EARTH_ORBIT_PERIOD_DAYS,
  EARTH_ORBIT_RADIUS,
  MOON_NODAL_REGRESSION_PERIOD_DAYS,
  MOON_ORBIT_ECCENTRICITY,
  MOON_ORBIT_PERIOD_DAYS,
  MOON_ORBIT_RADIUS,
  PLANET_ORBITAL_ELEMENTS,
} from "../constants";
import { length, subVectors } from "../vectorMath";

describe("GeocentricModel", () => {
  const model = new GeocentricModel();

  it("is a pure function of time - same time in, same state out", () => {
    const a = model.getState(42);
    const b = model.getState(42);
    expect(a).toEqual(b);
  });

  it("keeps Earth fixed at the model origin regardless of time", () => {
    for (const t of [0, 10, 365.25, 10000]) {
      const earth = model.getState(t).bodies[BodyIds.Earth];
      expect(earth.position).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  it("keeps the Sun's distance from Earth within its elliptical orbit's perigee-apogee range", () => {
    const perigee = EARTH_ORBIT_RADIUS * (1 - EARTH_ORBIT_ECCENTRICITY);
    const apogee = EARTH_ORBIT_RADIUS * (1 + EARTH_ORBIT_ECCENTRICITY);
    for (const t of [0, 91.3, 200, 500]) {
      const sun = model.getState(t).bodies[BodyIds.Sun];
      const distance = length(sun.position);
      expect(distance).toBeGreaterThanOrEqual(perigee - 1e-9);
      expect(distance).toBeLessThanOrEqual(apogee + 1e-9);
    }
  });

  it("reaches the Sun's apparent perigee (closest approach) at time 0, matching Earth's real perihelion timing", () => {
    const sun = model.getState(0).bodies[BodyIds.Sun];
    expect(length(sun.position)).toBeCloseTo(EARTH_ORBIT_RADIUS * (1 - EARTH_ORBIT_ECCENTRICITY));
  });

  it("returns the Sun to (approximately) its starting position after one full orbit", () => {
    const start = model.getState(0).bodies[BodyIds.Sun].position;
    const afterOneYear = model.getState(EARTH_ORBIT_PERIOD_DAYS).bodies[BodyIds.Sun].position;
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
    const relativeAt = (t: number) => {
      const state = model.getState(t);
      return subVectors(state.bodies[BodyIds.Moon].position, state.bodies[BodyIds.Earth].position);
    };
    const start = relativeAt(0);
    const afterOneMonth = relativeAt(MOON_ORBIT_PERIOD_DAYS);
    const deviation = length(subVectors(afterOneMonth, start));
    expect(deviation).toBeGreaterThan(0.01);
    expect(deviation).toBeLessThan(MOON_ORBIT_RADIUS * 0.2);
  });

  it("fully regresses the Moon's node by 360 degrees over one MOON_NODAL_REGRESSION_PERIOD_DAYS, returning to the same relative position", () => {
    const relativeAt = (t: number) => {
      const state = model.getState(t);
      return subVectors(state.bodies[BodyIds.Moon].position, state.bodies[BodyIds.Earth].position);
    };
    const monthsPerNodeCycle = Math.round(MOON_NODAL_REGRESSION_PERIOD_DAYS / MOON_ORBIT_PERIOD_DAYS);
    const t = monthsPerNodeCycle * MOON_ORBIT_PERIOD_DAYS;
    const start = relativeAt(0);
    const afterFullCycle = relativeAt(t);
    expect(afterFullCycle.x).toBeCloseTo(start.x, 0);
    expect(afterFullCycle.z).toBeCloseTo(start.z, 0);
  });

  it("sets parentId to reflect Earth<-Sun and Earth<-Moon hierarchy", () => {
    const state = model.getState(0);
    expect(state.bodies[BodyIds.Sun].parentId).toBe(BodyIds.Earth);
    expect(state.bodies[BodyIds.Moon].parentId).toBe(BodyIds.Earth);
    expect(state.bodies[BodyIds.Earth].parentId).toBeUndefined();
  });

  describe.each(Object.entries(PLANET_ORBITAL_ELEMENTS))("planet: %s", (id, elements) => {
    const bodyId = id as BodyId;

    it("sets parentId to Earth", () => {
      expect(model.getState(0).bodies[bodyId].parentId).toBe(BodyIds.Earth);
    });

    // The geocentric position is real vector subtraction (planet's real
    // heliocentric position minus Earth's), not a mirror-trick shortcut -
    // see GeocentricModel's own doc comment. There's no simple closed-form
    // periapsis/apoapsis for a GEOCENTRIC planet distance (unlike the Sun's
    // own perigee/apogee above), but by the triangle inequality the
    // geocentric distance |planetHelio - earthHelio| can never exceed the
    // sum of the two bodies' own heliocentric distances, nor fall below
    // their difference - a loose but real sanity bound on the subtraction.
    it("keeps its geocentric distance within the triangle-inequality bound implied by its own and Earth's heliocentric orbits", () => {
      const planetPeriapsis = elements.orbitRadius * (1 - elements.eccentricity);
      const planetApoapsis = elements.orbitRadius * (1 + elements.eccentricity);
      const earthApoapsis = EARTH_ORBIT_RADIUS * (1 + EARTH_ORBIT_ECCENTRICITY);
      const lowerBound = Math.max(0, planetPeriapsis - earthApoapsis);
      const upperBound = planetApoapsis + earthApoapsis;
      for (const t of [0, elements.periodDays * 0.2, elements.periodDays * 0.7, elements.periodDays * 1.5]) {
        const state = model.getState(t);
        const distance = length(subVectors(state.bodies[bodyId].position, state.bodies[BodyIds.Earth].position));
        expect(distance).toBeGreaterThanOrEqual(lowerBound - 1e-6);
        expect(distance).toBeLessThanOrEqual(upperBound + 1e-6);
      }
    });
  });

  // The pedagogical payoff of computing planets via real vector subtraction
  // rather than a shortcut: it naturally reproduces retrograde apparent
  // motion for the outer planets. Numerically verifies the geometry is
  // actually capable of a retrograde dip, without rendering/visually
  // inspecting anything (see NOTES/plan for why this matters - it's the
  // "technically equivalent but pedagogically pointless" regression this
  // guards against).
  it("Mars's geocentric apparent longitude shows a retrograde dip over one Earth-Mars synodic period", () => {
    // Synodic period (~779.9 days) = 1 / (1/EARTH_ORBIT_PERIOD_DAYS - 1/marsPeriodDays);
    // 800 days comfortably exceeds it and also exceeds Mars's own sidereal
    // period (~687 days), guaranteeing at least one full retrograde loop.
    const spanDays = 800;
    const sampleCount = 400;
    const longitudes: number[] = [];
    for (let i = 0; i <= sampleCount; i++) {
      const t = (spanDays * i) / sampleCount;
      const state = model.getState(t);
      const rel = subVectors(state.bodies[BodyIds.Mars].position, state.bodies[BodyIds.Earth].position);
      longitudes.push(Math.atan2(rel.z, rel.x));
    }
    // Unwrap across the +-PI branch cut so consecutive samples form a
    // continuous (not sawtooth) angle sequence.
    const unwrapped = [longitudes[0]];
    for (let i = 1; i < longitudes.length; i++) {
      let delta = longitudes[i] - longitudes[i - 1];
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      unwrapped.push(unwrapped[i - 1] + delta);
    }
    // Net motion over the full span is still prograde (the usual case -
    // Mars completes more than one apparent loop around Earth's sky in this
    // span).
    expect(unwrapped[unwrapped.length - 1]).toBeGreaterThan(unwrapped[0]);
    // But somewhere in the middle, apparent motion runs backward - the
    // retrograde loop itself.
    const hasRetrogradeDip = unwrapped.some((v, i) => i > 0 && v < unwrapped[i - 1]);
    expect(hasRetrogradeDip).toBe(true);
  });
});
