import type { Layer } from "./Layer";

/**
 * Central registry of every layer in the scene. This is what makes new
 * educational shots a matter of composition instead of code: register a
 * layer once, and it becomes addressable by id from `show()`, from the
 * control panel, and eventually from camera-keyframe scripts.
 */
export class LayerRegistry {
  private readonly layers = new Map<string, Layer>();
  // Mirrors the last value passed through show() for each id - lets
  // getVisibility() hand back a full snapshot without every Layer
  // implementation needing its own visibility getter. Populated lazily (only
  // ids show() has actually been called with), which is fine in practice:
  // main.ts always calls show() with every registered layer's default state
  // once at startup before anything reads it back.
  private readonly visibility = new Map<string, boolean>();

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
      this.visibility.set(id, visible);
    }
  }

  /** A full id->visible snapshot of every layer show() has touched so far -
   *  the catch-all bucket a SceneState capture uses for plain on/off layers
   *  (see scenes/SceneState.ts). */
  getVisibility(): Record<string, boolean> {
    return Object.fromEntries(this.visibility);
  }

  update(deltaSeconds: number): void {
    for (const layer of this.layers.values()) {
      layer.update?.(deltaSeconds);
    }
  }
}
