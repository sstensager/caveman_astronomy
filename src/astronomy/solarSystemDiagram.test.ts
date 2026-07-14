import { describe, expect, it } from "vitest";
import { getEarthDiagramPosition, getMoonDiagramPosition, getMoonOffsetFromEarth, getSunOffsetFromEarth } from "./solarSystemDiagram";
import { GeocentricModel } from "./models/GeocentricModel";
import { ModernHeliocentricModel } from "./models/ModernHeliocentricModel";
import { eclipticToWorld } from "./frames";
import { subVectors } from "./vectorMath";
import { BodyIds } from "./types";

const SAMPLE_TIMES = [0, 10, 91.3, 200, 365.25, 1000.7];
const EARTH_ORBIT_SCALE = 0.2375; // matches main.ts's earthOrbitScale for the default constants
const MOON_ORBIT_SCALE = 1.5; // matches main.ts's moonOrbitScale for the default constants

describe("getEarthDiagramPosition", () => {
  it("equals eclipticToWorld(earth - sun) * orbitScale directly", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(42.7);
    const expected = eclipticToWorld(subVectors(state.bodies[BodyIds.Earth].position, state.bodies[BodyIds.Sun].position));

    const actual = getEarthDiagramPosition(state, EARTH_ORBIT_SCALE);
    expect(actual.x).toBeCloseTo(expected.x * EARTH_ORBIT_SCALE, 10);
    expect(actual.y).toBeCloseTo(expected.y * EARTH_ORBIT_SCALE, 10);
    expect(actual.z).toBeCloseTo(expected.z * EARTH_ORBIT_SCALE, 10);
  });

  it("is identical whether GeocentricModel or ModernHeliocentricModel computes it - proven by the mirror trick", () => {
    const geo = new GeocentricModel();
    const helio = new ModernHeliocentricModel();
    for (const t of SAMPLE_TIMES) {
      const g = getEarthDiagramPosition(geo.getState(t), EARTH_ORBIT_SCALE);
      const h = getEarthDiagramPosition(helio.getState(t), EARTH_ORBIT_SCALE);
      expect(g.x).toBeCloseTo(h.x, 8);
      expect(g.y).toBeCloseTo(h.y, 8);
      expect(g.z).toBeCloseTo(h.z, 8);
    }
  });
});

describe("getMoonDiagramPosition", () => {
  it("equals Earth's diagram position plus eclipticToWorld(moon - earth) * moonOrbitScale", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(1234.5);
    const earth = getEarthDiagramPosition(state, EARTH_ORBIT_SCALE);
    const moonRelative = eclipticToWorld(subVectors(state.bodies[BodyIds.Moon].position, state.bodies[BodyIds.Earth].position));

    const actual = getMoonDiagramPosition(state, EARTH_ORBIT_SCALE, MOON_ORBIT_SCALE);
    expect(actual.x).toBeCloseTo(earth.x + moonRelative.x * MOON_ORBIT_SCALE, 10);
    expect(actual.y).toBeCloseTo(earth.y + moonRelative.y * MOON_ORBIT_SCALE, 10);
    expect(actual.z).toBeCloseTo(earth.z + moonRelative.z * MOON_ORBIT_SCALE, 10);
  });

  it("is identical whether GeocentricModel or ModernHeliocentricModel computes it", () => {
    const geo = new GeocentricModel();
    const helio = new ModernHeliocentricModel();
    for (const t of SAMPLE_TIMES) {
      const g = getMoonDiagramPosition(geo.getState(t), EARTH_ORBIT_SCALE, MOON_ORBIT_SCALE);
      const h = getMoonDiagramPosition(helio.getState(t), EARTH_ORBIT_SCALE, MOON_ORBIT_SCALE);
      expect(g.x).toBeCloseTo(h.x, 8);
      expect(g.y).toBeCloseTo(h.y, 8);
      expect(g.z).toBeCloseTo(h.z, 8);
    }
  });

  it("traces a loop around Earth's own position, not around the diagram's origin", () => {
    const model = new ModernHeliocentricModel();
    // At a time where Earth is far from the Sun (diagram origin), the Moon's
    // position should stay close to EARTH's position, not snap back toward
    // the origin - regression guard against accidentally computing the
    // Moon's offset from the Sun instead of from Earth.
    const state = model.getState(100);
    const earth = getEarthDiagramPosition(state, EARTH_ORBIT_SCALE);
    const moon = getMoonDiagramPosition(state, EARTH_ORBIT_SCALE, MOON_ORBIT_SCALE);
    const distanceFromEarth = Math.hypot(moon.x - earth.x, moon.y - earth.y, moon.z - earth.z);
    const distanceFromOrigin = Math.hypot(earth.x, earth.y, earth.z);
    expect(distanceFromEarth).toBeLessThan(distanceFromOrigin);
  });
});

