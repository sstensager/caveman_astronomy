import { describe, expect, it } from "vitest";
import { GeocentricModel } from "./GeocentricModel";
import { ModernHeliocentricModel } from "./ModernHeliocentricModel";
import { BodyIds } from "../types";
import { length, subVectors } from "../vectorMath";

const SAMPLE_TIMES = [0, 10, 91.3, 200, 365.25, 1000.7];

function directionFromEarth(state: ReturnType<GeocentricModel["getState"]>, bodyId: typeof BodyIds.Sun | typeof BodyIds.Moon) {
  const earth = state.bodies[BodyIds.Earth];
  const body = state.bodies[bodyId];
  const relative = subVectors(body.position, earth.position);
  const len = length(relative);
  return { x: relative.x / len, y: relative.y / len, z: relative.z / len };
}

describe("GeocentricModel vs ModernHeliocentricModel equivalence", () => {
  const geo = new GeocentricModel();
  const helio = new ModernHeliocentricModel();

  it("agree on normalized Sun-direction-from-Earth at every sampled time", () => {
    for (const t of SAMPLE_TIMES) {
      const g = directionFromEarth(geo.getState(t), BodyIds.Sun);
      const h = directionFromEarth(helio.getState(t), BodyIds.Sun);
      expect(g.x).toBeCloseTo(h.x, 10);
      expect(g.y).toBeCloseTo(h.y, 10);
      expect(g.z).toBeCloseTo(h.z, 10);
    }
  });

  it("agree on normalized Moon-direction-from-Earth at every sampled time", () => {
    for (const t of SAMPLE_TIMES) {
      const g = directionFromEarth(geo.getState(t), BodyIds.Moon);
      const h = directionFromEarth(helio.getState(t), BodyIds.Moon);
      expect(g.x).toBeCloseTo(h.x, 10);
      expect(g.y).toBeCloseTo(h.y, 10);
      expect(g.z).toBeCloseTo(h.z, 10);
    }
  });
});
