import type { Vector3Like } from "./types";
import { randomPointOnSphere } from "../utils/random";

/**
 * Placeholder star catalog: random unit directions in inertial space. Stored
 * as directions (not baked into any particular render radius) so the same
 * catalog can back both the immersive sky-scale view and the small
 * "explanatory globe" view without generating two independently-random skies.
 * A real star catalog would slot in here later with the same return shape.
 */
export function generatePlaceholderStarCatalog(count: number): Vector3Like[] {
  const catalog: Vector3Like[] = [];
  for (let i = 0; i < count; i++) {
    const [x, y, z] = randomPointOnSphere(1);
    catalog.push({ x, y, z });
  }
  return catalog;
}
