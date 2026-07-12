import * as THREE from "three";
import "./style.css";
import "./ui/controlPanel.css";

import { SimulationClock } from "./core/SimulationClock";
import { LayerRegistry } from "./layers/LayerRegistry";
import { CompositeLayer } from "./layers/CompositeLayer";
import { EarthBase } from "./layers/earth/EarthBase";
import { ContinentsLayer } from "./layers/earth/ContinentsLayer";
import { AxisLayer } from "./layers/earth/AxisLayer";
import { StarsLayer } from "./layers/sky/StarsLayer";
import { CelestialMarkerLayer } from "./layers/sky/CelestialMarkerLayer";
import { CelestialSphereShell } from "./layers/sky/CelestialSphereShell";
import { ModernHeliocentricModel } from "./astronomy/models/ModernHeliocentricModel";
import { GeocentricModel } from "./astronomy/models/GeocentricModel";
import { AstronomyModelRegistry } from "./astronomy/AstronomyModelRegistry";
import { BodyIds } from "./astronomy/types";
import { STAR_CATALOG } from "./astronomy/starCatalog";
import { GroundObserver } from "./observers/GroundObserver";
import { ObserverStation } from "./observers/ObserverStation";
import { ObserverRegistry, type ObserverEntry } from "./observers/ObserverRegistry";
import { ObserverMarker } from "./observers/ObserverMarker";
import { ZenithLayer } from "./observers/ZenithLayer";
import { AltAzGridLayer } from "./observers/AltAzGridLayer";
import { CameraManager } from "./cameras/CameraManager";
import { CameraMode } from "./cameras/CameraMode";
import { GroundMoveControls } from "./cameras/GroundMoveControls";
import { ControlPanel, type ControlPanelConfig, type ViewModeDef } from "./ui/ControlPanel";
import { SCENE_PRESETS } from "./ui/scenePresets";
import { StarPicker } from "./interaction/StarPicker";
import { SelectedStarMarker } from "./interaction/SelectedStarMarker";
import { ObserverPlacer } from "./interaction/ObserverPlacer";
import type { HemisphereMode } from "./utils/hemisphereFade";
import type { Layer } from "./layers/Layer";
import {
  BACKGROUND_STARS_DEFAULT,
  CELESTIAL_GLOBE_RADIUS,
  CELESTIAL_SPHERE_RADIUS,
  CELESTIAL_SPHERE_RADIUS_MAX,
  CELESTIAL_SPHERE_RADIUS_MIN,
  CELESTIAL_SPHERE_STARS_DEFAULT,
  CELESTIAL_SPHERE_WIREFRAME_OPACITY_DEFAULT,
  COLORS,
  DEFAULT_LATITUDE_DEG,
  EARTH_RADIUS,
  DEFAULT_LONGITUDE_DEG,
  MOON_GLOBE_ORBIT_FRACTION,
  STAR_LIMITING_MAGNITUDE_MAX,
  STAR_LIMITING_MAGNITUDE_MIN,
  SUN_GLOBE_ORBIT_FRACTION,
  TIME_SPEED_DEFAULT,
  TIME_SPEED_MAX,
  TIME_SPEED_MIN,
  TIME_STEP_DAY_DAYS,
  TIME_STEP_HOUR_DAYS,
  TIME_STEP_MONTH_DAYS,
  TIME_STEP_YEAR_DAYS,
} from "./config/constants";
import { EARTH_AXIAL_TILT_DEG } from "./astronomy/constants";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) throw new Error("#app container not found");

// --- Renderer & scene -------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.background);

// Ambient kept low (not zero) so the night side reads as unlit rather than
// pure black - the terminator itself comes entirely from keyLight, whose
// position is re-derived every frame from the active model's actual Sun
// direction (see the render loop below), not fixed here.
scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
scene.add(keyLight);

// --- Simulation clock -----------------------------------------------------

const simClock = new SimulationClock();

