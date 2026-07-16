import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GroundScatterLayer } from "./GroundScatterLayer";
import type { LandMaskSampler } from "../../utils/landMask";

const allLand: LandMaskSampler = { classify: () => "land" };

function childPositions(layer: GroundScatterLayer): THREE.Vector3[] {
  return layer.object3D.children.map((child) => child.position.clone());
}

// Away from every curated mountain range and simple to reason about.
const SAFE_LAT = 10;
const SAFE_LON = 10;

describe("GroundScatterLayer", () => {
  it("places PROP_COUNT (2) props on first regeneration", () => {
    const layer = new GroundScatterLayer(allLand);
    layer.regenerateAround(SAFE_LAT, SAFE_LON);
    expect(layer.object3D.children.length).toBe(2);
  });

  it("produces the same scatter for the same location on two separate instances (deterministic, not reshuffled)", () => {
    const a = new GroundScatterLayer(allLand);
    const b = new GroundScatterLayer(allLand);
    a.regenerateAround(SAFE_LAT, SAFE_LON);
    b.regenerateAround(SAFE_LAT, SAFE_LON);
    expect(childPositions(a)).toEqual(childPositions(b));
  });

  it("produces a different scatter for a clearly different location", () => {
    const a = new GroundScatterLayer(allLand);
    const b = new GroundScatterLayer(allLand);
    a.regenerateAround(SAFE_LAT, SAFE_LON);
    b.regenerateAround(SAFE_LAT + 20, SAFE_LON + 20);
    expect(childPositions(a)).not.toEqual(childPositions(b));
  });

  it("does not rebuild for a small movement under the regen threshold", () => {
    const layer = new GroundScatterLayer(allLand);
    layer.regenerateAround(SAFE_LAT, SAFE_LON);
    const firstChild = layer.object3D.children[0];
    layer.regenerateAround(SAFE_LAT + 0.0001, SAFE_LON);
    expect(layer.object3D.children[0]).toBe(firstChild);
  });

  it("rebuilds once moved past the regen threshold, replacing every child", () => {
    const layer = new GroundScatterLayer(allLand);
    layer.regenerateAround(SAFE_LAT, SAFE_LON);
    const firstChild = layer.object3D.children[0];
    layer.regenerateAround(SAFE_LAT + 10, SAFE_LON);
    expect(layer.object3D.children[0]).not.toBe(firstChild);
    expect(layer.object3D.children.length).toBe(2);
  });

  it("disposes old geometry when rebuilding, not just detaching it", () => {
    const layer = new GroundScatterLayer(allLand);
    layer.regenerateAround(SAFE_LAT, SAFE_LON);
    const firstMesh = layer.object3D.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh;
    let disposed = false;
    firstMesh.geometry.addEventListener("dispose", () => {
      disposed = true;
    });
    layer.regenerateAround(SAFE_LAT + 10, SAFE_LON);
    expect(disposed).toBe(true);
  });

  it("toggles the whole group's visibility", () => {
    const layer = new GroundScatterLayer(allLand);
    layer.setVisible(false);
    expect(layer.object3D.visible).toBe(false);
    layer.setVisible(true);
    expect(layer.object3D.visible).toBe(true);
  });

  it("places every prop at (a slight embed below) EARTH_RADIUS from Earth's center", () => {
    const layer = new GroundScatterLayer(allLand);
    layer.regenerateAround(SAFE_LAT, SAFE_LON);
    for (const position of childPositions(layer)) {
      // Loose bounds - just confirms props sit near the sphere surface, not
      // wildly off (e.g. the old tangent-plane-hover bug).
      expect(position.length()).toBeGreaterThan(4.9);
      expect(position.length()).toBeLessThanOrEqual(5.0);
    }
  });
});
