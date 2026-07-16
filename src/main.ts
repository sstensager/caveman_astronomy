import * as THREE from "three";
import "./style.css";
import "./ui/controlPanel.css";

import { SimulationClock } from "./core/SimulationClock";
import { LayerRegistry } from "./layers/LayerRegistry";
import { CompositeLayer } from "./layers/CompositeLayer";
import { EarthBase } from "./layers/earth/EarthBase";
import { ContinentsLayer } from "./layers/earth/ContinentsLayer";
import { AxisLayer } from "./layers/earth/AxisLayer";
import { GroundScatterLayer } from "./layers/earth/GroundScatterLayer";
import { StonehengeLayer } from "./layers/earth/StonehengeLayer";
import { ImageLandMask } from "./utils/landMask";
import { findSeasonalMarkers } from "./astronomy/seasons";
import { sunHorizonAzimuths } from "./astronomy/sunHorizon";
import { findRotationForHorizonAzimuth } from "./utils/rotationAlignment";
import { StarsLayer } from "./layers/sky/StarsLayer";
import { AtmosphereLayer } from "./layers/sky/AtmosphereLayer";
import { CelestialSphereShell } from "./layers/sky/CelestialSphereShell";
import { ConstellationLinesLayer } from "./layers/sky/ConstellationLinesLayer";
import { ConstellationLabelsLayer } from "./layers/sky/ConstellationLabelsLayer";
import { OrbitLineLayer } from "./layers/sky/OrbitLineLayer";
import { SkyPathLineLayer } from "./layers/sky/SkyPathLineLayer";
import { OrbitingBodyMarkerLayer } from "./layers/sky/OrbitingBodyMarkerLayer";
import { ModernHeliocentricModel } from "./astronomy/models/ModernHeliocentricModel";
import { GeocentricModel } from "./astronomy/models/GeocentricModel";
import { AstronomyModelRegistry } from "./astronomy/AstronomyModelRegistry";
import { BodyIds, type AstronomyModel, type SimulationTime } from "./astronomy/types";
import { getEarthDiagramPosition, getMoonOffsetFromEarth, getSunOffsetFromEarth } from "./astronomy/solarSystemDiagram";
import { eclipticToWorld } from "./astronomy/frames";
import { dateToSimulationDay, simulationDayToDate } from "./astronomy/calendar";
import { STAR_CATALOG } from "./astronomy/starCatalog";
import { RESOLVED_CONSTELLATION_CULTURES } from "./astronomy/constellationCatalog";
import { GroundObserver } from "./observers/GroundObserver";
import { ObserverStation } from "./observers/ObserverStation";
import { ObserverRegistry, type ObserverEntry } from "./observers/ObserverRegistry";
import { ObserverMarker } from "./observers/ObserverMarker";
import { ZenithLayer } from "./observers/ZenithLayer";
import { AltAzGridLayer } from "./observers/AltAzGridLayer";
import { CameraManager } from "./cameras/CameraManager";
import { CameraMode } from "./cameras/CameraMode";
import { CameraUpMode } from "./cameras/CameraUpMode";
import { GroundMoveControls } from "./cameras/GroundMoveControls";
import { ControlPanel, type ControlPanelConfig, type ViewModeDef } from "./ui/ControlPanel";
import { TimeHud } from "./ui/TimeHud";
import { MinimapHud } from "./ui/MinimapHud";
import { SCENE_PRESETS } from "./ui/scenePresets";
import { StarPicker } from "./interaction/StarPicker";
import { SelectedStarMarker } from "./interaction/SelectedStarMarker";
import { ObserverDragHandler } from "./interaction/ObserverDragHandler";
import { BodyTargetPicker, type TargetableBody } from "./interaction/BodyTargetPicker";
import { TargetReticleLayer } from "./interaction/TargetReticleLayer";
import type { HemisphereMode } from "./utils/hemisphereFade";
import type { Layer } from "./layers/Layer";
import {
  ALT_AZ_DOME_RADIUS,
  COLORS,
  TEXTURES,
  DEFAULT_LATITUDE_DEG,
  EARTH_RADIUS,
  DEFAULT_LONGITUDE_DEG,
  MOON_DARK_SIDE_BRIGHTNESS_DEFAULT,
  MOON_DARK_SIDE_BRIGHTNESS_MIN,
  MOON_DARK_SIDE_BRIGHTNESS_MAX,
  MOON_DISTANCE_DEFAULT_RADII,
  MOON_DISTANCE_MIN_RADII,
  MOON_DISTANCE_MAX_RADII,
  MOON_MARKER_SIZE_DEFAULT,
  MOON_SIZE_DEFAULT_RADII,
  MOON_SIZE_MIN_RADII,
  MOON_SIZE_MAX_RADII,
  OBSERVER_COLORS,
  STAR_LIMITING_MAGNITUDE_MAX,
  STAR_LIMITING_MAGNITUDE_MIN,
  STAR_RADIUS_DEFAULT,
  STAR_RADIUS_MIN,
  STAR_RADIUS_MAX,
  STARS_DEFAULT,
  SUN_DISTANCE_DEFAULT_RADII,
  SUN_DISTANCE_MIN_RADII,
  SUN_DISTANCE_MAX_RADII,
  SUN_MARKER_SIZE_DEFAULT,
  SUN_SIZE_DEFAULT_RADII,
  SUN_SIZE_MIN_RADII,
  SUN_SIZE_MAX_RADII,
  CELESTIAL_SPHERE_WIREFRAME_OPACITY_DEFAULT,
  MINIMAP_OPACITY_DEFAULT,
  ZENITH_DOT_SIZE,
  TIME_SPEED_DEFAULT,
  TIME_SPEED_MAX,
  TIME_SPEED_MIN,
  TIME_STEP_DAY_DAYS,
  TIME_STEP_HOUR_DAYS,
  TIME_STEP_MONTH_DAYS,
  TIME_STEP_YEAR_DAYS,
} from "./config/constants";
import {
  EARTH_AXIAL_TILT_DEG,
  EARTH_ORBIT_PERIOD_DAYS,
  EARTH_ORBIT_RADIUS,
  MOON_ORBIT_PERIOD_DAYS,
  MOON_ORBIT_RADIUS,
} from "./astronomy/constants";

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
// position is re-derived every frame from the active Scene's actual Sun
// direction (see the render loop below). keyLight itself isn't added to the
// scene until earthBase exists further down - it's parented under
// earthBase.object3D rather than scene directly (see that comment).
scene.add(new THREE.AmbientLight(0xffffff, 0.06));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);

