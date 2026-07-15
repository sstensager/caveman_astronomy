import * as THREE from "three";
import type { Layer, LayerGroup } from "../layers/Layer";
import type { Observer } from "./Observer";
import { projectDirectionToSphere } from "./projection";
import { createLabelTexture } from "../utils/canvasLabel";

export interface ZenithLayerOptions {
  id: string;
  label: string;
  /** How far out the zenith point/line projects - the zenith really is a
   *  point on the celestial sphere directly overhead, so this is typically
   *  the shared sky radius (see main.ts's skyRadius), not a small fixed
   *  value - can range up to effectively "infinity" (STAR_RADIUS_MAX). */
  radius: number;
  /** The dot's on-screen size, in the same constant-screen-space units as
   *  AltAzGridLayer's compass sprites at sizeAttenuation:false (NOT world
   *  units - see the class doc comment for why). Independent of `radius` -
   *  see config/constants.ts's ZENITH_DOT_SIZE. */
  dotSize: number;
  color?: number;
  getActiveObserver: () => Observer;
}

// A plain filled circle, reused by every ZenithLayer instance (color is
// applied per-instance via SpriteMaterial.color tinting a white base, same
// pattern as textured OrbitingBodyMarkerLayer bodies) - built lazily once,
// not per constructor call, since it never depends on any instance's own
// state. Reuses createLabelTexture (a canvas-text renderer) with the Unicode
// "black circle" glyph rather than writing a second canvas-drawing helper
// just to fill a circle.
let dotTexture: THREE.CanvasTexture | undefined;
function getDotTexture(): THREE.CanvasTexture {
  dotTexture ??= createLabelTexture("●", "#ffffff", { width: 64, height: 64, font: "64px sans-serif" });
  return dotTexture;
}

/**
 * Projects the active observer's local "up" (zenith) direction onto a
 * celestial sphere of the given radius, rendered as both a point and a
 * line from the observer's own position out to that point (AxisLayer's
 * two-point THREE.Line technique, rebuilt each frame since the observer
 * moves).
 *
 * The point is a Sprite at sizeAttenuation:false (constant screen-space
 * size), NOT a literal small 3D sphere - a real sphere small enough to look
 * right up close (Ground View) would shrink to a sub-pixel, invisible speck
 * at `radius`'s far end once that's the shared sky radius (up to 2000 -
 * see ZenithLayerOptions.radius), the same reason stars themselves are
 * drawn as constant-size points rather than true-scale spheres. The LINE
 * stays a literal geometric segment (THREE.Line) since a 1px line is
 * visible across its whole length regardless of how far it reaches, unlike
 * a marker that needs enough on-screen area to register at all.
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

  private readonly pointSprite: THREE.Sprite;
  private readonly line: THREE.Line;
  private readonly getActiveObserver: () => Observer;
  private radius: number;

  constructor(options: ZenithLayerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.radius = options.radius;
    this.getActiveObserver = options.getActiveObserver;

    const color = options.color ?? 0x7fe0ff;

    const pointMaterial = new THREE.SpriteMaterial({
      map: getDotTexture(),
      color,
      sizeAttenuation: false,
      transparent: true,
    });
    this.pointSprite = new THREE.Sprite(pointMaterial);
    this.pointSprite.scale.set(options.dotSize, options.dotSize, 1);
    this.pointSprite.name = `ZenithLayer.${options.id}.point`;

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const lineMaterial = new THREE.LineBasicMaterial({ color });
    this.line = new THREE.Line(lineGeometry, lineMaterial);
    this.line.name = `ZenithLayer.${options.id}.line`;

    this.object3D = new THREE.Group();
    this.object3D.name = `ZenithLayer.${options.id}`;
    this.object3D.add(this.pointSprite, this.line);
  }

  update(): void {
    const frame = this.getActiveObserver().getFrame();
    const offset = projectDirectionToSphere(frame.up, this.radius);
    const zenithWorld = frame.worldPosition.clone().add(offset);

    this.pointSprite.position.copy(zenithWorld);

    const positions = this.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    positions.setXYZ(0, frame.worldPosition.x, frame.worldPosition.y, frame.worldPosition.z);
    positions.setXYZ(1, zenithWorld.x, zenithWorld.y, zenithWorld.z);
    positions.needsUpdate = true;
    // REQUIRED - see AltAzGridLayer.update's doc comment on the identical
    // fix: this.line's transform stays at identity forever (positions are
    // written directly as world-space vertex data), so its bounding sphere
    // never auto-updates on its own and must be recomputed explicitly each
    // frame or the line eventually gets incorrectly frustum-culled as the
    // observer moves.
    this.line.geometry.computeBoundingSphere();
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  /** Updates how far future update() calls project the point/line - the
   *  dot's own on-screen size is fixed at construction (dotSize) and never
   *  rescaled here. */
  setRadius(radius: number): void {
    this.radius = radius;
  }
}