// --- Astronomy: model + observer -------------------------------------------
// The model never touches THREE.js; GroundObserver is the one place its
// plain domain values become THREE.Vector3s. See src/astronomy and
// src/observers for the full pipeline this feeds into.
//
// Exactly ONE AstronomyModel governs the universe at a time - every view
// (Space, Ground, Celestial Sphere, Background Stars) and every observer-
// relative calculation reads through modelRegistry.getActive(), never a
// fixed model reference, so switching the active model changes what every
// view shows simultaneously and coherently. See AstronomyModelRegistry.
const modelRegistry = new AstronomyModelRegistry();
modelRegistry.add({ id: "heliocentric", label: "Heliocentric", model: new ModernHeliocentricModel() });
modelRegistry.add({ id: "geocentric", label: "Geocentric", model: new GeocentricModel() });
const getActiveModel = () => modelRegistry.getActive().model;

// --- Layers ---------------------------------------------------------------
// Every independently-toggleable piece of the scene registers here. Adding
// a new layer later means: write a Layer, register it, add a control to
// ControlPanelConfig - no changes to the render loop required.
//
// Background Stars and Celestial Sphere Stars are two fully independent
// StarsLayer instances (see StarsLayer.ts) - no shared catalog, no fused
// checkbox. Sun/Moon markers still fuse a sky-scale and "explanatory globe"
// -scale instance under one CompositeLayer/checkbox per concept, since that
// IS one concept rendered at two display radii.

const layers = new LayerRegistry();

const earthBase = new EarthBase();
// Paused by default for this episode: isolates Sun/Moon orbital motion from
// Earth's daily spin. A main.ts (composition-root/episode) choice, not a
// change to EarthBase's own general-purpose default.
earthBase.rotationEnabled = false;
const continents = new ContinentsLayer(earthBase.mesh, earthBase.oceanMaterial);
const axis = new AxisLayer(earthBase.rotationGroup);

// --- Observers ---------------------------------------------------------
// Multiple observers can coexist; exactly one is "active" at a time - WASD,
// drag-to-place, the personal zenith/alt-az grid, and every marker's
// observerCentered offset all follow whichever one is active, via
// getActiveObserver() below, never a fixed reference. Pins render for every
// entry simultaneously; only the active entry's zenith/grid are shown.
const observerRegistry = new ObserverRegistry();
let observerMarkersVisible = true;
let nextObserverNumber = 1;

function createObserverEntry(id: string, label: string, latDeg: number, lonDeg: number): ObserverEntry {
  const station = new ObserverStation(earthBase.rotationGroup, { id, label, latDeg, lonDeg });
  const observer = new GroundObserver(id, station.object3D);
  const marker = new ObserverMarker(id, label, () => observer.getFrame().worldPosition);
  marker.setVisible(observerMarkersVisible);
  scene.add(marker.object3D);
  return { id, label, station, observer, marker };
}

const defaultObserverEntry = createObserverEntry(
  "observer-1",
  `Observer ${nextObserverNumber}`,
  DEFAULT_LATITUDE_DEG,
  DEFAULT_LONGITUDE_DEG,
);
observerRegistry.add(defaultObserverEntry);
nextObserverNumber += 1;

const getActiveObserver = () => observerRegistry.getActive().observer;
const getSimulationTime = () => simClock.getElapsedDays();

const backgroundStars = new StarsLayer({
  id: "backgroundStars",
  label: "Background Stars",
  group: "Sky.Observation",
  radius: CELESTIAL_SPHERE_RADIUS,
  getObserver: getActiveObserver,
  catalog: STAR_CATALOG,
  ...BACKGROUND_STARS_DEFAULT,
});

const celestialSphereStars = new StarsLayer({
  id: "celestialSphereStars",
  label: "Celestial Sphere Stars",
  group: "Sky.Geometry",
  radius: CELESTIAL_GLOBE_RADIUS,
  catalog: STAR_CATALOG,
  ...CELESTIAL_SPHERE_STARS_DEFAULT,
  supportsHemisphereFade: true,
});

