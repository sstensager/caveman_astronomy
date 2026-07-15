import type { AstronomyModel } from "./types";

export interface AstronomyModelEntry {
  readonly id: string;
  readonly label: string;
  readonly model: AstronomyModel;
}

/**
 * The list of every AstronomyModel the app knows about. This class itself
 * has no notion of a single "active" model - main.ts's activeScene picks
 * one directly (registry ids "geocentric"/"heliocentric" match Scene ids
 * one-to-one, see main.ts's getActiveModel), so exactly one is ever
 * consulted per frame. Both models are proven to produce identical apparent
 * sky positions (see modelEquivalence.test.ts) - which one actually
 * computes a given Scene's state is an implementation detail, never a
 * visible difference, so there is no per-model UI or duplicated Layer set
 * anywhere downstream of this registry.
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
