import * as THREE from "three";
import type { Layer } from "../Layer";
import { BASE_EARTH_ANGULAR_SPEED, COLORS, EARTH_RADIUS } from "../../config/constants";

/**
 * The fundamental Earth layer: an ocean-colored sphere plus the two
 * nested groups everything else on Earth attaches to:
 *  - `object3D` (orbitGroup): where Earth sits in space. Idle today,
 *    will carry Earth's revolution around the Sun later.
 *  - `rotationGroup`: spins on the axis. Geographic/environmental layers
 *    (continents, clouds, grids, the axis line) and any number of
 *    ObserverStation instances all parent into this so they rotate rigidly
 *    with the planet. EarthBase itself owns no observer/ground-station
 *    state - see src/observers/ObserverStation.ts.
 *
 * Unlike most layers this one can't be fully hidden - "Show Earth" only
 * toggles the mesh itself, since the rotation frame is load-bearing for
 * every other Earth layer and for Ground View.
 */
export class EarthBase implements Layer {
  readonly id = "earthBase";
  readonly label = "Show Earth";
  readonly group = "Earth.Base" as const;

  readonly object3D: THREE.Group;
  readonly rotationGroup: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly oceanMaterial: THREE.MeshStandardMaterial;

  rotationEnabled = true;

  constructor() {
    this.object3D = new THREE.Group();
    this.object3D.name = "Earth.orbitGroup";

    this.rotationGroup = new THREE.Group();
    this.rotationGroup.name = "Earth.rotationGroup";
    this.object3D.add(this.rotationGroup);

    this.oceanMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.earth,
      roughness: 1,
      metalness: 0,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 48, 32), this.oceanMaterial);
    this.mesh.name = "Earth.mesh";
    this.rotationGroup.add(this.mesh);
  }

  update(deltaSeconds: number): void {
    if (this.rotationEnabled) {
      this.rotationGroup.rotation.y += BASE_EARTH_ANGULAR_SPEED * deltaSeconds;
    }
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }
}
