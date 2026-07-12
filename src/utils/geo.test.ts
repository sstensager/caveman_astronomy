import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { computeNorthEast, latLonToSurfacePoint, surfacePointToLatLon } from "./geo";

describe("surfacePointToLatLon", () => {
  it("is the exact inverse of latLonToSurfacePoint for sampled lat/lon pairs", () => {
    const samples: Array<[number, number]> = [
      [0, 0],
      [45, 0],
      [-45, 0],
      [0, 90],
      [0, -90],
      [0, 180],
      [30, 120],
      [-60, -150],
      [89, 45],
      [-89, -45],
    ];
    for (const [latDeg, lonDeg] of samples) {
      const point = latLonToSurfacePoint(latDeg, lonDeg, 5);
      const result = surfacePointToLatLon(point);
      expect(result.latDeg).toBeCloseTo(latDeg, 8);
      expect(result.lonDeg).toBeCloseTo(lonDeg, 8);
    }
  });

  it("is radius-agnostic - only direction matters", () => {
    const point = latLonToSurfacePoint(37, -12, 1);
    const scaled = point.clone().multiplyScalar(250);
    const a = surfacePointToLatLon(point);
    const b = surfacePointToLatLon(scaled);
    expect(b.latDeg).toBeCloseTo(a.latDeg, 8);
    expect(b.lonDeg).toBeCloseTo(a.lonDeg, 8);
  });

  it("handles the poles without producing NaN", () => {
    const northPole = latLonToSurfacePoint(90, 0, 5);
    const southPole = latLonToSurfacePoint(-90, 0, 5);
    expect(surfacePointToLatLon(northPole).latDeg).toBeCloseTo(90, 8);
    expect(surfacePointToLatLon(southPole).latDeg).toBeCloseTo(-90, 8);
  });
});

describe("computeNorthEast", () => {
  const polarAxis = new THREE.Vector3(0, 1, 0);

  it("forms a right-handed (East, North, Up) frame orthogonal to up", () => {
    const up = latLonToSurfacePoint(37, 22, 1);
    const { north, east } = computeNorthEast(up, polarAxis);
    expect(north.dot(up)).toBeCloseTo(0, 10);
    expect(east.dot(up)).toBeCloseTo(0, 10);
    expect(east.dot(north)).toBeCloseTo(0, 10);
    expect(new THREE.Vector3().crossVectors(up, north).distanceTo(east)).toBeCloseTo(0, 10);
  });

  it("falls back to a defined tangent at the poles instead of NaN", () => {
    const { north, east } = computeNorthEast(polarAxis.clone(), polarAxis);
    expect(Number.isNaN(north.x)).toBe(false);
    expect(Number.isNaN(east.x)).toBe(false);
    expect(north.length()).toBeCloseTo(1, 10);
    expect(east.length()).toBeCloseTo(1, 10);
  });
});
