import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { OrbitingBodyMarkerLayer } from "./OrbitingBodyMarkerLayer";

describe("OrbitingBodyMarkerLayer", () => {
  it("positions object3D from getPosition() at construction time", () => {
    const layer = new OrbitingBodyMarkerLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      color: 0xffffff,
      markerSize: 1,
      getPosition: () => ({ x: 1, y: 2, z: 3 }),
    });

    expect(layer.object3D.position.x).toBeCloseTo(1);
    expect(layer.object3D.position.y).toBeCloseTo(2);
    expect(layer.object3D.position.z).toBeCloseTo(3);
  });

  it("update() re-reads getPosition(), reflecting a moving body with no reconstruction", () => {
    let position = { x: 0, y: 0, z: 0 };
    const layer = new OrbitingBodyMarkerLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      color: 0xffffff,
      markerSize: 1,
      getPosition: () => position,
    });

    position = { x: 5, y: -5, z: 10 };
    layer.update();

    expect(layer.object3D.position.x).toBeCloseTo(5);
    expect(layer.object3D.position.y).toBeCloseTo(-5);
    expect(layer.object3D.position.z).toBeCloseTo(10);
  });

  it("setVisible toggles object3D.visible", () => {
    const layer = new OrbitingBodyMarkerLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      color: 0xffffff,
      markerSize: 1,
      getPosition: () => ({ x: 0, y: 0, z: 0 }),
    });

    layer.setVisible(false);
    expect(layer.object3D.visible).toBe(false);
    layer.setVisible(true);
    expect(layer.object3D.visible).toBe(true);
  });

  it("sizes the marker sphere geometry from markerSize", () => {
    const layer = new OrbitingBodyMarkerLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      color: 0xffffff,
      markerSize: 2.5,
      getPosition: () => ({ x: 0, y: 0, z: 0 }),
    });

    const geometry = layer.object3D.geometry as import("three").SphereGeometry;
    expect(geometry.parameters.radius).toBeCloseTo(2.5);
  });

  it("setMarkerSize rescales via object3D.scale rather than rebuilding geometry", () => {
    const layer = new OrbitingBodyMarkerLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      color: 0xffffff,
      markerSize: 2,
      getPosition: () => ({ x: 0, y: 0, z: 0 }),
    });

    layer.setMarkerSize(6);
    expect(layer.object3D.scale.x).toBeCloseTo(3);
    expect(layer.object3D.scale.y).toBeCloseTo(3);
    expect(layer.object3D.scale.z).toBeCloseTo(3);
    // The underlying geometry radius is untouched - the visual size change
    // comes entirely from the scale multiplier.
    const geometry = layer.object3D.geometry as import("three").SphereGeometry;
    expect(geometry.parameters.radius).toBeCloseTo(2);
  });

  it("setDarkSideBrightness/setDarkSideLightDirection are harmless no-ops when darkSideBrightness wasn't supplied at construction", () => {
    const layer = new OrbitingBodyMarkerLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      color: 0xffffff,
      markerSize: 1,
      lit: true,
      getPosition: () => ({ x: 0, y: 0, z: 0 }),
    });

    expect(() => layer.setDarkSideBrightness(0.2)).not.toThrow();
    expect(() => layer.setDarkSideLightDirection(new THREE.Vector3(1, 0, 0))).not.toThrow();
  });

  it("patches a MeshStandardMaterial's onBeforeCompile when lit and darkSideBrightness are both supplied", () => {
    const layer = new OrbitingBodyMarkerLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      color: 0xffffff,
      markerSize: 1,
      lit: true,
      darkSideBrightness: 0.1,
      getPosition: () => ({ x: 0, y: 0, z: 0 }),
    });

    const material = layer.object3D.material as import("three").MeshStandardMaterial;
    expect(material.onBeforeCompile).not.toBe(undefined);
  });
});
