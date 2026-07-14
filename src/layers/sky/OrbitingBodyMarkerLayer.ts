import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { Vector3Like } from "../../astronomy/types";

export interface OrbitingBodyMarkerOptions {
  id: string;
  label: string;
  group: LayerGroup;
  color: number;
  /** Fully-resolved position for this marker, in the DIAGRAM'S OWN local
   *  space - i.e. relative to whatever THREE.Object3D this marker's
   *  object3D ends up parented under (see main.ts's buildSolarSystemDiagram,
   *  which parents every marker under a single offset Group), never raw
   *  model-space or world-space directly. Called fresh every update() -
   *  same "pure function of current sim time, no internal memoization"
   *  pattern as every other body-position consumer in this app (see
   *  CelestialMarkerLayer's doc comment). */
  getPosition: () => Vector3Like;
  /** Marker sphere radius, in the SAME diagram-local units getPosition()
   *  returns - unlike CelestialMarkerLayer, this diagram has no enclosing
   *  celestial-sphere radius to derive a size ratio from, so callers pass an
   *  absolute size directly (see main.ts for how each body's size is
   *  chosen). */
  markerSize: number;
  /** Optional image (served from public/, e.g. "/textures/earth1.png")
   *  mapped onto the marker sphere instead of a flat color. */
  textureUrl?: string;
  /** Default false (unlit `MeshBasicMaterial` - correct for a self-luminous
   *  body like the Sun). Set true for a body that should be genuinely
   *  SHADED by the scene's real keyLight instead (e.g. the Moon, for real
   *  phases) - see `CelestialMarkerLayer`'s identical option for the full
   *  reasoning (`MeshStandardMaterial`, responds to the same lights
   *  regardless of where this marker is parented). */
  lit?: boolean;
}

/**
 * A body marker positioned by raw, absolute (diagram-local) position rather
 * than apparent direction-from-an-observer - the thing CelestialMarkerLayer
 * deliberately does NOT do (see its own doc comment: "NEVER computes its own
 * orbital position... getDirectionTo() -> projectDirectionToSphere()").
 * This is the new capability the Solar System diagram needs: showing a body
 * actually MOVING through model space (e.g. Earth orbiting the Sun) rather
 * than the apparent sky-direction of a body as seen from a fixed observer.
 * See main.ts's buildSolarSystemDiagram for how getPosition() is computed -
 * always via real relative-vector math (eclipticToWorld(subVectors(...)))
 * exactly like OrbitLineLayer's ellipses, never a bespoke shortcut.
 */
export class OrbitingBodyMarkerLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D: THREE.Mesh;

  private readonly getPosition: () => Vector3Like;
  private readonly baseMarkerSize: number;

  constructor(options: OrbitingBodyMarkerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.group = options.group;
    this.getPosition = options.getPosition;
    this.baseMarkerSize = options.markerSize;

    const geometry = new THREE.SphereGeometry(options.markerSize, 20, 14);
    const color = options.textureUrl ? 0xffffff : options.color;
    const material = options.lit
      ? new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 })
      : new THREE.MeshBasicMaterial({ color });
    if (options.textureUrl) {
      const texture = new THREE.TextureLoader().load(options.textureUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
    }
    this.object3D = new THREE.Mesh(geometry, material);
    this.object3D.name = `OrbitingBodyMarker.${options.id}`;
    this.recompute();
  }

  update(): void {
    this.recompute();
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  /** Live-rescales the marker sphere after construction (e.g. a "Sun/Moon
   *  size" slider - see main.ts's Center:Sun Scale panel section), via
   *  object3D.scale rather than rebuilding geometry - same pattern as
   *  CelestialMarkerLayer.setRadius/ZenithLayer.setRadius. `size` is in the
   *  SAME diagram-local units the constructor's `markerSize` option is. */
  setMarkerSize(size: number): void {
    this.object3D.scale.setScalar(size / this.baseMarkerSize);
  }

  private recompute(): void {
    const p = this.getPosition();
    this.object3D.position.set(p.x, p.y, p.z);
  }
}
