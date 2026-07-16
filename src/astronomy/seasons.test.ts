import { describe, expect, it } from "vitest";
import { findSeasonalMarkers } from "./seasons";
import { GeocentricModel } from "./models/GeocentricModel";
import { BodyIds } from "./types";
import { eclipticToWorld } from "./frames";
import { length } from "./vectorMath";
import { EARTH_AXIAL_TILT_DEG, EARTH_ORBIT_PERIOD_DAYS } from "./constants";

const geocentricModel = new GeocentricModel();
const RAD_TO_DEG = 180 / Math.PI;

/** Independent re-derivation of declination (not reusing seasons.ts's
 *  private helper) so this test can't pass merely by agreeing with itself. */
function declinationDegAt(day: number): number {
  const sunEcliptic = geocentricModel.getState(day).bodies[BodyIds.Sun].position;
  const sunWorld = eclipticToWorld(sunEcliptic);
  const sinDec = sunWorld.y / length(sunWorld);
  return Math.asin(Math.max(-1, Math.min(1, sinDec))) * RAD_TO_DEG;
}

describe("findSeasonalMarkers", () => {
  const markers = findSeasonalMarkers(0);

  it("finds all four markers within the requested window", () => {
    const halfWindow = EARTH_ORBIT_PERIOD_DAYS / 2;
    for (const day of [markers.juneSolstice, markers.decemberSolstice, markers.marchEquinox, markers.septemberEquinox]) {
      expect(day).toBeGreaterThanOrEqual(-halfWindow);
      expect(day).toBeLessThanOrEqual(halfWindow);
    }
  });

  it("juneSolstice declination is close to +EARTH_AXIAL_TILT_DEG (max declination of the year)", () => {
    expect(declinationDegAt(markers.juneSolstice)).toBeCloseTo(EARTH_AXIAL_TILT_DEG, 0);
  });

  it("decemberSolstice declination is close to -EARTH_AXIAL_TILT_DEG (min declination of the year)", () => {
    expect(declinationDegAt(markers.decemberSolstice)).toBeCloseTo(-EARTH_AXIAL_TILT_DEG, 0);
  });

  it("equinox declinations are close to 0", () => {
    expect(declinationDegAt(markers.marchEquinox)).toBeCloseTo(0, 0);
    expect(declinationDegAt(markers.septemberEquinox)).toBeCloseTo(0, 0);
  });

  it("the four markers are roughly evenly spaced across the year (~1/4 year apart, generous tolerance for real orbital eccentricity)", () => {
    const sorted = [markers.juneSolstice, markers.decemberSolstice, markers.marchEquinox, markers.septemberEquinox].sort(
      (a, b) => a - b,
    );
    const quarterYear = EARTH_ORBIT_PERIOD_DAYS / 4;
    for (let i = 0; i < 4; i++) {
      const gap = i < 3 ? sorted[i + 1] - sorted[i] : sorted[0] + EARTH_ORBIT_PERIOD_DAYS - sorted[3];
      expect(gap).toBeGreaterThan(quarterYear - 15);
      expect(gap).toBeLessThan(quarterYear + 15);
    }
  });

  it("throws if windowDays is too small to contain both equinoxes", () => {
    expect(() => findSeasonalMarkers(0, 10)).toThrow();
  });
});