// --- Simulation clock -----------------------------------------------------

const simClock = new SimulationClock();

// --- Scene: Geocentric / Heliocentric --------------------------------------
// The ONE top-level choice in this app: which body is treated as fixed at
// the world origin. Everything else - Sun/Moon visibility, distance, size,
// star density, grids, observers - is shared, persistent state that both
// Scenes render under; switching Scenes never resets or duplicates it.
// GeocentricModel and ModernHeliocentricModel are proven to produce
// identical apparent sky positions (see modelEquivalence.test.ts) - each
// Scene just uses the model whose own math already expresses that Scene's
// body-at-the-origin convention directly (Earth fixed for Geocentric, Sun
// fixed for Heliocentric), so no separate "which model computes it" choice
// is exposed to the user at all.
const modelRegistry = new AstronomyModelRegistry();
modelRegistry.add({ id: "heliocentric", label: "Heliocentric", model: new ModernHeliocentricModel() });
modelRegistry.add({ id: "geocentric", label: "Geocentric", model: new GeocentricModel() });

type SceneId = "geocentric" | "heliocentric";
let activeScene: SceneId = "heliocentric";
const getActiveModel = (): AstronomyModel => modelRegistry.get(activeScene)!.model;

// --- Layers ---------------------------------------------------------------
// Every independently-toggleable piece of the scene registers here. Exactly
// ONE instance of each concept exists (one Sun, one Moon, one star field) -
// there is no per-Scene or per-tier duplication to keep in sync.

const layers = new LayerRegistry();

const earthBase = new EarthBase();
// Paused by default: isolates Sun/Moon orbital motion from Earth's daily
// spin for legibility.
earthBase.rotationEnabled = false;
const continents = new ContinentsLayer(earthBase.mesh, earthBase.oceanMaterial);
const axis = new AxisLayer(earthBase.rotationGroup);
// Loads earth1.png independently of ContinentsLayer's own THREE.Texture (a
// second decode of the same file) so GroundScatterLayer can read real pixel
// data via canvas - THREE's texture pipeline doesn't expose that. See
// landMask.ts's doc comment for why this can't be unit-tested directly.
const landMask = new ImageLandMask(TEXTURES.continents);
const groundScatter = new GroundScatterLayer(landMask);
earthBase.rotationGroup.add(groundScatter.object3D);

const stonehenge = new StonehengeLayer();
earthBase.rotationGroup.add(stonehenge.object3D);

// --- Observers ---------------------------------------------------------
// Multiple observers can coexist; exactly one is "active" at a time - WASD,
// drag-to-place, and Ground View's camera attachment all follow whichever
// one is active, via getActiveObserver() below, never a fixed reference.
// Pins render for every entry simultaneously; each entry's zenith/alt-az
// grid ALSO render independently of which one is "active".
const observerRegistry = new ObserverRegistry();
let observerMarkersVisible = true;
let observerFarSideIndicatorEnabled = true;
let nextObserverNumber = 1;
// ANDed with the live groundViewActive check in the render loop - see
// MinimapHud's class doc comment.
let minimapManuallyVisible = true;

// The one shared sky/celestial-sphere radius - stars, constellations, the
// wireframe shell, the Sun/Moon sky-path lines, and each observer's zenith
// all track this same live value (see config/constants.ts's STAR_RADIUS_*
// doc comment) - the zenith really is a point on the celestial sphere
// directly overhead, so its line/point should reach exactly as far as the
// rest of the sky does. Each observer's alt-az GRID deliberately does NOT
// track this - see ALT_AZ_DOME_RADIUS.
let skyRadius = STAR_RADIUS_DEFAULT;

function createObserverEntry(id: string, label: string, latDeg: number, lonDeg: number, colorIndex: number): ObserverEntry {
  const station = new ObserverStation(earthBase.rotationGroup, { id, label, latDeg, lonDeg });
  const observer = new GroundObserver(id, station.object3D);
  const color = OBSERVER_COLORS[colorIndex % OBSERVER_COLORS.length];
  const colorHex = `#${color.toString(16).padStart(6, "0")}`;
  const marker = new ObserverMarker(id, label, () => observer.getFrame().worldPosition, {
    color,
    getEarthCenter: () => earthBase.object3D.getWorldPosition(new THREE.Vector3()),
  });
  marker.setVisible(observerMarkersVisible);
  marker.setFarSideIndicatorEnabled(observerFarSideIndicatorEnabled);
  scene.add(marker.object3D);

  // Colored to match this observer's own marker pin - see `color` above -
  // so which dome/zenith belongs to which observer reads at a glance.
  const zenith = new ZenithLayer({
    id: `${id}Zenith`,
    label: `${label} Zenith`,
    radius: skyRadius,
    dotSize: ZENITH_DOT_SIZE,
    color,
    getActiveObserver: () => observer,
  });
  // Fixed at ALT_AZ_DOME_RADIUS, NOT the shared skyRadius - see that
  // constant's doc comment for why this stays a tiny personal dome instead
  // of ballooning out with the star field.
  const altAzGrid = new AltAzGridLayer({
    id: `${id}AltAzGrid`,
    label: `${label} Alt/Az Grid`,
    radius: ALT_AZ_DOME_RADIUS,
    color,
    compassColor: colorHex,
    getActiveObserver: () => observer,
  });

  layers.register(zenith);
  layers.register(altAzGrid);
  scene.add(zenith.object3D, altAzGrid.object3D);
  layers.show({ [zenith.id]: false, [altAzGrid.id]: false });

  return { id, label, station, observer, marker, color, zenith, altAzGrid };
}

