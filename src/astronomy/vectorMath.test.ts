import { describe, expect, it } from "vitest";
import { addVectors, circularOrbitPosition, inclinedOrbitPosition, length, subVectors } from "./vectorMath";

describe("addVectors / subVectors", () => {
  it("adds and subtracts component-wise", () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 4, y: -1, z: 0.5 };
    expect(addVectors(a, b)).toEqual({ x: 5, y: 1, z: 3.5 });
    expect(subVectors(a, b)).toEqual({ x: -3, y: 3, z: 2.5 });
  });
});

describe("length", () => {
  it("computes euclidean length", () => {
    expect(length({ x: 3, y: 4, z: 0 })).toBeCloseTo(5);
  });
});

describe("circularOrbitPosition", () => {
  it("stays at constant radius from origin for any angle", () => {
    for (const angle of [0, 0.5, Math.PI / 2, Math.PI, 4.2]) {
      expect(length(circularOrbitPosition(10, angle))).toBeCloseTo(10);
    }
  });

  it("lies in the X-Z plane (y=0)", () => {
    expect(circularOrbitPosition(10, 1.23).y).toBe(0);
  });

  it("matches known angles", () => {
    expect(circularOrbitPosition(10, 0)).toEqual({ x: 10, y: 0, z: 0 });
    const quarterTurn = circularOrbitPosition(10, Math.PI / 2);
    expect(quarterTurn.x).toBeCloseTo(0);
    expect(quarterTurn.z).toBeCloseTo(10);
  });
});

describe("inclinedOrbitPosition", () => {
  it("reduces to circularOrbitPosition at zero inclination", () => {
    const angle = 1.1;
    const flat = circularOrbitPosition(5, angle);
    const inclined = inclinedOrbitPosition(5, angle, 0);
    expect(inclined.x).toBeCloseTo(flat.x);
    expect(inclined.y).toBeCloseTo(flat.y);
    expect(inclined.z).toBeCloseTo(flat.z);
  });

  it("stays at constant radius from origin regardless of inclination", () => {
    expect(length(inclinedOrbitPosition(7, 2.0, 5.14))).toBeCloseTo(7);
  });

  it("tilts out of the y=0 plane when inclined and z would be nonzero", () => {
    // angle = pi/2 puts the flat position entirely on +z, so inclination
    // should visibly lift it out of the y=0 plane.
    const inclined = inclinedOrbitPosition(10, Math.PI / 2, 5.14);
    expect(Math.abs(inclined.y)).toBeGreaterThan(0.01);
  });
});