// All four markers below share the SAME getActiveModel/getActiveObserver
// getters - confirming they're all just different VIEWS (sky vs globe
// display radius) of the one active model, not tied to different models.
// observerCentered stays differentiated per tier exactly as before this
// correction: sky-scale markers are observer-centered (parallax-correct
// from the actual observer position); globe-scale markers stay Earth-
// centered (the globe is a static external diagram - see CelestialSphereShell).
const sunMarkerSky = new CelestialMarkerLayer(BodyIds.Sun, getActiveModel, getActiveObserver, getSimulationTime, {
  id: "sunMarkerSky",
  label: "Sun (sky)",
  color: COLORS.sun,
  radius: CELESTIAL_SPHERE_RADIUS,
  observerCentered: true,
});
const sunMarkerGlobe = new CelestialMarkerLayer(BodyIds.Sun, getActiveModel, getActiveObserver, getSimulationTime, {
  id: "sunMarkerGlobe",
  label: "Sun (globe)",
  color: COLORS.sun,
  radius: CELESTIAL_GLOBE_RADIUS,
  orbitRadiusFraction: SUN_GLOBE_ORBIT_FRACTION,
});
const sunMarker = new CompositeLayer("sunMarker", "Show Sun", "Sky.Observation", [sunMarkerSky, sunMarkerGlobe]);

const moonMarkerSky = new CelestialMarkerLayer(BodyIds.Moon, getActiveModel, getActiveObserver, getSimulationTime, {
  id: "moonMarkerSky",
  label: "Moon (sky)",
  color: COLORS.moon,
  radius: CELESTIAL_SPHERE_RADIUS,
  observerCentered: true,
  textureUrl: "/textures/moon1.png",
  spinMode: "tidalLocked",
});
const moonMarkerGlobe = new CelestialMarkerLayer(BodyIds.Moon, getActiveModel, getActiveObserver, getSimulationTime, {
  id: "moonMarkerGlobe",
  label: "Moon (globe)",
  color: COLORS.moon,
  radius: CELESTIAL_GLOBE_RADIUS,
  orbitRadiusFraction: MOON_GLOBE_ORBIT_FRACTION,
  textureUrl: "/textures/moon1.png",
  spinMode: "tidalLocked",
});
const moonMarker = new CompositeLayer("moonMarker", "Show Moon", "Sky.Observation", [moonMarkerSky, moonMarkerGlobe]);

const celestialSphereShell = new CelestialSphereShell(CELESTIAL_GLOBE_RADIUS);

// Personal zenith (point + line) and alt/az grid: dual-tier like Sun/Moon,
// but unconditionally observer-centered on BOTH tiers (no observerCentered
// option) - altitude/azimuth/zenith have no Earth-center equivalent to
// fall back to, unlike Sun/Moon's negligible-parallax approximation. Both
// always follow whichever observer is currently active.
const zenithSky = new ZenithLayer({
  id: "zenithSky",
  label: "Zenith (sky)",
  radius: CELESTIAL_SPHERE_RADIUS,
  getActiveObserver,
});
const zenithGlobe = new ZenithLayer({
  id: "zenithGlobe",
  label: "Zenith (globe)",
  radius: CELESTIAL_GLOBE_RADIUS,
  getActiveObserver,
});
const zenith = new CompositeLayer("zenith", "Show Zenith", "Sky.Interpretation", [zenithSky, zenithGlobe]);

const altAzGridSky = new AltAzGridLayer({
  id: "altAzGridSky",
  label: "Alt/Az Grid (sky)",
  radius: CELESTIAL_SPHERE_RADIUS,
  getActiveObserver,
});
const altAzGridGlobe = new AltAzGridLayer({
  id: "altAzGridGlobe",
  label: "Alt/Az Grid (globe)",
  radius: CELESTIAL_GLOBE_RADIUS,
  getActiveObserver,
});
const altAzGrid = new CompositeLayer("altAzGrid", "Show Alt/Az Grid", "Sky.Interpretation", [altAzGridSky, altAzGridGlobe]);

