import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ObserverStation } from "./ObserverStation";
import { EARTH_RADIUS, OBSERVER_HEIGHT } from "../config/constants";

describe("ObserverStation", () => {
  it("setLatLon / getLatLon round-trip", () => {
    const parent = new THREE.Object3D();
    const station = new ObserverStation(parent, { id: "a", label: "A", latDeg: 45, lonDeg: 0 });

    for (const [latDeg, lonDeg] of [
      [0, 0],
      [-30, 120],
      [60, -90],
      [10, 179],
    ] as const) {
      station.setLatLon(latDeg, lonDeg);
      const result = station.getLatLon();
      expect(result.latDeg).toBeCloseTo(latDeg, 8);
      expect(result.lonDeg).toBeCloseTo(lonDeg, 8);
    }
  });

  it("stays at the fixed EARTH_RADIUS + OBSERVER_HEIGHT distance from the parent origin", () => {
    const parent = new THREE.Object3D();
    const station = new ObserverStation(parent, { id: "a", label: "A", latDeg: 20, lonDeg: 30 });
    expect(station.object3D.position.length()).toBeCloseTo(EARTH_RADIUS + OBSERVER_HEIGHT, 8);
  });

  it("moveTangent along north increases latitude when starting at the equator", () => {
    const parent = new THREE.Object3D();
    const station = new ObserverStation(parent, { id: "a", label: "A", latDeg: 0, lonDeg: 0 });
    station.moveTangent(0.5, 0);
    const { latDeg } = station.getLatLon();
    expect(latDeg).toBeGreaterThan(0);
  });

  it("moveTangent keeps the station on the fixed-radius sphere", () => {
    const parent = new THREE.Object3D();
    const station = new ObserverStation(parent, { id: "a", label: "A", latDeg: 10, lonDeg: 10 });
    station.moveTangent(0.3, 0.2);
    expect(station.object3D.position.length()).toBeCloseTo(EARTH_RADIUS + OBSERVER_HEIGHT, 8);
  });

  it("setLocalSurfacePoint renormalizes an off-sphere point onto the fixed radius", () => {
    const parent = new THREE.Object3D();
    const station = new ObserverStation(parent, { id: "a", label: "A", latDeg: 0, lonDeg: 0 });
    station.setLocalSurfacePoint(new THREE.Vector3(500, 0, 500));
    expect(station.object3D.position.length()).toBeCloseTo(EARTH_RADIUS + OBSERVER_HEIGHT, 8);
    // (500,0,500) direction is lon=45, lat=0
    const { latDeg, lonDeg } = station.getLatLon();
    expect(latDeg).toBeCloseTo(0, 5);
    expect(lonDeg).toBeCloseTo(45, 5);
  });

  it("self-parents into the given parent Object3D", () => {
    const parent = new THREE.Object3D();
    const station = new ObserverStation(parent, { id: "a", label: "A", latDeg: 0, lonDeg: 0 });
    expect(parent.children).toContain(station.object3D);
  });

  it("moveInLocalDirection displaces toward the given direction and stays on the fixed-radius sphere", () => {
    const parent = new THREE.Object3D();
    const station = new ObserverStation(parent, { id: "a", label: "A", latDeg: 0, lonDeg: 0 });
    const before = station.object3D.position.clone();
    station.moveInLocalDirection(new THREE.Vector3(0, 0, -1), 0.5);
    const after = station.object3D.position.clone();
    expect(after.distanceTo(before)).toBeGreaterThan(0);
    expect(after.length()).toBeCloseTo(EARTH_RADIUS + OBSERVER_HEIGHT, 8);
  });

  it("moveInLocalDirection with a zero-length distance is a no-op", () => {
    const parent = new THREE.Object3D();
    const station = new ObserverStation(parent, { id: "a", label: "A", latDeg: 0, lonDeg: 0 });
    const before = station.object3D.position.clone();
    station.moveInLocalDirection(new THREE.Vector3(0, 0, -1), 0);
    expect(station.object3D.position.distanceTo(before)).toBeCloseTo(0, 10);
  });
});
