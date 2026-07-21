import type { PlanetId } from "../astronomy/types";
import { COLORS } from "./constants";

/**
 * Render-facing config for the 5 naked-eye planets, driving main.ts's loop
 * that constructs each planet's marker/orbit-line/sky-path layers and the
 * control panel's planets section - the sibling of astronomy/constants.ts's
 * PLANET_ORBITAL_ELEMENTS (that table is model-space physics, this one is
 * purely display: color and marker size). `markerSizeRadii` is artistic
 * (Earth-radii units), matching how SUN_SIZE_DEFAULT_RADII/
 * MOON_SIZE_DEFAULT_RADII are also tuned by eye rather than to true scale -
 * Jupiter/Saturn read noticeably larger than Mercury without being
 * physically accurate gas-giant proportions.
 *
 * Sized so the Planets section's "Visibility Boost" slider's OWN floor
 * (PLANET_VISIBILITY_BOOST_MIN = 1x, in main.ts) reads as a bright
 * near-point - realistically, naked-eye planets are unresolved points, not
 * discs - while its ceiling (4x) reproduces this file's previous marker
 * sizes, so the old "clearly resolved sphere" look is still reachable, just
 * no longer the unavoidable floor.
 */
export interface PlanetRenderConfig {
  id: PlanetId;
  label: string;
  color: number;
  markerSizeRadii: number;
}

export const PLANET_RENDER_CONFIG: PlanetRenderConfig[] = [
  { id: "mercury", label: "Mercury", color: COLORS.mercury, markerSizeRadii: 0.0625 },
  { id: "venus", label: "Venus", color: COLORS.venus, markerSizeRadii: 0.1125 },
  { id: "mars", label: "Mars", color: COLORS.mars, markerSizeRadii: 0.075 },
  { id: "jupiter", label: "Jupiter", color: COLORS.jupiter, markerSizeRadii: 0.3 },
  { id: "saturn", label: "Saturn", color: COLORS.saturn, markerSizeRadii: 0.25 },
];
