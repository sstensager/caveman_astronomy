import * as THREE from "three";
import type { Entity } from "./Entity";
import {
  AXIS_LENGTH,
  BASE_EARTH_ANGULAR_SPEED,
  COLORS,
  DEFAULT_LATITUDE_DEG,
  DEFAULT_LONGITUDE_DEG,
  EARTH_RADIUS,
  OBSERVER_HEIGHT,
} from "../config/constants";

function latLonToSurfacePoint(latDeg: number, lonDeg: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - latDeg); // polar angle from +Y
  const theta = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Earth is split into two nested groups so future features slot in cleanly:
 *  - `orbitGroup` (== object3D): where Earth sits in space. Idle today,
 *    will carry Earth's revolution around the Sun later.
 *  - `rotationGroup`: spins on the axis. Everything that should visually
 *    rotate with the planet (mesh, axis helper, ground station) lives here.
 *
 * A "ground station" child anchor marks a fixed point on the surface
 * (given a latitude/longitude) so a camera can be parented there to get
 * a "standing on Earth" view that rotates rigidly with the planet.
 */
export class Earth implements Entity {
  readonly object3D: THREE.Group;
  readonly groundStation: THREE.Object3D;

  private readonly rotationGroup: THREE.Group;
  private readonly earthMesh: THREE.Mesh;
  private readonly axisLine: THREE.Line;

  rotationEnabled = true;

  constructor() {
    this.object3D = new THREE.Group();
    this.object3D.name = "Earth.orbitGroup";

    this.rotationGroup = new THREE.Group();
    this.rotationGroup.name = "Earth.rotationGroup";
    this.object3D.add(this.rotationGroup);

    this.earthMesh = this.createMesh();
    this.rotationGroup.add(this.earthMesh);

    this.axisLine = this.createAxisLine();
    this.rotationGroup.add(this.axisLine);

    this.groundStation = this.createGroundStation();
    this.rotationGroup.add(this.groundStation);
  }

  private createMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 48, 32);
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.earth,
      roughness: 1,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "Earth.mesh";
    return mesh;
  }

  private createAxisLine(): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -AXIS_LENGTH, 0),
      new THREE.Vector3(0, AXIS_LENGTH, 0),
    ]);
    const material = new THREE.LineBasicMaterial({ color: COLORS.axis });
    const line = new THREE.Line(geometry, material);
    line.name = "Earth.axis";
    return line;
  }

  private createGroundStation(): THREE.Object3D {
    const surfacePoint = latLonToSurfacePoint(
      DEFAULT_LATITUDE_DEG,
      DEFAULT_LONGITUDE_DEG,
      EARTH_RADIUS + OBSERVER_HEIGHT,
    );
    const normal = surfacePoint.clone().normalize();

    const station = new THREE.Object3D();
    station.name = "Earth.groundStation";
    station.position.copy(surfacePoint);
    station.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    return station;
  }

  update(deltaSeconds: number): void {
    if (this.rotationEnabled) {
      this.rotationGroup.rotation.y += BASE_EARTH_ANGULAR_SPEED * deltaSeconds;
    }
  }

  setVisible(visible: boolean): void {
    this.earthMesh.visible = visible;
  }

  setAxisVisible(visible: boolean): void {
    this.axisLine.visible = visible;
  }
}
