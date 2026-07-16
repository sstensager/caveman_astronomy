import { CameraMode } from "../cameras/CameraMode";

/**
 * A hardcoded, one-click starting point for an educational shot. Each
 * preset lists a value only for the layer ids it cares about - applying one
 * MERGES onto whatever else is already toggled (unlike the old design,
 * which had to hand-list every single layer id as `false` to fully replace
 * state - see git history). That hand-maintained "every known layer, off by
 * default" map was itself a symptom of the old per-model/per-tier layer
 * explosion; with exactly one Sun, one Moon, one star field, one Earth,
 * there's no longer a combinatorial set of ids a preset needs to silently
 * reset.
 */
export interface ScenePreset {
  id: string;
  label: string;
  layers: Record<string, boolean>;
  cameraMode?: CameraMode;
  /** Switches the active Scene before anything else in this preset is
   *  applied - omit to leave whichever Scene is currently active untouched. */
  scene?: "geocentric" | "heliocentric";
  /** Optional distance/radius overrides (Earth-radii units for the two
   *  distances, render units for skyRadius - see config/constants.ts's
   *  STAR_RADIUS, SUN_DISTANCE, and MOON_DISTANCE default constants). Omit
   *  any to leave that slider wherever the user last left it - a preset is
   *  a starting point, not a full state reset (see this file's own doc
   *  comment). */
  skyRadius?: number;
  sunDistanceRadii?: number;
  moonDistanceRadii?: number;
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "emptySpace",
    label: "Empty Space",
    layers: {
      earthBase: false,
      continents: false,
      axis: false,
      stars: false,
      sunMarker: false,
      moonMarker: false,
      sunEclipticPath: false,
      moonSkyPath: false,
      orbitLines: false,
      earthOrbitLine: false,
      celestialSphereShell: false,
      observerMarkers: false,
      groundScatter: false,
      stonehenge: false,
    },
    cameraMode: CameraMode.Space,
  },
  {
    id: "earthOnly",
    label: "Earth Only",
    layers: { earthBase: true, continents: true, sunMarker: false, moonMarker: false, stars: false, observerMarkers: false },
    cameraMode: CameraMode.Space,
  },
  {
    id: "earthAndSun",
    label: "Earth + Sun",
    layers: { earthBase: true, continents: true, sunMarker: true, moonMarker: false, stars: false, observerMarkers: false },
    cameraMode: CameraMode.Space,
  },
  {
    id: "observerView",
    label: "Observer View",
    layers: {
      earthBase: true,
      continents: true,
      sunMarker: true,
      moonMarker: true,
      stars: true,
      observerMarkers: true,
    },
    cameraMode: CameraMode.Ground,
  },
  {
    id: "celestialSphereDemo",
    label: "Celestial Sphere Demo",
    // The whole point of dialing the shared sky radius down small: the
    // wireframe shell, stars, and Sun/Moon markers all read as one small,
    // comprehensible diagram wrapped snugly around Earth - demonstrating
    // "you are the center of your own celestial sphere" directly, rather
    // than needing a second parallel display system.
    layers: {
      earthBase: true,
      continents: true,
      celestialSphereShell: true,
      stars: true,
      sunMarker: true,
      moonMarker: true,
      orbitLines: true,
      observerMarkers: true,
    },
    cameraMode: CameraMode.Space,
    skyRadius: 25,
    sunDistanceRadii: 12,
    moonDistanceRadii: 2.5,
  },
  {
    id: "teachingDefault",
    label: "Teaching Default",
    layers: {
      earthBase: true,
      continents: true,
      axis: true,
      stars: true,
      sunMarker: true,
      moonMarker: true,
      observerMarkers: true,
    },
    cameraMode: CameraMode.Space,
  },
];