const defaultObserverEntry = createObserverEntry(
  "observer-1",
  `Observer ${nextObserverNumber}`,
  DEFAULT_LATITUDE_DEG,
  DEFAULT_LONGITUDE_DEG,
  0,
);
observerRegistry.add(defaultObserverEntry);
nextObserverNumber += 1;

const getActiveObserver = () => observerRegistry.getActive().observer;
const getSimulationTime = () => simClock.getElapsedDays();

// --- Sky: stars, constellations, celestial sphere shell --------------------
// ONE tier each, spanning "small comprehensible diagram" to "immersive
// infinite backdrop" via skyRadius (see its own doc comment above) rather
// than two separate parallel systems with their own duplicated controls.
// All observer-centered (getObserver) - the celestial sphere IS centered on
// the observer, which is exactly what shrinking skyRadius demonstrates.

const stars = new StarsLayer({
  id: "stars",
  label: "Stars",
  group: "Sky.Observation",
  radius: skyRadius,
  getObserver: getActiveObserver,
  catalog: STAR_CATALOG,
  ...STARS_DEFAULT,
  supportsHemisphereFade: true,
});

const atmosphere = new AtmosphereLayer(scene);

const ALL_CONSTELLATIONS = RESOLVED_CONSTELLATION_CULTURES.flatMap((culture) => culture.constellations);

const constellationLines = new ConstellationLinesLayer({
  id: "constellationLines",
  label: "Constellation Lines",
  group: "Sky.Observation",
  radius: skyRadius,
  constellations: ALL_CONSTELLATIONS,
  getObserver: getActiveObserver,
});
const constellationNames = new ConstellationLabelsLayer({
  id: "constellationNames",
  label: "Constellation Names",
  group: "Sky.Observation",
  radius: skyRadius,
  constellations: ALL_CONSTELLATIONS,
  getObserver: getActiveObserver,
});

const celestialSphereShell = new CelestialSphereShell(skyRadius, getActiveObserver);

// The path each body traces across the sky over one full orbital period
// (the Sun's is literally the ecliptic) - direction-only, drawn on the
// shared sky radius, independent of the body's own distance slider below.
const sunEclipticPath = new SkyPathLineLayer({
  id: "sunEclipticPath",
  label: "Sun Ecliptic Path",
  group: "Sky.Observation",
  bodyId: BodyIds.Sun,
  relativeToId: BodyIds.Earth,
  periodDays: EARTH_ORBIT_PERIOD_DAYS,
  getModel: getActiveModel,
  getObserver: getActiveObserver,
  getSimulationTime,
  radius: skyRadius,
  color: COLORS.sun,
});
const moonSkyPath = new SkyPathLineLayer({
  id: "moonSkyPath",
  label: "Moon Sky Path",
  group: "Sky.Observation",
  bodyId: BodyIds.Moon,
  relativeToId: BodyIds.Earth,
  periodDays: MOON_ORBIT_PERIOD_DAYS,
  getModel: getActiveModel,
  getObserver: getActiveObserver,
  getSimulationTime,
  radius: skyRadius,
  color: COLORS.moon,
});

/** Every layer whose display radius tracks the shared skyRadius - called
 *  whenever the Sky radius slider changes. Includes each observer's zenith
 *  (a real point on the celestial sphere) but deliberately excludes their
 *  alt-az GRID - see ALT_AZ_DOME_RADIUS's doc comment. */
function setSkyRadius(radius: number): void {
  skyRadius = radius;
  stars.setRadius(radius);
  constellationLines.setRadius(radius);
  constellationNames.setRadius(radius);
  celestialSphereShell.setRadius(radius);
  sunEclipticPath.setRadius(radius);
  moonSkyPath.setRadius(radius);
  for (const entry of observerRegistry.all()) {
    entry.zenith.setRadius(radius);
  }
}

// --- Sun & Moon: one Sun, one Moon, always -------------------------------
// Both markers are positioned Earth-relative (getSunOffsetFromEarth/
// getMoonOffsetFromEarth) and parented under earthBase.object3D - this is
// what makes a single instance correct in BOTH Scenes with no branching:
// in Geocentric, earthBase never moves, so this Earth-relative offset IS
// the world position (Sun/Moon truly orbit a fixed Earth). In Heliocentric,
// earthBase itself moves to its real position around a Sun fixed at the
// world origin (see the render loop's setOrbitPosition call) using the
// EXACT SAME distance scale this marker's offset uses - the two cancel
// exactly, so the Sun marker always renders at the world origin there. See
// astronomy/solarSystemDiagram.ts's doc comments for the underlying vector
// math and its model-agnostic proof.
let sunDistanceRadii = SUN_DISTANCE_DEFAULT_RADII;
let moonDistanceRadii = MOON_DISTANCE_DEFAULT_RADII;

const sunMarker = new OrbitingBodyMarkerLayer({
  id: "sunMarker",
  label: "Sun",
  group: "Sky.Geometry",
  color: COLORS.sun,
  markerSize: SUN_MARKER_SIZE_DEFAULT,
  getPosition: () =>
    getSunOffsetFromEarth(getActiveModel().getState(getSimulationTime()), (EARTH_RADIUS * sunDistanceRadii) / EARTH_ORBIT_RADIUS),
});
const moonMarker = new OrbitingBodyMarkerLayer({
  id: "moonMarker",
  label: "Moon",
  group: "Sky.Geometry",
  color: COLORS.moon,
  markerSize: MOON_MARKER_SIZE_DEFAULT,
  textureUrl: "/textures/moon1.png",
  spinMode: "tidalLocked",
  lit: true,
  darkSideBrightness: MOON_DARK_SIDE_BRIGHTNESS_DEFAULT,
  getPosition: () =>
    getMoonOffsetFromEarth(getActiveModel().getState(getSimulationTime()), (EARTH_RADIUS * moonDistanceRadii) / MOON_ORBIT_RADIUS),
});
earthBase.object3D.add(sunMarker.object3D, moonMarker.object3D);

