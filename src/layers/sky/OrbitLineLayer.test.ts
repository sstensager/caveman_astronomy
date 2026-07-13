import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { OrbitLineLayer } from "./OrbitLineLayer";
import { GeocentricModel } from "../../astronomy/models/GeocentricModel";
import { ModernHeliocentricModel } from "../../astronomy/models/ModernHeliocentricModel";
import { BodyIds, type AstronomyModel, type SimulationTime, type UniverseState } from "../../astronomy/types";
import { eclipticToWorld } from "../../astronomy/frames";

/** Expected render-space point for a given ecliptic-frame relative vector -
 *  every assertion below must route through this, exactly like
 *  OrbitLineLayer itself does, since eclipticToWorld's 23.44deg obliquity
 *  rotation mixes ecliptic x/y into world x/y (z is unaffected - see
 *  frames.ts). */
function expectedWorldPoint(x: number, y: number, z: number, scale: number): THREE.Vector3 {
  const world = eclipticToWorld({ x, y, z });
  return new THREE.Vector3(world.x * scale, world.y * scale, world.z * scale);
}

function stubModel(bodyPosition: (time: SimulationTime) => THREE.Vector3): AstronomyModel {
  return {
    id: "stub",
    name: "stub",
    getState(time: SimulationTime): UniverseState {
      const identity = { x: 0, y: 0, z: 0, w: 1 };
      const p = bodyPosition(time);
      return {
        time,
        bodies: {
          [BodyIds.Sun]: { id: BodyIds.Sun, position: { x: p.x, y: p.y, z: p.z }, orientation: identity, radius: 1 },
          [BodyIds.Earth]: { id: BodyIds.Earth, position: { x: 0, y: 0, z: 0 }, orientation: identity, radius: 1 },
          [BodyIds.Moon]: { id: BodyIds.Moon, position: { x: 0, y: 0, z: 0 }, orientation: identity, radius: 1 },
        },
      };
    },
  };
}

function pointAt(positions: Float32Array, i: number): THREE.Vector3 {
  return new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
}

describe("OrbitLineLayer", () => {
  it("samples bodyPos - relativeToPos across one full period, scaled by radius*fraction/semiMajorAxis", () => {
    const model = stubModel((t) => new THREE.Vector3(10 * Math.cos(t), 0, 10 * Math.sin(t)));
    const layer = new OrbitLineLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      bodyId: BodyIds.Sun,
      relativeToId: BodyIds.Earth,
      periodDays: 2 * Math.PI,
      semiMajorAxis: 10,
      getModel: () => model,
      getSimulationTime: () => 0,
      radius: 25,
      orbitRadiusFraction: 0.95,
      segments: 4,
    });

    const positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const scale = (25 * 0.95) / 10;
    // t=0 -> ecliptic (10, 0, 0), rotated into world space
    const p0 = expectedWorldPoint(10, 0, 0, scale);
    expect(pointAt(positions, 0).x).toBeCloseTo(p0.x);
    expect(pointAt(positions, 0).y).toBeCloseTo(p0.y);
    expect(pointAt(positions, 0).z).toBeCloseTo(p0.z);
    // quarter period later -> ecliptic (0, 0, 10) - z is unaffected by the
    // obliquity rotation (see eclipticToWorld), so this stays unrotated.
    expect(pointAt(positions, 1).x).toBeCloseTo(0, 5);
    expect(pointAt(positions, 1).z).toBeCloseTo(10 * scale, 5);
  });

  it("reflects whichever model getModel() currently returns on update(), without reconstruction", () => {
    // z-only positions - unaffected by eclipticToWorld's obliquity rotation
    // (see frames.ts), so this test can stay focused on the model-switching
    // behavior without also asserting rotation math (covered separately above).
    let activeModel = stubModel(() => new THREE.Vector3(0, 0, 1));
    const layer = new OrbitLineLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      bodyId: BodyIds.Sun,
      relativeToId: BodyIds.Earth,
      periodDays: 10,
      semiMajorAxis: 1,
      getModel: () => activeModel,
      getSimulationTime: () => 0,
      radius: 1,
      orbitRadiusFraction: 1,
      segments: 2,
    });

    let positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    expect(pointAt(positions, 0).z).toBeCloseTo(1);

    activeModel = stubModel(() => new THREE.Vector3(0, 0, 2));
    layer.update();
    positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    expect(pointAt(positions, 0).z).toBeCloseTo(2);
  });

  it("setRadius rescales the sampled ellipse and marks the geometry for re-upload", () => {
    const model = stubModel(() => new THREE.Vector3(0, 0, 4));
    const layer = new OrbitLineLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      bodyId: BodyIds.Sun,
      relativeToId: BodyIds.Earth,
      periodDays: 10,
      semiMajorAxis: 4,
      getModel: () => model,
      getSimulationTime: () => 0,
      radius: 10,
      orbitRadiusFraction: 1,
      segments: 2,
    });

    layer.setRadius(20);
    const positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    expect(pointAt(positions, 0).z).toBeCloseTo(20);
  });

  it("setVisible toggles object3D.visible", () => {
    const model = stubModel(() => new THREE.Vector3(1, 0, 0));
    const layer = new OrbitLineLayer({
      id: "test",
      label: "Test",
      group: "Sky.Geometry",
      bodyId: BodyIds.Sun,
      relativeToId: BodyIds.Earth,
      periodDays: 10,
      semiMajorAxis: 1,
      getModel: () => model,
      getSimulationTime: () => 0,
      radius: 1,
      orbitRadiusFraction: 1,
    });

    layer.setVisible(false);
    expect(layer.object3D.visible).toBe(false);
    layer.setVisible(true);
    expect(layer.object3D.visible).toBe(true);
  });
});