// Synthetic Layer (no object3D of its own - see Layer.object3D being
// optional) fanning "Show Observer Markers" out to every registered
// observer's marker, including ones added later via "Add Observer".
const observerMarkersLayer: Layer = {
  id: "observerMarkers",
  label: "Show Observer Markers",
  group: "Earth.Teaching",
  setVisible: (visible: boolean) => {
    observerMarkersVisible = visible;
    observerRegistry.all().forEach((entry) => entry.marker.setVisible(visible));
  },
  update: () => {
    observerRegistry.all().forEach((entry) => entry.marker.update?.());
  },
};

layers.register(earthBase);
layers.register(continents);
layers.register(axis);
layers.register(backgroundStars);
layers.register(celestialSphereStars);
layers.register(sunMarker);
layers.register(sunMarkerSky);
layers.register(sunMarkerGlobe);
layers.register(moonMarker);
layers.register(moonMarkerSky);
layers.register(moonMarkerGlobe);
layers.register(celestialSphereShell);
layers.register(zenith);
layers.register(zenithSky);
layers.register(zenithGlobe);
layers.register(altAzGrid);
layers.register(altAzGridSky);
layers.register(altAzGridGlobe);
layers.register(observerMarkersLayer);

scene.add(earthBase.object3D);
scene.add(backgroundStars.object3D, celestialSphereStars.object3D);
scene.add(zenithSky.object3D, zenithGlobe.object3D);
scene.add(altAzGridSky.object3D, altAzGridGlobe.object3D);
scene.add(sunMarkerSky.object3D, sunMarkerGlobe.object3D);
scene.add(moonMarkerSky.object3D, moonMarkerGlobe.object3D);
scene.add(celestialSphereShell.object3D);

const selectedStarMarker = new SelectedStarMarker();
scene.add(selectedStarMarker.object3D);

const defaultLayerVisibility: Record<string, boolean> = {
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
  zenithSky: false,
  zenithGlobe: false,
  altAzGridSky: false,
  altAzGridGlobe: false,
  observerMarkers: true,
};
layers.show(defaultLayerVisibility);

// --- Cameras --------------------------------------------------------------

const cameraManager = new CameraManager(() => observerRegistry.getActive().station.object3D, renderer.domElement);

// The globe-scale ("explanatory globe") tier (Sun/Moon globe markers, the
// wireframe shell, and its own star field) is Earth-centered - see
// CelestialSphereShell / CELESTIAL_GLOBE_RADIUS - so every toggle for it is
// freely available in Space View: fly wherever you want and turn on
// whatever you want to look at, with no camera-mode-based restriction.
// Ground View is the one deliberate exception: standing at
// EARTH_RADIUS-scale on Earth's surface puts the observer very close to a
// CELESTIAL_GLOBE_RADIUS-scale diagram (5 vs 25 units), so its Sun/Moon/
// stars show up wildly parallax-shifted from the real sky-tier ones right
// next to them - almost never what you'd want, so it auto-hides there. This
// is a Ground-View-specific carve-out, not a general "pick a mode to see
// content" restriction - see the plan doc/conversation history for why an
// earlier version gated this by a whole separate "Celestial Sphere" camera
// mode instead, and why that turned out to be an unnecessary restriction
// (that mode was never anything but Space View with a different zoom-range
// preset - see CameraManager).
//
// Gating this ONLY inside a checkbox's onChange (as an earlier version of
// this file did) isn't enough: scene presets set visibility via
// layers.show(preset.layers) directly, bypassing any onChange handler
// entirely, and nothing previously re-checked the invariant when the
// camera mode changed afterward - so applying a preset that enables the
// globe tier, then manually switching to Ground View, left it stuck on.
// applyGlobeTierVisibility() re-derives ALL FOUR gated layers from tracked
// "wanted" state every time either the wanted state OR the camera mode
// changes, so the invariant holds regardless of which path changed it.
const globeTierAllowed = (): boolean => cameraManager.getMode() !== CameraMode.Ground;

