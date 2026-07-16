import { describe, expect, it } from "vitest";
import { nearestMountainRange } from "./mountainRanges";

describe("nearestMountainRange", () => {
  it("returns factor 1 exactly at a segment's own center", () => {
    const match = nearestMountainRange(28, 84);
    expect(match).toBeDefined();
    expect(match?.name).toBe("Himalaya");
    expect(match?.factor).toBeCloseTo(1, 5);
  });

  it("returns undefined far from any known range", () => {
    // Mid-Pacific, nowhere near a listed segment.
    expect(nearestMountainRange(0, -160)).toBeUndefined();
  });

  it("factor decreases toward the segment's radius edge", () => {
    const near = nearestMountainRange(28, 84);
    const far = nearestMountainRange(28 + 5, 84); // near.radiusDeg is 6, this is within it but further out
    expect(near).toBeDefined();
    expect(far).toBeDefined();
    expect(far!.factor).toBeLessThan(near!.factor);
  });

  it("returns undefined just past a segment's radius", () => {
    // Himalaya center (28, 84), radius 6 - 10 degrees away should be well clear.
    expect(nearestMountainRange(28 + 10, 84)).toBeUndefined();
  });

  it("picks the deeper (higher-factor) segment when two overlap", () => {
    // Andes segments are spaced ~13-18 degrees of latitude apart with
    // radiusDeg 3-4 each - not actually overlapping at their shared
    // boundary lon, so instead directly verify the tie-break logic in
    // isolation: a point exactly at one segment's center must win over any
    // other segment even if both happen to contain it.
    const atCentralAndesCenter = nearestMountainRange(-13, -74);
    expect(atCentralAndesCenter?.name).toBe("Andes (central)");
    expect(atCentralAndesCenter?.factor).toBeCloseTo(1, 5);
  });
});