describe("getMoonOffsetFromEarth", () => {
  it("equals eclipticToWorld(moon - earth) * moonOrbitScale, with NO Earth-from-Sun term added", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(500);
    const expected = eclipticToWorld(subVectors(state.bodies[BodyIds.Moon].position, state.bodies[BodyIds.Earth].position));

    const actual = getMoonOffsetFromEarth(state, MOON_ORBIT_SCALE);
    expect(actual.x).toBeCloseTo(expected.x * MOON_ORBIT_SCALE, 10);
    expect(actual.y).toBeCloseTo(expected.y * MOON_ORBIT_SCALE, 10);
    expect(actual.z).toBeCloseTo(expected.z * MOON_ORBIT_SCALE, 10);
  });

  it("getMoonDiagramPosition equals getEarthDiagramPosition + getMoonOffsetFromEarth exactly (no drift between the two functions)", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(777);
    const earth = getEarthDiagramPosition(state, EARTH_ORBIT_SCALE);
    const offset = getMoonOffsetFromEarth(state, MOON_ORBIT_SCALE);
    const combined = getMoonDiagramPosition(state, EARTH_ORBIT_SCALE, MOON_ORBIT_SCALE);
    expect(combined.x).toBeCloseTo(earth.x + offset.x, 12);
    expect(combined.y).toBeCloseTo(earth.y + offset.y, 12);
    expect(combined.z).toBeCloseTo(earth.z + offset.z, 12);
  });

  it("is identical whether GeocentricModel or ModernHeliocentricModel computes it", () => {
    const geo = new GeocentricModel();
    const helio = new ModernHeliocentricModel();
    for (const t of SAMPLE_TIMES) {
      const g = getMoonOffsetFromEarth(geo.getState(t), MOON_ORBIT_SCALE);
      const h = getMoonOffsetFromEarth(helio.getState(t), MOON_ORBIT_SCALE);
      expect(g.x).toBeCloseTo(h.x, 8);
      expect(g.y).toBeCloseTo(h.y, 8);
      expect(g.z).toBeCloseTo(h.z, 8);
    }
  });
});

describe("getSunOffsetFromEarth", () => {
  it("equals eclipticToWorld(sun - earth) * sunOrbitScale directly", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(321);
    const expected = eclipticToWorld(subVectors(state.bodies[BodyIds.Sun].position, state.bodies[BodyIds.Earth].position));

    const actual = getSunOffsetFromEarth(state, EARTH_ORBIT_SCALE);
    expect(actual.x).toBeCloseTo(expected.x * EARTH_ORBIT_SCALE, 10);
    expect(actual.y).toBeCloseTo(expected.y * EARTH_ORBIT_SCALE, 10);
    expect(actual.z).toBeCloseTo(expected.z * EARTH_ORBIT_SCALE, 10);
  });

  it("is the negation of getEarthDiagramPosition at the same scale (Sun-from-Earth vs Earth-from-Sun)", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(654.3);
    const earthFromSun = getEarthDiagramPosition(state, EARTH_ORBIT_SCALE);
    const sunFromEarth = getSunOffsetFromEarth(state, EARTH_ORBIT_SCALE);
    expect(sunFromEarth.x).toBeCloseTo(-earthFromSun.x, 10);
    expect(sunFromEarth.y).toBeCloseTo(-earthFromSun.y, 10);
    expect(sunFromEarth.z).toBeCloseTo(-earthFromSun.z, 10);
  });

  it("is identical whether GeocentricModel or ModernHeliocentricModel computes it", () => {
    const geo = new GeocentricModel();
    const helio = new ModernHeliocentricModel();
    for (const t of SAMPLE_TIMES) {
      const g = getSunOffsetFromEarth(geo.getState(t), EARTH_ORBIT_SCALE);
      const h = getSunOffsetFromEarth(helio.getState(t), EARTH_ORBIT_SCALE);
      expect(g.x).toBeCloseTo(h.x, 8);
      expect(g.y).toBeCloseTo(h.y, 8);
      expect(g.z).toBeCloseTo(h.z, 8);
    }
  });
});
