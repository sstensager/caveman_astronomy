import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ConstellationLabelsLayer } from "./ConstellationLabelsLayer";
import type { ResolvedConstellation } from "../../astronomy/constellationCatalog";
import type { Observer, ObserverFrame } from "../../observers/Observer";

// Avoids canvas/document (this project's vitest environment is "node", not
// "jsdom") - see ConstellationLabelsLayerOptions.createTexture.
const stubCreateTexture = () => new THREE.Texture();

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
  { id: "A", name: "Alpha", labelDirection: { x: 1, y: 0, z: 0 }, segments: [] },
  { id: "B", name: "Beta", labelDirection: { x: 0, y: 1, z: 0 }, segments: [] },
];

describe("ConstellationLabelsLayer", () => {
  it("creates one sprite per constellation", () => {
    const layer = new ConstellationLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      radius: 100,
      constellations,
      createTexture: stubCreateTexture,
    });
    expect(layer.object3D.children).toHaveLength(2);
    expect(layer.object3D.children[0]).toBeInstanceOf(THREE.Sprite);
  });

  it("positions each label at direction * radius when no observer is supplied (globe-tier behavior)", () => {
    const layer = new ConstellationLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      radius: 100,
      constellations,
      createTexture: stubCreateTexture,
    });
    const [alphaSprite, betaSprite] = layer.object3D.children as THREE.Sprite[];
    expect(alphaSprite.position.x).toBeCloseTo(100);
    expect(alphaSprite.position.y).toBeCloseTo(0);
    expect(betaSprite.position.y).toBeCloseTo(100);
  });

  it("adds the active observer's world position when a getter is supplied (sky-tier behavior)", () => {
    let observer = stubObserver(new THREE.Vector3(0, 0, 0));
    const layer = new ConstellationLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      radius: 100,
      constellations,
      createTexture: stubCreateTexture,
      getObserver: () => observer,
    });
    observer = stubObserver(new THREE.Vector3(3, 4, 5));
    layer.update();
    const [alphaSprite] = layer.object3D.children as THREE.Sprite[];
    expect(alphaSprite.position.x).toBeCloseTo(103);
    expect(alphaSprite.position.y).toBeCloseTo(4);
    expect(alphaSprite.position.z).toBeCloseTo(5);
  });

  it("setRadius rescales every label's position", () => {
    const layer = new ConstellationLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      radius: 100,
      constellations,
      createTexture: stubCreateTexture,
    });
    layer.setRadius(25);
    const [alphaSprite] = layer.object3D.children as THREE.Sprite[];
    expect(alphaSprite.position.x).toBeCloseTo(25);
  });

  it("uses fixed screen-space sprite size (sizeAttenuation off), independent of radius", () => {
    const layer = new ConstellationLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      radius: 2000,
      constellations,
      createTexture: stubCreateTexture,
    });
    const [alphaSprite] = layer.object3D.children as THREE.Sprite[];
    expect((alphaSprite.material as THREE.SpriteMaterial).sizeAttenuation).toBe(false);
  });
});
