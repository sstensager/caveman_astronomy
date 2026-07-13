import { CameraMode } from "../cameras/CameraMode";

/**
 * A hardcoded, one-click starting point for an educational shot. Each
 * preset lists a value for every known layer id so applying one fully
 * replaces the current visibility state rather than merging on top of
 * whatever was already toggled - the whole point is "pick a preset" as
 * step one of a shot, not "pick a preset, then remember what to turn off."
 */
export interface ScenePreset {
  id: string;
  label: string;
  layers: Record<string, boolean>;
  cameraMode?: CameraMode;
}

// Model ids must match main.ts's modelRegistry.add() calls - each model's
// explanatory-globe diagram (Sun/Moon markers + orbit lines) is fully
// independent (see AstronomyModelRegistry's doc comment - no "active" model
// anymore), so presets address them individually rather than through one
// shared id.
const MODEL_IDS = ["heliocentric", "geocentric"] as const;

const ALL_LAYERS_OFF: Record<string, boolean> = {
  earthBase: false,
  continents: false,
  axis: false,
  backgroundStars: false,
  celestialSphereStars: false,
  sunMarkerSky: false,
  moonMarkerSky: false,
  sunEclipticPath: false,
  moonSkyPath: false,
  celestialSphereShell: false,
  observerMarkers: false,
  // observer-1's zenith/grid (see ObserverRegistry) - the only observer ID
  // presets can rely on always existing; any observers added later via
  // "Add Observer" are personal, per-observer toggles a preset shouldn't
  // reach into.
  "observer-1Zenith": false,
  "observer-1AltAzGrid": false,
};
for (const modelId of MODEL_IDS) {
  ALL_LAYERS_OFF[`${modelId}SunMarkerGlobe`] = false;
  ALL_LAYERS_OFF[`${modelId}MoonMarkerGlobe`] = false;
  ALL_LAYERS_OFF[`${modelId}OrbitLines`] = false;
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "emptySpace",
    label: "Empty Space",
    layers: { ...ALL_LAYERS_OFF },
    cameraMode: CameraMode.Space,
  },
  {
    id: "earthOnly",
    label: "Earth Only",
    layers: { ...ALL_LAYERS_OFF, earthBase: true, continents: true },
    cameraMode: CameraMode.Space,
  },
  {
    id: "earthAndSun",
    label: "Earth + Sun",
    layers: { ...ALL_LAYERS_OFF, earthBase: true, continents: true, sunMarkerSky: true },
    cameraMode: CameraMode.Space,
  },
  {
    id: "observerView",
    label: "Observer View",
    layers: {
      ...ALL_LAYERS_OFF,
      earthBase: true,
      continents: true,
      sunMarkerSky: true,
      moonMarkerSky: true,
      backgroundStars: true,
      observerMarkers: true,
    },
    cameraMode: CameraMode.Ground,
  },
  {
    id: "celestialSphere",
    label: "Celestial Sphere",
    // The complete explanatory-globe diagram: Earth-centered shell, its own
    // star field, plus Heliocentric's globe-tier Sun/Moon markers and their
    // real elliptical orbit lines (see OrbitLineLayer) - one click for "show
    // me the whole small diagram together" instead of hunting through
    // Astronomy Model's per-model checkboxes separately. Heliocentric is an
    // arbitrary pick (both models render identically here - see
    // AstronomyModelRegistry) - turn on Geocentric's own checkboxes too to
    // compare both diagrams at once.
    layers: {
      ...ALL_LAYERS_OFF,
      earthBase: true,
      continents: true,
      celestialSphereShell: true,
      celestialSphereStars: true,
      sunMarkerSky: true,
      moonMarkerSky: true,
      heliocentricSunMarkerGlobe: true,
      heliocentricMoonMarkerGlobe: true,
      heliocentricOrbitLines: true,
    },
    cameraMode: CameraMode.Space,
  },
  {
    id: "teachingDefault",
    label: "Teaching Default",
    layers: {
      ...ALL_LAYERS_OFF,
      earthBase: true,
      continents: true,
      axis: true,
      backgroundStars: true,
      sunMarkerSky: true,
      moonMarkerSky: true,
      observerMarkers: true,
    },
    cameraMode: CameraMode.Space,
  },
];