let sunVisibleWanted = true;
let moonVisibleWanted = true;
let celestialSphereShellWanted = false;
let celestialSphereStarsWanted = false;

const applyGlobeTierVisibility = (): void => {
  const allowed = globeTierAllowed();
  layers.show({
    sunMarkerSky: sunVisibleWanted,
    sunMarkerGlobe: sunVisibleWanted && allowed,
    moonMarkerSky: moonVisibleWanted,
    moonMarkerGlobe: moonVisibleWanted && allowed,
    celestialSphereShell: celestialSphereShellWanted && allowed,
    celestialSphereStars: celestialSphereStarsWanted && allowed,
  });
};

// celestialSphereShell/celestialSphereStars have no sky-tier equivalent, so
// their checkbox IS the only control for something camera mode can silently
// override - it needs to reflect the effective (gated) state, or it'll show
// "on" while nothing is actually rendered (see applyGlobeTierVisibility).
// This must NOT be called from the checkboxes' own onChange, though: it
// would immediately re-read `allowed` as false whenever the user checks the
// box while in Ground View and snap it back to unchecked, fighting the very
// click that triggered it. Only call this from paths where the change
// originates from something OTHER than the checkbox itself - camera-mode
// switches and scene presets.
const syncGlobeTierCheckboxes = (): void => {
  const allowed = globeTierAllowed();
  controlPanel?.syncLayerToggles({
    celestialSphereShell: celestialSphereShellWanted && allowed,
    celestialSphereStars: celestialSphereStarsWanted && allowed,
  });
};

const viewModes: ViewModeDef[] = [
  { mode: CameraMode.Space, label: "Space View" },
  { mode: CameraMode.Ground, label: "Ground View" },
];

// --- UI ---------------------------------------------------------------
// `controlPanel` is referenced (not called) inside preset/camera callbacks
// below before it's assigned - safe, since those callbacks only run after
// construction completes on user interaction.
let controlPanel: ControlPanel;

const onHemisphereModeChange = (mode: HemisphereMode): void => {
  celestialSphereShell.setHemisphereMode(mode);
  celestialSphereStars.setHemisphereMode(mode);
};

const onCelestialSphereRadiusChange = (radius: number): void => {
  celestialSphereShell.setRadius(radius);
  celestialSphereStars.setRadius(radius);
  sunMarkerGlobe.setRadius(radius);
  moonMarkerGlobe.setRadius(radius);
  zenithGlobe.setRadius(radius);
  altAzGridGlobe.setRadius(radius);
};

// --- Observer movement ------------------------------------------------
// WASD (Ground View) and drag-to-place (Space/Celestial Sphere View) both
// act on whichever observer is currently active - see getActiveObserver.
const groundMoveControls = new GroundMoveControls(
  () => observerRegistry.getActive().station,
  () => cameraManager.getActiveCamera(),
);

const observerPlacer = new ObserverPlacer(
  () => cameraManager.getActiveCamera(),
  renderer.domElement,
  earthBase.mesh,
  earthBase.rotationGroup,
  () => observerRegistry.getActive().station,
);

// Drag-to-place works in every camera mode, including Ground View now -
// WASD (GroundMoveControls) still works there too, as a complementary way
// to move; drag-to-place additionally suspends GroundLookControls while
// armed (see GroundCameraRig.setInteractionEnabled) since both are pointer-
// drag gestures on the same element and would otherwise fight over the same
// event. Tracks the checkbox's own intent separately from camera mode so
// toggling either one re-derives the correct armed state.
let moveObserverChecked = false;
const applyPlacementArming = (): void => {
  const armed = moveObserverChecked;
  // setPlacementModeActive first: in Ground View it suspends
  // GroundLookControls, which resets the cursor to "default" - setArmed
  // must run AFTER so its "crosshair" cursor is the one that sticks.
  cameraManager.setPlacementModeActive(armed);
  observerPlacer.setArmed(armed);
};

