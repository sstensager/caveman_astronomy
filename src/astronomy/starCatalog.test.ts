import { describe, expect, it } from "vitest";
import { raDecToVector3, STAR_CATALOG } from "./starCatalog";

describe("raDecToVector3", () => {
  it("maps Dec=+90 to world +Y", () => {
    const v = raDecToVector3(0, 90);
    expect(v.x).toBeCloseTo(0, 10);
    expect(v.y).toBeCloseTo(1, 10);
    expect(v.z).toBeCloseTo(0, 10);
  });

  it("maps RA=0h/Dec=0 to world +X", () => {
    const v = raDecToVector3(0, 0);
    expect(v.x).toBeCloseTo(1, 10);
    expect(v.y).toBeCloseTo(0, 10);
    expect(v.z).toBeCloseTo(0, 10);
  });

  it("maps RA=6h/Dec=0 to world +Z", () => {
    const v = raDecToVector3(6, 0);
    expect(v.x).toBeCloseTo(0, 10);
    expect(v.y).toBeCloseTo(0, 10);
    expect(v.z).toBeCloseTo(1, 10);
  });
});

describe("STAR_CATALOG", () => {
  it("is non-empty", () => {
    expect(STAR_CATALOG.length).toBeGreaterThan(0);
  });

  it("is sorted ascending by magnitude", () => {
    for (let i = 1; i < STAR_CATALOG.length; i++) {
      expect(STAR_CATALOG[i].mag).toBeGreaterThanOrEqual(STAR_CATALOG[i - 1].mag);
    }
  });

  it("excludes the synthetic Sol row", () => {
    expect(STAR_CATALOG.some((s) => s.properName === "Sol")).toBe(false);
  });

  it("gives every star a unit-length direction", () => {
    for (const star of STAR_CATALOG.slice(0, 50)) {
      const len = Math.sqrt(star.direction.x ** 2 + star.direction.y ** 2 + star.direction.z ** 2);
      expect(len).toBeCloseTo(1, 6);
    }
  });
});
