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
import { ConstellationLinesLayer } from "./layers/sky/ConstellationLinesLayer";
import { ConstellationLabelsLayer } from "./layers/sky/ConstellationLabelsLayer";
import { OrbitLineLayer } from "./layers/sky/OrbitLineLayer";
import { SkyPathLineLayer } from "./layers/sky/SkyPathLineLayer";
import { ModernHeliocentricModel } from "./astronomy/models/ModernHeliocentricModel";
import { GeocentricModel } from "./astronomy/models/GeocentricModel";
import { AstronomyModelRegistry } from "./astronomy/AstronomyModelRegistry";
import { BodyIds, type AstronomyModel } from "./astronomy/types";
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
import { SCENE_PRESETS } from "./ui/scenePresets";
import { StarPicker } from "./interaction/StarPicker";
import { SelectedStarMarker } from "./interaction/SelectedStarMarker";
import { ObserverDragHandler } from "./interaction/ObserverDragHandler";
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
  OBSERVER_COLORS,
  OBSERVER_GRID_RADIUS,
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
// Every registered AstronomyModel is permanently, independently addressable
// - there is no single "active" model anymore (see AstronomyModelRegistry).
// Each model gets its OWN explanatory-globe diagram (Sun/Moon markers +
// orbit lines, built below by buildModelDiagram), toggled fully
// independently, so both models' pictures can be inspected side by side.
//
// Ground View's sky and the day/night terminator lighting still need
// exactly ONE model to read from (you can't stand under two skies at once)
// - they read from `groundModel` below. Since the two models are PROVEN to
// produce identical apparent-sky positions (see modelEquivalence.test.ts
// and GeocentricModel's doc comment), which model that is doesn't change
// what's observed - "heliocentric" is picked arbitrarily, fixed, not
// user-switchable. This is the seam a future model-space rewire (Sun fixed
// with Earth's orbit line, instead of everything staying Earth-centered)
// will replace with something that actually depends on where you're
// standing/traveling to.
const modelRegistry = new AstronomyModelRegistry();
modelRegistry.add({ id: "heliocentric", label: "Heliocentric", model: new ModernHeliocentricModel() });
modelRegistry.add({ id: "geocentric", label: "Geocentric", model: new GeocentricModel() });
const groundModel = modelRegistry.get("heliocentric")!.model;

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
// drag-to-place, and Ground View's camera attachment all follow whichever
// one is active, via getActiveObserver() below, never a fixed reference.
// Pins render for every entry simultaneously; each entry's zenith/alt-az
// grid ALSO render independently of which one is "active" - see
// createObserverEntry, which binds each pair to that specific observer
// (never getActiveObserver), exactly like buildModelDiagram binds each
// model's diagram to a fixed model instead of getActiveModel.
const observerRegistry = new ObserverRegistry();
let observerMarkersVisible = true;
let nextObserverNumber = 1;