// Real elliptical orbit shapes (true eccentricity, unlike the direction-only
// sky paths above) at the body's current distance scale - Earth-relative,
// so parented under earthBase.object3D exactly like the markers themselves.
const sunOrbitLine = new OrbitLineLayer({
  id: "sunOrbitLine",
  label: "Sun Orbit",
  group: "Sky.Geometry",
  bodyId: BodyIds.Sun,
  relativeToId: BodyIds.Earth,
  periodDays: EARTH_ORBIT_PERIOD_DAYS,
  semiMajorAxis: EARTH_ORBIT_RADIUS,
  getModel: getActiveModel,
  getSimulationTime,
  radius: EARTH_RADIUS * sunDistanceRadii,
  orbitRadiusFraction: 1,
  color: COLORS.sun,
});
const moonOrbitLine = new OrbitLineLayer({
  id: "moonOrbitLine",
  label: "Moon Orbit",
  group: "Sky.Geometry",
  bodyId: BodyIds.Moon,
  relativeToId: BodyIds.Earth,
  periodDays: MOON_ORBIT_PERIOD_DAYS,
  semiMajorAxis: MOON_ORBIT_RADIUS,
  getModel: getActiveModel,
  getSimulationTime,
  radius: EARTH_RADIUS * moonDistanceRadii,
  orbitRadiusFraction: 1,
  color: COLORS.moon,
});
const orbitLines = new CompositeLayer("orbitLines", "Orbit Lines", "Sky.Geometry", [sunOrbitLine, moonOrbitLine]);
earthBase.object3D.add(sunOrbitLine.object3D, moonOrbitLine.object3D);

// Earth's own real elliptical path around the Sun - only meaningful in
// Heliocentric (Earth is the body that actually moves there); force-hidden
// in Geocentric regardless of its own checkbox state, see
// applyEarthOrbitPathVisibility. Parented at the world/scene root (NOT
// earthBase) - it traces the path AROUND a Sun fixed at the world origin,
// the same frame earthBase's own Heliocentric position is computed in.
let earthOrbitPathVisible = false;
const earthOrbitLine = new OrbitLineLayer({
  id: "earthOrbitLine",
  label: "Earth's Orbital Path",
  group: "Sky.Geometry",
  bodyId: BodyIds.Earth,
  relativeToId: BodyIds.Sun,
  periodDays: EARTH_ORBIT_PERIOD_DAYS,
  semiMajorAxis: EARTH_ORBIT_RADIUS,
  getModel: getActiveModel,
  getSimulationTime,
  radius: EARTH_RADIUS * sunDistanceRadii,
  orbitRadiusFraction: 1,
  color: COLORS.earth,
});
scene.add(earthOrbitLine.object3D);

function applyEarthOrbitPathVisibility(): void {
  layers.show({ earthOrbitLine: earthOrbitPathVisible && activeScene === "heliocentric" });
}

/** Every layer whose scale tracks the Sun's own distance slider. */
function setSunDistanceRadii(radii: number): void {
  sunDistanceRadii = radii;
  sunOrbitLine.setRadius(EARTH_RADIUS * radii);
  earthOrbitLine.setRadius(EARTH_RADIUS * radii);
  cameraManager.setSpaceMaxDistance(Math.max(EARTH_RADIUS * 200, radii * EARTH_RADIUS * 3));
}
function setMoonDistanceRadii(radii: number): void {
  moonDistanceRadii = radii;
  moonOrbitLine.setRadius(EARTH_RADIUS * radii);
}

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

const observerFarSideIndicatorLayer: Layer = {
  id: "observerFarSideIndicator",
  label: "Show Far-Side Indicator (chevron)",
  group: "Earth.Teaching",
  setVisible: (visible: boolean) => {
    observerFarSideIndicatorEnabled = visible;
    observerRegistry.all().forEach((entry) => entry.marker.setFarSideIndicatorEnabled(visible));
  },
};

const targetReticles = new TargetReticleLayer();

layers.register(earthBase);
layers.register(continents);
layers.register(axis);
layers.register(groundScatter);
layers.register(stonehenge);
layers.register(stars);
layers.register(atmosphere);
layers.register(constellationLines);
layers.register(constellationNames);
layers.register(celestialSphereShell);
layers.register(sunEclipticPath);
layers.register(moonSkyPath);
layers.register(sunMarker);
layers.register(moonMarker);
layers.register(sunOrbitLine);
layers.register(moonOrbitLine);
layers.register(orbitLines);
layers.register(earthOrbitLine);
layers.register(observerMarkersLayer);
layers.register(observerFarSideIndicatorLayer);
layers.register(targetReticles);

scene.add(earthBase.object3D);
scene.add(stars.object3D);
scene.add(constellationLines.object3D);
scene.add(constellationNames.object3D);
scene.add(celestialSphereShell.object3D);
scene.add(sunEclipticPath.object3D, moonSkyPath.object3D);
scene.add(targetReticles.object3D);

// keyLight and its target are parented under earthBase.object3D: the
// per-frame position formula in the render loop below
// (sunLightDirection * EARTH_RADIUS*20) is relative to wherever Earth's
// center currently is. keyLight.target defaults to local (0,0,0), exactly
// Earth's own mesh center regardless of spin/tilt (both pure rotations, not
// translations) - it never needs to be touched again.
earthBase.object3D.add(keyLight, keyLight.target);

