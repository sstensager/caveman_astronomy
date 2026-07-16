import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { embedOnSphere, tangentPolarPoint } from "./surfacePlacement";

describe("tangentPolarPoint", () => {
  const origin = new THREE.Vector3(0, 5, 0);
  const north = new THREE.Vector3(1, 0, 0);
  const east = new THREE.Vector3(0, 0, 1);

  it("moves purely along north at bearing 0", () => {
    const point = tangentPolarPoint(origin, north, east, 0, 2);
    expect(point.x).toBeCloseTo(2, 10);
    expect(point.z).toBeCloseTo(0, 10);
    expect(point.y).toBeCloseTo(5, 10);
  });

  it("moves purely along east at bearing 90", () => {
    const point = tangentPolarPoint(origin, north, east, 90, 2);
    expect(point.x).toBeCloseTo(0, 10);
    expect(point.z).toBeCloseTo(2, 10);
  });

  it("moves purely along south (-north) at bearing 180", () => {
    const point = tangentPolarPoint(origin, north, east, 180, 2);
    expect(point.x).toBeCloseTo(-2, 10);
    expect(point.z).toBeCloseTo(0, 10);
  });
});

describe("embedOnSphere", () => {
  it("renormalizes an off-sphere point back onto the sphere radius, minus embedDepth", () => {
    // A point deliberately off-sphere (distance from origin != 5).
    const offset = new THREE.Vector3(6, 0, 0);
    const { position, up } = embedOnSphere(offset, 5, 0.1);
    expect(position.length()).toBeCloseTo(4.9, 10);
    expect(up.length()).toBeCloseTo(1, 10);
    expect(position.clone().normalize().dot(up)).toBeCloseTo(1, 10);
  });

  it("defaults embedDepth to 0 (lands exactly on the sphere)", () => {
    const offset = new THREE.Vector3(0, 7, 0);
    const { position } = embedOnSphere(offset, 5);
    expect(position.length()).toBeCloseTo(5, 10);
  });

  it("up points in the same direction as the input offset (direction-only, radius-agnostic)", () => {
    const offset = new THREE.Vector3(3, 4, 0); // length 5, but direction is what matters
    const { up } = embedOnSphere(offset, 100, 2);
    expect(up.x).toBeCloseTo(0.6, 10);
    expect(up.y).toBeCloseTo(0.8, 10);
  });
});
