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
  it("returns every registered model from all()", () => {
    const registry = new AstronomyModelRegistry();
    registry.add({ id: "a", label: "A", model: stubModel("a") });
    registry.add({ id: "b", label: "B", model: stubModel("b") });
    expect(registry.all().map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("looks up a registered model by id via get()", () => {
    const registry = new AstronomyModelRegistry();
    registry.add({ id: "a", label: "A", model: stubModel("a") });
    expect(registry.get("a")?.model.id).toBe("a");
  });

  it("returns undefined from get() for an unknown id", () => {
    const registry = new AstronomyModelRegistry();
    registry.add({ id: "a", label: "A", model: stubModel("a") });
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("starts with an empty list", () => {
    const registry = new AstronomyModelRegistry();
    expect(registry.all()).toEqual([]);
  });
});