const selectedStarMarker = new SelectedStarMarker();
scene.add(selectedStarMarker.object3D);

const defaultLayerVisibility: Record<string, boolean> = {
  earthBase: true,
  continents: true,
  axis: true,
  groundScatter: true,
  stonehenge: false,
  stars: true,
  atmosphere: true,
  constellationLines: false,
  constellationNames: false,
  celestialSphereShell: false,
  sunEclipticPath: false,
  moonSkyPath: false,
  sunMarker: true,
  moonMarker: true,
  orbitLines: false,
  earthOrbitLine: false,
  observerMarkers: true,
  observerFarSideIndicator: true,
  targetReticles: true,
};
layers.show(defaultLayerVisibility);

// --- Cameras --------------------------------------------------------------

const cameraManager = new CameraManager(() => observerRegistry.getActive().station.object3D, renderer.domElement);
cameraManager.setSpaceMaxDistance(Math.max(EARTH_RADIUS * 200, sunDistanceRadii * EARTH_RADIUS * 3));

const getCameraPosition = () => cameraManager.getActiveCamera().position;
defaultObserverEntry.marker.setCameraPositionGetter(getCameraPosition);

const viewModes: ViewModeDef[] = [
  { mode: CameraMode.Space, label: "Space View" },
  { mode: CameraMode.Ground, label: "Ground View" },
];

// --- UI ---------------------------------------------------------------

let controlPanel: ControlPanel;

const onHemisphereModeChange = (mode: HemisphereMode): void => {
  celestialSphereShell.setHemisphereMode(mode);
  stars.setHemisphereMode(mode);
};

// --- Observer movement ------------------------------------------------
const groundMoveControls = new GroundMoveControls(
  () => observerRegistry.getActive().station,
  () => cameraManager.getActiveCamera(),
);

new ObserverDragHandler(
  () => cameraManager.getActiveCamera(),
  renderer.domElement,
  earthBase.mesh,
  earthBase.rotationGroup,
  () => observerRegistry.all(),
  (hovering) => {
    if (hovering) renderer.domElement.style.cursor = "pointer";
  },
  (dragging) => {
    cameraManager.setPlacementModeActive(dragging);
    if (dragging) renderer.domElement.style.cursor = "grabbing";
  },
);

// --- Target lock: click the Sun/Moon/Earth to center and follow it -------
// Space View only (see CameraManager.setSpaceFollowTarget) - Ground View's
// camera is anchored to the observer station and has no orbit target to
// re-center.
const targetableBodies: TargetableBody[] = [
  { id: "sun", label: "Sun", object3D: sunMarker.object3D },
  { id: "moon", label: "Moon", object3D: moonMarker.object3D },
  { id: "earth", label: "Earth", object3D: earthBase.mesh },
];

function bodyPositionGetter(body: TargetableBody | undefined): (() => THREE.Vector3) | undefined {
  return body ? () => body.object3D.getWorldPosition(new THREE.Vector3()) : undefined;
}

function setAnchorBody(id: string | undefined): void {
  const body = id ? targetableBodies.find((b) => b.id === id) : undefined;
  cameraManager.setSpaceFollowTarget(bodyPositionGetter(body));
  targetReticles.setAnchorTarget(bodyPositionGetter(body));
  controlPanel.setAnchorBody(body?.label);
}

function setLookAtBody(id: string | undefined): void {
  const body = id ? targetableBodies.find((b) => b.id === id) : undefined;
  cameraManager.setSpaceLookAtTarget(bodyPositionGetter(body));
  targetReticles.setLookAtTarget(bodyPositionGetter(body));
  controlPanel.setLookAtBody(body?.label);
}

new BodyTargetPicker(() => cameraManager.getActiveCamera(), renderer.domElement, targetableBodies, setAnchorBody, setLookAtBody);

// Same release path as clicking/long-pressing empty space (see
// BodyTargetPicker's doc comment) - a global listener rather than scoped to
// the canvas so it still works while focus is on a control panel input.
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setAnchorBody(undefined);
    setLookAtBody(undefined);
  }
});

function addObserver(): void {
  const number = nextObserverNumber;
  nextObserverNumber += 1;
  const id = `observer-${number}`;
  const label = `Observer ${number}`;
  const lonDeg = DEFAULT_LONGITUDE_DEG + 30 * observerRegistry.all().length;
  const entry = createObserverEntry(id, label, DEFAULT_LATITUDE_DEG, lonDeg, number - 1);
  entry.marker.setCameraPositionGetter(getCameraPosition);
  observerRegistry.add(entry);
  controlPanel.addObserverButton({ id, label });
  controlPanel.addObserverToggleRow({
    id,
    label,
    zenith: { checked: false, onChange: (v) => layers.show({ [entry.zenith.id]: v }) },
    grid: { checked: false, onChange: (v) => layers.show({ [entry.altAzGrid.id]: v }) },
  });
}

function switchCameraMode(mode: CameraMode): void {
  cameraManager.setMode(mode);
  controlPanel.setActiveCameraMode(mode);
  groundMoveControls.setActive(mode === CameraMode.Ground);
}

function switchCameraUpMode(mode: CameraUpMode): void {
  cameraManager.setSpaceUpMode(mode);
  controlPanel.setActiveUpMode(mode);
}

/** Switching the Scene changes ONLY which body is fixed at the world
 *  origin (see earthBase.setOrbitPosition in the render loop) - every
 *  layer's own visibility/distance/size state is untouched, so there is no
 *  carry-over logic needed here at all. */
function switchScene(id: SceneId): void {
  if (id === activeScene) return;
  activeScene = id;
  controlPanel.setActiveScene(id);
  applyEarthOrbitPathVisibility();
}

