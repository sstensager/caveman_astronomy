import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SkyPathLineLayer } from "./SkyPathLineLayer";
import { GeocentricModel } from "../../astronomy/models/GeocentricModel";
import { ModernHeliocentricModel } from "../../astronomy/models/ModernHeliocentricModel";
import { BodyIds, type AstronomyModel, type BodyId, type BodyState, type SimulationTime, type UniverseState } from "../../astronomy/types";
import type { Observer, ObserverFrame } from "../../observers/Observer";
import { eclipticToWorld } from "../../astronomy/frames";

function expectedDirection(x: number, y: number, z: number): THREE.Vector3 {
  const world = eclipticToWorld({ x, y, z });
  return new THREE.Vector3(world.x, world.y, world.z).normalize();
}

const PLANET_IDS = [BodyIds.Mercury, BodyIds.Venus, BodyIds.Mars, BodyIds.Jupiter, BodyIds.Saturn] as const;

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
          ...(Object.fromEntries(
            PLANET_IDS.map((id) => [id, { id, position: { x: 0, y: 0, z: 0 }, orientation: identity, radius: 1 }]),
          ) as Record<BodyId, BodyState>),
          [BodyIds.Sun]: { id: BodyIds.Sun, position: { x: p.x, y: p.y, z: p.z }, orientation: identity, radius: 1 },
          [BodyIds.Earth]: { id: BodyIds.Earth, position: { x: 0, y: 0, z: 0 }, orientation: identity, radius: 1 },
          [BodyIds.Moon]: { id: BodyIds.Moon, position: { x: 0, y: 0, z: 0 }, orientation: identity, radius: 1 },
        },
      };
    },
  };
}

function stubObserver(worldPosition: THREE.Vector3): Observer {
  return {
    id: "stub-observer",
    getFrame(): ObserverFrame {
      return { worldPosition: worldPosition.clone(), up: new THREE.Vector3(0, 1, 0) };
    },
    getDirectionTo(): THREE.Vector3 {
      throw new Error("not used by SkyPathLineLayer");
    },
  };
}

function pointAt(positions: Float32Array, i: number): THREE.Vector3 {
  return new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
}

describe("SkyPathLineLayer", () => {
  it("samples normalize(bodyPos - relativeToPos)*radius, offset by the observer's world position", () => {
    const model = stubModel((t) => new THREE.Vector3(10 * Math.cos(t), 0, 10 * Math.sin(t)));
    const observerPosition = new THREE.Vector3(1, 2, 3);
    const layer = new SkyPathLineLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      bodyId: BodyIds.Sun,
      relativeToId: BodyIds.Earth,
      periodDays: 2 * Math.PI,
      getModel: () => model,
      getObserver: () => stubObserver(observerPosition),
      getSimulationTime: () => 0,
      radius: 2000,
      segments: 4,
    });

    const positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    // t=0 -> ecliptic (10, 0, 0) direction, rotated into world space, normalized (distance dropped)
    const d0 = expectedDirection(10, 0, 0);
    const p0 = pointAt(positions, 0);
    expect(p0.x).toBeCloseTo(observerPosition.x + d0.x * 2000);
    expect(p0.y).toBeCloseTo(observerPosition.y + d0.y * 2000);
    expect(p0.z).toBeCloseTo(observerPosition.z + d0.z * 2000);
  });

  it("reflects whichever model getModel() currently returns on update(), without reconstruction", () => {
    let activeModel = stubModel(() => new THREE.Vector3(0, 0, 1));
    const layer = new SkyPathLineLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      bodyId: BodyIds.Sun,
      relativeToId: BodyIds.Earth,
      periodDays: 10,
      getModel: () => activeModel,
      getObserver: () => stubObserver(new THREE.Vector3(0, 0, 0)),
      getSimulationTime: () => 0,
      radius: 1,
      segments: 2,
    });

    let positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    expect(pointAt(positions, 0).z).toBeCloseTo(1);

    activeModel = stubModel(() => new THREE.Vector3(0, 0, 5));
    layer.update();
    positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    // Direction-only: distance 5 normalizes to the same unit direction as distance 1.
    expect(pointAt(positions, 0).z).toBeCloseTo(1);
  });

  it("reflects whichever observer getObserver() currently returns", () => {
    const model = stubModel(() => new THREE.Vector3(0, 0, 1));
    let activeObserver = stubObserver(new THREE.Vector3(0, 0, 0));
    const layer = new SkyPathLineLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      bodyId: BodyIds.Sun,
      relativeToId: BodyIds.Earth,
      periodDays: 10,
      getModel: () => model,
      getObserver: () => activeObserver,
      getSimulationTime: () => 0,
      radius: 1,
      segments: 2,
    });

    let positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    expect(pointAt(positions, 0).z).toBeCloseTo(1);

    activeObserver = stubObserver(new THREE.Vector3(5, 0, 0));
    layer.update();
    positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    expect(pointAt(positions, 0).x).toBeCloseTo(5);
    expect(pointAt(positions, 0).z).toBeCloseTo(1);
  });

  it("setRadius rescales the sampled path", () => {
    const model = stubModel(() => new THREE.Vector3(0, 0, 4));
    const layer = new SkyPathLineLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      bodyId: BodyIds.Sun,
      relativeToId: BodyIds.Earth,
      periodDays: 10,
      getModel: () => model,
      getObserver: () => stubObserver(new THREE.Vector3(0, 0, 0)),
      getSimulationTime: () => 0,
      radius: 10,
      segments: 2,
    });

    layer.setRadius(2000);
    const positions = (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    expect(pointAt(positions, 0).z).toBeCloseTo(2000);
  });

  it("setVisible toggles object3D.visible", () => {
    const model = stubModel(() => new THREE.Vector3(1, 0, 0));
    const layer = new SkyPathLineLayer({
      id: "test",
      label: "Test",
      group: "Sky.Observation",
      bodyId: BodyIds.Sun,
      relativeToId: BodyIds.Earth,
      periodDays: 10,
      getModel: () => model,
      getObserver: () => stubObserver(new THREE.Vector3(0, 0, 0)),
      getSimulationTime: () => 0,
      radius: 1,
    });

    layer.setVisible(false);
    expect(layer.object3D.visible).toBe(false);
    layer.setVisible(true);
    expect(layer.object3D.visible).toBe(true);
  });
});

describe("SkyPathLineLayer - real model equivalence", () => {
  it("draws an identical Sun ecliptic path whether Geocentric or ModernHeliocentric is active", () => {
    const geo = new GeocentricModel();
    const helio = new ModernHeliocentricModel();
    const EARTH_ORBIT_PERIOD_DAYS = 365.25;

    function samplePositions(model: AstronomyModel): Float32Array {
      const layer = new SkyPathLineLayer({
        id: "test",
        label: "Test",
        group: "Sky.Observation",
        bodyId: BodyIds.Sun,
        relativeToId: BodyIds.Earth,
        periodDays: EARTH_ORBIT_PERIOD_DAYS,
        getModel: () => model,
        getObserver: () => stubObserver(new THREE.Vector3(0.01, 0.02, 0.03)),
        getSimulationTime: () => 42.7,
        radius: 2000,
        segments: 24,
      });
      return (layer.object3D.geometry.getAttribute("position") as THREE.BufferAttribute).array.slice() as Float32Array;
    }

    const geoPositions = samplePositions(geo);
    const helioPositions = samplePositions(helio);
    for (let i = 0; i < geoPositions.length; i++) {
      expect(geoPositions[i]).toBeCloseTo(helioPositions[i], 6);
    }
  });
});
