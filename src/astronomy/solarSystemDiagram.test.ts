import { describe, expect, it } from "vitest";
import { getBodyOffsetFromEarth, getBodyOffsetFromSun, getEarthDiagramPosition, getMoonOffsetFromEarth, getSunOffsetFromEarth } from "./solarSystemDiagram";
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

describe("getBodyOffsetFromEarth", () => {
  const MARS_ORBIT_SCALE = 0.47;

  it("equals eclipticToWorld(body - earth) * scale for a non-Sun/Moon body (Mars)", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(88.8);
    const expected = eclipticToWorld(subVectors(state.bodies[BodyIds.Mars].position, state.bodies[BodyIds.Earth].position));

    const actual = getBodyOffsetFromEarth(state, BodyIds.Mars, MARS_ORBIT_SCALE);
    expect(actual.x).toBeCloseTo(expected.x * MARS_ORBIT_SCALE, 10);
    expect(actual.y).toBeCloseTo(expected.y * MARS_ORBIT_SCALE, 10);
    expect(actual.z).toBeCloseTo(expected.z * MARS_ORBIT_SCALE, 10);
  });

  it("is identical whether GeocentricModel or ModernHeliocentricModel computes it, for Mars", () => {
    const geo = new GeocentricModel();
    const helio = new ModernHeliocentricModel();
    for (const t of SAMPLE_TIMES) {
      const g = getBodyOffsetFromEarth(geo.getState(t), BodyIds.Mars, MARS_ORBIT_SCALE);
      const h = getBodyOffsetFromEarth(helio.getState(t), BodyIds.Mars, MARS_ORBIT_SCALE);
      expect(g.x).toBeCloseTo(h.x, 8);
      expect(g.y).toBeCloseTo(h.y, 8);
      expect(g.z).toBeCloseTo(h.z, 8);
    }
  });

  it("getSunOffsetFromEarth is a thin wrapper equal to getBodyOffsetFromEarth(state, Sun, scale)", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(17.5);
    const viaWrapper = getSunOffsetFromEarth(state, MARS_ORBIT_SCALE);
    const viaGeneric = getBodyOffsetFromEarth(state, BodyIds.Sun, MARS_ORBIT_SCALE);
    expect(viaWrapper).toEqual(viaGeneric);
  });
});

describe("getBodyOffsetFromSun", () => {
  const SCALE = 0.6;

  it("equals eclipticToWorld(body - sun) * scale for a non-Earth body (Mars)", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(200.4);
    const expected = eclipticToWorld(subVectors(state.bodies[BodyIds.Mars].position, state.bodies[BodyIds.Sun].position));

    const actual = getBodyOffsetFromSun(state, BodyIds.Mars, SCALE);
    expect(actual.x).toBeCloseTo(expected.x * SCALE, 10);
    expect(actual.y).toBeCloseTo(expected.y * SCALE, 10);
    expect(actual.z).toBeCloseTo(expected.z * SCALE, 10);
  });

  it("is identical whether GeocentricModel or ModernHeliocentricModel computes it, for Mars", () => {
    const geo = new GeocentricModel();
    const helio = new ModernHeliocentricModel();
    for (const t of SAMPLE_TIMES) {
      const g = getBodyOffsetFromSun(geo.getState(t), BodyIds.Mars, SCALE);
      const h = getBodyOffsetFromSun(helio.getState(t), BodyIds.Mars, SCALE);
      expect(g.x).toBeCloseTo(h.x, 8);
      expect(g.y).toBeCloseTo(h.y, 8);
      expect(g.z).toBeCloseTo(h.z, 8);
    }
  });

  it("getEarthDiagramPosition is a thin wrapper equal to getBodyOffsetFromSun(state, Earth, scale)", () => {
    const model = new ModernHeliocentricModel();
    const state = model.getState(303.1);
    const viaWrapper = getEarthDiagramPosition(state, SCALE);
    const viaGeneric = getBodyOffsetFromSun(state, BodyIds.Earth, SCALE);
    expect(viaWrapper).toEqual(viaGeneric);
  });
});

// The decisive correctness check for main.ts's Geocentric deferent+epicycle
// construction (see planetLayers' own doc comment there): a planet's real
// geocentric position is planetHelio - earthHelio, split at the minus sign
// into a "deferent carrier" term and an "epicycle" term. This proves the two
// terms recombine EXACTLY back into the real geocentric offset - the same
// vector getBodyOffsetFromEarth already computes and the planet's own
// marker already uses - for both a superior planet (deferent carries
// +planetHelio, epicycle carries -earthHelio) and an inferior one (deferent
// carries -earthHelio, epicycle carries +planetHelio). Pure vector algebra,
// so this holds exactly, not approximately, and for any AstronomyModel.
describe("deferent + epicycle decomposition (main.ts's Geocentric planet orbit lines)", () => {
  const SCALE = 0.35;

  it("superior planet (Mars): getBodyOffsetFromSun(Mars) + getSunOffsetFromEarth == getBodyOffsetFromEarth(Mars)", () => {
    const geo = new GeocentricModel();
    for (const t of SAMPLE_TIMES) {
      const state = geo.getState(t);
      const deferentCarrier = getBodyOffsetFromSun(state, BodyIds.Mars, SCALE);
      const epicycleOffset = getSunOffsetFromEarth(state, SCALE);
      const marker = getBodyOffsetFromEarth(state, BodyIds.Mars, SCALE);
      expect(deferentCarrier.x + epicycleOffset.x).toBeCloseTo(marker.x, 10);
      expect(deferentCarrier.y + epicycleOffset.y).toBeCloseTo(marker.y, 10);
      expect(deferentCarrier.z + epicycleOffset.z).toBeCloseTo(marker.z, 10);
    }
  });

  it("inferior planet (Venus): getSunOffsetFromEarth + getBodyOffsetFromSun(Venus) == getBodyOffsetFromEarth(Venus)", () => {
    const geo = new GeocentricModel();
    for (const t of SAMPLE_TIMES) {
      const state = geo.getState(t);
      const deferentCarrier = getSunOffsetFromEarth(state, SCALE);
      const epicycleOffset = getBodyOffsetFromSun(state, BodyIds.Venus, SCALE);
      const marker = getBodyOffsetFromEarth(state, BodyIds.Venus, SCALE);
      expect(deferentCarrier.x + epicycleOffset.x).toBeCloseTo(marker.x, 10);
      expect(deferentCarrier.y + epicycleOffset.y).toBeCloseTo(marker.y, 10);
      expect(deferentCarrier.z + epicycleOffset.z).toBeCloseTo(marker.z, 10);
    }
  });
});
