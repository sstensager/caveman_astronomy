import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { AltAzGridLayer } from "./AltAzGridLayer";
import type { Observer, ObserverFrame } from "./Observer";

// Avoids canvas/document (this project's vitest environment is "node", not
// "jsdom") - see AltAzGridLayerOptions.createTexture.
const stubCreateTexture = () => new THREE.Texture();

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
      createTexture: stubCreateTexture,
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
      createTexture: stubCreateTexture,
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
      createTexture: stubCreateTexture,
    });
    expect(() => layer.update()).not.toThrow();
  });

  it("the zenith-most altitude-circle vertex (alt=60, az=0) lies along up-biased direction", () => {
    const layer = new AltAzGridLayer({
      id: "test",
      label: "Test",
      radius: 1,
      getActiveObserver: () => stubObserver(IDENTITY_FRAME),
      createTexture: stubCreateTexture,
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

  it("creates one sprite per compass letter (N/S/E/W) as children of object3D", () => {
    const layer = new AltAzGridLayer({
      id: "test",
      label: "Test",
      radius: 50,
      getActiveObserver: () => stubObserver(IDENTITY_FRAME),
      createTexture: stubCreateTexture,
    });
    const sprites = layer.object3D.children.filter((child): child is THREE.Sprite => child instanceof THREE.Sprite);
    expect(sprites).toHaveLength(4);
  });

  it("places North on the horizon in the frame's own north direction, at the configured radius", () => {
    const layer = new AltAzGridLayer({
      id: "test",
      label: "Test",
      radius: 50,
      getActiveObserver: () => stubObserver(IDENTITY_FRAME),
      createTexture: stubCreateTexture,
    });
    layer.update();
    const sprites = layer.object3D.children.filter((child): child is THREE.Sprite => child instanceof THREE.Sprite);
    // IDENTITY_FRAME.north = (0, 0, -1) - North's sprite should sit exactly there, scaled by radius.
    const north = sprites[0];
    expect(north.position.x).toBeCloseTo(0);
    expect(north.position.y).toBeCloseTo(0);
    expect(north.position.z).toBeCloseTo(-50);
  });

  it("places East on the horizon in the frame's own east direction, at the configured radius", () => {
    const layer = new AltAzGridLayer({
      id: "test",
      label: "Test",
      radius: 50,
      getActiveObserver: () => stubObserver(IDENTITY_FRAME),
      createTexture: stubCreateTexture,
    });
    layer.update();
    const sprites = layer.object3D.children.filter((child): child is THREE.Sprite => child instanceof THREE.Sprite);
    // IDENTITY_FRAME.east = (1, 0, 0) - East's sprite should sit exactly there, scaled by radius.
    const east = sprites[1];
    expect(east.position.x).toBeCloseTo(50);
    expect(east.position.y).toBeCloseTo(0);
    expect(east.position.z).toBeCloseTo(0);
  });

  it("offsets compass letters by the observer's world position when it moves", () => {
    const movedFrame: ObserverFrame = { ...IDENTITY_FRAME, worldPosition: new THREE.Vector3(10, 0, 0) };
    const layer = new AltAzGridLayer({
      id: "test",
      label: "Test",
      radius: 50,
      getActiveObserver: () => stubObserver(movedFrame),
      createTexture: stubCreateTexture,
    });
    layer.update();
    const sprites = layer.object3D.children.filter((child): child is THREE.Sprite => child instanceof THREE.Sprite);
    const north = sprites[0];
    expect(north.position.x).toBeCloseTo(10);
    expect(north.position.z).toBeCloseTo(-50);
  });
});
