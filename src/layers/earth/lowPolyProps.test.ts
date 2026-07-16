import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildMountain, buildRock, buildSailboat, buildStoneMonolith, buildTree } from "./lowPolyProps";

function firstMeshMaterialColor(object: THREE.Object3D): number {
  const mesh = object instanceof THREE.Mesh ? object : (object.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh);
  const material = mesh.material as THREE.MeshStandardMaterial;
  return material.color.getHex();
}

describe("lowPolyProps", () => {
  it("scales mountain height with heightScale", () => {
    const small = buildMountain(0.5) as THREE.Mesh;
    const big = buildMountain(1.0) as THREE.Mesh;
    const smallHeight = (small.geometry as THREE.ConeGeometry).parameters.height;
    const bigHeight = (big.geometry as THREE.ConeGeometry).parameters.height;
    expect(bigHeight).toBeGreaterThan(smallHeight);
  });

  it("gives temperate and snowy tree variants visually distinct canopy colors", () => {
    const temperate = buildTree("temperate");
    const snowy = buildTree("snowy");
    expect(firstMeshMaterialColor(temperate.children[1])).not.toBe(firstMeshMaterialColor(snowy.children[1]));
  });

  it("applies a caller-supplied rotation to rocks deterministically (no internal randomness)", () => {
    const a = buildRock(1, 1.23);
    const b = buildRock(1, 1.23);
    expect(a.rotation.y).toBeCloseTo(b.rotation.y, 10);
    expect(a.rotation.y).toBeCloseTo(1.23, 10);
  });

  it("builds a sailboat with a hull, mast, and sail (3 children)", () => {
    const boat = buildSailboat();
    expect(boat.children.length).toBe(3);
  });

  it("makes marker stones taller than ring stones, with a visually distinct color", () => {
    const ring = buildStoneMonolith(1, false) as THREE.Mesh;
    const marker = buildStoneMonolith(1, true) as THREE.Mesh;
    const ringHeight = (ring.geometry as THREE.BoxGeometry).parameters.height;
    const markerHeight = (marker.geometry as THREE.BoxGeometry).parameters.height;
    expect(markerHeight).toBeGreaterThan(ringHeight);
    expect(firstMeshMaterialColor(ring)).not.toBe(firstMeshMaterialColor(marker));
  });

  it("scales stone monolith size with sizeScale", () => {
    const small = buildStoneMonolith(0.5) as THREE.Mesh;
    const big = buildStoneMonolith(1.0) as THREE.Mesh;
    const smallHeight = (small.geometry as THREE.BoxGeometry).parameters.height;
    const bigHeight = (big.geometry as THREE.BoxGeometry).parameters.height;
    expect(bigHeight).toBeGreaterThan(smallHeight);
  });
});
