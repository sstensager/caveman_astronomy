import type { ObserverStation } from "./ObserverStation";
import type { GroundObserver } from "./GroundObserver";
import type { ObserverMarker } from "./ObserverMarker";

export interface ObserverEntry {
  readonly id: string;
  label: string;
  readonly station: ObserverStation;
  readonly observer: GroundObserver;
  readonly marker: ObserverMarker;
}

/**
 * Tracks every observer entity in the scene and which one is currently
 * "active" (the one WASD/drag-to-place/personal-zenith/alt-az-grid follow).
 * Add-only for v1 - no remove. Pins render for every entry simultaneously
 * (you need to see where an observer is to switch to them); the personal
 * zenith/alt-az grid, by contrast, follow only the active entry - see
 * main.ts wiring.
 */
export class ObserverRegistry {
  private readonly entries = new Map<string, ObserverEntry>();
  private activeId?: string;

  add(entry: ObserverEntry): void {
    this.entries.set(entry.id, entry);
    if (this.activeId === undefined) this.activeId = entry.id;
  }

  all(): ObserverEntry[] {
    return [...this.entries.values()];
  }

  get(id: string): ObserverEntry | undefined {
    return this.entries.get(id);
  }

  getActive(): ObserverEntry {
    if (this.activeId === undefined) {
      throw new Error("ObserverRegistry.getActive: no observers registered");
    }
    const entry = this.entries.get(this.activeId);
    if (!entry) {
      throw new Error(`ObserverRegistry.getActive: active id "${this.activeId}" not found`);
    }
    return entry;
  }

  getActiveId(): string {
    return this.getActive().id;
  }

  setActive(id: string): void {
    if (!this.entries.has(id)) {
      throw new Error(`ObserverRegistry.setActive: unknown observer id "${id}"`);
    }
    this.activeId = id;
  }
}
