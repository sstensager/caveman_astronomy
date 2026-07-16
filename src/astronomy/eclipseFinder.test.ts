import { describe, expect, it } from "vitest";
import { findNearestEclipseAlignment } from "./eclipseFinder";

describe("findNearestEclipseAlignment", () => {
  it("finds a close alignment within an eclipse-season-sized window", () => {
    // Real eclipse seasons recur roughly every ~173 days (half the ~346-day
    // eclipse year), so scanning a window comfortably larger than that
    // should always turn up a near-syzygy-near-node moment.
    const result = findNearestEclipseAlignment(0, 200);
    expect(result).toBeDefined();
    const syzygyErrorDeg = result!.kind === "solar" ? result!.separationDeg : 180 - result!.separationDeg;
    expect(syzygyErrorDeg).toBeLessThan(10);
    expect(Math.abs(result!.moonLatitudeDeg)).toBeLessThan(10);
  });

  it("returns a day within the requested window", () => {
    const centerDay = 500;
    const windowDays = 100;
    const result = findNearestEclipseAlignment(centerDay, windowDays, 0.5);
    expect(result).toBeDefined();
    expect(result!.day).toBeGreaterThanOrEqual(centerDay - windowDays);
    expect(result!.day).toBeLessThanOrEqual(centerDay + windowDays);
  });
});
