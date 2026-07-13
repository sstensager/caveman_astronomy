/** Which fixed direction the free-roam Space View camera treats as "up" -
 *  see OrbitCameraRig.setUpMode. Ground View has no equivalent: its camera
 *  is locked to the observer's actual local zenith, not a free choice. */
export const CameraUpMode = {
  /** World +Y - the true celestial pole (Polaris/Earth's spin axis). The
   *  standard, intuitive default: the sky rotates the way a ground observer
   *  actually experiences it. */
  Equatorial: "equatorial",
  /** The fixed ecliptic pole (see astronomy/frames.ts's ECLIPTIC_POLE_IN_WORLD) -
   *  levels the Sun/Moon/planet orbital plane on screen instead, so Earth's
   *  axial tilt reads as a visible tilt against it. */
  Ecliptic: "ecliptic",
} as const;

export type CameraUpMode = (typeof CameraUpMode)[keyof typeof CameraUpMode];
