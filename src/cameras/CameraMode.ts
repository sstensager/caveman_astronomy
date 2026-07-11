export const CameraMode = {
  Space: "space",
  Ground: "ground",
} as const;

export type CameraMode = (typeof CameraMode)[keyof typeof CameraMode];
