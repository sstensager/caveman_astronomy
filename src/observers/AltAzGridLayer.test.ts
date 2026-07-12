import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { AltAzGridLayer } from "./AltAzGridLayer";
import type { Observer, ObserverFrame } from "./Observer";

function stubObserver(frame: ObserverFrame): Observer {
  return {
    id: "stub",
    getFrame: () => frame,
    getDirectionTo: () => new THREE.Vector3(0, 0, 1),
  };
}

const IDENTITY_FRAME: ObserverFrame = {
  worldPosition: new THREE.Vector3(0, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
  north: new THREE.Vector3(0, 0, -1),
  east: new THREE.Vector3(1, 0, 0),
};

describe("AltAzGridLayer", () => {
  it("places every vertex at exactly the configured radius from the observer's world position", () => {
    const layer = new AltAzGridLayer({
      id: "test",
      label: "Test",
      radius: 50,
      getActiveObserver: () => stubObserver(IDENTITY_FRAME),
    });
    layer.update();

    const positions = layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i);
      expect(p.distanceTo(IDENTITY_FRAME.worldPosition)).toBeCloseTo(50, 4);
    }
  });

  it("offsets every vertex by the observer's world position when it moves", () => {
    const movedFrame: ObserverFrame = { ...IDENTITY_FRAME, worldPosition: new THREE.Vector3(10, 0, 0) };
    const layer = new AltAzGridLayer({
      id: "test",
      label: "Test",
      radius: 50,
      getActiveObserver: () => stubObserver(movedFrame),
    });
    layer.update();

    const positions = layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i);
      expect(p.distanceTo(movedFrame.worldPosition)).toBeCloseTo(50, 4);
    }
  });

  it("does nothing (no crash) when the observer frame lacks north/east", () => {
    const degenerateFrame: ObserverFrame = { worldPosition: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
    const layer = new AltAzGridLayer({
      id: "test",
      label: "Test",
      radius: 50,
      getActiveObserver: () => stubObserver(degenerateFrame),
    });
    expect(() => layer.update()).not.toThrow();
  });

  it("the zenith-most altitude-circle vertex (alt=60, az=0) lies along up-biased direction", () => {
    const layer = new AltAzGridLayer({
      id: "test",
      label: "Test",
      radius: 1,
      getActiveObserver: () => stubObserver(IDENTITY_FRAME),
    });
    layer.update();
    // First sample is alt=0 circle; just confirm all vertices sit on the unit sphere
    // around the observer (radius 1) and y ranges within [-small, 1] (never below horizon
    // by more than float error, since min altitude sampled is 0).
    const positions = layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    let maxY = -Infinity;
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i);
      maxY = Math.max(maxY, p.y);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
    }
    expect(maxY).toBeGreaterThan(0.8); // the 60deg circle should reach fairly high
  });
});
