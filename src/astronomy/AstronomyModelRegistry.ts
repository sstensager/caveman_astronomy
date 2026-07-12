import type { AstronomyModel } from "./types";

export interface AstronomyModelEntry {
  readonly id: string;
  readonly label: string;
  readonly model: AstronomyModel;
}

/**
 * Tracks every AstronomyModel the app can switch between and which one is
 * currently "active". Exactly one model governs the universe at a time -
 * every view (Space, Ground, Celestial Sphere, Background Stars) and every
 * observer-relative calculation reads through getActive(), never a fixed
 * model reference, so switching the active model changes what every view
 * shows simultaneously and coherently. Mirrors ObserverRegistry's exact
 * shape (add-only, first added becomes active) for consistency.
 */
export class AstronomyModelRegistry {
  private readonly entries = new Map<string, AstronomyModelEntry>();
  private activeId?: string;

  add(entry: AstronomyModelEntry): void {
    this.entries.set(entry.id, entry);
    if (this.activeId === undefined) this.activeId = entry.id;
  }

  all(): AstronomyModelEntry[] {
    return [...this.entries.values()];
  }

  get(id: string): AstronomyModelEntry | undefined {
    return this.entries.get(id);
  }

  getActive(): AstronomyModelEntry {
    if (this.activeId === undefined) {
      throw new Error("AstronomyModelRegistry.getActive: no models registered");
    }
    const entry = this.entries.get(this.activeId);
    if (!entry) {
      throw new Error(`AstronomyModelRegistry.getActive: active id "${this.activeId}" not found`);
    }
    return entry;
  }

  getActiveId(): string {
    return this.getActive().id;
  }

  setActive(id: string): void {
    if (!this.entries.has(id)) {
      throw new Error(`AstronomyModelRegistry.setActive: unknown model id "${id}"`);
    }
    this.activeId = id;
  }
}
