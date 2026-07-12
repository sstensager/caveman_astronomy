import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CelestialMarkerLayer } from "./CelestialMarkerLayer";
import { BodyIds, type AstronomyModel, type SimulationTime, type UniverseState } from "../../astronomy/types";
import type { Observer, ObserverFrame } from "../../observers/Observer";

function stubModel(sunDirection: THREE.Vector3): AstronomyModel {
  return {
    id: "stub",
    name: "stub",
    getState(time: SimulationTime): UniverseState {
      const identity = { x: 0, y: 0, z: 0, w: 1 };
      return {
        time,
        bodies: {
          [BodyIds.Sun]: {
            id: BodyIds.Sun,
            position: { x: sunDirection.x, y: sunDirection.y, z: sunDirection.z },
            orientation: identity,
            radius: 1,
          },
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
    getDirectionTo(bodyId, state): THREE.Vector3 {
      const earth = state.bodies[BodyIds.Earth];
      const body = state.bodies[bodyId];
      return new THREE.Vector3(body.position.x, body.position.y, body.position.z)
        .sub(new THREE.Vector3(earth.position.x, earth.position.y, earth.position.z))
        .normalize();
    },
  };
}

describe("CelestialMarkerLayer - active model/observer switching", () => {
  it("reflects whichever model getModel() currently returns, without reconstructing the layer", () => {
    let activeModel = stubModel(new THREE.Vector3(1, 0, 0));
    const layer = new CelestialMarkerLayer(BodyIds.Sun, () => activeModel, () => stubObserver(new THREE.Vector3(0, 0, 0)), () => 0, {
      id: "test",
      label: "Test",
      color: 0xffffff,
      radius: 100,
    });

    layer.update();
    expect(layer.object3D.position.x).toBeCloseTo(100);
    expect(layer.object3D.position.z).toBeCloseTo(0);

    // Same layer instance, no reconstruction - just a new value from the closure.
    activeModel = stubModel(new THREE.Vector3(0, 0, 1));
    layer.update();
    expect(layer.object3D.position.x).toBeCloseTo(0);
    expect(layer.object3D.position.z).toBeCloseTo(100);
  });

  it("reflects whichever observer getObserver() currently returns for the observerCentered offset", () => {
    const model = stubModel(new THREE.Vector3(1, 0, 0));
    let activeObserver = stubObserver(new THREE.Vector3(0, 0, 0));
    const layer = new CelestialMarkerLayer(BodyIds.Sun, () => model, () => activeObserver, () => 0, {
      id: "test",
      label: "Test",
      color: 0xffffff,
      radius: 100,
      observerCentered: true,
    });

    layer.update();
    expect(layer.object3D.position.x).toBeCloseTo(100);

    activeObserver = stubObserver(new THREE.Vector3(5, 0, 0));
    layer.update();
    expect(layer.object3D.position.x).toBeCloseTo(105);
  });

  it("does NOT apply the observer world-position offset when observerCentered is false", () => {
    const model = stubModel(new THREE.Vector3(1, 0, 0));
    const activeObserver = stubObserver(new THREE.Vector3(5, 0, 0));
    const layer = new CelestialMarkerLayer(BodyIds.Sun, () => model, () => activeObserver, () => 0, {
      id: "test",
      label: "Test",
      color: 0xffffff,
      radius: 100,
    });

    layer.update();
    expect(layer.object3D.position.x).toBeCloseTo(100);
  });
});
