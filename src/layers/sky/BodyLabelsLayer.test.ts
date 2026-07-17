import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BodyLabelsLayer, type BodyLabelEntry } from "./BodyLabelsLayer";

// Avoids canvas/document (this project's vitest environment is "node", not
// "jsdom") - see BodyLabelsLayerOptions.createTexture.
const stubCreateTexture = () => new THREE.Texture();

function makeEntry(text: string, position: { x: number; y: number; z: number }, offset?: { x: number; y: number; z: number }): BodyLabelEntry {
  return { text, getPosition: () => position, offset };
}

describe("BodyLabelsLayer", () => {
  it("creates one sprite per entry", () => {
    const layer = new BodyLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      entries: [makeEntry("Mercury", { x: 1, y: 0, z: 0 }), makeEntry("Venus", { x: 0, y: 2, z: 0 })],
      createTexture: stubCreateTexture,
    });
    expect(layer.object3D.children).toHaveLength(2);
    expect(layer.object3D.children[0]).toBeInstanceOf(THREE.Sprite);
  });

  it("positions each label at its entry's live getPosition() result", () => {
    const layer = new BodyLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      entries: [makeEntry("Mercury", { x: 5, y: 6, z: 7 })],
      createTexture: stubCreateTexture,
    });
    const [sprite] = layer.object3D.children as THREE.Sprite[];
    expect(sprite.position.x).toBeCloseTo(5);
    expect(sprite.position.y).toBeCloseTo(6);
    expect(sprite.position.z).toBeCloseTo(7);
  });

  it("adds the entry's own offset on top of getPosition()", () => {
    const layer = new BodyLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      entries: [makeEntry("Mercury", { x: 1, y: 1, z: 1 }, { x: 0, y: 0.5, z: 0 })],
      createTexture: stubCreateTexture,
    });
    const [sprite] = layer.object3D.children as THREE.Sprite[];
    expect(sprite.position.y).toBeCloseTo(1.5);
  });

  it("re-reads live getPosition() on update() - moving body, moving label", () => {
    let position = { x: 0, y: 0, z: 0 };
    const layer = new BodyLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      entries: [{ text: "Mercury", getPosition: () => position }],
      createTexture: stubCreateTexture,
    });
    position = { x: 9, y: 9, z: 9 };
    layer.update();
    const [sprite] = layer.object3D.children as THREE.Sprite[];
    expect(sprite.position.x).toBeCloseTo(9);
  });

  it("uses fixed screen-space sprite size (sizeAttenuation off), matching ConstellationLabelsLayer's convention", () => {
    const layer = new BodyLabelsLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      entries: [makeEntry("Mercury", { x: 0, y: 0, z: 0 })],
      createTexture: stubCreateTexture,
    });
    const [sprite] = layer.object3D.children as THREE.Sprite[];
    expect((sprite.material as THREE.SpriteMaterial).sizeAttenuation).toBe(false);
  });
});
