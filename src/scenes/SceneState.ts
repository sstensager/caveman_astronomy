import type { CameraMode } from "../cameras/CameraMode";
import type { CameraUpMode } from "../cameras/CameraUpMode";
import type { HemisphereMode } from "../utils/hemisphereFade";
import type { SunMode } from "../layers/sky/SunMode";

/** Which body is fixed at the world origin - see main.ts's activeScene. */
export type SceneId = "geocentric" | "heliocentric";

export interface SceneObserverState {
  id: string;
  label: string;
  latDeg: number;
  lonDeg: number;
}

/** The 4 path-visibility flags gating a planet's own layer set - kept
 *  separate from the `layers` catch-all bucket because they aren't plain
 *  on/off switches: main.ts re-derives the actual layer visibility from
 *  these flags AND the active Scene every time either changes (see
 *  applyPlanetOrbitLineVisibility etc.), so restoring just the raw layer
 *  ids would silently desync the moment the Scene is switched afterward. */
export interface ScenePlanetState {
  orbitLine: boolean;
  ptolemaic: boolean;
  truePath: boolean;
  skyPath: boolean;
}

export const SCENE_STATE_VERSION = 1;

/**
 * A complete, serializable snapshot of every control-panel-reachable piece
 * of app state - the one data model the "paste JSON to build a shot"
 * workflow (see ControlPanel's Scene JSON section) is built on, and the
 * foundation any future saved-scene library would reuse. Capturing/applying
 * this is meant to be the ONLY way scene state moves in or out of the app -
 * never a partial, hand-picked subset (see main.ts's captureSceneState/
 * applySceneState).
 *
 * `layers` is the catch-all bucket for every plain on/off layer
 * (LayerRegistry.getVisibility()) - anything not already covered by a more
 * specific field below (sliders, per-planet path flags, observers, camera,
 * time). Kept as a flat id->boolean map rather than one field per layer so
 * registering a new layer never requires touching this type.
 */
export interface SceneState {
  version: typeof SCENE_STATE_VERSION;
  scene: SceneId;
  simDay: number;
  timeSpeed: number;
  paused: boolean;
  cameraMode: CameraMode;
  cameraUpMode: CameraUpMode;
  /** Space View's camera-to-target zoom distance only (see
   *  OrbitCameraRig.getDistance/setDistance) - NOT full camera position/
   *  orientation. Angle is left as whatever's live when captured/applied;
   *  only the zoom level is reproducible via SceneState. */
  spaceCameraDistance: number;
  hemisphereMode: HemisphereMode;
  skyRadius: number;
  wireframeOpacity: number;
  sunDistanceRadii: number;
  moonDistanceRadii: number;
  sunSizeRadii: number;
  moonSizeRadii: number;
  sunMode: SunMode;
  moonDarkSideBrightness: number;
  earthAxialTiltDeg: number;
  earthRotationEnabled: boolean;
  planetVisibilityBoost: number;
  pathLabelsVisible: boolean;
  earthOrbitPathVisible: boolean;
  starLimitingMagnitude: number;
  starBrightness: number;
  starSize: number;
  starOpacity: number;
  observers: SceneObserverState[];
  activeObserverId: string;
  observerMarkersVisible: boolean;
  observerFarSideIndicatorEnabled: boolean;
  minimapVisible: boolean;
  minimapOpacity: number;
  stonehengePlacedAt?: { latDeg: number; lonDeg: number };
  anchorBodyId?: string;
  lookAtBodyId?: string;
  planets: Record<string, ScenePlanetState>;
  layers: Record<string, boolean>;
}
