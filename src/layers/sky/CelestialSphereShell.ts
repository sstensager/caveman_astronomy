import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { Observer } from "../../observers/Observer";
import { hemisphereFadeFactor, type HemisphereMode } from "../../utils/hemisphereFade";

/**
 * A translucent wireframe reference sphere marking the surface of the
 * shared sky radius (see config/constants.ts's STAR_RADIUS_*) - gives the
 * star field/Sun/Moon markers a visible surface to read against, and is
 * itself the clearest visual demonstration of "the celestial sphere"
 * concept when the radius is dialed down small. Purely a static visual
 * reference; carries no model/motion logic of its own beyond tracking the
 * observer's position, same as StarsLayer - the celestial sphere is
 * centered on the OBSERVER, not on Earth's core, an offset that only reads
 * as visible once the radius shrinks close to EARTH_RADIUS.
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
  private readonly getObserver?: () => Observer;
  private hemisphereMode: HemisphereMode = "none";

  constructor(radius: number, getObserver?: () => Observer) {
    this.getObserver = getObserver;

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

  /** No-op unless an observer getter was supplied - identical shape to
   *  StarsLayer.update. */
  update(): void {
    if (!this.getObserver) return;
    this.object3D.position.copy(this.getObserver().getFrame().worldPosition);
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
