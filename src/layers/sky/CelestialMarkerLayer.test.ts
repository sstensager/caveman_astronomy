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

describe("CelestialMarkerLayer - spinMode", () => {
  function stubModelWithMoonDirection(moonDirection: THREE.Vector3): AstronomyModel {
    return {
      id: "stub",
      name: "stub",
      getState(time: SimulationTime): UniverseState {
        const identity = { x: 0, y: 0, z: 0, w: 1 };
        return {
          time,
          bodies: {
            [BodyIds.Sun]: { id: BodyIds.Sun, position: { x: 1, y: 0, z: 0 }, orientation: identity, radius: 1 },
            [BodyIds.Earth]: { id: BodyIds.Earth, position: { x: 0, y: 0, z: 0 }, orientation: identity, radius: 1 },
            [BodyIds.Moon]: {
              id: BodyIds.Moon,
              position: { x: moonDirection.x, y: moonDirection.y, z: moonDirection.z },
              orientation: identity,
              radius: 1,
            },
          },
        };
      },
    };
  }

  it("defaults to 'still' - the mesh never rotates as the body orbits", () => {
    let model = stubModelWithMoonDirection(new THREE.Vector3(1, 0, 0));
    const layer = new CelestialMarkerLayer(BodyIds.Moon, () => model, () => stubObserver(new THREE.Vector3(0, 0, 0)), () => 0, {
      id: "test",
      label: "Test",
      color: 0xffffff,
      radius: 100,
    });
    layer.update();
    const initialQuaternion = layer.object3D.quaternion.clone();

    model = stubModelWithMoonDirection(new THREE.Vector3(0, 0, 1));
    layer.update();
    expect(layer.object3D.quaternion.equals(initialQuaternion)).toBe(true);
  });

  it("'tidalLocked' keeps the mesh's local -Z axis pointed at Earth (world origin) as the body orbits", () => {
    let model = stubModelWithMoonDirection(new THREE.Vector3(1, 0, 0));
    const layer = new CelestialMarkerLayer(BodyIds.Moon, () => model, () => stubObserver(new THREE.Vector3(0, 0, 0)), () => 0, {
      id: "test",
      label: "Test",
      color: 0xffffff,
      radius: 100,
      spinMode: "tidalLocked",
    });

    // THREE.Object3D.lookAt(target) (unlike Camera) orients the object so
    // its local +Z axis points at the target, not -Z - verified empirically
    // here rather than assumed.
    function localForwardInWorldSpace(): THREE.Vector3 {
      return new THREE.Vector3(0, 0, 1).applyQuaternion(layer.object3D.quaternion);
    }

    layer.update();
    let expectedFacing = new THREE.Vector3(0, 0, 0).sub(layer.object3D.position).normalize();
    expect(localForwardInWorldSpace().dot(expectedFacing)).toBeCloseTo(1, 5);

    // A different orbital position (different orbit angle, not just a
    // different distance) - the marker's world position moves, but its
    // mesh must re-orient each update() so the same local face still
    // points at Earth's center, not at whatever the mesh's last rotation
    // happened to be (that's the "still" behavior, tested separately).
    model = stubModelWithMoonDirection(new THREE.Vector3(0, 1, 1).normalize());
    layer.update();
    expectedFacing = new THREE.Vector3(0, 0, 0).sub(layer.object3D.position).normalize();
    expect(localForwardInWorldSpace().dot(expectedFacing)).toBeCloseTo(1, 5);
  });
});
