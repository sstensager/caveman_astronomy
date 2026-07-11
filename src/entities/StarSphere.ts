import * as THREE from "three";
import type { Entity } from "./Entity";
import { CELESTIAL_SPHERE_RADIUS, COLORS, STAR_COUNT } from "../config/constants";
import { randomPointOnSphere } from "../utils/random";

/**
 * A large sphere of points representing "effectively infinitely far away"
 * stars. Deliberately lives at the scene root (not under Earth) and never
 * rotates - this is what makes the sky read as fixed while Earth spins
 * beneath it in Space View, and as moving overhead in Ground View once
 * the observer's horizon rotates instead.
 */
export class StarSphere implements Entity {
  readonly object3D: THREE.Points;

  constructor() {
    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const [x, y, z] = randomPointOnSphere(CELESTIAL_SPHERE_RADIUS);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: COLORS.star,
      size: 4,
      sizeAttenuation: false,
    });

    this.object3D = new THREE.Points(geometry, material);
    this.object3D.name = "StarSphere";
  }

  // Stars are static; nothing to advance per frame in v0.1.
  update(): void {}

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }
}
