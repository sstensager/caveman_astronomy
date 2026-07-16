import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { StonehengeLayer } from "./StonehengeLayer";
import { computeHengeLayout } from "./hengeLayout";

const STONEHENGE_LAT_DEG = 51.1789;
const STONEHENGE_LON_DEG = -1.8262;

function childPositions(layer: StonehengeLayer): THREE.Vector3[] {
  return layer.object3D.children.map((c) => c.position.clone());
}

describe("StonehengeLayer", () => {
  it("places exactly as many stones as computeHengeLayout returns for that latitude", () => {
    const layer = new StonehengeLayer();
    layer.place(STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG);
    expect(layer.object3D.children.length).toBe(computeHengeLayout(STONEHENGE_LAT_DEG).length);
  });

  it("is deterministic for the same lat/lon (pure function of latitude, no RNG involved)", () => {
    const a = new StonehengeLayer();
    const b = new StonehengeLayer();
    a.place(STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG);
    b.place(STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG);
    expect(childPositions(a)).toEqual(childPositions(b));
  });

  it("produces a different layout at a different location", () => {
    const a = new StonehengeLayer();
    const b = new StonehengeLayer();
    a.place(STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG);
    b.place(30, 100);
    expect(childPositions(a)).not.toEqual(childPositions(b));
  });

  it("replaces (not accumulates) stones when place() is called again", () => {
    const layer = new StonehengeLayer();
    layer.place(STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG);
    layer.place(30, 100);
    expect(layer.object3D.children.length).toBe(computeHengeLayout(30).length);
  });

  it("disposes old geometry when place() is called again, not just detaching it", () => {
    const layer = new StonehengeLayer();
    layer.place(STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG);
    const firstMesh = layer.object3D.children[0] as THREE.Mesh;
    let disposed = false;
    firstMesh.geometry.addEventListener("dispose", () => {
      disposed = true;
    });
    layer.place(30, 100);
    expect(disposed).toBe(true);
  });

  it("toggles the whole group's visibility", () => {
    const layer = new StonehengeLayer();
    layer.setVisible(false);
    expect(layer.object3D.visible).toBe(false);
    layer.setVisible(true);
    expect(layer.object3D.visible).toBe(true);
  });

  it("places every stone at (a slight embed below) EARTH_RADIUS from Earth's center", () => {
    const layer = new StonehengeLayer();
    layer.place(STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG);
    for (const position of childPositions(layer)) {
      expect(position.length()).toBeGreaterThan(4.9);
      expect(position.length()).toBeLessThanOrEqual(5.0);
    }
  });

  it("tracks the placed location", () => {
    const layer = new StonehengeLayer();
    expect(layer.isPlaced()).toBe(false);
    expect(layer.getPlacedLatLon()).toBeUndefined();
    layer.place(STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG);
    expect(layer.isPlaced()).toBe(true);
    expect(layer.getPlacedLatLon()).toEqual({ latDeg: STONEHENGE_LAT_DEG, lonDeg: STONEHENGE_LON_DEG });
  });

  it("places only ring + equinox markers at a polar latitude where both solstices are polar day/night", () => {
    const layer = new StonehengeLayer();
    layer.place(70, 0);
    expect(layer.object3D.children.length).toBe(computeHengeLayout(70).length);
  });
});
