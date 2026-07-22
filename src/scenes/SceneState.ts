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
 * foundation any future saved-scene library would reuse. captureSceneState/
 * applySceneState (main.ts) always deal in a full SceneState like this one -
 * it's only at the I/O boundary (scene JSON export/import, saved shots) that
 * a SPARSE `Partial<SceneState>` is allowed, via diffSceneState/
 * mergeSceneState below: a saved scene only needs to record what differs
 * from main.ts's DEFAULT_SCENE_STATE, and anything it omits (because it
 * matched the default, or because the field didn't exist yet when it was
 * saved) is filled back in from the current defaults at apply time - so
 * adding a new field to this interface never breaks an older saved scene.
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!isPlainObject(a) || !isPlainObject(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return a === b;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((k) => deepEqual(a[k], b[k]));
}

/** One level of `diffSceneState`'s per-key comparison, reused for both
 *  `layers` (flat id->boolean) and `planets` (id->ScenePlanetState) - a
 *  changed planet only contributes the booleans that actually differ, not
 *  its whole ScenePlanetState, so e.g. flipping one planet's orbit line
 *  doesn't drag the other 3 flags into the saved JSON too. */
function diffRecord(state: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(state)) {
    const base = defaults[id];
    if (isPlainObject(value) && isPlainObject(base)) {
      const sub = diffRecord(value, base);
      if (Object.keys(sub).length > 0) out[id] = sub;
    } else if (!deepEqual(value, base)) {
      out[id] = value;
    }
  }
  return out;
}

/** Reduces a full SceneState to just what differs from `defaults` - the
 *  form scene JSON is saved/exported in (see main.ts's sceneIO.
 *  getCurrentStateJson and VideoLibrary's ShotDef.state). `version` is
 *  always included so `mergeSceneState` can warn on a mismatch even for an
 *  otherwise-empty diff. The inverse of `mergeSceneState`. */
export function diffSceneState(state: SceneState, defaults: SceneState): Partial<SceneState> {
  const delta: Partial<SceneState> = { version: state.version };
  for (const key of Object.keys(state) as (keyof SceneState)[]) {
    if (key === "version") continue;
    if (key === "layers" || key === "planets") {
      const sub = diffRecord(state[key] as Record<string, unknown>, defaults[key] as Record<string, unknown>);
      if (Object.keys(sub).length > 0) (delta as Record<string, unknown>)[key] = sub;
      continue;
    }
    if (!deepEqual(state[key], defaults[key])) {
      (delta as Record<string, unknown>)[key] = state[key];
    }
  }
  return delta;
}

/** Reinflates a (possibly sparse) saved/pasted scene into a full SceneState
 *  by layering it over `defaults` - any field the JSON doesn't mention
 *  (because it matched the default when saved, or because it didn't exist
 *  yet when an older shot was authored) just falls back to `defaults`
 *  rather than becoming `undefined` at apply time. `layers` and `planets`
 *  are merged one level deep (per-id for `planets`) instead of wholesale
 *  overwritten, so a diff that only touched one flag doesn't reset every
 *  other flag in that bucket back to `undefined`. A full, non-partial
 *  SceneState (the format every shot used before this function existed)
 *  is a valid input too - it simply overrides 100% of `defaults`. */
export function mergeSceneState(partial: Partial<SceneState>, defaults: SceneState): SceneState {
  const planets = { ...defaults.planets };
  for (const [id, sub] of Object.entries(partial.planets ?? {})) {
    planets[id] = { ...(planets[id] ?? { orbitLine: false, ptolemaic: false, truePath: false, skyPath: false }), ...sub };
  }
  return {
    ...defaults,
    ...partial,
    planets,
    layers: { ...defaults.layers, ...partial.layers },
  };
}
