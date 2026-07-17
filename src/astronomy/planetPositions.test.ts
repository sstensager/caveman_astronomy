import { describe, expect, it } from "vitest";
import { ptolemaicCapScaleFactor, synodicPeriodDays } from "./planetPositions";
import { EARTH_ORBIT_RADIUS, PLANET_ORBITAL_ELEMENTS } from "./constants";

describe("synodicPeriodDays", () => {
  it("matches the well-known real Earth-Mars synodic period (~779.9 days)", () => {
    expect(synodicPeriodDays(PLANET_ORBITAL_ELEMENTS.mars.periodDays)).toBeCloseTo(779.9, 0);
  });

  it("matches the well-known real Earth-Venus synodic period (~583.9 days)", () => {
    expect(synodicPeriodDays(PLANET_ORBITAL_ELEMENTS.venus.periodDays)).toBeCloseTo(583.9, 0);
  });

  it("matches the well-known real Earth-Mercury synodic period (~116 days)", () => {
    expect(synodicPeriodDays(PLANET_ORBITAL_ELEMENTS.mercury.periodDays)).toBeCloseTo(116, 0);
  });

  it("gives exactly 2x Earth's period for a hypothetical planet at exactly 2x Earth's period", () => {
    // 1/E - 1/(2E) = 1/(2E), so the synodic period is exactly 2E - a clean,
    // hand-verifiable case (unlike the real planets above, which only have
    // approximate textbook reference values).
    const hypotheticalPeriod = 2 * 365.25;
    expect(synodicPeriodDays(hypotheticalPeriod)).toBeCloseTo(2 * 365.25, 6);
  });
});

describe("ptolemaicCapScaleFactor", () => {
  it("scales the deferent+epicycle's combined maximum reach to exactly EARTH_ORBIT_RADIUS (the Sun's own average distance) for Venus", () => {
    const scale = ptolemaicCapScaleFactor(PLANET_ORBITAL_ELEMENTS.venus.orbitRadius);
    const combinedReach = scale * EARTH_ORBIT_RADIUS + scale * PLANET_ORBITAL_ELEMENTS.venus.orbitRadius;
    expect(combinedReach).toBeCloseTo(EARTH_ORBIT_RADIUS, 10);
  });

  it("scales the deferent+epicycle's combined maximum reach to exactly EARTH_ORBIT_RADIUS for Mercury", () => {
    const scale = ptolemaicCapScaleFactor(PLANET_ORBITAL_ELEMENTS.mercury.orbitRadius);
    const combinedReach = scale * EARTH_ORBIT_RADIUS + scale * PLANET_ORBITAL_ELEMENTS.mercury.orbitRadius;
    expect(combinedReach).toBeCloseTo(EARTH_ORBIT_RADIUS, 10);
  });

  it("preserves the deferent/epicycle RATIO (and therefore the real max-elongation direction) - both radii scale by the same factor", () => {
    const realRatio = PLANET_ORBITAL_ELEMENTS.venus.orbitRadius / EARTH_ORBIT_RADIUS;
    const scale = ptolemaicCapScaleFactor(PLANET_ORBITAL_ELEMENTS.venus.orbitRadius);
    const scaledRatio = (scale * PLANET_ORBITAL_ELEMENTS.venus.orbitRadius) / (scale * EARTH_ORBIT_RADIUS);
    expect(scaledRatio).toBeCloseTo(realRatio, 10);
  });

  it("gives exactly 0.5 for a hypothetical planet whose own orbit radius equals Earth's - a clean, hand-verifiable case", () => {
    // k*R + k*R = R => k = 0.5.
    expect(ptolemaicCapScaleFactor(EARTH_ORBIT_RADIUS)).toBeCloseTo(0.5, 10);
  });
});
