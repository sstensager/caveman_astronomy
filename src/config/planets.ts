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
 */
export interface PlanetRenderConfig {
  id: PlanetId;
  label: string;
  color: number;
  markerSizeRadii: number;
}

export const PLANET_RENDER_CONFIG: PlanetRenderConfig[] = [
  { id: "mercury", label: "Mercury", color: COLORS.mercury, markerSizeRadii: 0.25 },
  { id: "venus", label: "Venus", color: COLORS.venus, markerSizeRadii: 0.45 },
  { id: "mars", label: "Mars", color: COLORS.mars, markerSizeRadii: 0.3 },
  { id: "jupiter", label: "Jupiter", color: COLORS.jupiter, markerSizeRadii: 1.2 },
  { id: "saturn", label: "Saturn", color: COLORS.saturn, markerSizeRadii: 1.0 },
];
