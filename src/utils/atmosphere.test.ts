import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { computeDayFactor, computeSunsetFactor } from "./atmosphere";

const UP = new THREE.Vector3(0, 1, 0);

describe("computeDayFactor", () => {
  it("is near 1 when the sun is well above the horizon", () => {
    expect(computeDayFactor(UP, new THREE.Vector3(0, 1, 0), 0.2)).toBeCloseTo(1);
  });

  it("is near 0 when the sun is well below the horizon", () => {
    expect(computeDayFactor(UP, new THREE.Vector3(0, -1, 0), 0.2)).toBeCloseTo(0);
  });

  it("is exactly 0.5 when the sun sits exactly at the horizon", () => {
    expect(computeDayFactor(UP, new THREE.Vector3(1, 0, 0), 0.2)).toBeCloseTo(0.5);
  });

  it("reaches exactly 1/0 at the +-softness boundary", () => {
    const softness = 0.2;
    // dot(up, sun) = softness -> upper edge of the smoothstep band
    const above = new THREE.Vector3(Math.sqrt(1 - softness * softness), softness, 0);
    const below = new THREE.Vector3(Math.sqrt(1 - softness * softness), -softness, 0);
    expect(computeDayFactor(UP, above, softness)).toBeCloseTo(1);
    expect(computeDayFactor(UP, below, softness)).toBeCloseTo(0);
  });

  it("increases monotonically as the sun rises from below to above the horizon", () => {
    const angles = [-Math.PI / 2, -0.5, -0.1, 0, 0.1, 0.5, Math.PI / 2];
    const values = angles.map((angle) => computeDayFactor(UP, new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0), 0.2));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});

describe("computeSunsetFactor", () => {
  it("peaks at exactly 1 when the sun sits exactly at the horizon", () => {
    expect(computeSunsetFactor(UP, new THREE.Vector3(1, 0, 0), 0.15)).toBeCloseTo(1);
  });

  it("is exactly 0 at the +-band boundary", () => {
    const band = 0.15;
    const above = new THREE.Vector3(Math.sqrt(1 - band * band), band, 0);
    const below = new THREE.Vector3(Math.sqrt(1 - band * band), -band, 0);
    expect(computeSunsetFactor(UP, above, band)).toBeCloseTo(0);
    expect(computeSunsetFactor(UP, below, band)).toBeCloseTo(0);
  });

  it("clamps to 0 well outside the band, never negative", () => {
    expect(computeSunsetFactor(UP, new THREE.Vector3(0, 1, 0), 0.15)).toBe(0);
    expect(computeSunsetFactor(UP, new THREE.Vector3(0, -1, 0), 0.15)).toBe(0);
  });

  it("is symmetric between sunrise and sunset (equal |dot|)", () => {
    const angle = 0.3;
    const sunrise = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    const sunset = new THREE.Vector3(Math.cos(angle), -Math.sin(angle), 0);
    expect(computeSunsetFactor(UP, sunrise, 0.5)).toBeCloseTo(computeSunsetFactor(UP, sunset, 0.5));
  });
});
