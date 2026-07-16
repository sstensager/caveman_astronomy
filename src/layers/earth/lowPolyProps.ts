import * as THREE from "three";
import { EARTH_RADIUS } from "../../config/constants";

/**
 * Parameterized low-poly prop builders, generalized from the confirmed-good
 * shapes/proportions in the scenerySandbox.ts prototype (mountain + pine
 * tree confirmed good as-is; a palm tree was tried and dropped; the
 * sailboat was kept). Every builder takes a scale multiplier (1.0 = the
 * prototype's original size) so GroundScatterLayer can vary size per
 * instance and per mountain-range proximity, and buildTree also takes a
 * color variant for latitude-based appearance (see GroundScatterLayer's
 * SNOWY_LATITUDE_DEG).
 */

export type TreeVariant = "temperate" | "snowy";

export function buildMountain(heightScale = 1): THREE.Object3D {
  const height = EARTH_RADIUS * 0.3 * heightScale;
  const radius = EARTH_RADIUS * 0.12 * heightScale;
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 5),
    new THREE.MeshStandardMaterial({ color: 0x8b8378, roughness: 1, metalness: 0 }),
  );
  mesh.position.y = height / 2;
  return mesh;
}

const TREE_COLORS: Record<TreeVariant, { trunk: number; canopy: number }> = {
  temperate: { trunk: 0x6b4a2f, canopy: 0x2f5f3a },
  // Pale, frosted canopy + a slightly desaturated trunk - distinct from the
  // temperate variant at a glance without needing an entirely different
  // shape.
  snowy: { trunk: 0x5a4438, canopy: 0xd8e4e8 },
};

export function buildTree(variant: TreeVariant = "temperate", sizeScale = 1): THREE.Object3D {
  const colors = TREE_COLORS[variant];
  const group = new THREE.Group();

  const trunkHeight = EARTH_RADIUS * 0.02 * sizeScale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(EARTH_RADIUS * 0.003 * sizeScale, EARTH_RADIUS * 0.005 * sizeScale, trunkHeight, 6),
    new THREE.MeshStandardMaterial({ color: colors.trunk, roughness: 1, metalness: 0 }),
  );
  trunk.position.y = trunkHeight / 2;
  group.add(trunk);

  const canopyHeight = EARTH_RADIUS * 0.045 * sizeScale;
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(EARTH_RADIUS * 0.016 * sizeScale, canopyHeight, 7),
    new THREE.MeshStandardMaterial({ color: colors.canopy, roughness: 1, metalness: 0 }),
  );
  canopy.position.y = trunkHeight + canopyHeight / 2 - EARTH_RADIUS * 0.005 * sizeScale;
  group.add(canopy);

  return group;
}

/** Simple low-poly rock - used both as generic ground clutter and as the
 *  only prop placed on ice (real ice sheets don't have forests). `rotationY`
 *  is a caller-supplied param (not Math.random() internally) so a scatter
 *  seeded from a deterministic RNG stays fully reproducible down to each
 *  rock's own spin, not just which prop/size/position was picked. */
export function buildRock(sizeScale = 1, rotationY = 0): THREE.Object3D {
  const radius = EARTH_RADIUS * 0.012 * sizeScale;
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 1, metalness: 0 }),
  );
  mesh.position.y = radius * 0.6;
  mesh.rotation.y = rotationY;
  return mesh;
}

/** A simple standing-stone monolith, for StonehengeLayer's ring/marker
 *  stones. `isMarker` makes it slightly taller and gives it a distinct
 *  warmer-grey tint (same idea as buildTree's snowy/temperate variant) so
 *  alignment stones read as "the important ones" against the plain ring at
 *  a glance - deliberately NOT much bigger than a ring stone, since markers
 *  sit much farther from the henge's center (see hengeLayout.ts's
 *  DEFAULT_MARKER_RADIUS) and are meant to read as a small, distant feature
 *  near the horizon (like the real Heel Stone), not something looming
 *  overhead that swallows the sun behind it - a real problem hit live: at
 *  the ORIGINAL closer marker radius/larger size, a marker stone filled
 *  roughly 40deg of the observer's sky, hiding the sun's marker sprite
 *  behind its own bulk instead of showing it rising near/above the stone. */
export function buildStoneMonolith(sizeScale = 1, isMarker = false): THREE.Object3D {
  const height = (isMarker ? EARTH_RADIUS * 0.05 : EARTH_RADIUS * 0.045) * sizeScale;
  const width = (isMarker ? EARTH_RADIUS * 0.012 : EARTH_RADIUS * 0.014) * sizeScale;
  const depth = width * 0.6;
  const color = isMarker ? 0x9c8f7a : 0x84837e;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }),
  );
  mesh.position.y = height / 2;
  return mesh;
}

/** A simple low-poly sailboat - hull is a squashed/stretched sphere rather
 *  than anything hand-tapered, deliberately the crudest shape that still
 *  reads as a hull once combined with a mast+sail. */
export function buildSailboat(sizeScale = 1): THREE.Object3D {
  const group = new THREE.Group();

  const hullRadius = EARTH_RADIUS * 0.022 * sizeScale;
  const hull = new THREE.Mesh(
    new THREE.SphereGeometry(hullRadius, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1, metalness: 0 }),
  );
  hull.scale.set(2.2, 0.45, 1);
  hull.position.y = hullRadius * 0.45;
  group.add(hull);

  const mastHeight = EARTH_RADIUS * 0.05 * sizeScale;
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(EARTH_RADIUS * 0.0015 * sizeScale, EARTH_RADIUS * 0.0015 * sizeScale, mastHeight, 5),
    new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1, metalness: 0 }),
  );
  mast.position.y = hullRadius * 0.9 + mastHeight / 2;
  group.add(mast);

  const sailHeight = mastHeight * 0.8;
  const sail = new THREE.Mesh(
    new THREE.ConeGeometry(EARTH_RADIUS * 0.018 * sizeScale, sailHeight, 3),
    new THREE.MeshStandardMaterial({ color: 0xf2ede1, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
  );
  // Flatten the 3-sided cone into a thin triangular sheet rather than a
  // solid wedge.
  sail.scale.z = 0.05;
  sail.position.set(EARTH_RADIUS * 0.006 * sizeScale, hullRadius * 0.9 + sailHeight / 2, 0);
  group.add(sail);

  return group;
}