/** Snaps Earth's CURRENT rotation (not just the date) so the sun sits
 *  exactly at the horizon, at the bearing matching the placed henge's own
 *  alignment stone for this event - reuses the EXACT same
 *  sunHorizonAzimuths call hengeLayout.ts used to place that stone, so the
 *  found rotation is guaranteed to line up with it, not just "some"
 *  sunrise/sunset. No-op if no henge has been placed yet (nothing to align
 *  with) or if the event doesn't occur there that day (polar day/night -
 *  see sunHorizonAzimuths' own contract). */
function snapRotationToStonehengeAlignment(day: SimulationTime, declinationDeg: number, useSunsetAzimuth: boolean): void {
  const placed = stonehenge.getPlacedLatLon();
  if (!placed) return;

  const horizonEvent = sunHorizonAzimuths(placed.latDeg, declinationDeg);
  if (horizonEvent.kind !== "normal") return;
  const targetAzimuthDeg = useSunsetAzimuth ? horizonEvent.sunsetAzimuthDeg : horizonEvent.sunriseAzimuthDeg;

  const state = getActiveModel().getState(day);
  const sunEcliptic = state.bodies[BodyIds.Sun].position;
  const earthEcliptic = state.bodies[BodyIds.Earth].position;
  const sunWorldDir = new THREE.Vector3(
    sunEcliptic.x - earthEcliptic.x,
    sunEcliptic.y - earthEcliptic.y,
    sunEcliptic.z - earthEcliptic.z,
  );
  const sunWorldDirRotated = eclipticToWorld(sunWorldDir);
  const sunDir = new THREE.Vector3(sunWorldDirRotated.x, sunWorldDirRotated.y, sunWorldDirRotated.z).normalize();

  const theta = findRotationForHorizonAzimuth(earthBase.tiltGroup.quaternion, sunDir, placed.latDeg, placed.lonDeg, targetAzimuthDeg);
  if (theta !== undefined) earthBase.rotationGroup.rotation.y = theta;
}

