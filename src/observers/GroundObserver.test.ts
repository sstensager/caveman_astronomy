import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GroundObserver } from "./GroundObserver";
import { BodyIds, type BodyId, type UniverseState } from "../astronomy/types";

/** A groundStation-shaped fixture at the equator, longitude 0 - same
 *  construction EarthBase.createGroundStation uses, but with explicit,
 *  hand-verifiable numbers instead of depending on latLonToSurfacePoint. */
function equatorStationFixture(): THREE.Object3D {
  const station = new THREE.Object3D();
  const surfacePoint = new THREE.Vector3(1, 0, 0); // equator, lon=0, radius=1
  station.position.copy(surfacePoint);
  station.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfacePoint.clone().normalize());
  return station;
}

function stateWithBodyAt(bodyId: BodyId, position: THREE.Vector3): UniverseState {
  const identityOrientation = { x: 0, y: 0, z: 0, w: 1 };
  return {
    time: 0,
    bodies: {
      [BodyIds.Sun]: { id: BodyIds.Sun, position: { x: 0, y: 0, z: 0 }, orientation: identityOrientation, radius: 1 },
      [BodyIds.Earth]: { id: BodyIds.Earth, position: { x: 0, y: 0, z: 0 }, orientation: identityOrientation, radius: 1 },
      [BodyIds.Moon]: { id: BodyIds.Moon, position: { x: 0, y: 0, z: 0 }, orientation: identityOrientation, radius: 1 },
      [bodyId]: {
        id: bodyId,
        position: { x: position.x, y: position.y, z: position.z },
        orientation: identityOrientation,
        radius: 1,
      },
    },
  };
}

describe("GroundObserver.getFrame", () => {
  it("derives up/north/east correctly at the equator, lon=0", () => {
    const observer = new GroundObserver(equatorStationFixture());
    const frame = observer.getFrame();

    expect(frame.up.x).toBeCloseTo(1);
    expect(frame.up.y).toBeCloseTo(0);
    expect(frame.up.z).toBeCloseTo(0);

    // North points toward the pole (+Y).
    expect(frame.north!.x).toBeCloseTo(0);
    expect(frame.north!.y).toBeCloseTo(1);
    expect(frame.north!.z).toBeCloseTo(0);

    // East: increasing longitude increases z (see utils/geo.ts), so east is +Z here.
    expect(frame.east!.x).toBeCloseTo(0);
    expect(frame.east!.y).toBeCloseTo(0);
    expect(frame.east!.z).toBeCloseTo(1);
  });

  it("keeps up/north/east mutually perpendicular and unit length", () => {
    const observer = new GroundObserver(equatorStationFixture());
    const { up, north, east } = observer.getFrame();
    expect(up.length()).toBeCloseTo(1);
    expect(north!.length()).toBeCloseTo(1);
    expect(east!.length()).toBeCloseTo(1);
    expect(up.dot(north!)).toBeCloseTo(0);
    expect(up.dot(east!)).toBeCloseTo(0);
    expect(north!.dot(east!)).toBeCloseTo(0);
  });
});

describe("GroundObserver.getDirectionTo", () => {
  it("returns a unit vector pointing from Earth's center toward the body", () => {
    const observer = new GroundObserver(equatorStationFixture());
    const state = stateWithBodyAt(BodyIds.Sun, new THREE.Vector3(0, 0, 500));
    const direction = observer.getDirectionTo(BodyIds.Sun, state);
    expect(direction.length()).toBeCloseTo(1);
    expect(direction.x).toBeCloseTo(0);
    expect(direction.y).toBeCloseTo(0);
    expect(direction.z).toBeCloseTo(1);
  });

  it("throws for an unknown body id", () => {
    const observer = new GroundObserver(equatorStationFixture());
    const state = stateWithBodyAt(BodyIds.Sun, new THREE.Vector3(1, 0, 0));
    expect(() => observer.getDirectionTo("mars" as BodyId, state)).toThrow();
  });

  it("hand-computed: Sun directly overhead reads as zenith (direction parallel to local up)", () => {
    const observer = new GroundObserver(equatorStationFixture());
    const frame = observer.getFrame();
    // Put the Sun far along this observer's own "up" direction.
    const sunPosition = frame.up.clone().multiplyScalar(1000);
    const state = stateWithBodyAt(BodyIds.Sun, sunPosition);
    const direction = observer.getDirectionTo(BodyIds.Sun, state);
    expect(direction.dot(frame.up)).toBeCloseTo(1, 5);
  });

  it("hand-computed: Sun on the horizon reads as perpendicular to local up", () => {
    const observer = new GroundObserver(equatorStationFixture());
    const frame = observer.getFrame();
    // Put the Sun far along this observer's "north" direction - tangent to
    // the sphere, i.e. exactly on the horizon.
    const sunPosition = frame.north!.clone().multiplyScalar(1000);
    const state = stateWithBodyAt(BodyIds.Sun, sunPosition);
    const direction = observer.getDirectionTo(BodyIds.Sun, state);
    expect(direction.dot(frame.up)).toBeCloseTo(0, 5);
  });
});
