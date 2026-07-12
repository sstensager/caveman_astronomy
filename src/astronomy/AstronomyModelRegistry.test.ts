import { describe, expect, it } from "vitest";
import { AstronomyModelRegistry } from "./AstronomyModelRegistry";
import type { AstronomyModel, SimulationTime, UniverseState } from "./types";
import { BodyIds } from "./types";

function stubModel(id: string): AstronomyModel {
  return {
    id,
    name: id,
    getState(time: SimulationTime): UniverseState {
      const identity = { x: 0, y: 0, z: 0, w: 1 };
      return {
        time,
        bodies: {
          [BodyIds.Sun]: { id: BodyIds.Sun, position: { x: 0, y: 0, z: 0 }, orientation: identity, radius: 1 },
          [BodyIds.Earth]: { id: BodyIds.Earth, position: { x: 0, y: 0, z: 0 }, orientation: identity, radius: 1 },
          [BodyIds.Moon]: { id: BodyIds.Moon, position: { x: 0, y: 0, z: 0 }, orientation: identity, radius: 1 },
        },
      };
    },
  };
}

describe("AstronomyModelRegistry", () => {
  it("makes the first added model active by default", () => {
    const registry = new AstronomyModelRegistry();
    registry.add({ id: "a", label: "A", model: stubModel("a") });
    registry.add({ id: "b", label: "B", model: stubModel("b") });
    expect(registry.getActiveId()).toBe("a");
  });

  it("switches active model via setActive", () => {
    const registry = new AstronomyModelRegistry();
    registry.add({ id: "a", label: "A", model: stubModel("a") });
    registry.add({ id: "b", label: "B", model: stubModel("b") });
    registry.setActive("b");
    expect(registry.getActiveId()).toBe("b");
    expect(registry.getActive().model.id).toBe("b");
  });

  it("throws when getting active with nothing registered", () => {
    const registry = new AstronomyModelRegistry();
    expect(() => registry.getActive()).toThrow();
  });

  it("throws when setting an unknown active id", () => {
    const registry = new AstronomyModelRegistry();
    registry.add({ id: "a", label: "A", model: stubModel("a") });
    expect(() => registry.setActive("nonexistent")).toThrow();
  });
});
