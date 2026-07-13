import type { AstronomyModel } from "./types";

export interface AstronomyModelEntry {
  readonly id: string;
  readonly label: string;
  readonly model: AstronomyModel;
}

/**
 * The list of every AstronomyModel the app knows about. There is no notion
 * of a single "active" model here - each registered model is permanently,
 * independently addressable (see main.ts's per-model diagram builder), which
 * is what lets both models' explanatory diagrams be toggled on screen at
 * once instead of exactly one being "selected". Adding a future third model
 * (e.g. epicycles) is a single add() call - both the diagram-building loop
 * and the control-panel-building loop in main.ts iterate all() to pick up
 * new entries automatically.
 */
export class AstronomyModelRegistry {
  private readonly entries = new Map<string, AstronomyModelEntry>();

  add(entry: AstronomyModelEntry): void {
    this.entries.set(entry.id, entry);
  }

  all(): AstronomyModelEntry[] {
    return [...this.entries.values()];
  }

  get(id: string): AstronomyModelEntry | undefined {
    return this.entries.get(id);
  }
}