const panelConfig: ControlPanelConfig = {
  scene: {
    entries: [
      { id: "heliocentric", label: "Heliocentric" },
      { id: "geocentric", label: "Geocentric" },
    ],
    activeId: activeScene,
    onSwitchActive: (id) => switchScene(id as SceneId),
  },
  presets: {
    presets: SCENE_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      onApply: () => {
        if (preset.scene) switchScene(preset.scene);
        if (preset.skyRadius !== undefined) setSkyRadius(preset.skyRadius);
        if (preset.sunDistanceRadii !== undefined) setSunDistanceRadii(preset.sunDistanceRadii);
        if (preset.moonDistanceRadii !== undefined) setMoonDistanceRadii(preset.moonDistanceRadii);
        layers.show(preset.layers);
        if (preset.cameraMode) {
          cameraManager.setMode(preset.cameraMode);
          controlPanel.setActiveCameraMode(preset.cameraMode);
        }
        applyEarthOrbitPathVisibility();
        controlPanel.syncLayerToggles(preset.layers);
        controlPanel.syncSliders({
          skyRadius: preset.skyRadius,
          sunDistanceRadii: preset.sunDistanceRadii,
          moonDistanceRadii: preset.moonDistanceRadii,
        });
      },
    })),
  },
  earth: {
    visible: { checked: true, onChange: (v) => layers.show({ earthBase: v }) },
    continents: { checked: true, onChange: (v) => layers.show({ continents: v }) },
    rotation: { checked: false, onChange: (v) => (earthBase.rotationEnabled = v) },
    axis: { checked: true, onChange: (v) => layers.show({ axis: v }) },
    axialTilt: {
      value: EARTH_AXIAL_TILT_DEG,
      min: 0,
      max: 90,
      step: 0.5,
      onChange: (v) => earthBase.setAxialTilt(v),
    },
    groundScatter: {
      checked: defaultLayerVisibility.groundScatter,
      onChange: (v) => layers.show({ groundScatter: v }),
    },
  },
  stonehenge: {
    visible: {
      checked: defaultLayerVisibility.stonehenge,
      onChange: (v) => layers.show({ stonehenge: v }),
    },
    onPlaceAtObserver: () => {
      const { latDeg, lonDeg } = observerRegistry.getActive().station.getLatLon();
      stonehenge.place(latDeg, lonDeg);
      layers.show({ stonehenge: true });
      controlPanel.syncLayerToggles({ stonehenge: true });
      controlPanel.setStonehengeLocation({ latDeg, lonDeg });
    },
    // Each jump snaps BOTH the date (which day) and Earth's current
    // rotation (which moment within that day) so the sun actually sits at
    // the placed henge's own marker stone, not just somewhere on the
    // correct date - see snapRotationToStonehengeAlignment. All 4 target
    // SUNRISE consistently (last useSunsetAzimuth arg is always false) -
    // hengeLayout.ts's "Winter Solstice Sunrise" stone exists specifically
    // so December has a real sunrise stone to match, alongside the
    // "Winter Solstice Sunset" stone real Stonehenge's own axis uses (still
    // built and visible, just not tied to a jump button). March/September
    // both land on the same due-east "Equinox Sunrise" stone (declination
    // is 0 for both - there's no astronomical difference in WHERE the sun
    // rises between the two equinoxes, only the date differs).
    onJumpToJuneSolstice: () => {
      const day = findSeasonalMarkers(simClock.getElapsedDays()).juneSolstice;
      simClock.setElapsedDays(day);
      snapRotationToStonehengeAlignment(day, EARTH_AXIAL_TILT_DEG, false);
    },
    onJumpToDecemberSolstice: () => {
      const day = findSeasonalMarkers(simClock.getElapsedDays()).decemberSolstice;
      simClock.setElapsedDays(day);
      snapRotationToStonehengeAlignment(day, -EARTH_AXIAL_TILT_DEG, false);
    },
    onJumpToMarchEquinox: () => {
      const day = findSeasonalMarkers(simClock.getElapsedDays()).marchEquinox;
      simClock.setElapsedDays(day);
      snapRotationToStonehengeAlignment(day, 0, false);
    },
    onJumpToSeptemberEquinox: () => {
      const day = findSeasonalMarkers(simClock.getElapsedDays()).septemberEquinox;
      simClock.setElapsedDays(day);
      snapRotationToStonehengeAlignment(day, 0, false);
    },
  },
  sunAndMoon: {
    sun: { checked: true, onChange: (v) => layers.show({ sunMarker: v }) },
    moon: { checked: true, onChange: (v) => layers.show({ moonMarker: v }) },
    sunEclipticPath: { checked: false, onChange: (v) => layers.show({ sunEclipticPath: v }) },
    moonSkyPath: { checked: false, onChange: (v) => layers.show({ moonSkyPath: v }) },
    orbitLines: { checked: false, onChange: (v) => layers.show({ orbitLines: v }) },
    earthOrbitPath: {
      checked: earthOrbitPathVisible,
      onChange: (v) => {
        earthOrbitPathVisible = v;
        applyEarthOrbitPathVisibility();
      },
    },
    sunDistance: {
      value: sunDistanceRadii,
      min: SUN_DISTANCE_MIN_RADII,
      max: SUN_DISTANCE_MAX_RADII,
      step: 5,
      format: (v: number) => `${v} R⊕`,
      onChange: setSunDistanceRadii,
    },
    moonDistance: {
      value: moonDistanceRadii,
      min: MOON_DISTANCE_MIN_RADII,
      max: MOON_DISTANCE_MAX_RADII,
      step: 0.1,
      format: (v: number) => `${v.toFixed(1)} R⊕`,
      onChange: setMoonDistanceRadii,
    },
    sunSize: {
      value: SUN_SIZE_DEFAULT_RADII,
      min: SUN_SIZE_MIN_RADII,
      max: SUN_SIZE_MAX_RADII,
      step: 0.1,
      format: (v: number) => `${v.toFixed(1)} R⊕`,
      onChange: (v: number) => sunMarker.setMarkerSize(EARTH_RADIUS * v),
    },
    moonSize: {
      value: MOON_SIZE_DEFAULT_RADII,
      min: MOON_SIZE_MIN_RADII,
      max: MOON_SIZE_MAX_RADII,
      step: 0.05,
      format: (v: number) => `${v.toFixed(2)} R⊕`,
      onChange: (v: number) => moonMarker.setMarkerSize(EARTH_RADIUS * v),
    },
    moonDarkSideBrightness: {
      value: MOON_DARK_SIDE_BRIGHTNESS_DEFAULT,
      min: MOON_DARK_SIDE_BRIGHTNESS_MIN,
      max: MOON_DARK_SIDE_BRIGHTNESS_MAX,
      step: MOON_DARK_SIDE_BRIGHTNESS_MAX / 100,
      // Percent OF THE SLIDER'S OWN RANGE (not the raw linear value) - 100%
      // always lands at MAX regardless of how that constant gets retuned.
      // See MOON_DARK_SIDE_BRIGHTNESS_MAX's doc comment for why the raw
      // value itself is kept so small (sRGB gamma).
      format: (v: number) => `${Math.round((v / MOON_DARK_SIDE_BRIGHTNESS_MAX) * 100)}%`,
      onChange: (v: number) => moonMarker.setDarkSideBrightness(v),
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
    markersVisible: { checked: observerMarkersVisible, onChange: (v) => layers.show({ observerMarkers: v }) },
    farSideIndicatorVisible: {
      checked: observerFarSideIndicatorEnabled,
      onChange: (v) => layers.show({ observerFarSideIndicator: v }),
    },
    observerToggles: observerRegistry.all().map((entry) => ({
      id: entry.id,
      label: entry.label,
      zenith: { checked: false, onChange: (v: boolean) => layers.show({ [entry.zenith.id]: v }) },
      grid: { checked: false, onChange: (v: boolean) => layers.show({ [entry.altAzGrid.id]: v }) },
    })),
  },
  sky: {
    atmosphereVisible: { checked: true, onChange: (v) => layers.show({ atmosphere: v }) },
    radius: {
      value: skyRadius,
      min: STAR_RADIUS_MIN,
      max: STAR_RADIUS_MAX,
      step: 1,
      onChange: setSkyRadius,
    },
    shellVisible: { checked: false, onChange: (v) => layers.show({ celestialSphereShell: v }) },
    wireframeOpacity: {
      value: CELESTIAL_SPHERE_WIREFRAME_OPACITY_DEFAULT,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (v) => celestialSphereShell.setWireframeOpacity(v),
    },
    onHemisphereModeChange,
    stars: {
      visible: { checked: true, onChange: (v) => layers.show({ stars: v }) },
      limitingMagnitude: {
        value: STARS_DEFAULT.limitingMagnitude,
        min: STAR_LIMITING_MAGNITUDE_MIN,
        max: STAR_LIMITING_MAGNITUDE_MAX,
        step: 0.1,
        onChange: (v) => stars.setLimitingMagnitude(v),
      },
      brightness: {
        value: STARS_DEFAULT.brightness,
        min: 0.1,
        max: 1,
        step: 0.05,
        onChange: (v) => stars.setBrightness(v),
      },
      size: { value: STARS_DEFAULT.size, min: 0.25, max: 4, step: 0.25, onChange: (v) => stars.setSize(v) },
      opacity: {
        value: STARS_DEFAULT.opacity,
        min: 0.1,
        max: 1,
        step: 0.05,
        onChange: (v) => stars.setOpacity(v),
      },
    },
    constellationLines: { checked: false, onChange: (v) => layers.show({ constellationLines: v }) },
    constellationNames: { checked: false, onChange: (v) => layers.show({ constellationNames: v }) },
  },
  camera: {
    viewModes,
    onCameraModeChange: switchCameraMode,
    upMode: {
      entries: [
        { id: CameraUpMode.Equatorial, label: "North Up" },
        { id: CameraUpMode.Ecliptic, label: "Ecliptic Up" },
      ],
      activeId: CameraUpMode.Equatorial,
      onSwitchActive: switchCameraUpMode,
    },
    onClearTarget: () => {
      setAnchorBody(undefined);
      setLookAtBody(undefined);
    },
    reticles: {
      checked: defaultLayerVisibility.targetReticles,
      onChange: (v) => layers.show({ targetReticles: v }),
    },
    minimapVisible: {
      checked: minimapManuallyVisible,
      onChange: (v) => (minimapManuallyVisible = v),
    },
    minimapOpacity: {
      value: MINIMAP_OPACITY_DEFAULT,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (v) => minimapHud.setOpacity(v),
    },
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
    currentDate: simulationDayToDate(getSimulationTime()),
    onSelectDate: (date) => simClock.setElapsedDays(dateToSimulationDay(date)),
  },
};

