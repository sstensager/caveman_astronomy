import * as THREE from "three";

/**
 * Places a direction on a sphere of the given radius. Purely visual - radius
 * is a display choice, independent of any body's actual (model-space)
 * distance. The same direction can be projected at multiple radii
 * simultaneously (e.g. an immersive sky-scale sphere and a small
 * "explanatory globe") without recomputing anything upstream.
 */
export function projectDirectionToSphere(direction: THREE.Vector3, radius: number): THREE.Vector3 {
  return direction.clone().normalize().multiplyScalar(radius);
}
