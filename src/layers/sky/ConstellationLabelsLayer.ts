import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { Observer } from "../../observers/Observer";
import type { ResolvedConstellation } from "../../astronomy/constellationCatalog";
import { createLabelTexture } from "../../utils/canvasLabel";

const LABEL_CANVAS_WIDTH = 256;
const LABEL_CANVAS_HEIGHT = 64;

interface LabelEntry {
  sprite: THREE.Sprite;
  direction: THREE.Vector3;
}

export interface ConstellationLabelsLayerOptions {
  id: string;
  label: string;
  group: LayerGroup;
  radius: number;
  constellations: ResolvedConstellation[];
  color?: string;
  /** Sprite size in NDC-ish units - independent of `radius` and of camera
   *  distance, since sizeAttenuation is off (see class doc comment), so the
   *  same default reads sensibly at both the sky and globe scale. */
  spriteWidth?: number;
  spriteHeight?: number;
  /** Same meaning as StarsLayer/ConstellationLinesLayer's getObserver -
   *  only the sky-tier instance sets this. */
  getObserver?: () => Observer;
  /** Defaults to createLabelTexture (real canvas text rendering) -
   *  injectable so tests can verify the position/update math (the actually
   *  interesting logic here) without a canvas 2D context, which this
   *  project's vitest environment ("node", not "jsdom") doesn't provide. */
  createTexture?: (text: string, color: string) => THREE.Texture;
}

/**
 * Constellation name labels: one THREE.Sprite per constellation, its text
 * baked into a CanvasTexture ONCE at construction (89 small canvases total,
 * for the western set) - never per frame, and never a DOM element attached
 * to the page. `sizeAttenuation: false` on the sprite material makes each
 * label a fixed on-screen size regardless of distance, matching this app's
 * existing fixed-pixel-marker convention (see ObserverMarker/
 * SelectedStarMarker), and conveniently means the same spriteWidth/Height
 * defaults work for both the sky-scale and globe-scale instance without
 * per-tier tuning.
 *
 * Per-frame work is one vector scale+add per label (direction * radius,
 * plus the observer's world position for the sky tier) - cheap position
 * math on ALREADY-resolved directions, not a star lookup, and not
 * per-vertex geometry work like StarsLayer's hemisphere fade. Handles both
 * "observer moved" and "radius slider changed" the same way, every frame,
 * rather than needing a separate setRadius() special case.
 */
export class ConstellationLabelsLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D: THREE.Group;

  private readonly entries: LabelEntry[] = [];
  private readonly getObserver?: () => Observer;
  private radius: number;

  constructor(options: ConstellationLabelsLayerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.group = options.group;
    this.radius = options.radius;
    this.getObserver = options.getObserver;

    this.object3D = new THREE.Group();
    this.object3D.name = `ConstellationLabelsLayer.${options.id}`;

    const width = options.spriteWidth ?? 0.09;
    const height = options.spriteHeight ?? (width * LABEL_CANVAS_HEIGHT) / LABEL_CANVAS_WIDTH;
    const createTexture = options.createTexture ?? createLabelTexture;

    for (const constellation of options.constellations) {
      const texture = createTexture(constellation.name, options.color ?? "#8fb7e0");
      const material = new THREE.SpriteMaterial({
        map: texture,
        sizeAttenuation: false,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(width, height, 1);
      sprite.renderOrder = 997;

      const direction = new THREE.Vector3(constellation.labelDirection.x, constellation.labelDirection.y, constellation.labelDirection.z);
      this.object3D.add(sprite);
      this.entries.push({ sprite, direction });
    }

    this.update();
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  update(_deltaSeconds?: number): void {
    const observerWorldPosition = this.getObserver?.().getFrame().worldPosition;
    for (const entry of this.entries) {
      entry.sprite.position.copy(entry.direction).multiplyScalar(this.radius);
      if (observerWorldPosition) entry.sprite.position.add(observerWorldPosition);
    }
  }

  setRadius(radius: number): void {
    this.radius = radius;
    this.update();
  }
}
