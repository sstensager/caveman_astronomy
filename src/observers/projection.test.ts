import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { projectDirectionToSphere } from "./projection";

describe("projectDirectionToSphere", () => {
  it("produces a point at exactly the given radius", () => {
    const point = projectDirectionToSphere(new THREE.Vector3(3, 4, 0), 100);
    expect(point.length()).toBeCloseTo(100);
  });

  it("preserves direction (normalizes, doesn't distort)", () => {
    const direction = new THREE.Vector3(1, 1, 1);
    const point = projectDirectionToSphere(direction, 50);
    const expectedDirection = direction.clone().normalize();
    expect(point.clone().normalize().x).toBeCloseTo(expectedDirection.x);
    expect(point.clone().normalize().y).toBeCloseTo(expectedDirection.y);
    expect(point.clone().normalize().z).toBeCloseTo(expectedDirection.z);
  });

  it("does not mutate the input direction", () => {
    const direction = new THREE.Vector3(0, 0, 5);
    projectDirectionToSphere(direction, 20);
    expect(direction).toEqual(new THREE.Vector3(0, 0, 5));
  });

  it("scales correctly for an already-unit vector", () => {
    const point = projectDirectionToSphere(new THREE.Vector3(0, 1, 0), 2000);
    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(2000);
    expect(point.z).toBeCloseTo(0);
  });
});
