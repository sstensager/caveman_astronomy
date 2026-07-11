import type { Layer } from "./Layer";

/**
 * Central registry of every layer in the scene. This is what makes new
 * educational shots a matter of composition instead of code: register a
 * layer once, and it becomes addressable by id from `show()`, from the
 * control panel, and eventually from camera-keyframe scripts.
 */
export class LayerRegistry {
  private readonly layers = new Map<string, Layer>();

  register(layer: Layer): void {
    this.layers.set(layer.id, layer);
  }

  get(id: string): Layer | undefined {
    return this.layers.get(id);
  }

  all(): Layer[] {
    return [...this.layers.values()];
  }

  /** e.g. layers.show({ continents: true, axis: false }) */
  show(visibility: Partial<Record<string, boolean>>): void {
    for (const [id, visible] of Object.entries(visibility)) {
      if (visible === undefined) continue;
      const layer = this.layers.get(id);
      if (!layer) {
        console.warn(`LayerRegistry.show: unknown layer id "${id}"`);
        continue;
      }
      layer.setVisible(visible);
    }
  }

  update(deltaSeconds: number): void {
    for (const layer of this.layers.values()) {
      layer.update?.(deltaSeconds);
    }
  }
}