function addObserver(): void {
  const number = nextObserverNumber;
  nextObserverNumber += 1;
  const id = `observer-${number}`;
  const label = `Observer ${number}`;
  const lonDeg = DEFAULT_LONGITUDE_DEG + 30 * observerRegistry.all().length;
  const entry = createObserverEntry(id, label, DEFAULT_LATITUDE_DEG, lonDeg);
  observerRegistry.add(entry);
  controlPanel.addObserverButton({ id, label });
}

// Shared by the Camera section's own buttons AND by anything that needs to
// switch mode as a side effect (see celestialSphere/stars.celestialSphere
// onChange below) - the globe tier is hidden in Ground View (see
// globeTierAllowed), so checking "Celestial Sphere visible" or "Celestial
// Sphere Stars visible" while there would otherwise leave the checkbox
// checked with nothing on screen to show for it - reported as "clicking
// celestial sphere brings up nothing" back when that gating covered Space
// View too.
function switchCameraMode(mode: CameraMode): void {
  cameraManager.setMode(mode);
  controlPanel.setActiveCameraMode(mode);
  groundMoveControls.setActive(mode === CameraMode.Ground);
  applyPlacementArming();
  applyGlobeTierVisibility();
  syncGlobeTierCheckboxes();
}

const panelConfig: ControlPanelConfig = {
  scene: {
    presets: SCENE_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      onApply: () => {
        layers.show(preset.layers);
        if (preset.cameraMode) {
          cameraManager.setMode(preset.cameraMode);
          controlPanel.setActiveCameraMode(preset.cameraMode);
        }
        // Presets can request the globe tier via the fused sunMarker/
        // moonMarker id or celestialSphereShell/celestialSphereStars
        // directly, bypassing the checkboxes' onChange gating entirely -
        // re-derive tracked intent from the preset and re-apply now that
        // camera mode (if changed) is in its final state, so the globe
        // tier never ends up stuck on outside Celestial Sphere mode.
        sunVisibleWanted = preset.layers.sunMarkerSky ?? preset.layers.sunMarker ?? false;
        moonVisibleWanted = preset.layers.moonMarkerSky ?? preset.layers.moonMarker ?? false;
        celestialSphereShellWanted = preset.layers.celestialSphereShell ?? false;
        celestialSphereStarsWanted = preset.layers.celestialSphereStars ?? false;
        applyGlobeTierVisibility();
        controlPanel.syncLayerToggles({
          ...preset.layers,
          sunMarker: sunVisibleWanted,
          moonMarker: moonVisibleWanted,
        });
        // Overrides the celestialSphereShell/celestialSphereStars keys just
        // synced above with their gated (effective) value, since a preset's
        // raw intent can request the globe tier while camera mode ends up
        // somewhere it isn't allowed.
        syncGlobeTierCheckboxes();
      },
    })),
  },
  earth: {
    visible: { checked: true, onChange: (v) => layers.show({ earthBase: v }) },
    continents: { checked: true, onChange: (v) => layers.show({ continents: v }) },
    // Starts unchecked/paused for this episode - see earthBase.rotationEnabled = false above.
    rotation: { checked: false, onChange: (v) => (earthBase.rotationEnabled = v) },
    axis: { checked: true, onChange: (v) => layers.show({ axis: v }) },
    axialTilt: {
      value: EARTH_AXIAL_TILT_DEG,
      min: 0,
      max: 90,
      step: 0.5,
      onChange: (v) => earthBase.setAxialTilt(v),
    },
  },
  astronomyModel: {
    entries: modelRegistry.all().map((entry) => ({ id: entry.id, label: entry.label })),
    activeId: modelRegistry.getActiveId(),
    onSwitchActive: (id) => {
      modelRegistry.setActive(id);
      controlPanel.setActiveAstronomyModel(id);
    },
  },
  observer: {
    entries: observerRegistry.all().map((entry) => ({ id: entry.id, label: entry.label })),
    activeId: observerRegistry.getActiveId(),
    onSwitchActive: (id) => {
      observerRegistry.setActive(id);
      controlPanel.setActiveObserver(id);
    },
    onAddObserver: addObserver,
    moveObserver: {
      checked: false,
      onChange: (v) => {
        moveObserverChecked = v;
        applyPlacementArming();
      },
    },
    markersVisible: { checked: observerMarkersVisible, onChange: (v) => layers.show({ observerMarkers: v }) },
    // Unlike Sun/Moon's globe-tier markers, Zenith/AltAzGrid are always
    // observer-centered (see ZenithLayer/AltAzGridLayer) - the globe-tier
    // instance is centered on wherever the observer/camera actually is, so
    // there's no off-center parallax distortion to guard against by
    // restricting it to the external Celestial Sphere camera. Both tiers
    // toggle freely in any camera mode, letting the small globe-scale grid
    // be superimposed over Ground/Space View too.
    zenith: { checked: false, onChange: (v) => layers.show({ zenithSky: v, zenithGlobe: v }) },
    grid: { checked: false, onChange: (v) => layers.show({ altAzGridSky: v, altAzGridGlobe: v }) },
  },
  sunMoon: {
    sun: {
      checked: true,
      onChange: (v) => {
        sunVisibleWanted = v;
        applyGlobeTierVisibility();
      },
    },
    moon: {
      checked: true,
      onChange: (v) => {
        moonVisibleWanted = v;
        applyGlobeTierVisibility();
      },
    },
  },
  celestialSphere: {
    visible: {
      checked: false,
      onChange: (v) => {
        celestialSphereShellWanted = v;
        if (v && cameraManager.getMode() === CameraMode.Ground) {
          switchCameraMode(CameraMode.Space);
        } else {
          applyGlobeTierVisibility();
        }
      },
    },
    wireframeOpacity: {
      value: CELESTIAL_SPHERE_WIREFRAME_OPACITY_DEFAULT,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (v) => celestialSphereShell.setWireframeOpacity(v),
    },
    radius: {
      value: CELESTIAL_GLOBE_RADIUS,
      min: CELESTIAL_SPHERE_RADIUS_MIN,
      max: CELESTIAL_SPHERE_RADIUS_MAX,
      step: 1,
      onChange: onCelestialSphereRadiusChange,
    },
    onHemisphereModeChange,
  },
  stars: {
    background: {
      visible: { checked: true, onChange: (v) => layers.show({ backgroundStars: v }) },
      limitingMagnitude: {
        value: BACKGROUND_STARS_DEFAULT.limitingMagnitude,
        min: STAR_LIMITING_MAGNITUDE_MIN,
        max: STAR_LIMITING_MAGNITUDE_MAX,
        step: 0.1,
        onChange: (v) => backgroundStars.setLimitingMagnitude(v),
      },
      brightness: {
        value: BACKGROUND_STARS_DEFAULT.brightness,
        min: 0.1,
        max: 1,
        step: 0.05,
        onChange: (v) => backgroundStars.setBrightness(v),
      },
      size: { value: BACKGROUND_STARS_DEFAULT.size, min: 0.25, max: 4, step: 0.25, onChange: (v) => backgroundStars.setSize(v) },
      opacity: {
        value: BACKGROUND_STARS_DEFAULT.opacity,
        min: 0.1,
        max: 1,
        step: 0.05,
        onChange: (v) => backgroundStars.setOpacity(v),
      },
    },
    celestialSphere: {
      visible: {
        checked: false,
        onChange: (v) => {
          celestialSphereStarsWanted = v;
          if (v && cameraManager.getMode() === CameraMode.Ground) {
            switchCameraMode(CameraMode.Space);
          } else {
            applyGlobeTierVisibility();
          }
        },
      },
      limitingMagnitude: {
        value: CELESTIAL_SPHERE_STARS_DEFAULT.limitingMagnitude,
        min: STAR_LIMITING_MAGNITUDE_MIN,
        max: STAR_LIMITING_MAGNITUDE_MAX,
        step: 0.1,
        onChange: (v) => celestialSphereStars.setLimitingMagnitude(v),
      },
      brightness: {
        value: CELESTIAL_SPHERE_STARS_DEFAULT.brightness,
        min: 0.1,
        max: 1,
        step: 0.05,
        onChange: (v) => celestialSphereStars.setBrightness(v),
      },
      size: {
        value: CELESTIAL_SPHERE_STARS_DEFAULT.size,
        min: 0.25,
        max: 4,
        step: 0.25,
        onChange: (v) => celestialSphereStars.setSize(v),
      },
      opacity: {
        value: CELESTIAL_SPHERE_STARS_DEFAULT.opacity,
        min: 0.1,
        max: 1,
        step: 0.05,
        onChange: (v) => celestialSphereStars.setOpacity(v),
      },
    },
  },
  camera: {
    viewModes,
    onCameraModeChange: switchCameraMode,
  },
  time: {
    onPlayPauseChange: (paused) => (simClock.paused = paused),
    timeScale: {
      value: TIME_SPEED_DEFAULT,
      min: TIME_SPEED_MIN,
      max: TIME_SPEED_MAX,
      step: 0.1,
      format: (v) => `${v}x`,
      onChange: (v) => (simClock.timeSpeed = v),
    },
    onStepHour: () => simClock.addElapsedDays(TIME_STEP_HOUR_DAYS),
    onStepDay: () => simClock.addElapsedDays(TIME_STEP_DAY_DAYS),
    onStepMonth: () => simClock.addElapsedDays(TIME_STEP_MONTH_DAYS),
    onStepYear: () => simClock.addElapsedDays(TIME_STEP_YEAR_DAYS),
    onReset: () => simClock.reset(),
  },
};

