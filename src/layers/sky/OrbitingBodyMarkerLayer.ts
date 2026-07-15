import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { Vector3Like } from "../../astronomy/types";

export interface OrbitingBodyMarkerOptions {
  id: string;
  label: string;
  group: LayerGroup;
  color: number;
  /** Fully-resolved position for this marker, in whatever THREE.Object3D
   *  this marker's object3D ends up parented under (e.g. main.ts's
   *  sunMarker/moonMarker, parented under earthBase.object3D - see their
   *  own doc comments), never raw model-space or world-space directly.
   *  Called fresh every update() - a pure function of current sim time, no
   *  internal memoization, same pattern as every other body-position
   *  consumer in this app. */
  getPosition: () => Vector3Like;
  /** Marker sphere radius, in the SAME local units getPosition() returns -
   *  there is no enclosing celestial-sphere radius to derive a size ratio
   *  from, so callers pass an absolute size directly (see main.ts for how
   *  each body's size is chosen). */
  markerSize: number;
  /** Optional image (served from public/, e.g. "/textures/earth1.png")
   *  mapped onto the marker sphere instead of a flat color. */
  textureUrl?: string;
  /** Default false (unlit `MeshBasicMaterial` - correct for a self-luminous
   *  body like the Sun). Set true for a body that should be genuinely
   *  SHADED by the scene's real keyLight instead (e.g. the Moon, for real
   *  phases) - `MeshStandardMaterial`, responds to the same lights
   *  regardless of where this marker is parented. */
  lit?: boolean;
  /** How the marker's own mesh is oriented as it moves, independent of its
   *  ORBITAL position (which recompute() always computes correctly
   *  regardless of this setting). Default "still". "tidalLocked" keeps a
   *  fixed mesh-local face pointed at this marker's PARENT origin (its
   *  local (0,0,0) - e.g. Earth's own center, for a marker parented under
   *  earthBase.object3D) as it moves, the way the Moon's real near side
   *  always faces Earth. */
  spinMode?: "still" | "tidalLocked";
}

/**
 * A body marker positioned by raw, absolute (local) position rather than
 * apparent direction-from-an-observer - shows a body actually MOVING
 * through space (e.g. the Sun/Moon orbiting Earth) rather than its apparent
 * sky-direction as seen from a fixed observer. The app's one Sun marker and
 * one Moon marker (see main.ts's sunMarker/moonMarker) are both built from
 * this, via real relative-vector math (eclipticToWorld(subVectors(...))) -
 * see astronomy/solarSystemDiagram.ts - exactly like OrbitLineLayer's
 * ellipses, never a bespoke shortcut.
 */
export class OrbitingBodyMarkerLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D: THREE.Mesh;

  private readonly getPosition: () => Vector3Like;
  private readonly baseMarkerSize: number;
  private readonly spinMode: "still" | "tidalLocked";

  constructor(options: OrbitingBodyMarkerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.group = options.group;
    this.getPosition = options.getPosition;
    this.baseMarkerSize = options.markerSize;
    this.spinMode = options.spinMode ?? "still";

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

  /** Live-rescales the marker sphere after construction (the Sun & Moon
   *  section's Size sliders - see main.ts), via object3D.scale rather than
   *  rebuilding geometry - same pattern as ZenithLayer.setRadius. `size` is
   *  in the SAME local units the constructor's `markerSize` option is. */
  setMarkerSize(size: number): void {
    this.object3D.scale.setScalar(size / this.baseMarkerSize);
  }

  private recompute(): void {
    const p = this.getPosition();
    this.object3D.position.set(p.x, p.y, p.z);
    if (this.spinMode === "tidalLocked") {
      this.object3D.lookAt(0, 0, 0);
    }
  }
}
