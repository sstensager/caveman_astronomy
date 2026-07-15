import * as THREE from "three";
import type { Layer, LayerGroup } from "../layers/Layer";
import type { Observer } from "./Observer";
import { projectDirectionToSphere } from "./projection";

export interface ZenithLayerOptions {
  id: string;
  label: string;
  /** How far out the zenith point/line projects - the zenith really is a
   *  point on the celestial sphere directly overhead, so this is typically
   *  the shared sky radius (see main.ts's skyRadius), not a small fixed
   *  value - can range up to effectively "infinity" (STAR_RADIUS_MAX). */
  radius: number;
  /** Absolute marker-dot size, in world units, INDEPENDENT of `radius` -
   *  the dot itself should read as a small fixed marker regardless of how
   *  far its line extends, not balloon up proportionally the way the sky
   *  radius can (10 to 2000) - see config/constants.ts's ZENITH_DOT_SIZE. */
  dotSize: number;
  color?: number;
  getActiveObserver: () => Observer;
}

/**
 * Projects the active observer's local "up" (zenith) direction onto a
 * celestial sphere of the given radius, rendered as both a point and a
 * line from the observer's own position out to that point (AxisLayer's
 * two-point THREE.Line technique, rebuilt each frame since the observer
 * moves).
 *
 * Always offset by the observer's live world position - structurally
 * required here, since the whole point is that it's rooted at the
 * observer.
 *
 * Takes a LAZY getActiveObserver getter (mirroring StarPicker's getCamera
 * pattern) rather than a fixed Observer, so a single instance always
 * follows whichever observer is currently active.
 */
export class ZenithLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup = "Sky.Interpretation";
  readonly object3D: THREE.Group;

  private readonly pointMesh: THREE.Mesh;
  private readonly line: THREE.Line;
  private readonly getActiveObserver: () => Observer;
  private radius: number;

  constructor(options: ZenithLayerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.radius = options.radius;
    this.getActiveObserver = options.getActiveObserver;

    const color = options.color ?? 0x7fe0ff;

    const pointMaterial = new THREE.MeshBasicMaterial({ color });
    this.pointMesh = new THREE.Mesh(new THREE.SphereGeometry(options.dotSize, 16, 12), pointMaterial);
    this.pointMesh.name = `ZenithLayer.${options.id}.point`;

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const lineMaterial = new THREE.LineBasicMaterial({ color });
    this.line = new THREE.Line(lineGeometry, lineMaterial);
    this.line.name = `ZenithLayer.${options.id}.line`;

    this.object3D = new THREE.Group();
    this.object3D.name = `ZenithLayer.${options.id}`;
    this.object3D.add(this.pointMesh, this.line);
  }

  update(): void {
    const frame = this.getActiveObserver().getFrame();
    const offset = projectDirectionToSphere(frame.up, this.radius);
    const zenithWorld = frame.worldPosition.clone().add(offset);

    this.pointMesh.position.copy(zenithWorld);

    const positions = this.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    positions.setXYZ(0, frame.worldPosition.x, frame.worldPosition.y, frame.worldPosition.z);
    positions.setXYZ(1, zenithWorld.x, zenithWorld.y, zenithWorld.z);
    positions.needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  /** Updates how far future update() calls project the point/line - the
   *  dot's own visual size is fixed at construction (dotSize) and never
   *  rescaled here, unlike the old radius-proportional behavior this
   *  replaced. */
  setRadius(radius: number): void {
    this.radius = radius;
  }
}
