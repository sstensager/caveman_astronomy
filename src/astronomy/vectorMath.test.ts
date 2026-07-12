import { describe, expect, it } from "vitest";
import {
  addVectors,
  circularOrbitPosition,
  ellipticalOrbitPosition,
  inclinedEllipticalOrbitPosition,
  inclinedOrbitPosition,
  length,
  subVectors,
} from "./vectorMath";

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

describe("ellipticalOrbitPosition", () => {
  it("reduces exactly to circularOrbitPosition at zero eccentricity", () => {
    for (const angle of [0, 0.5, Math.PI / 2, Math.PI, 4.2]) {
      const circular = circularOrbitPosition(10, angle);
      const elliptical = ellipticalOrbitPosition(10, 0, 0, angle);
      expect(elliptical.x).toBeCloseTo(circular.x);
      expect(elliptical.y).toBeCloseTo(circular.y);
      expect(elliptical.z).toBeCloseTo(circular.z);
    }
  });

  it("lies in the X-Z plane (y=0)", () => {
    expect(ellipticalOrbitPosition(10, 0.5, 1.0, 2.0).y).toBe(0);
  });

  it("is closest to the origin (periapsis) at mean anomaly 0, along the argument-of-periapsis direction", () => {
    const a = 10;
    const e = 0.5;
    const omega = 0;
    const periapsis = ellipticalOrbitPosition(a, e, omega, 0);
    // Periapsis distance = a(1-e).
    expect(length(periapsis)).toBeCloseTo(a * (1 - e));
    expect(periapsis.x).toBeCloseTo(a * (1 - e));
    expect(periapsis.z).toBeCloseTo(0);
  });

  it("is farthest from the origin (apoapsis) at mean anomaly PI", () => {
    const a = 10;
    const e = 0.5;
    const apoapsis = ellipticalOrbitPosition(a, e, 0, Math.PI);
    // Apoapsis distance = a(1+e).
    expect(length(apoapsis)).toBeCloseTo(a * (1 + e));
  });

  it("respects argumentOfPeriapsis as a pure rotation of the ellipse", () => {
    const a = 10;
    const e = 0.5;
    const rotated = ellipticalOrbitPosition(a, e, Math.PI / 2, 0);
    // Periapsis should now point along +Z instead of +X.
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.z).toBeCloseTo(a * (1 - e));
  });

  it("negation is itself a valid ellipse of the same shape, via argumentOfPeriapsis + PI - the trick GeocentricModel's Sun relies on", () => {
    const a = 10;
    const e = 0.3;
    const omega = 0.7;
    for (const M of [0, 1.2, Math.PI, 4.5]) {
      const original = ellipticalOrbitPosition(a, e, omega, M);
      const negatedViaOmega = ellipticalOrbitPosition(a, e, omega + Math.PI, M);
      expect(negatedViaOmega.x).toBeCloseTo(-original.x);
      expect(negatedViaOmega.z).toBeCloseTo(-original.z);
    }
  });
});

describe("inclinedEllipticalOrbitPosition", () => {
  it("reduces exactly to inclinedOrbitPosition at zero eccentricity and zero ascending node", () => {
    const angle = 1.1;
    const inclinationDeg = 5.14;
    const plain = inclinedOrbitPosition(5, angle, inclinationDeg);
    const generalized = inclinedEllipticalOrbitPosition(5, 0, 0, angle, inclinationDeg);
    expect(generalized.x).toBeCloseTo(plain.x);
    expect(generalized.y).toBeCloseTo(plain.y);
    expect(generalized.z).toBeCloseTo(plain.z);
  });

  it("stays at constant radius from origin regardless of ascending node rotation", () => {
    const withoutNode = inclinedEllipticalOrbitPosition(10, 0.3, 0.5, 2.0, 5.14, 0);
    const withNode = inclinedEllipticalOrbitPosition(10, 0.3, 0.5, 2.0, 5.14, Math.PI / 3);
    expect(length(withNode)).toBeCloseTo(length(withoutNode));
  });

  it("ascending node rotation is a pure rotation about the pole (Y axis) - Y unchanged, X/Z rotated", () => {
    const base = inclinedEllipticalOrbitPosition(10, 0.3, 0.5, 2.0, 5.14, 0);
    const rotated = inclinedEllipticalOrbitPosition(10, 0.3, 0.5, 2.0, 5.14, Math.PI / 2);
    expect(rotated.y).toBeCloseTo(base.y);
    // A 90 degree rotation about Y maps (x,z) -> (z,-x) under this function's convention.
    expect(rotated.x).toBeCloseTo(base.z);
    expect(rotated.z).toBeCloseTo(-base.x);
  });
});