function createObserverEntry(id: string, label: string, latDeg: number, lonDeg: number, colorIndex: number): ObserverEntry {
  const station = new ObserverStation(earthBase.rotationGroup, { id, label, latDeg, lonDeg });
  const observer = new GroundObserver(id, station.object3D);
  const color = OBSERVER_COLORS[colorIndex % OBSERVER_COLORS.length];
  const marker = new ObserverMarker(id, label, () => observer.getFrame().worldPosition, { color });
  marker.setVisible(observerMarkersVisible);
  scene.add(marker.object3D);

  const zenithSky = new ZenithLayer({
    id: `${id}ZenithSky`,
    label: `${label} Zenith (sky)`,
    radius: CELESTIAL_SPHERE_RADIUS,
    getActiveObserver: () => observer,
  });
  const zenithGlobe = new ZenithLayer({
    id: `${id}ZenithGlobe`,
    label: `${label} Zenith (globe)`,
    radius: CELESTIAL_GLOBE_RADIUS,
    getActiveObserver: () => observer,
  });
  const altAzGridSky = new AltAzGridLayer({
    id: `${id}AltAzGridSky`,
    label: `${label} Alt/Az Grid (sky)`,
    radius: CELESTIAL_SPHERE_RADIUS,
    getActiveObserver: () => observer,
  });
  const altAzGridGlobe = new AltAzGridLayer({
    id: `${id}AltAzGridGlobe`,
    label: `${label} Alt/Az Grid (globe)`,
    radius: OBSERVER_GRID_RADIUS,
    getActiveObserver: () => observer,
  });
  const zenith = new CompositeLayer(`${id}Zenith`, `${label} Zenith`, "Sky.Interpretation", [zenithSky, zenithGlobe]);
  const altAzGrid = new CompositeLayer(`${id}AltAzGrid`, `${label} Alt/Az Grid`, "Sky.Interpretation", [altAzGridSky, altAzGridGlobe]);

  layers.register(zenith);
  layers.register(zenithSky);
  layers.register(zenithGlobe);
  layers.register(altAzGrid);
  layers.register(altAzGridSky);
  layers.register(altAzGridGlobe);
  scene.add(zenithSky.object3D, zenithGlobe.object3D, altAzGridSky.object3D, altAzGridGlobe.object3D);
  layers.show({ [zenith.id]: false, [altAzGrid.id]: false });

  return { id, label, station, observer, marker, zenithSky, zenithGlobe, zenith, altAzGridSky, altAzGridGlobe, altAzGrid };
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

// Only "western" ships today, but this flattens whichever cultures exist -
// see constellationCatalog.ts's ConstellationCulture. Independent of the
// star toggles above: resolved once against the shared STAR_CATALOG at
// load (not derived from what's currently drawn), so turning stars off
// never destroys this, and turning this off never touches stars.
const ALL_CONSTELLATIONS = RESOLVED_CONSTELLATION_CULTURES.flatMap((culture) => culture.constellations);

// Sky-tier and globe-tier each get their own independent checkbox (no
// fusing CompositeLayer, unlike Sun/Moon) - unlike a body marker, "show
// constellations in the immersive sky" and "show constellations on the
// small explanatory globe" are genuinely separate teaching choices someone
// may want on one at a time, not one concept rendered at two scales.
const constellationLinesSky = new ConstellationLinesLayer({
  id: "constellationLinesSky",
  label: "Constellation Lines (sky)",
  group: "Sky.Observation",
  radius: CELESTIAL_SPHERE_RADIUS,
  constellations: ALL_CONSTELLATIONS,
  getObserver: getActiveObserver,
});
const constellationLinesGlobe = new ConstellationLinesLayer({
  id: "constellationLinesGlobe",
  label: "Constellation Lines (globe)",
  group: "Sky.Geometry",
  radius: CELESTIAL_GLOBE_RADIUS,
  constellations: ALL_CONSTELLATIONS,
});

const constellationNamesSky = new ConstellationLabelsLayer({
  id: "constellationNamesSky",
  label: "Constellation Names (sky)",
  group: "Sky.Observation",
  radius: CELESTIAL_SPHERE_RADIUS,
  constellations: ALL_CONSTELLATIONS,
  getObserver: getActiveObserver,
});
const constellationNamesGlobe = new ConstellationLabelsLayer({
  id: "constellationNamesGlobe",
  label: "Constellation Names (globe)",
  group: "Sky.Geometry",
  radius: CELESTIAL_GLOBE_RADIUS,
  constellations: ALL_CONSTELLATIONS,
});

// The always-on immersive sky markers - single, shared, NOT tied to any
// particular model's explanatory diagram (see buildModelDiagram below).
// Driven by the fixed groundModel, exactly like Ground View's lighting -
// this is "what's actually in today's sky", not "model 1's diagram" or
// "model 2's diagram". observerCentered: true makes these parallax-correct
// from the actual observer position, unlike the globe-tier diagrams below,
// which stay Earth-centered (each is a static external diagram - see
// CelestialSphereShell).
const sunMarkerSky = new CelestialMarkerLayer(BodyIds.Sun, () => groundModel, getActiveObserver, getSimulationTime, {
  id: "sunMarkerSky",
  label: "Sun (sky)",
  color: COLORS.sun,
  radius: CELESTIAL_SPHERE_RADIUS,
  observerCentered: true,
});
const moonMarkerSky = new CelestialMarkerLayer(BodyIds.Moon, () => groundModel, getActiveObserver, getSimulationTime, {
  id: "moonMarkerSky",
  label: "Moon (sky)",
  color: COLORS.moon,
  radius: CELESTIAL_SPHERE_RADIUS,
  observerCentered: true,
  textureUrl: "/textures/moon1.png",
  spinMode: "tidalLocked",
});

// The path each body traces across the immersive sky over one full orbital
// period (the Sun's is literally the ecliptic) - see SkyPathLineLayer's doc
// comment for why this is direction-only (no real eccentricity, unlike
// OrbitLineLayer's globe-tier ellipses) and why it's driven by the same
// fixed groundModel as the sky markers above, not duplicated per model.
const sunEclipticPath = new SkyPathLineLayer({
  id: "sunEclipticPath",
  label: "Sun Ecliptic Path",
  group: "Sky.Observation",
  bodyId: BodyIds.Sun,
  relativeToId: BodyIds.Earth,
  periodDays: EARTH_ORBIT_PERIOD_DAYS,
  getModel: () => groundModel,
  getObserver: getActiveObserver,
  getSimulationTime,
  radius: CELESTIAL_SPHERE_RADIUS,
  color: COLORS.sun,
});
const moonSkyPath = new SkyPathLineLayer({
  id: "moonSkyPath",
  label: "Moon Sky Path",
  group: "Sky.Observation",
  bodyId: BodyIds.Moon,
  relativeToId: BodyIds.Earth,
  periodDays: MOON_ORBIT_PERIOD_DAYS,
  getModel: () => groundModel,
  getObserver: getActiveObserver,
  getSimulationTime,
  radius: CELESTIAL_SPHERE_RADIUS,
  color: COLORS.moon,
});

const celestialSphereShell = new CelestialSphereShell(CELESTIAL_GLOBE_RADIUS);

/**
 * One model's full explanatory-globe diagram: its Sun/Moon markers (real
 * apparent position, Earth-centered) and its real elliptical orbit lines
 * (true eccentricity - see OrbitLineLayer's doc comment). Bound to a FIXED
 * model instance (never a lazily-resolved "active" one), so every model's
 * diagram is permanently, independently toggleable - multiple can be shown
 * at once to compare them directly, which is the whole point of having two
 * models in the first place. orbitRadiusFraction matches between a body's
 * marker and its line so they read as one diagram, exactly as before.
 */
function buildModelDiagram(modelId: string, modelLabel: string, model: AstronomyModel) {
  const sunMarkerGlobe = new CelestialMarkerLayer(BodyIds.Sun, () => model, getActiveObserver, getSimulationTime, {
    id: `${modelId}SunMarkerGlobe`,
    label: `${modelLabel} Sun`,
    color: COLORS.sun,
    radius: CELESTIAL_GLOBE_RADIUS,
    orbitRadiusFraction: SUN_GLOBE_ORBIT_FRACTION,
  });
  const moonMarkerGlobe = new CelestialMarkerLayer(BodyIds.Moon, () => model, getActiveObserver, getSimulationTime, {
    id: `${modelId}MoonMarkerGlobe`,
    label: `${modelLabel} Moon`,
    color: COLORS.moon,
    radius: CELESTIAL_GLOBE_RADIUS,
    orbitRadiusFraction: MOON_GLOBE_ORBIT_FRACTION,
    textureUrl: "/textures/moon1.png",
    spinMode: "tidalLocked",
  });
  const sunOrbitLine = new OrbitLineLayer({
    id: `${modelId}SunOrbitLine`,
    label: `${modelLabel} Sun Orbit`,
    group: "Sky.Geometry",
    bodyId: BodyIds.Sun,
    relativeToId: BodyIds.Earth,
    periodDays: EARTH_ORBIT_PERIOD_DAYS,
    semiMajorAxis: EARTH_ORBIT_RADIUS,
    getModel: () => model,
    getSimulationTime,
    radius: CELESTIAL_GLOBE_RADIUS,
    orbitRadiusFraction: SUN_GLOBE_ORBIT_FRACTION,
    color: COLORS.sun,
  });
  const moonOrbitLine = new OrbitLineLayer({
    id: `${modelId}MoonOrbitLine`,
    label: `${modelLabel} Moon Orbit`,
    group: "Sky.Geometry",
    bodyId: BodyIds.Moon,
    relativeToId: BodyIds.Earth,
    periodDays: MOON_ORBIT_PERIOD_DAYS,
    semiMajorAxis: MOON_ORBIT_RADIUS,
    getModel: () => model,
    getSimulationTime,
    radius: CELESTIAL_GLOBE_RADIUS,
    orbitRadiusFraction: MOON_GLOBE_ORBIT_FRACTION,
    color: COLORS.moon,
  });
  // Fuses this model's two orbit lines under one id/checkbox - "Show Orbital
  // Lines" is one teaching choice per model, not two, exactly like the
  // original shared orbitLines composite before this became per-model.
  const orbitLines = new CompositeLayer(`${modelId}OrbitLines`, `${modelLabel} Orbit Lines`, "Sky.Geometry", [
    sunOrbitLine,
    moonOrbitLine,
  ]);
  return { modelId, modelLabel, sunMarkerGlobe, moonMarkerGlobe, sunOrbitLine, moonOrbitLine, orbitLines };
}

const modelDiagrams = modelRegistry.all().map((entry) => buildModelDiagram(entry.id, entry.label, entry.model));

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
layers.register(constellationLinesSky);
layers.register(constellationLinesGlobe);
layers.register(constellationNamesSky);
layers.register(constellationNamesGlobe);
layers.register(sunMarkerSky);
layers.register(moonMarkerSky);
layers.register(sunEclipticPath);
layers.register(moonSkyPath);
for (const diagram of modelDiagrams) {
  layers.register(diagram.sunMarkerGlobe);
  layers.register(diagram.moonMarkerGlobe);
  layers.register(diagram.orbitLines);
  layers.register(diagram.sunOrbitLine);
  layers.register(diagram.moonOrbitLine);
}
layers.register(celestialSphereShell);
layers.register(observerMarkersLayer);

scene.add(earthBase.object3D);
scene.add(backgroundStars.object3D, celestialSphereStars.object3D);
scene.add(constellationLinesSky.object3D, constellationLinesGlobe.object3D);
scene.add(constellationNamesSky.object3D, constellationNamesGlobe.object3D);
scene.add(sunMarkerSky.object3D, moonMarkerSky.object3D);
scene.add(sunEclipticPath.object3D, moonSkyPath.object3D);
for (const diagram of modelDiagrams) {
  scene.add(diagram.sunMarkerGlobe.object3D, diagram.moonMarkerGlobe.object3D);
  scene.add(diagram.sunOrbitLine.object3D, diagram.moonOrbitLine.object3D);
}
scene.add(celestialSphereShell.object3D);

const selectedStarMarker = new SelectedStarMarker();
scene.add(selectedStarMarker.object3D);

const defaultLayerVisibility: Record<string, boolean> = {
  earthBase: true,
  continents: true,
  axis: true,
  backgroundStars: true,
  celestialSphereStars: false,
  constellationLinesSky: false,
  constellationLinesGlobe: false,
  constellationNamesSky: false,
  constellationNamesGlobe: false,
  sunMarkerSky: true,
  moonMarkerSky: true,
  sunEclipticPath: false,
  moonSkyPath: false,
  celestialSphereShell: false,
  observerMarkers: true,
};
// Both models' diagrams start fully off - neither is "primary" (see
// AstronomyModelRegistry's doc comment), so nobody's marker/orbit-line
// defaults get silently favored over the other's.
for (const diagram of modelDiagrams) {
  defaultLayerVisibility[diagram.sunMarkerGlobe.id] = false;
  defaultLayerVisibility[diagram.moonMarkerGlobe.id] = false;
  defaultLayerVisibility[diagram.orbitLines.id] = false;
}
layers.show(defaultLayerVisibility);

// --- Cameras --------------------------------------------------------------

const cameraManager = new CameraManager(() => observerRegistry.getActive().station.object3D, renderer.domElement);

// Wired in here (not at construction) since CameraManager doesn't exist yet
// when the default observer's marker is created above - see
// ObserverMarker.setCameraPositionGetter's doc comment. addObserver() below
// wires this into every subsequently-created marker too.
const getCameraPosition = () => cameraManager.getActiveCamera().position;
defaultObserverEntry.marker.setCameraPositionGetter(getCameraPosition);

// The globe-scale ("explanatory globe") tier (Sun/Moon globe markers, the
// wireframe shell, and its own star field) is Earth-centered - see
// CelestialSphereShell / CELESTIAL_GLOBE_RADIUS. It used to auto-hide in
// Ground View specifically (standing at EARTH_RADIUS-scale on Earth's
// surface puts you very close to a CELESTIAL_GLOBE_RADIUS-scale diagram, so
// its Sun/Moon/stars show up parallax-shifted from the real sky-tier ones
// right next to them) - but every layer toggle is now unconditionally
// user-controlled in every camera mode, full stop: "everything should be
// toggleable" from anywhere, including the resulting parallax-shifted look
// in Ground View if you choose to turn it on there. See the plan doc/
// conversation history for the earlier, now-removed gating.

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
  constellationLinesGlobe.setRadius(radius);
  constellationNamesGlobe.setRadius(radius);
  for (const diagram of modelDiagrams) {
    diagram.sunMarkerGlobe.setRadius(radius);
    diagram.moonMarkerGlobe.setRadius(radius);
    diagram.sunOrbitLine.setRadius(radius);
    diagram.moonOrbitLine.setRadius(radius);
  }
  // altAzGridGlobe deliberately excluded - see OBSERVER_GRID_RADIUS's own
  // doc comment, it has its own independent scale.
  for (const entry of observerRegistry.all()) {
    entry.zenithGlobe.setRadius(radius);
  }
};

