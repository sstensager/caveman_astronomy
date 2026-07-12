import { describe, expect, it } from "vitest";
import { starColorFromColorIndex } from "./starColor";

describe("starColorFromColorIndex", () => {
  it("falls back to white when no color index is given", () => {
    expect(starColorFromColorIndex(undefined)).toEqual([1, 1, 1]);
  });

  it("returns white for a neutral (A-type) B-V of 0.0", () => {
    const [r, g, b] = starColorFromColorIndex(0.0);
    expect(r).toBeCloseTo(1, 5);
    expect(g).toBeCloseTo(1, 5);
    expect(b).toBeCloseTo(1, 5);
  });

  it("returns a blue-leaning color for a hot (negative B-V) star", () => {
    const [r, , b] = starColorFromColorIndex(-0.4);
    expect(b).toBeGreaterThan(r);
  });

  it("returns a red-leaning color for a cool (large positive B-V) star", () => {
    const [r, , b] = starColorFromColorIndex(2.0);
    expect(r).toBeGreaterThan(b);
  });

  it("clamps out-of-range color indices instead of extrapolating", () => {
    const extreme = starColorFromColorIndex(10);
    const clamped = starColorFromColorIndex(2.0);
    expect(extreme).toEqual(clamped);
  });
});
