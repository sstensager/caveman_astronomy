import { describe, expect, it } from "vitest";
import {
  buildHipIndex,
  CONSTELLATION_CULTURES,
  RESOLVED_CONSTELLATION_CULTURES,
  resolveCulture,
  type ConstellationCulture,
} from "./constellationCatalog";
import { STAR_CATALOG } from "./starCatalog";
import { length } from "./vectorMath";

function fakeStar(hip: number) {
  return { hip, ra: 0, dec: 0, mag: 1, direction: { x: 1, y: 0, z: 0 } };
}

describe("resolveCulture", () => {
  it("resolves every segment's star ids to actual StarRecords from the given index", () => {
    const culture: ConstellationCulture = {
      id: "test",
      name: "Test",
      constellations: [
        { id: "Tst", name: "Testicon", labelRaHours: 1, labelDecDeg: 2, segments: [[1, 2]] },
      ],
    };
    const index = new Map([
      [1, fakeStar(1)],
      [2, fakeStar(2)],
    ]);
    const resolved = resolveCulture(culture, index);
    expect(resolved.constellations).toHaveLength(1);
    expect(resolved.constellations[0].segments).toHaveLength(1);
    expect(resolved.constellations[0].segments[0].a.hip).toBe(1);
    expect(resolved.constellations[0].segments[0].b.hip).toBe(2);
  });

  it("drops a segment silently when either star id isn't in the index, rather than throwing", () => {
    const culture: ConstellationCulture = {
      id: "test",
      name: "Test",
      constellations: [{ id: "Tst", name: "Testicon", labelRaHours: 0, labelDecDeg: 0, segments: [[1, 999]] }],
    };
    const index = new Map([[1, fakeStar(1)]]);
    const resolved = resolveCulture(culture, index);
    expect(resolved.constellations[0].segments).toHaveLength(0);
  });

  it("computes labelDirection as a unit vector from labelRaHours/labelDecDeg", () => {
    const culture: ConstellationCulture = {
      id: "test",
      name: "Test",
      constellations: [{ id: "Tst", name: "Testicon", labelRaHours: 6, labelDecDeg: 0, segments: [] }],
    };
    const resolved = resolveCulture(culture, new Map());
    const d = resolved.constellations[0].labelDirection;
    expect(length(d)).toBeCloseTo(1);
  });
});

describe("buildHipIndex", () => {
  it("indexes only stars that have a hip id", () => {
    const index = buildHipIndex([fakeStar(5), { ...fakeStar(0), hip: undefined }]);
    expect(index.get(5)).toBeDefined();
    expect(index.size).toBe(1);
  });
});

describe("CONSTELLATION_CULTURES (raw on-disk data)", () => {
  it("never embeds coordinates in a segment - every segment element is a bare number pair", () => {
    for (const culture of CONSTELLATION_CULTURES) {
      for (const constellation of culture.constellations) {
        for (const segment of constellation.segments) {
          expect(segment).toHaveLength(2);
          expect(Number.isInteger(segment[0])).toBe(true);
          expect(Number.isInteger(segment[1])).toBe(true);
        }
      }
    }
  });

  it("includes the western culture with Orion and Ursa Major", () => {
    const western = CONSTELLATION_CULTURES.find((c) => c.id === "western");
    expect(western).toBeDefined();
    expect(western!.constellations.find((c) => c.id === "Ori")).toBeDefined();
    expect(western!.constellations.find((c) => c.id === "UMa")).toBeDefined();
  });
});

describe("RESOLVED_CONSTELLATION_CULTURES (against the real shared STAR_CATALOG)", () => {
  it("resolves against the shared STAR_CATALOG, not a private copy", () => {
    const western = RESOLVED_CONSTELLATION_CULTURES.find((c) => c.id === "western")!;
    const orion = western.constellations.find((c) => c.id === "Ori")!;
    expect(orion.segments.length).toBeGreaterThan(0);
    for (const segment of orion.segments) {
      // Every resolved star object must be the SAME reference as the one in
      // STAR_CATALOG (not a clone) - the actual "single source of truth,
      // never a second copy" guarantee, not just an equal-by-value check.
      expect(STAR_CATALOG.includes(segment.a)).toBe(true);
      expect(STAR_CATALOG.includes(segment.b)).toBe(true);
    }
  });

  it("Orion's segments connect real, recognizable named stars", () => {
    const orion = RESOLVED_CONSTELLATION_CULTURES.find((c) => c.id === "western")!.constellations.find((c) => c.id === "Ori")!;
    const names = new Set(orion.segments.flatMap((s) => [s.a.properName, s.b.properName]).filter(Boolean));
    for (const expected of ["Betelgeuse", "Rigel", "Bellatrix", "Alnilam", "Alnitak"]) {
      expect(names.has(expected)).toBe(true);
    }
  });

  it("Ursa Major's segments connect real, recognizable named stars (the Big Dipper)", () => {
    const uma = RESOLVED_CONSTELLATION_CULTURES.find((c) => c.id === "western")!.constellations.find((c) => c.id === "UMa")!;
    const names = new Set(uma.segments.flatMap((s) => [s.a.properName, s.b.properName]).filter(Boolean));
    for (const expected of ["Dubhe", "Merak", "Alioth", "Mizar", "Alkaid"]) {
      expect(names.has(expected)).toBe(true);
    }
  });

  it("every segment's two stars are at a plausible constellation-figure distance apart (not a false cross-sky match)", () => {
    for (const culture of RESOLVED_CONSTELLATION_CULTURES) {
      for (const constellation of culture.constellations) {
        for (const { a, b } of constellation.segments) {
          const angularDistanceDeg = (Math.acos(a.direction.x * b.direction.x + a.direction.y * b.direction.y + a.direction.z * b.direction.z) * 180) / Math.PI;
          expect(angularDistanceDeg).toBeLessThan(60);
        }
      }
    }
  });
});
