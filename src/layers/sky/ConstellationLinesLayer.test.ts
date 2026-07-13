import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ConstellationLinesLayer } from "./ConstellationLinesLayer";
import type { ResolvedConstellation } from "../../astronomy/constellationCatalog";
import type { Observer, ObserverFrame } from "../../observers/Observer";

function fakeStar(direction: THREE.Vector3) {
  return { ra: 0, dec: 0, mag: 1, direction: { x: direction.x, y: direction.y, z: direction.z } };
}

function stubObserver(worldPosition: THREE.Vector3): Observer {
  return {
    id: "stub",
    getFrame(): ObserverFrame {
      return { worldPosition: worldPosition.clone(), up: new THREE.Vector3(0, 1, 0) };
    },
    getDirectionTo: () => new THREE.Vector3(0, 0, -1),
  };
}

const constellations: ResolvedConstellation[] = [
  {
    id: "Tst",
    name: "Test",
    labelDirection: { x: 0, y: 1, z: 0 },
    segments: [
      { a: fakeStar(new THREE.Vector3(1, 0, 0)), b: fakeStar(new THREE.Vector3(0, 1, 0)) },
      { a: fakeStar(new THREE.Vector3(0, 1, 0)), b: fakeStar(new THREE.Vector3(0, 0, 1)) },
    ],
  },
];

describe("ConstellationLinesLayer", () => {
  it("builds one batched geometry with 2 vertices per segment, not one Line per segment", () => {
    const layer = new ConstellationLinesLayer({ id: "test", label: "Test", group: "Sky.Observation", radius: 100, constellations });
    expect(layer.object3D).toBeInstanceOf(THREE.LineSegments);
    const position = layer.object3D.geometry.getAttribute("position");
    expect(position.count).toBe(4); // 2 segments * 2 vertices
  });

  it("scales the object by radius, same as StarsLayer", () => {
    const layer = new ConstellationLinesLayer({ id: "test", label: "Test", group: "Sky.Observation", radius: 250, constellations });
    expect(layer.object3D.scale.x).toBeCloseTo(250);
  });

  it("stays at the origin when no observer getter is supplied (globe-tier behavior)", () => {
    const layer = new ConstellationLinesLayer({ id: "test", label: "Test", group: "Sky.Observation", radius: 100, constellations });
    layer.update(0);
    expect(layer.object3D.position.length()).toBe(0);
  });

  it("tracks the active observer's world position when a getter is supplied (sky-tier behavior)", () => {
    let observer = stubObserver(new THREE.Vector3(0, 0, 0));
    const layer = new ConstellationLinesLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      radius: 100,
      constellations,
      getObserver: () => observer,
    });
    observer = stubObserver(new THREE.Vector3(3, 4, 5));
    layer.update(0);
    expect(layer.object3D.position.x).toBeCloseTo(3);
    expect(layer.object3D.position.y).toBeCloseTo(4);
    expect(layer.object3D.position.z).toBeCloseTo(5);
  });

  it("setRadius updates the object scale", () => {
    const layer = new ConstellationLinesLayer({ id: "test", label: "Test", group: "Sky.Observation", radius: 100, constellations });
    layer.setRadius(2000);
    expect(layer.object3D.scale.x).toBeCloseTo(2000);
  });
});
