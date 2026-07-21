/** How the Sun marker renders - see OrbitingBodyMarkerLayer.setTexture/
 *  setColorBrightness and main.ts's switchSunMode, which combines those two
 *  generic primitives into each named mode below. */
export const SunMode = {
  /** Today's default: flat COLORS.sun tint, no texture. */
  Dim: "dim",
  /** The same flat tint pushed well past white-clip via setColorBrightness -
   *  a blown-out, "too bright to look at" disc, no bloom pipeline required. */
  Bright: "bright",
  /** TEXTURES.sunHalpha mapped onto the sphere at full (untinted) brightness -
   *  see public/textures/NOTICE.md for the source image's attribution. */
  Textury: "textury",
} as const;

export type SunMode = (typeof SunMode)[keyof typeof SunMode];
