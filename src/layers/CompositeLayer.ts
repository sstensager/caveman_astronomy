import type { Layer, LayerGroup } from "./Layer";

/**
 * Fuses several Layers under one id/label/checkbox. General-purpose, not
 * sky-specific - for any "one concept, multiple render representations"
 * need (e.g. the same stars or Sun/Moon marker rendered at both an
 * immersive sky-scale radius and a small "explanatory globe" radius: one
 * "Show Stars" toggle should control both, not double the checkbox count).
 * Has no object3D of its own - each child is responsible for adding its own
 * object3D to the scene.
 */
export class CompositeLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  private readonly children: Layer[];

  constructor(id: string, label: string, group: LayerGroup, children: Layer[]) {
    this.id = id;
    this.label = label;
    this.group = group;
    this.children = children;
  }

  setVisible(visible: boolean): void {
    for (const child of this.children) {
      child.setVisible(visible);
    }
  }

  update(deltaSeconds: number): void {
    for (const child of this.children) {
      child.update?.(deltaSeconds);
    }
  }
}
