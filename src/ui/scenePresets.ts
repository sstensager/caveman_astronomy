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

const ALL_LAYERS_OFF: Record<string, boolean> = {
  earthBase: false,
  continents: false,
  axis: false,
  backgroundStars: false,
  celestialSphereStars: false,
  sunMarker: false,
  moonMarker: false,
  celestialSphereShell: false,
  zenithSky: false,
  zenithGlobe: false,
  altAzGridSky: false,
  altAzGridGlobe: false,
  observerMarkers: false,
};

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
    layers: { ...ALL_LAYERS_OFF, earthBase: true, continents: true, sunMarker: true },
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
      sunMarkerGlobe: false,
      moonMarkerSky: true,
      moonMarkerGlobe: false,
      backgroundStars: true,
      observerMarkers: true,
    },
    cameraMode: CameraMode.Ground,
  },
  {
    id: "celestialSphere",
    label: "Celestial Sphere",
    layers: {
      ...ALL_LAYERS_OFF,
      earthBase: true,
      continents: true,
      celestialSphereShell: true,
      celestialSphereStars: true,
      sunMarker: true,
      moonMarker: true,
    },
    cameraMode: CameraMode.CelestialSphere,
  },
  {
    id: "teachingDefault",
    label: "Teaching Default",
    layers: {
      earthBase: true,
      continents: true,
      axis: true,
      backgroundStars: true,
      celestialSphereStars: false,
      sunMarkerSky: true,
      sunMarkerGlobe: false,
      moonMarkerSky: true,
      moonMarkerGlobe: false,
      celestialSphereShell: false,
      observerMarkers: true,
    },
    cameraMode: CameraMode.Space,
  },
];
