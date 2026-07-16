import { describe, expect, it } from "vitest";
import { computeHengeLayout } from "./hengeLayout";

const STONEHENGE_LAT_DEG = 51.1789;

function angularDistanceDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

describe("computeHengeLayout", () => {
  it("places ring stones on the evenly-spaced 12-position grid, minus gaps at each marker bearing", () => {
    const stones = computeHengeLayout(STONEHENGE_LAT_DEG);
    const ringStones = stones.filter((s) => s.kind === "ring");
    // Real Stonehenge leaves a gap in the circle at each real alignment -
    // you sight OUT through the gap toward the marker stone, not through
    // solid rock - so fewer than the full 12 grid positions survive.
    expect(ringStones.length).toBeLessThan(12);
    expect(ringStones.length).toBeGreaterThan(0);
    for (const ring of ringStones) {
      expect(ring.bearingDeg % 30).toBeCloseTo(0, 6);
    }
  });

  it("never places a ring stone close enough to a marker bearing to block its sightline", () => {
    const stones = computeHengeLayout(STONEHENGE_LAT_DEG);
    const ringStones = stones.filter((s) => s.kind === "ring");
    const markers = stones.filter((s) => s.kind === "marker");
    const gapDeg = (360 / 12) * 0.6;
    for (const ring of ringStones) {
      for (const marker of markers) {
        expect(angularDistanceDeg(ring.bearingDeg, marker.bearingDeg)).toBeGreaterThanOrEqual(gapDeg);
      }
    }
  });

  it("respects a custom ringCount, still leaving gaps at marker bearings", () => {
    const stones = computeHengeLayout(STONEHENGE_LAT_DEG, { ringCount: 8 });
    const ringStones = stones.filter((s) => s.kind === "ring");
    expect(ringStones.length).toBeLessThan(8);
    expect(ringStones.length).toBeGreaterThan(0);
  });

  it("places exactly 5 marker stones at a normal (non-polar) latitude", () => {
    const stones = computeHengeLayout(STONEHENGE_LAT_DEG);
    const markers = stones.filter((s) => s.kind === "marker");
    expect(markers.length).toBe(5);
    const labels = markers.map((s) => s.label).sort();
    expect(labels).toEqual([
      "Equinox Sunrise (due east)",
      "Equinox Sunset (due west)",
      "Summer Solstice Sunrise",
      "Winter Solstice Sunrise",
      "Winter Solstice Sunset",
    ]);
  });

  it("winter-solstice sunrise sits at the mirror bearing of summer-solstice sunrise (180 - bearing)", () => {
    const stones = computeHengeLayout(STONEHENGE_LAT_DEG);
    const summerSunrise = stones.find((s) => s.label === "Summer Solstice Sunrise")!;
    const winterSunrise = stones.find((s) => s.label === "Winter Solstice Sunrise")!;
    expect(winterSunrise.bearingDeg).toBeCloseTo(180 - summerSunrise.bearingDeg, 8);
  });

  it("summer-sunrise and winter-sunset markers form a single straight axis (exactly 180deg apart)", () => {
    const stones = computeHengeLayout(STONEHENGE_LAT_DEG);
    const summerSunrise = stones.find((s) => s.label === "Summer Solstice Sunrise")!;
    const winterSunset = stones.find((s) => s.label === "Winter Solstice Sunset")!;
    expect((summerSunrise.bearingDeg + 180) % 360).toBeCloseTo(winterSunset.bearingDeg, 8);
  });

  it("equinox markers sit exactly due east and due west", () => {
    const stones = computeHengeLayout(STONEHENGE_LAT_DEG);
    const sunrise = stones.find((s) => s.label === "Equinox Sunrise (due east)")!;
    const sunset = stones.find((s) => s.label === "Equinox Sunset (due west)")!;
    expect(sunrise.bearingDeg).toBeCloseTo(90, 8);
    expect(sunset.bearingDeg).toBeCloseTo(270, 8);
  });

  it("markers sit at a larger radius than ring stones", () => {
    const stones = computeHengeLayout(STONEHENGE_LAT_DEG);
    const ringRadius = stones.find((s) => s.kind === "ring")!.radiusUnits;
    const markerRadius = stones.find((s) => s.kind === "marker")!.radiusUnits;
    expect(markerRadius).toBeGreaterThan(ringRadius);
  });

  it("omits solstice markers (but keeps equinox markers) at a polar latitude", () => {
    // lat=70: summer solstice is polar day, winter solstice is polar night
    // (see sunHorizon.test.ts) - neither has a real sunrise/sunset that day.
    const stones = computeHengeLayout(70);
    const markers = stones.filter((s) => s.kind === "marker");
    expect(markers.map((s) => s.label).sort()).toEqual(["Equinox Sunrise (due east)", "Equinox Sunset (due west)"]);
  });
});
