import { describe, expect, it } from "vitest";
import { ECLIPTIC_POLE_IN_WORLD, eclipticToWorld } from "./frames";
import { EARTH_AXIAL_TILT_DEG } from "./constants";

const OBLIQUITY_RAD = (EARTH_AXIAL_TILT_DEG * Math.PI) / 180;

describe("eclipticToWorld", () => {
  it("tilts the ecliptic pole away from world +Y by the real obliquity, matching the {sin, cos, 0} convention documented on ModernHeliocentricModel's EARTH_ROTATION_AXIS", () => {
    const pole = eclipticToWorld({ x: 0, y: 1, z: 0 });
    expect(pole.x).toBeCloseTo(Math.sin(OBLIQUITY_RAD));
    expect(pole.y).toBeCloseTo(Math.cos(OBLIQUITY_RAD));
    expect(pole.z).toBeCloseTo(0);
  });

  it("leaves vectors along the rotation axis (Z) unchanged", () => {
    const v = eclipticToWorld({ x: 0, y: 0, z: 500 });
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(500);
  });

  it("is a pure rotation - preserves vector length", () => {
    const v = eclipticToWorld({ x: 3, y: -4, z: 5 });
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    expect(length).toBeCloseTo(Math.sqrt(3 * 3 + 4 * 4 + 5 * 5));
  });
});

describe("ECLIPTIC_POLE_IN_WORLD", () => {
  it("equals eclipticToWorld applied to ecliptic +Y", () => {
    const recomputed = eclipticToWorld({ x: 0, y: 1, z: 0 });
    expect(ECLIPTIC_POLE_IN_WORLD.x).toBeCloseTo(recomputed.x);
    expect(ECLIPTIC_POLE_IN_WORLD.y).toBeCloseTo(recomputed.y);
    expect(ECLIPTIC_POLE_IN_WORLD.z).toBeCloseTo(recomputed.z);
  });

  it("is NOT world +Y - the ecliptic pole and celestial pole are genuinely different directions", () => {
    expect(ECLIPTIC_POLE_IN_WORLD.y).toBeLessThan(1);
    expect(Math.abs(ECLIPTIC_POLE_IN_WORLD.x)).toBeGreaterThan(0);
  });
});