describe("OrbitLineLayer - real model equivalence", () => {
  it("draws an identical Sun-relative-to-Earth ellipse whether Geocentric or ModernHeliocentric is active", () => {
    const geo = new GeocentricModel();
    const helio = new ModernHeliocentricModel();
    const EARTH_ORBIT_RADIUS = 100;
    const EARTH_ORBIT_PERIOD_DAYS = 365.25;

    function samplePositions(model: AstronomyModel): Float32Array {
      const layer = new OrbitLineLayer({
        id: "test",
        label: "Test",
        group: "Sky.Geometry",
        bodyId: BodyIds.Sun,
        relativeToId: BodyIds.Earth,
        periodDays: EARTH_ORBIT_PERIOD_DAYS,
        semiMajorAxis: EARTH_ORBIT_RADIUS,
        getModel: () => model,
        getSimulationTime: () => 42.7,
        radius: 25,
        orbitRadiusFraction: 0.95,
        segments: 24,
      });
      return (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array.slice() as Float32Array;
    }

    const geoPositions = samplePositions(geo);
    const helioPositions = samplePositions(helio);
    for (let i = 0; i < geoPositions.length; i++) {
      expect(geoPositions[i]).toBeCloseTo(helioPositions[i], 8);
    }
  });

  it("draws an identical Moon-relative-to-Earth ellipse whether Geocentric or ModernHeliocentric is active", () => {
    const geo = new GeocentricModel();
    const helio = new ModernHeliocentricModel();
    const MOON_ORBIT_RADIUS = 5;
    const MOON_ORBIT_PERIOD_DAYS = 27.3;

    function samplePositions(model: AstronomyModel): Float32Array {
      const layer = new OrbitLineLayer({
        id: "test",
        label: "Test",
        group: "Sky.Geometry",
        bodyId: BodyIds.Moon,
        relativeToId: BodyIds.Earth,
        periodDays: MOON_ORBIT_PERIOD_DAYS,
        semiMajorAxis: MOON_ORBIT_RADIUS,
        getModel: () => model,
        getSimulationTime: () => 1234.5,
        radius: 25,
        orbitRadiusFraction: 0.3,
        segments: 24,
      });
      return (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array.slice() as Float32Array;
    }

    const geoPositions = samplePositions(geo);
    const helioPositions = samplePositions(helio);
    for (let i = 0; i < geoPositions.length; i++) {
      expect(geoPositions[i]).toBeCloseTo(helioPositions[i], 8);
    }
  });
});
