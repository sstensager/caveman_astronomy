import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { EarthBase } from "./EarthBase";
import { EARTH_AXIAL_TILT_DEG } from "../../astronomy/constants";

function rotationAxisWorldDirection(earthBase: EarthBase): THREE.Vector3 {
  earthBase.rotationGroup.updateMatrixWorld(true);
  return new THREE.Vector3(0, 1, 0).applyQuaternion(earthBase.rotationGroup.getWorldQuaternion(new THREE.Quaternion()));
}

describe("EarthBase - axial tilt", () => {
  it("points the rotation axis at exactly world +Y at the real/default tilt", () => {
    const earthBase = new EarthBase();
    const axis = rotationAxisWorldDirection(earthBase);
    expect(axis.x).toBeCloseTo(0, 10);
    expect(axis.y).toBeCloseTo(1, 10);
    expect(axis.z).toBeCloseTo(0, 10);
  });

  it("re-derives the same world +Y alignment after explicitly setting the real tilt value again", () => {
    const earthBase = new EarthBase();
    earthBase.setAxialTilt(0);
    earthBase.setAxialTilt(EARTH_AXIAL_TILT_DEG);
    const axis = rotationAxisWorldDirection(earthBase);
    expect(axis.y).toBeCloseTo(1, 10);
  });

  it("swings the axis away from world +Y by exactly the deviation from the real tilt, not the raw slider value", () => {
    const earthBase = new EarthBase();
    earthBase.setAxialTilt(0);
    const axis = rotationAxisWorldDirection(earthBase);
    const angleFromWorldUpDeg = (Math.acos(THREE.MathUtils.clamp(axis.y, -1, 1)) * 180) / Math.PI;
    // Deviation from real = 0 - EARTH_AXIAL_TILT_DEG, so the axis should
    // swing away from world +Y by EARTH_AXIAL_TILT_DEG degrees - this is
    // what keeps Polaris (very close to world +Y - see starCatalog.ts)
    // aligned with the axis ONLY at the real tilt value, not at every value.
    expect(angleFromWorldUpDeg).toBeCloseTo(EARTH_AXIAL_TILT_DEG, 6);
  });

  it("stays at world +Y regardless of daily spin (rotationGroup.rotation.y) - spin and tilt are independent", () => {
    const earthBase = new EarthBase();
    earthBase.rotationGroup.rotation.y = Math.PI / 3;
    const axis = rotationAxisWorldDirection(earthBase);
    expect(axis.y).toBeCloseTo(1, 10);
  });
});

describe("EarthBase - setOrbitPosition", () => {
  it("moves the outer orbitGroup (object3D) to the given world position", () => {
    const earthBase = new EarthBase();
    earthBase.setOrbitPosition({ x: 12, y: -3, z: 7 });
    expect(earthBase.object3D.position.x).toBeCloseTo(12);
    expect(earthBase.object3D.position.y).toBeCloseTo(-3);
    expect(earthBase.object3D.position.z).toBeCloseTo(7);
  });

  it("carries the mesh and everything parented under rotationGroup along with it", () => {
    const earthBase = new EarthBase();
    earthBase.setOrbitPosition({ x: 100, y: 0, z: 0 });
    earthBase.object3D.updateMatrixWorld(true);
    const meshWorldPos = earthBase.mesh.getWorldPosition(new THREE.Vector3());
    expect(meshWorldPos.x).toBeCloseTo(100);
  });

  it("defaults to the origin - unaffected until explicitly called", () => {
    const earthBase = new EarthBase();
    expect(earthBase.object3D.position.x).toBeCloseTo(0);
    expect(earthBase.object3D.position.y).toBeCloseTo(0);
    expect(earthBase.object3D.position.z).toBeCloseTo(0);
  });
});
