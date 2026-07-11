import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";

/**
 * A translucent wireframe reference sphere for the "explanatory globe" view -
 * gives the small-scale Sun/Moon/star markers a visible surface to read as
 * "wrapped around Earth" from outside, rather than floating in empty space.
 * Purely a static visual reference; carries no model/motion logic.
 */
export class CelestialSphereShell implements Layer {
  readonly id = "celestialSphereShell";
  readonly label = "Show Celestial Sphere";
  readonly group: LayerGroup = "Sky.Geometry";
  readonly object3D: THREE.Mesh;

  constructor(radius: number) {
    const geometry = new THREE.SphereGeometry(radius, 24, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x3a5a99,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.object3D = new THREE.Mesh(geometry, material);
    this.object3D.name = "CelestialSphereShell";
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }
}
