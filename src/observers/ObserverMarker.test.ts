import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ObserverMarker, PIN_FRAGMENT_SHADER, CHEVRON_FRAGMENT_SHADER } from "./ObserverMarker";

describe("ObserverMarker", () => {
  it("positions its single vertex at the current world position", () => {
    const marker = new ObserverMarker("test", "Test", () => new THREE.Vector3(1, 2, 3));
    const attr = marker.object3D.geometry.getAttribute("position") as THREE.BufferAttribute;
    expect(attr.getX(0)).toBeCloseTo(1);
    expect(attr.getY(0)).toBeCloseTo(2);
    expect(attr.getZ(0)).toBeCloseTo(3);
  });

  it("uses the pin shader by default, with no camera position getter wired", () => {
    const marker = new ObserverMarker("test", "Test", () => new THREE.Vector3(0, 5, 0));
    const material = marker.object3D.material as THREE.ShaderMaterial;
    expect(material.fragmentShader).toBe(PIN_FRAGMENT_SHADER);
  });

  it("stays on the pin shader when the camera is on the same hemisphere as the marker", () => {
    const markerPosition = new THREE.Vector3(0, 5, 0); // "north pole" of Earth (center at origin)
    const marker = new ObserverMarker("test", "Test", () => markerPosition);
    // Camera also above, on the same (near) side.
    marker.setCameraPositionGetter(() => new THREE.Vector3(0, 20, 20));
    marker.update();
    const material = marker.object3D.material as THREE.ShaderMaterial;
    expect(material.fragmentShader).toBe(PIN_FRAGMENT_SHADER);
  });

  it("switches to the chevron shader when the marker is on Earth's far hemisphere from the camera", () => {
    const markerPosition = new THREE.Vector3(0, 5, 0); // "north pole"
    const marker = new ObserverMarker("test", "Test", () => markerPosition);
    // Camera on the opposite (south) side - the marker's outward normal
    // points away from the camera, so it should read as occluded.
    marker.setCameraPositionGetter(() => new THREE.Vector3(0, -20, 0));
    marker.update();
    const material = marker.object3D.material as THREE.ShaderMaterial;
    expect(material.fragmentShader).toBe(CHEVRON_FRAGMENT_SHADER);
  });

  it("switches back to the pin shader once the marker rotates back into view", () => {
    let markerPosition = new THREE.Vector3(0, -5, 0);
    const marker = new ObserverMarker("test", "Test", () => markerPosition);
    marker.setCameraPositionGetter(() => new THREE.Vector3(0, 20, 0));
    marker.update();
    expect((marker.object3D.material as THREE.ShaderMaterial).fragmentShader).toBe(CHEVRON_FRAGMENT_SHADER);

    markerPosition = new THREE.Vector3(0, 5, 0);
    marker.update();
    expect((marker.object3D.material as THREE.ShaderMaterial).fragmentShader).toBe(PIN_FRAGMENT_SHADER);
  });

  it("setVisible toggles object3D.visible", () => {
    const marker = new ObserverMarker("test", "Test", () => new THREE.Vector3());
    marker.setVisible(false);
    expect(marker.object3D.visible).toBe(false);
    marker.setVisible(true);
    expect(marker.object3D.visible).toBe(true);
  });

  it("computes occlusion relative to a moved Earth center, not the world origin (Center: Sun mode)", () => {
    // Earth has moved to (100, 0, 0) - see EarthBase.setOrbitPosition. A
    // marker "north pole"-equivalent relative to that new center sits at
    // (100, 5, 0), NOT (0, 5, 0). Without getEarthCenter, normalize(pos)
    // would treat (100, 5, 0) as nearly pointing along +X (Earth's now-
    // distant world position), producing nonsense occlusion - this is the
    // bug this test guards against.
    const earthCenter = new THREE.Vector3(100, 0, 0);
    const markerPosition = new THREE.Vector3(100, 5, 0);
    const marker = new ObserverMarker("test", "Test", () => markerPosition, {
      getEarthCenter: () => earthCenter,
    });
    // Camera also above Earth's new center, same (near) side.
    marker.setCameraPositionGetter(() => new THREE.Vector3(100, 20, 20));
    marker.update();
    expect((marker.object3D.material as THREE.ShaderMaterial).fragmentShader).toBe(PIN_FRAGMENT_SHADER);

    // Camera on the opposite side of Earth's new center - should occlude.
    marker.setCameraPositionGetter(() => new THREE.Vector3(100, -20, 0));
    marker.update();
    expect((marker.object3D.material as THREE.ShaderMaterial).fragmentShader).toBe(CHEVRON_FRAGMENT_SHADER);
  });

  it("defaults getEarthCenter to the origin when not provided - matches every pre-existing call site", () => {
    const markerPosition = new THREE.Vector3(0, 5, 0);
    const marker = new ObserverMarker("test", "Test", () => markerPosition);
    marker.setCameraPositionGetter(() => new THREE.Vector3(0, -20, 0));
    marker.update();
    expect((marker.object3D.material as THREE.ShaderMaterial).fragmentShader).toBe(CHEVRON_FRAGMENT_SHADER);
  });
});
