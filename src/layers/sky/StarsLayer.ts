import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { Vector3Like } from "../../astronomy/types";
import { COLORS } from "../../config/constants";

/**
 * Builds a shared, unit-radius BufferGeometry from a star catalog so
 * multiple StarsLayer instances (different display radii) can reference
 * the identical star data via object3D.scale instead of duplicating it -
 * guarantees the sky-scale and "explanatory globe"-scale views show the
 * same stars, not two independently-randomized skies.
 */
export function buildStarGeometry(catalog: Vector3Like[]): THREE.BufferGeometry {
  const positions = new Float32Array(catalog.length * 3);
  catalog.forEach((direction, i) => {
    positions[i * 3] = direction.x;
    positions[i * 3 + 1] = direction.y;
    positions[i * 3 + 2] = direction.z;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/**
 * A large sphere of points representing "effectively infinitely far away"
 * stars. Deliberately lives at the scene root (not under Earth) and never
 * rotates - this is what makes the sky read as fixed while Earth spins
 * beneath it in Space View, and as moving overhead in Ground View once
 * the observer's horizon rotates instead.
 *
 * Takes a pre-built, unit-radius geometry (see buildStarGeometry above) and
 * applies its display radius via object3D.scale.
 */
export class StarsLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup = "Sky.Observation";
  readonly object3D: THREE.Points;

  constructor(geometry: THREE.BufferGeometry, radius: number, id = "stars", label = "Show Stars") {
    this.id = id;
    this.label = label;

    const material = new THREE.PointsMaterial({
      color: COLORS.star,
      size: 4,
      sizeAttenuation: false,
    });

    this.object3D = new THREE.Points(geometry, material);
    this.object3D.name = `StarsLayer.${id}`;
    this.object3D.scale.setScalar(radius);
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }
}
