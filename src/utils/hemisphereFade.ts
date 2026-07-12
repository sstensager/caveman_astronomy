import * as THREE from "three";

export type HemisphereMode = "none" | "hide" | "fade";

/**
 * Per-vertex/per-point visibility factor for the celestial sphere's
 * near-camera hemisphere, when viewed from outside (Celestial Sphere camera
 * mode). Obscures the NEAR side (facing the camera) and keeps the FAR side
 * (away from the camera) visible - the near hemisphere sits visually between
 * the external camera and Earth, cluttering the view; the far hemisphere
 * sits behind Earth from that viewpoint and reads cleanly as a backdrop,
 * closer to what you're used to seeing in celestial-sphere diagrams.
 * Implemented as a plain 0..1 color multiplier rather than alpha/clipping:
 * against this app's near-black background, a color faded to black reads
 * identically to a transparent or clipped fragment, without a custom shader.
 */
export function hemisphereFadeFactor(
  direction: THREE.Vector3,
  cameraDirection: THREE.Vector3,
  mode: HemisphereMode,
): number {
  const dot = -direction.dot(cameraDirection);
  if (mode === "hide") {
    return dot >= 0 ? 1 : 0;
  }
  // "fade": smooth falloff across the terminator (dot in [-1, 1] -> [0, 1]).
  const t = THREE.MathUtils.clamp(dot * 0.5 + 0.5, 0, 1);
  return t * t * (3 - 2 * t);
}
