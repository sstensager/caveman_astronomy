export const CameraMode = {
  Space: "space",
  Ground: "ground",
  CelestialSphere: "celestialSphere",
} as const;

export type CameraMode = (typeof CameraMode)[keyof typeof CameraMode];
