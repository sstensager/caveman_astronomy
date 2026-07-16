import { describe, expect, it } from "vitest";
import { sunHorizonAzimuths } from "./sunHorizon";

const EARTH_AXIAL_TILT_DEG = 23.44;
const STONEHENGE_LAT_DEG = 51.1789;

describe("sunHorizonAzimuths", () => {
  it("gives exactly due east sunrise / due west sunset at the equinox, at any latitude", () => {
    for (const latDeg of [0, 30, 60, -45]) {
      const event = sunHorizonAzimuths(latDeg, 0);
      expect(event.kind).toBe("normal");
      if (event.kind === "normal") {
        expect(event.sunriseAzimuthDeg).toBeCloseTo(90, 8);
        expect(event.sunsetAzimuthDeg).toBeCloseTo(270, 8);
      }
    }
  });

  it("predicts a summer-solstice sunrise azimuth close to real Stonehenge's historically-known Heel Stone alignment (~49-51deg)", () => {
    const event = sunHorizonAzimuths(STONEHENGE_LAT_DEG, EARTH_AXIAL_TILT_DEG);
    expect(event.kind).toBe("normal");
    if (event.kind === "normal") {
      expect(event.sunriseAzimuthDeg).toBeGreaterThan(49);
      expect(event.sunriseAzimuthDeg).toBeLessThan(52);
    }
  });

  it("winter-solstice sunset sits exactly opposite (180deg from) summer-solstice sunrise at the same latitude", () => {
    const summer = sunHorizonAzimuths(STONEHENGE_LAT_DEG, EARTH_AXIAL_TILT_DEG);
    const winter = sunHorizonAzimuths(STONEHENGE_LAT_DEG, -EARTH_AXIAL_TILT_DEG);
    expect(summer.kind).toBe("normal");
    expect(winter.kind).toBe("normal");
    if (summer.kind === "normal" && winter.kind === "normal") {
      const expectedWinterSunset = (summer.sunriseAzimuthDeg + 180) % 360;
      expect(winter.sunsetAzimuthDeg).toBeCloseTo(expectedWinterSunset, 8);
    }
  });

  it("detects polar day (midnight sun) above the Arctic/Antarctic circle at the relevant solstice", () => {
    expect(sunHorizonAzimuths(70, EARTH_AXIAL_TILT_DEG).kind).toBe("polarDay");
    expect(sunHorizonAzimuths(-70, -EARTH_AXIAL_TILT_DEG).kind).toBe("polarDay");
  });

  it("detects polar night above the Arctic/Antarctic circle at the opposite solstice", () => {
    expect(sunHorizonAzimuths(70, -EARTH_AXIAL_TILT_DEG).kind).toBe("polarNight");
    expect(sunHorizonAzimuths(-70, EARTH_AXIAL_TILT_DEG).kind).toBe("polarNight");
  });

  it("stays normal (no polar day/night) at mid latitudes on the solstices", () => {
    expect(sunHorizonAzimuths(STONEHENGE_LAT_DEG, EARTH_AXIAL_TILT_DEG).kind).toBe("normal");
    expect(sunHorizonAzimuths(STONEHENGE_LAT_DEG, -EARTH_AXIAL_TILT_DEG).kind).toBe("normal");
  });
});
