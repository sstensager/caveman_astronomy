import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { Vector3Like } from "../../astronomy/types";
import { createLabelTexture } from "../../utils/canvasLabel";

const LABEL_CANVAS_WIDTH = 256;
const LABEL_CANVAS_HEIGHT = 64;

export interface BodyLabelEntry {
  /** Fully-resolved position, in whatever THREE.Object3D this layer's own
   *  object3D ends up parented under - same convention as
   *  OrbitingBodyMarkerLayer's getPosition, since this is meant to track a
   *  body marker built the same way. Called fresh every update(). */
  getPosition: () => Vector3Like;
  text: string;
  color?: string;
  /** Added AFTER getPosition(), in the same local units - lets the label
   *  sit just above/beside its marker instead of directly overlapping it. */
  offset?: Vector3Like;
}

interface LabelSprite {
  entry: BodyLabelEntry;
  sprite: THREE.Sprite;
}

export interface BodyLabelsLayerOptions {
  id: string;
  label: string;
  group: LayerGroup;
  entries: BodyLabelEntry[];
  /** Sprite size in NDC-ish units - same sizeAttenuation:false convention
   *  as ConstellationLabelsLayer, so labels stay legible at any zoom/camera
   *  distance instead of shrinking to nothing far from the body. */
  spriteWidth?: number;
  spriteHeight?: number;
  /** Defaults to createLabelTexture (real canvas text rendering) -
   *  injectable so tests can verify the position update logic without a
   *  canvas 2D context, same pattern as ConstellationLabelsLayer. */
  createTexture?: (text: string, color: string) => THREE.Texture;
}

/**
 * Text labels tracking a set of live body positions (e.g. main.ts's planet
 * markers) rather than fixed celestial-sphere directions - the sibling of
 * ConstellationLabelsLayer, which positions via direction*radius+observer
 * instead. One sprite per entry, its text baked into a CanvasTexture ONCE at
 * construction, repositioned every update() from the entry's own
 * getPosition() (the same live position source the tracked marker itself
 * uses) plus a small fixed offset so the label doesn't sit directly on top
 * of the marker dot.
 */
export class BodyLabelsLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D: THREE.Group;

  private readonly labels: LabelSprite[] = [];

  constructor(options: BodyLabelsLayerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.group = options.group;

    this.object3D = new THREE.Group();
    this.object3D.name = `BodyLabelsLayer.${options.id}`;

    const width = options.spriteWidth ?? 0.09;
    const height = options.spriteHeight ?? (width * LABEL_CANVAS_HEIGHT) / LABEL_CANVAS_WIDTH;
    const createTexture = options.createTexture ?? createLabelTexture;

    for (const entry of options.entries) {
      const texture = createTexture(entry.text, entry.color ?? "#ffffff");
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
      this.object3D.add(sprite);
      this.labels.push({ entry, sprite });
    }

    this.update();
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  update(): void {
    for (const { entry, sprite } of this.labels) {
      const p = entry.getPosition();
      const offset = entry.offset ?? { x: 0, y: 0, z: 0 };
      sprite.position.set(p.x + offset.x, p.y + offset.y, p.z + offset.z);
    }
  }
}
