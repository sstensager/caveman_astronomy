import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { latLonToCanvasPixel, latLonToUV } from "./equirectangular";
import { latLonToSurfacePoint } from "./geo";

/** Ground truth: find the actual vertex a real THREE.SphereGeometry (same
 *  default-UV construction as EarthBase's mesh) generates closest to a given
 *  lat/lon, and read its REAL uv attribute - not a hand-derived formula. A
 *  previous hand derivation of the v axis disagreed with this and was wrong;
 *  this test exists specifically to catch that class of mistake again. */
function referenceUV(latDeg: number, lonDeg: number): { u: number; v: number } {
  const geometry = new THREE.SphereGeometry(1, 48, 32);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const target = latLonToSurfacePoint(latDeg, lonDeg, 1);
  let bestDistSq = Infinity;
  let bestU = 0;
  let bestV = 0;
  for (let i = 0; i < position.count; i++) {
    const dx = position.getX(i) - target.x;
    const dy = position.getY(i) - target.y;
    const dz = position.getZ(i) - target.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestU = uv.getX(i);
      bestV = uv.getY(i);
    }
  }
  return { u: bestU, v: bestV };
}

describe("latLonToUV", () => {
  it("matches the real THREE.SphereGeometry uv attribute (away from the poles, where the mesh grid is coarse)", () => {
    const samples: Array<[number, number]> = [
      [0, 0],
      [0, 90],
      [0, -90],
      [0, 180],
      [23, 10],
      [-5, -60],
      [45, 45],
      [-30, -120],
    ];
    for (const [latDeg, lonDeg] of samples) {
      const ref = referenceUV(latDeg, lonDeg);
      const got = latLonToUV(latDeg, lonDeg);
      // Nearest-vertex lookup on a 48x32 grid only approximates the true
      // continuous surface, so allow a small tolerance rather than exact
      // equality.
      expect(got.u).toBeCloseTo(ref.u, 1);
      expect(got.v).toBeCloseTo(ref.v, 1);
    }
  });

  it("puts the north pole at v=1 and the south pole at v=0 (matches the real SphereGeometry uv attribute, not intuition)", () => {
    expect(latLonToUV(90, 0).v).toBeCloseTo(1, 8);
    expect(latLonToUV(-90, 0).v).toBeCloseTo(0, 8);
  });

  it("puts the equator at v=0.5 regardless of longitude", () => {
    expect(latLonToUV(0, 0).v).toBeCloseTo(0.5, 8);
    expect(latLonToUV(0, 137).v).toBeCloseTo(0.5, 8);
  });

  it("wraps u into [0, 1) for any longitude", () => {
    for (const lonDeg of [-180, -179, 0, 179, 180, 359, 720]) {
      const { u } = latLonToUV(0, lonDeg);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });
});

describe("latLonToCanvasPixel", () => {
  it("undoes latLonToUV's flipY-compensated v so canvas row 0 is the north pole (top of the source PNG)", () => {
    const north = latLonToCanvasPixel(90, 0, 200, 100);
    const south = latLonToCanvasPixel(-90, 0, 200, 100);
    expect(north.y).toBeCloseTo(0, 6);
    expect(south.y).toBeCloseTo(100, 6);
  });

  it("scales u directly by width with no inversion", () => {
    const { u } = latLonToUV(10, 33);
    const { x } = latLonToCanvasPixel(10, 33, 200, 100);
    expect(x).toBeCloseTo(u * 200, 6);
  });
});