// --- Observer movement ------------------------------------------------
// WASD (Ground View) and drag-to-place (Space/Celestial Sphere View) both
// act on whichever observer is currently active - see getActiveObserver.
const groundMoveControls = new GroundMoveControls(
  () => observerRegistry.getActive().station,
  () => cameraManager.getActiveCamera(),
);

// Direct-manipulation drag-to-place: hover any observer's pin (in any
// camera mode, including Ground View now) for a hand cursor, then drag it -
// no separate "arm" checkbox. WASD (GroundMoveControls) still works
// alongside it in Ground View, as a complementary way to move the active
// observer specifically. Dragging suspends the active camera rig's own
// pointer interaction for its duration (see GroundCameraRig/OrbitCameraRig
// setInteractionEnabled) since both are pointer-drag gestures on the same
// element and would otherwise fight over the same event; hovering alone
// does not suspend anything, only picking up a marker does.
new ObserverDragHandler(
  () => cameraManager.getActiveCamera(),
  renderer.domElement,
  earthBase.mesh,
  earthBase.rotationGroup,
  () => observerRegistry.all(),
  (hovering) => {
    // Only actively claims the cursor while hovering - doesn't reset it on
    // hover-out, since that would clobber whichever camera rig's own idle
    // cursor is meant to be showing instead (see ObserverDragHandler and
    // the matching OrbitCameraRig/GroundCameraRig setInteractionEnabled
    // cursor-reclaim pattern this mirrors).
    if (hovering) renderer.domElement.style.cursor = "pointer";
  },
  (dragging) => {
    cameraManager.setPlacementModeActive(dragging);
    if (dragging) renderer.domElement.style.cursor = "grabbing";
  },
);

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
        controlPanel.syncLayerToggles(preset.layers);
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
    models: modelDiagrams.map((diagram) => ({
      id: diagram.modelId,
      label: diagram.modelLabel,
      sun: { checked: false, onChange: (v: boolean) => layers.show({ [diagram.sunMarkerGlobe.id]: v }) },
      moon: { checked: false, onChange: (v: boolean) => layers.show({ [diagram.moonMarkerGlobe.id]: v }) },
      orbitLines: { checked: false, onChange: (v: boolean) => layers.show({ [diagram.orbitLines.id]: v }) },
    })),
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
    // One row per observer, independently toggleable regardless of which is
    // "active" - see ObserverRegistry's doc comment and createObserverEntry.
    // Unlike Sun/Moon's globe-tier markers, Zenith/AltAzGrid are always
    // observer-centered (see ZenithLayer/AltAzGridLayer) - the globe-tier
    // instance is centered on wherever that observer actually is, so
    // there's no off-center parallax distortion to guard against by
    // restricting it to the external Celestial Sphere camera. Both tiers
    // toggle freely in any camera mode, letting the small globe-scale grid
    // be superimposed over Ground/Space View too.
    observerToggles: observerRegistry.all().map((entry) => ({
      id: entry.id,
      label: entry.label,
      zenith: { checked: false, onChange: (v: boolean) => layers.show({ [entry.zenith.id]: v }) },
      grid: { checked: false, onChange: (v: boolean) => layers.show({ [entry.altAzGrid.id]: v }) },
    })),
  },
  sunMoon: {
    sun: { checked: true, onChange: (v) => layers.show({ sunMarkerSky: v }) },
    moon: { checked: true, onChange: (v) => layers.show({ moonMarkerSky: v }) },
    sunEclipticPath: { checked: false, onChange: (v) => layers.show({ sunEclipticPath: v }) },
    moonSkyPath: { checked: false, onChange: (v) => layers.show({ moonSkyPath: v }) },
  },
  celestialSphere: {
    visible: { checked: false, onChange: (v) => layers.show({ celestialSphereShell: v }) },
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
      visible: { checked: false, onChange: (v) => layers.show({ celestialSphereStars: v }) },
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
  constellations: {
    linesSky: { checked: false, onChange: (v) => layers.show({ constellationLinesSky: v }) },
    linesGlobe: { checked: false, onChange: (v) => layers.show({ constellationLinesGlobe: v }) },
    namesSky: { checked: false, onChange: (v) => layers.show({ constellationNamesSky: v }) },
    namesGlobe: { checked: false, onChange: (v) => layers.show({ constellationNamesGlobe: v }) },
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

  // Real day/night terminator: the key light always comes from groundModel's
  // actual current Sun direction (see groundModel's own doc comment above -
  // fixed, not switchable). Earth's mesh sits at the world origin regardless
  // of model (see EarthBase), but the model's own coordinate origin does NOT
  // always coincide with Earth - Heliocentric puts the Sun near origin and
  // moves Earth, Geocentric does the opposite - so this must use the
  // RELATIVE vector (Sun - Earth), exactly like GroundObserver.
  // getDirectionTo, not either absolute position alone. DirectionalLight
  // only cares about direction, not distance, but a position far outside
  // Earth keeps the math the same shape as a real light source.
  const universeState = groundModel.getState(getSimulationTime());
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