controlPanel = new ControlPanel(container, panelConfig);
controlPanel.setActiveCameraMode(CameraMode.Space);

new StarPicker(
  () => cameraManager.getActiveCamera(),
  renderer.domElement,
  [backgroundStars, celestialSphereStars],
  (star, worldPosition) => {
    controlPanel.setSelectedStarInfo(star);
    selectedStarMarker.setWorldPosition(worldPosition);
  },
);

// --- Render loop --------------------------------------------------------

function onResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  cameraManager.setAspect(width / height);
}
window.addEventListener("resize", onResize);
onResize();

const cameraDirection = new THREE.Vector3();
const sunLightDirection = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const deltaSeconds = simClock.tick();
  layers.update(deltaSeconds);
  groundMoveControls.update(deltaSeconds);
  cameraManager.update();

  // Real day/night terminator: the key light always comes from the active
  // model's actual current Sun direction. Earth's mesh sits at the world
  // origin regardless of model (see EarthBase), but the model's own
  // coordinate origin does NOT always coincide with Earth - Heliocentric
  // puts the Sun near origin and moves Earth, Geocentric does the
  // opposite - so this must use the RELATIVE vector (Sun - Earth), exactly
  // like GroundObserver.getDirectionTo, not either absolute position
  // alone. DirectionalLight only cares about direction, not distance, but
  // a position far outside Earth keeps the math the same shape as a real
  // light source.
  const universeState = getActiveModel().getState(getSimulationTime());
  const sunBody = universeState.bodies[BodyIds.Sun];
  const earthBody = universeState.bodies[BodyIds.Earth];
  sunLightDirection
    .set(sunBody.position.x - earthBody.position.x, sunBody.position.y - earthBody.position.y, sunBody.position.z - earthBody.position.z)
    .normalize();
  keyLight.position.copy(sunLightDirection).multiplyScalar(EARTH_RADIUS * 20);

  const activeLatLon = observerRegistry.getActive().station.getLatLon();
  controlPanel.setObserverLatLon(activeLatLon.latDeg, activeLatLon.lonDeg);

  const camera = cameraManager.getActiveCamera();
  cameraDirection.copy(camera.position).normalize();
  celestialSphereShell.updateHemisphereFade(cameraDirection);
  celestialSphereStars.updateHemisphereFade(cameraDirection);

  renderer.render(scene, camera);
});