controlPanel = new ControlPanel(container, panelConfig);
controlPanel.setActiveCameraMode(CameraMode.Space);
const timeHud = new TimeHud(container);
const minimapHud = new MinimapHud(container);

new StarPicker(
  () => cameraManager.getActiveCamera(),
  renderer.domElement,
  [stars],
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

  const universeState = getActiveModel().getState(getSimulationTime());

  // Geocentric: Earth stays fixed at the world origin (every other system's
  // assumption). Heliocentric: Earth's whole rig moves to its real position
  // relative to a Sun fixed at the origin, using the SAME distance scale
  // sunMarker's own Earth-relative offset uses - see sunMarker's doc
  // comment for why that makes the Sun always render at the origin here.
  earthBase.setOrbitPosition(
    activeScene === "heliocentric"
      ? getEarthDiagramPosition(universeState, (EARTH_RADIUS * sunDistanceRadii) / EARTH_ORBIT_RADIUS)
      : { x: 0, y: 0, z: 0 },
  );

  // Real day/night terminator: the key light always comes from the active
  // Scene's actual current Sun direction. keyLight is parented under
  // earthBase.object3D, so this position is LOCAL to wherever Earth
  // currently is - the model's own coordinate origin does NOT always
  // coincide with Earth either way, so this must use the RELATIVE vector
  // (Sun - Earth), exactly like GroundObserver.getDirectionTo.
  //
  // eclipticToWorld is REQUIRED here: models express position in the
  // ecliptic frame (Y = ecliptic pole), but Earth's real geography spins
  // around the TILTED celestial-pole axis (world +Y, see EarthBase).
  const sunBody = universeState.bodies[BodyIds.Sun];
  const earthBody = universeState.bodies[BodyIds.Earth];
  const sunDirectionWorld = eclipticToWorld({
    x: sunBody.position.x - earthBody.position.x,
    y: sunBody.position.y - earthBody.position.y,
    z: sunBody.position.z - earthBody.position.z,
  });
  sunLightDirection.set(sunDirectionWorld.x, sunDirectionWorld.y, sunDirectionWorld.z).normalize();
  keyLight.position.copy(sunLightDirection).multiplyScalar(EARTH_RADIUS * 20);
  continents.setSunDirection(sunLightDirection);
  // Sun-Earth direction reused directly for the Moon's own phase shading
  // (see OrbitingBodyMarkerLayer.setDarkSideLightDirection) - Earth-Moon
  // distance is negligible next to Earth-Sun distance, so the Sun-Moon
  // direction is imperceptibly different from this, same approximation the
  // Moon's lighting already relied on via the shared scene keyLight before.
  moonMarker.setDarkSideLightDirection(sunLightDirection);

  const observerUp = getActiveObserver().getFrame().up;
  const groundViewActive = cameraManager.getMode() === CameraMode.Ground;
  atmosphere.updateSky(sunLightDirection, observerUp, groundViewActive);
  const skyFadeFactor = atmosphere.getFadeFactor();
  stars.setDayNightFactor(skyFadeFactor);
  // Fade the Moon into the sky as it brightens - the dark side fully
  // (vanishes against blue sky), the lit side only partially (reads as
  // faint, the way a real daytime moon does) - see
  // OrbitingBodyMarkerLayer.setSkyBlend's doc comment. Uses getFadeFactor
  // (not getDayFactor) so this also fully kicks in right at the sunset/
  // sunrise transition, not just once the sun is comfortably above the
  // horizon - see AtmosphereLayer.getFadeFactor's doc comment.
  moonMarker.setSkyBlend(atmosphere.getColor(), skyFadeFactor);

  const activeLatLon = observerRegistry.getActive().station.getLatLon();
  controlPanel.setObserverLatLon(activeLatLon.latDeg, activeLatLon.lonDeg);
  timeHud.update(simulationDayToDate(universeState.time), simClock.timeSpeed, simClock.paused);
  // Internally a no-op unless the active observer has moved past
  // GroundScatterLayer's own REGEN_THRESHOLD since the last rebuild - cheap
  // enough to call unconditionally every frame.
  groundScatter.regenerateAround(activeLatLon.latDeg, activeLatLon.lonDeg);

  const minimapVisible = groundViewActive && minimapManuallyVisible;
  minimapHud.setVisible(minimapVisible);
  if (minimapVisible) {
    const activeObserverId = observerRegistry.getActiveId();
    minimapHud.update(
      observerRegistry.all().map((entry) => {
        const { latDeg, lonDeg } = entry.station.getLatLon();
        return { latDeg, lonDeg, color: entry.color, active: entry.id === activeObserverId };
      }),
    );
  }

  const camera = cameraManager.getActiveCamera();
  cameraDirection.copy(camera.position).normalize();
  celestialSphereShell.updateHemisphereFade(cameraDirection);
  stars.updateHemisphereFade(cameraDirection);

  renderer.render(scene, camera);
});
