import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import { hemisphereFadeFactor, type HemisphereMode } from "../../utils/hemisphereFade";

/**
 * A translucent wireframe reference sphere for the "explanatory globe" view -
 * gives the small-scale Sun/Moon/star markers a visible surface to read as
 * "wrapped around Earth" from outside, rather than floating in empty space.
 * Purely a static visual reference; carries no model/motion logic.
 *
 * Built at unit radius and scaled via object3D.scale (same pattern as
 * StarsLayer) so the display radius can change live without rebuilding
 * geometry.
 */
export class CelestialSphereShell implements Layer {
  readonly id = "celestialSphereShell";
  readonly label = "Show Celestial Sphere";
  readonly group: LayerGroup = "Sky.Geometry";
  readonly object3D: THREE.Mesh;

  private readonly material: THREE.MeshBasicMaterial;
  private hemisphereMode: HemisphereMode = "none";

  constructor(radius: number) {
    const geometry = new THREE.SphereGeometry(1, 24, 16);
    const colorAttribute = new THREE.BufferAttribute(
      new Float32Array(geometry.getAttribute("position").count * 3).fill(1),
      3,
    );
    geometry.setAttribute("color", colorAttribute);

    this.material = new THREE.MeshBasicMaterial({
      color: 0x3a5a99,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      vertexColors: true,
    });
    this.object3D = new THREE.Mesh(geometry, this.material);
    this.object3D.name = "CelestialSphereShell";
    this.object3D.scale.setScalar(radius);
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  setRadius(radius: number): void {
    this.object3D.scale.setScalar(radius);
  }

  setWireframeOpacity(value: number): void {
    this.material.opacity = value;
  }

  setHemisphereMode(mode: HemisphereMode): void {
    this.hemisphereMode = mode;
  }

  /** No-op unless a mode other than "none" is active - cheap to call
   *  unconditionally each frame. Reuses the sphere's own outward-facing
   *  normals as the per-vertex direction, no extra geometry math needed. */
  updateHemisphereFade(cameraDirection: THREE.Vector3): void {
    if (this.hemisphereMode === "none") return;

    const normal = this.object3D.geometry.getAttribute("normal") as THREE.BufferAttribute;
    const color = this.object3D.geometry.getAttribute("color") as THREE.BufferAttribute;
    const direction = new THREE.Vector3();
    for (let i = 0; i < normal.count; i++) {
      direction.set(normal.getX(i), normal.getY(i), normal.getZ(i));
      const factor = hemisphereFadeFactor(direction, cameraDirection, this.hemisphereMode);
      color.setXYZ(i, factor, factor, factor);
    }
    color.needsUpdate = true;
  }
}
