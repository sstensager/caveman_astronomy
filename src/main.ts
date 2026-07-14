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
import { OrbitingBodyMarkerLayer } from "./layers/sky/OrbitingBodyMarkerLayer";
import { ModernHeliocentricModel } from "./astronomy/models/ModernHeliocentricModel";
import { GeocentricModel } from "./astronomy/models/GeocentricModel";
import { AstronomyModelRegistry } from "./astronomy/AstronomyModelRegistry";
import { BodyIds, type AstronomyModel } from "./astronomy/types";
import { getEarthDiagramPosition, getMoonDiagramPosition, getMoonOffsetFromEarth, getSunOffsetFromEarth } from "./astronomy/solarSystemDiagram";
import { eclipticToWorld } from "./astronomy/frames";
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
import { RenderCenter } from "./cameras/RenderCenter";
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
  CELESTIAL_MARKER_SIZE_RATIO,
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
  CENTER_SUN_EARTH_DISTANCE_DEFAULT_RADII,
  CENTER_SUN_EARTH_DISTANCE_MIN_RADII,
  CENTER_SUN_EARTH_DISTANCE_MAX_RADII,
  CENTER_SUN_MOON_DISTANCE_DEFAULT_RADII,
  CENTER_SUN_MOON_DISTANCE_MIN_RADII,
  CENTER_SUN_MOON_DISTANCE_MAX_RADII,
  CENTER_SUN_SUN_SIZE_DEFAULT_RADII,
  CENTER_SUN_SUN_SIZE_MIN_RADII,
  CENTER_SUN_SUN_SIZE_MAX_RADII,
  CENTER_SUN_MOON_SIZE_DEFAULT_RADII,
  CENTER_SUN_MOON_SIZE_MIN_RADII,
  CENTER_SUN_MOON_SIZE_MAX_RADII,
  CENTER_EARTH_SUN_DISTANCE_DEFAULT_RADII,
  CENTER_EARTH_SUN_DISTANCE_MIN_RADII,
  CENTER_EARTH_SUN_DISTANCE_MAX_RADII,
  CENTER_EARTH_MOON_DISTANCE_DEFAULT_RADII,
  CENTER_EARTH_MOON_DISTANCE_MIN_RADII,
  CENTER_EARTH_MOON_DISTANCE_MAX_RADII,
  CENTER_EARTH_SUN_SIZE_DEFAULT_RADII,
  CENTER_EARTH_SUN_SIZE_MIN_RADII,
  CENTER_EARTH_SUN_SIZE_MAX_RADII,
  CENTER_EARTH_MOON_SIZE_DEFAULT_RADII,
  CENTER_EARTH_MOON_SIZE_MIN_RADII,
  CENTER_EARTH_MOON_SIZE_MAX_RADII,
  EARTH_CENTERED_SUN_MARKER_SIZE,
  EARTH_CENTERED_MOON_MARKER_SIZE,
  OBSERVER_COLORS,
  OBSERVER_GRID_RADIUS,
  REAL_MOON_MARKER_SIZE,
  REAL_SUN_MARKER_SIZE,
  SOLAR_SYSTEM_DIAGRAM_OFFSET,
  SOLAR_SYSTEM_DIAGRAM_RADIUS,
  SOLAR_SYSTEM_EARTH_ORBIT_SCALE,
  SOLAR_SYSTEM_MOON_ORBIT_SCALE,
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
// direction (see the render loop below), not fixed here. keyLight itself
// isn't added to the scene until earthBase exists further down - see the
// comment there for why it's parented under earthBase.object3D rather than
// scene directly. Lowered from 0.25 - the night side used to read as a flat
// mid-gray no matter what, which undersold both Earth's own real day/night
// contrast and the new Moon-phase shading (a lit Moon whose "dark" side is
// still 25% bright barely reads as a phase at all). Still not zero - a
// LITTLE ambient fill keeps the unlit hemisphere findable rather than
// pure black, useful for locating things in Ground View at night.
scene.add(new THREE.AmbientLight(0xffffff, 0.06));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);

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
// Whether an occluded (far-side) marker draws the chevron indicator at all,
// vs. staying hidden until it rotates back into view - see
// ObserverMarker.setFarSideIndicatorEnabled and observerFarSideIndicatorLayer
// below. Independent of observerMarkersVisible, which hides markers outright.
let observerFarSideIndicatorEnabled = true;
let nextObserverNumber = 1;

function createObserverEntry(id: string, label: string, latDeg: number, lonDeg: number, colorIndex: number): ObserverEntry {
  const station = new ObserverStation(earthBase.rotationGroup, { id, label, latDeg, lonDeg });
  const observer = new GroundObserver(id, station.object3D);
  const color = OBSERVER_COLORS[colorIndex % OBSERVER_COLORS.length];
  const marker = new ObserverMarker(id, label, () => observer.getFrame().worldPosition, {
    color,
    getEarthCenter: () => earthBase.object3D.getWorldPosition(new THREE.Vector3()),
  });
  marker.setVisible(observerMarkersVisible);
  marker.setFarSideIndicatorEnabled(observerFarSideIndicatorEnabled);
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
  lit: true,
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
    lit: true,
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

/**
 * A THIRD, separate display tier (alongside "sky" and "globe") showing TRUE
 * model-space relative motion: the Sun fixed at this diagram's own center,
 * Earth actually orbiting it in its real eccentric-ellipse shape, the Moon
 * looping around Earth's current (moving) position - unlike buildModelDiagram
 * above, whose Sun/Moon markers stay Earth-centered (Earth never moves
 * there; only apparent direction from Earth is shown). Lives in its own
 * offset THREE.Group (SOLAR_SYSTEM_DIAGRAM_OFFSET) so its Sun-at-center
 * marker doesn't collide with the real EarthBase mesh or the origin-centered
 * globe diagram, both permanently at the world origin.
 *
 * Every position here is computed the SAME way OrbitLineLayer's ellipses
 * already are - eclipticToWorld(subVectors(bodyPos, referenceBodyPos)),
 * scaled - never a bespoke shortcut. Earth's position is Earth-relative-to-
 * Sun, which is exactly the negation of the Sun-relative-to-Earth vector
 * that's already proven model-agnostic (see modelEquivalence.test.ts and
 * GeocentricModel's doc comment on the mirror trick) - so Earth's diagram
 * position is provably identical whichever model computes it. The Moon's
 * position composes two such proven-model-agnostic relative vectors
 * (Earth-from-Sun, then Moon-from-Earth), so the composition is too.
 *
 * Built once per registered model (like buildModelDiagram), all sharing the
 * SAME world offset - since the underlying math is model-agnostic, both
 * models' diagrams are meant to exactly coincide when shown together, same
 * as the existing globe-tier diagrams already do.
 */
function buildSolarSystemDiagram(modelId: string, modelLabel: string, model: AstronomyModel) {
  const group = new THREE.Group();
  group.name = `SolarSystemDiagram.${modelId}`;
  group.position.set(SOLAR_SYSTEM_DIAGRAM_OFFSET.x, SOLAR_SYSTEM_DIAGRAM_OFFSET.y, SOLAR_SYSTEM_DIAGRAM_OFFSET.z);

  // Shared scale constants (config/constants.ts) - also used by the
  // "Center: Sun" render mode below, so both stay in sync by construction.
  const earthOrbitScale = SOLAR_SYSTEM_EARTH_ORBIT_SCALE;
  const moonOrbitScale = SOLAR_SYSTEM_MOON_ORBIT_SCALE;

  const sunMarker = new OrbitingBodyMarkerLayer({
    id: `${modelId}SolarSystemSun`,
    label: `${modelLabel} Solar System Sun`,
    group: "Sky.Geometry",
    color: COLORS.sun,
    markerSize: SOLAR_SYSTEM_DIAGRAM_RADIUS * CELESTIAL_MARKER_SIZE_RATIO * 3,
    getPosition: () => ({ x: 0, y: 0, z: 0 }),
  });
  const earthMarker = new OrbitingBodyMarkerLayer({
    id: `${modelId}SolarSystemEarth`,
    label: `${modelLabel} Solar System Earth`,
    group: "Sky.Geometry",
    color: COLORS.earth,
    markerSize: SOLAR_SYSTEM_DIAGRAM_RADIUS * CELESTIAL_MARKER_SIZE_RATIO * 1.5,
    textureUrl: "/textures/earth1.png",
    getPosition: () => getEarthDiagramPosition(model.getState(getSimulationTime()), earthOrbitScale),
  });
  const moonMarker = new OrbitingBodyMarkerLayer({
    id: `${modelId}SolarSystemMoon`,
    label: `${modelLabel} Solar System Moon`,
    group: "Sky.Geometry",
    color: COLORS.moon,
    markerSize: SOLAR_SYSTEM_DIAGRAM_RADIUS * CELESTIAL_MARKER_SIZE_RATIO * 0.7,
    textureUrl: "/textures/moon1.png",
    getPosition: () => getMoonDiagramPosition(model.getState(getSimulationTime()), earthOrbitScale, moonOrbitScale),
  });
  const bodies = new CompositeLayer(`${modelId}SolarSystemBodies`, `${modelLabel} Solar System Bodies`, "Sky.Geometry", [
    sunMarker,
    earthMarker,
    moonMarker,
  ]);

  const earthOrbitLine = new OrbitLineLayer({
    id: `${modelId}SolarSystemEarthPath`,
    label: `${modelLabel} Earth's Orbital Path`,
    group: "Sky.Geometry",
    bodyId: BodyIds.Earth,
    relativeToId: BodyIds.Sun,
    periodDays: EARTH_ORBIT_PERIOD_DAYS,
    semiMajorAxis: EARTH_ORBIT_RADIUS,
    getModel: () => model,
    getSimulationTime,
    radius: SOLAR_SYSTEM_DIAGRAM_RADIUS,
    orbitRadiusFraction: SUN_GLOBE_ORBIT_FRACTION,
    color: COLORS.earth,
  });

  group.add(sunMarker.object3D, earthMarker.object3D, moonMarker.object3D, earthOrbitLine.object3D);

  return { modelId, modelLabel, group, sunMarker, earthMarker, moonMarker, bodies, earthOrbitLine };
}

const solarSystemDiagrams = modelRegistry.all().map((entry) => buildSolarSystemDiagram(entry.id, entry.label, entry.model));

// "Center: Sun Scale" sliders (Camera panel section) - live, independently
// adjustable distance knobs for this mode only, decoupled from the Solar
// System side-diagram's own fixed scale (see config/constants.ts's doc
// comment on CENTER_SUN_EARTH_DISTANCE_DEFAULT_RADII for why). The render
// loop below reads these fresh every frame; marker SIZE changes instead
// call OrbitingBodyMarkerLayer.setMarkerSize() directly from the slider's
// onChange (no per-frame read needed - size doesn't animate on its own).
// Declared HERE (before realMoonMarker below), not near the sliders'
// panelConfig wiring further down - OrbitingBodyMarkerLayer's constructor
// calls getPosition() immediately (via recompute()), so a `let` declared
// later in the file would throw a temporal-dead-zone ReferenceError the
// instant the page loads, not just whenever the slider first moves.
let centerSunEarthDistanceRadii = CENTER_SUN_EARTH_DISTANCE_DEFAULT_RADII;
let centerSunMoonDistanceRadii = CENTER_SUN_MOON_DISTANCE_DEFAULT_RADII;

// Master switch for THIS mode's real Sun+Moon pair (realSunMarker/
// realMoonMarker below) - OFF by default, so loading straight into (or
// switching to) Center:Sun doesn't immediately drop a body next to Earth
// unasked. Combined with `renderCenter` in applyRealBodyVisibility (defined
// near switchRenderCenter) - only actually shown when BOTH this is checked
// AND this mode is the active one. Declared here (not near the checkbox's
// panelConfig wiring) for the same TDZ reason as the distance vars above.
let sunCenteredBodiesVisible = false;

// The real Sun, fixed at the world origin - only meaningful/visible in
// "Center: Sun" mode (see RenderCenter.ts), and even then only when
// sunCenteredBodiesVisible above is checked (see applyRealBodyVisibility) -
// not registered in `layers`/LayerRegistry (its checkbox lives in this
// mode's own Scale panel instead, alongside the distance/size sliders it's
// most relevant next to) and never needs update() since its position never
// changes - only setVisible() is ever called on it, from
// applyRealBodyVisibility.
const realSunMarker = new OrbitingBodyMarkerLayer({
  id: "realSunMarker",
  label: "The Sun",
  group: "Sky.Geometry",
  color: COLORS.sun,
  markerSize: REAL_SUN_MARKER_SIZE,
  getPosition: () => ({ x: 0, y: 0, z: 0 }),
});
realSunMarker.setVisible(false);
scene.add(realSunMarker.object3D);

// The real Moon, orbiting close to Earth's own (now-moved) position - same
// visibility rule as realSunMarker above, but parented under
// earthBase.object3D (NOT scene) so its LOCAL position only needs the
// Earth-relative offset (getMoonOffsetFromEarth), not Earth's own absolute
// position too - the parent transform already supplies that, exactly like
// the reparented globe-tier diagram elsewhere in this file. DOES need
// update() every frame (the Moon actually orbits, unlike the fixed Sun) -
// called explicitly from the render loop's Center:Sun branch below, not
// registered in `layers`, for the same reason realSunMarker isn't.
const realMoonMarker = new OrbitingBodyMarkerLayer({
  id: "realMoonMarker",
  label: "The Moon",
  group: "Sky.Geometry",
  color: COLORS.moon,
  markerSize: REAL_MOON_MARKER_SIZE,
  textureUrl: "/textures/moon1.png",
  lit: true,
  // Reads the LIVE, slider-adjustable distance (declared just above) each
  // time this is called, not the side-diagram's fixed
  // SOLAR_SYSTEM_MOON_ORBIT_SCALE - see that constant's doc comment.
  getPosition: () =>
    getMoonOffsetFromEarth(groundModel.getState(getSimulationTime()), (EARTH_RADIUS * centerSunMoonDistanceRadii) / MOON_ORBIT_RADIUS),
});
realMoonMarker.setVisible(false);
earthBase.object3D.add(realMoonMarker.object3D);

// "Center: Earth" mode's own scale state - the mirror image of the two
// above. Same TDZ reasoning: must be declared before
// earthCenteredSunMarker/earthCenteredMoonMarker's construction, not near
// their sliders' panelConfig wiring.
let centerEarthSunDistanceRadii = CENTER_EARTH_SUN_DISTANCE_DEFAULT_RADII;
let centerEarthMoonDistanceRadii = CENTER_EARTH_MOON_DISTANCE_DEFAULT_RADII;

// Mirror image of sunCenteredBodiesVisible above, for this mode's own
// Sun+Moon pair - also OFF by default. Earth mode being the app's DEFAULT
// active mode is exactly why this matters most here: without this, the
// Earth-centered Moon marker used to render right next to Earth on first
// load, before the user asked for it.
let earthCenteredBodiesVisible = false;

// "Center: Earth" mode's own real Sun, truly orbiting the fixed Earth with
// real elliptical distance - unlike the existing globe/sky-tier Sun
// markers (sunMarkerGlobe/sunMarkerSky), which are direction-only at a
// fixed fraction-of-radius distance. Only visible in Center:Earth mode AND
// when earthCenteredBodiesVisible is checked (see applyRealBodyVisibility) -
// the mirror image of realSunMarker, but THIS Sun moves (Earth stays
// fixed) so it DOES need per-frame update(), called from the render
// loop's new Center:Earth branch below. Parented under earthBase.object3D
// for consistency with realMoonMarker even though Earth never moves in
// this mode (so local == world here).
const earthCenteredSunMarker = new OrbitingBodyMarkerLayer({
  id: "earthCenteredSunMarker",
  label: "The Sun (Earth-centered)",
  group: "Sky.Geometry",
  color: COLORS.sun,
  markerSize: EARTH_CENTERED_SUN_MARKER_SIZE,
  getPosition: () =>
    getSunOffsetFromEarth(groundModel.getState(getSimulationTime()), (EARTH_RADIUS * centerEarthSunDistanceRadii) / EARTH_ORBIT_RADIUS),
});
earthCenteredSunMarker.setVisible(false);
earthBase.object3D.add(earthCenteredSunMarker.object3D);

// "Center: Earth" mode's own real Moon - same real-distance treatment,
// fully independent scale from realMoonMarker's (Center:Sun mode's) own
// Moon distance/size, per this session's established decoupling pattern.
const earthCenteredMoonMarker = new OrbitingBodyMarkerLayer({
  id: "earthCenteredMoonMarker",
  label: "The Moon (Earth-centered)",
  group: "Sky.Geometry",
  color: COLORS.moon,
  markerSize: EARTH_CENTERED_MOON_MARKER_SIZE,
  textureUrl: "/textures/moon1.png",
  lit: true,
  getPosition: () =>
    getMoonOffsetFromEarth(groundModel.getState(getSimulationTime()), (EARTH_RADIUS * centerEarthMoonDistanceRadii) / MOON_ORBIT_RADIUS),
});
earthCenteredMoonMarker.setVisible(false);
earthBase.object3D.add(earthCenteredMoonMarker.object3D);

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

// Same fan-out pattern as observerMarkersLayer above, but for the far-side
// chevron indicator rather than marker visibility itself - see
// ObserverMarker.setFarSideIndicatorEnabled's doc comment.
const observerFarSideIndicatorLayer: Layer = {
  id: "observerFarSideIndicator",
  label: "Show Far-Side Indicator (chevron)",
  group: "Earth.Teaching",
  setVisible: (visible: boolean) => {
    observerFarSideIndicatorEnabled = visible;
    observerRegistry.all().forEach((entry) => entry.marker.setFarSideIndicatorEnabled(visible));
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
for (const diagram of solarSystemDiagrams) {
  layers.register(diagram.bodies);
  layers.register(diagram.sunMarker);
  layers.register(diagram.earthMarker);
  layers.register(diagram.moonMarker);
  layers.register(diagram.earthOrbitLine);
}
layers.register(celestialSphereShell);
layers.register(observerMarkersLayer);
layers.register(observerFarSideIndicatorLayer);

scene.add(earthBase.object3D);
scene.add(backgroundStars.object3D);
scene.add(constellationLinesSky.object3D);
scene.add(constellationNamesSky.object3D);
scene.add(sunMarkerSky.object3D, moonMarkerSky.object3D);
scene.add(sunEclipticPath.object3D, moonSkyPath.object3D);
for (const diagram of solarSystemDiagrams) {
  scene.add(diagram.group);
}
// Everything below is the Earth-CENTERED "explanatory globe" tier (small
// diagram wrapped snugly around Earth - see README's "Dual-tier display")
// - parented under earthBase.object3D (the orbitGroup), NOT scene, so it
// moves rigidly with Earth in "Center: Sun" mode instead of staying behind
// at the old origin. Their own position math (CelestialMarkerLayer with
// observerCentered:false, OrbitLineLayer's Earth-relative ellipses) was
// always implicitly Earth-relative - this just makes that relationship a
// real parent transform instead of a coincidence of Earth sitting at the
// origin. See RenderCenter.ts / EarthBase.setOrbitPosition.
earthBase.object3D.add(celestialSphereStars.object3D);
earthBase.object3D.add(constellationLinesGlobe.object3D);
earthBase.object3D.add(constellationNamesGlobe.object3D);
for (const diagram of modelDiagrams) {
  earthBase.object3D.add(diagram.sunMarkerGlobe.object3D, diagram.moonMarkerGlobe.object3D);
  earthBase.object3D.add(diagram.sunOrbitLine.object3D, diagram.moonOrbitLine.object3D);
}
earthBase.object3D.add(celestialSphereShell.object3D);

// keyLight (declared near the top of this file, not yet added anywhere) and
// its target are parented under earthBase.object3D too, for the same reason
// as the globe-tier diagram above: the per-frame position formula in the
// render loop below (sunLightDirection * EARTH_RADIUS*20) was always
// implicitly "relative to wherever Earth's center is" - reparenting makes
// that real instead of assumed. keyLight.target defaults to local (0,0,0),
// which is exactly Earth's own mesh center regardless of spin/tilt (both
// pure rotations, not translations) - it never needs to be touched again.
// Without this, the terminator would stay aimed at the old origin once
// "Center: Sun" moves Earth away from it.
earthBase.object3D.add(keyLight, keyLight.target);

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
  // Default OFF now (was on) - Center:Earth mode's own earthCenteredSunMarker/
  // earthCenteredMoonMarker (visible by default, since Center:Earth is the
  // default mode - see switchRenderCenter) are the new default "relevant
  // bodies" and would otherwise clutter the view alongside these
  // direction-only, fixed-distance approximations right out of the box.
  // Still fully manually toggleable - see switchRenderCenter's doc comment
  // for why this is deliberate auto-linking, not permanent removal.
  sunMarkerSky: false,
  moonMarkerSky: false,
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
// Same "neither model favored, start off" reasoning as modelDiagrams above.
for (const diagram of solarSystemDiagrams) {
  defaultLayerVisibility[diagram.bodies.id] = false;
  defaultLayerVisibility[diagram.earthOrbitLine.id] = false;
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

// Which body sits fixed at the world origin - see RenderCenter.ts. Fully
// orthogonal to CameraMode/AstronomyModel (see the class doc comment) -
// deliberately NOT forcing a camera-mode switch here, since Ground View
// keeps working correctly unmodified when Earth moves (its camera is
// parented under the active ObserverStation, which rides along - see
// GroundCameraRig.syncParent). The actual per-frame position update lives
// in the render loop below.
let renderCenter: RenderCenter = RenderCenter.Earth;

/** Each Center mode's own real Sun+Moon pair is only actually shown when
 *  BOTH conditions hold: that mode is the active one AND its own
 *  bodiesVisible checkbox (sunCenteredBodiesVisible/earthCenteredBodiesVisible
 *  above) is checked. The checkbox alone can't show a body while the OTHER
 *  mode's tab is active, and switching tabs alone can't show a body the
 *  user hasn't asked for - both a mode switch (switchRenderCenter) and a
 *  checkbox change (see panelConfig.sunAndMoon.realDistance.earth/sun.bodiesVisible)
 *  call this to re-resolve the combined state. */
function applyRealBodyVisibility(): void {
  realSunMarker.setVisible(renderCenter === RenderCenter.Sun && sunCenteredBodiesVisible);
  realMoonMarker.setVisible(renderCenter === RenderCenter.Sun && sunCenteredBodiesVisible);
  earthCenteredSunMarker.setVisible(renderCenter === RenderCenter.Earth && earthCenteredBodiesVisible);
  earthCenteredMoonMarker.setVisible(renderCenter === RenderCenter.Earth && earthCenteredBodiesVisible);
}

/** Switching Center mode also auto-hides the OLDER, direction-only/fixed-
 *  distance Sun & Moon approximations (sky-tier sunMarkerSky/moonMarkerSky,
 *  and every model's globe-tier sunMarkerGlobe/moonMarkerGlobe) - both
 *  Center modes now have their own true-position replacement (realSunMarker/
 *  realMoonMarker for Sun mode, earthCenteredSunMarker/earthCenteredMoonMarker
 *  for Earth mode), so the old ones are just redundant clutter stacked on
 *  top of the new ones, in EITHER mode. This is deliberate auto-LINKING
 *  triggered by an explicit user action (clicking a tab), not silent
 *  gating - every checkbox this touches stays fully manually re-toggleable
 *  afterward (layers.show + controlPanel.syncLayerToggles is the exact
 *  same pattern scene presets already use for "apply a state, but the
 *  user can still override it by hand"). Deliberately does NOT touch the
 *  Solar System side-diagram (`${modelId}SolarSystemBodies`) - that's a
 *  separate, still fully independent teaching diagram, unrelated to which
 *  body Center mode currently fixes at the origin. */
function switchRenderCenter(mode: RenderCenter): void {
  renderCenter = mode;
  applyRealBodyVisibility();
  controlPanel.setActiveRenderCenter(mode);

  const supersededMarkerVisibility: Record<string, boolean> = {
    sunMarkerSky: false,
    moonMarkerSky: false,
  };
  for (const diagram of modelDiagrams) {
    supersededMarkerVisibility[diagram.sunMarkerGlobe.id] = false;
    supersededMarkerVisibility[diagram.moonMarkerGlobe.id] = false;
  }
  layers.show(supersededMarkerVisibility);
  controlPanel.syncLayerToggles(supersededMarkerVisibility);
}

const panelConfig: ControlPanelConfig = {
  view: {
    renderCenter: {
      entries: [
        { id: RenderCenter.Earth, label: "Center: Earth" },
        { id: RenderCenter.Sun, label: "Center: Sun" },
      ],
      activeId: RenderCenter.Earth,
      onSwitchActive: switchRenderCenter,
    },
  },
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
  // The single home for every Sun/Moon representation in the app, tier-
  // first (see ControlPanel.ts's SunAndMoonPanelConfig doc comment) -
  // replaces the old separate `astronomyModel`/`sunMoon` keys and the top
  // View tab strip's per-mode scale sliders. explanatoryGlobe/
  // solarSystemDiagram are each their own independent .map() now (not
  // zipped together by index like the old single `astronomyModel.models`
  // was) - both still rely on modelDiagrams/solarSystemDiagrams being built
  // from the same modelRegistry.all() call in the same order (see above)
  // for their id/label to line up 1:1, even though nothing zips them
  // together anymore.
  sunAndMoon: {
    sky: {
      sun: { checked: true, onChange: (v) => layers.show({ sunMarkerSky: v }) },
      moon: { checked: true, onChange: (v) => layers.show({ moonMarkerSky: v }) },
      sunEclipticPath: { checked: false, onChange: (v) => layers.show({ sunEclipticPath: v }) },
      moonSkyPath: { checked: false, onChange: (v) => layers.show({ moonSkyPath: v }) },
    },
    explanatoryGlobe: modelDiagrams.map((diagram) => ({
      id: diagram.modelId,
      label: diagram.modelLabel,
      sun: { checked: false, onChange: (v: boolean) => layers.show({ [diagram.sunMarkerGlobe.id]: v }) },
      moon: { checked: false, onChange: (v: boolean) => layers.show({ [diagram.moonMarkerGlobe.id]: v }) },
      orbitLines: { checked: false, onChange: (v: boolean) => layers.show({ [diagram.orbitLines.id]: v }) },
    })),
    solarSystemDiagram: solarSystemDiagrams.map((solarSystem) => ({
      id: solarSystem.modelId,
      label: solarSystem.modelLabel,
      bodies: { checked: false, onChange: (v: boolean) => layers.show({ [solarSystem.bodies.id]: v }) },
      earthPath: { checked: false, onChange: (v: boolean) => layers.show({ [solarSystem.earthOrbitLine.id]: v }) },
    })),
    realDistance: {
      earth: {
        bodiesVisible: {
          checked: earthCenteredBodiesVisible,
          onChange: (v: boolean) => {
            earthCenteredBodiesVisible = v;
            applyRealBodyVisibility();
          },
        },
        sunDistance: {
          value: CENTER_EARTH_SUN_DISTANCE_DEFAULT_RADII,
          min: CENTER_EARTH_SUN_DISTANCE_MIN_RADII,
          max: CENTER_EARTH_SUN_DISTANCE_MAX_RADII,
          step: 5,
          format: (v: number) => `${v} R⊕`,
          onChange: (v: number) => {
            centerEarthSunDistanceRadii = v;
            // Same zoom-range-keeps-pace reasoning as Center:Sun's own
            // Earth-Sun distance slider below - here it's the Sun MARKER
            // moving far from a fixed Earth instead, but the camera still
            // needs to be able to zoom out far enough to see it.
            cameraManager.setSpaceMaxDistance(Math.max(EARTH_RADIUS * 200, v * EARTH_RADIUS * 3));
          },
        },
        moonDistance: {
          value: CENTER_EARTH_MOON_DISTANCE_DEFAULT_RADII,
          min: CENTER_EARTH_MOON_DISTANCE_MIN_RADII,
          max: CENTER_EARTH_MOON_DISTANCE_MAX_RADII,
          step: 0.1,
          format: (v: number) => `${v.toFixed(1)} R⊕`,
          onChange: (v: number) => (centerEarthMoonDistanceRadii = v),
        },
        sunSize: {
          value: CENTER_EARTH_SUN_SIZE_DEFAULT_RADII,
          min: CENTER_EARTH_SUN_SIZE_MIN_RADII,
          max: CENTER_EARTH_SUN_SIZE_MAX_RADII,
          step: 0.1,
          format: (v: number) => `${v.toFixed(1)} R⊕`,
          onChange: (v: number) => earthCenteredSunMarker.setMarkerSize(EARTH_RADIUS * v),
        },
        moonSize: {
          value: CENTER_EARTH_MOON_SIZE_DEFAULT_RADII,
          min: CENTER_EARTH_MOON_SIZE_MIN_RADII,
          max: CENTER_EARTH_MOON_SIZE_MAX_RADII,
          step: 0.05,
          format: (v: number) => `${v.toFixed(2)} R⊕`,
          onChange: (v: number) => earthCenteredMoonMarker.setMarkerSize(EARTH_RADIUS * v),
        },
      },
      sun: {
        bodiesVisible: {
          checked: sunCenteredBodiesVisible,
          onChange: (v: boolean) => {
            sunCenteredBodiesVisible = v;
            applyRealBodyVisibility();
          },
        },
        sunDistance: {
          value: CENTER_SUN_EARTH_DISTANCE_DEFAULT_RADII,
          min: CENTER_SUN_EARTH_DISTANCE_MIN_RADII,
          max: CENTER_SUN_EARTH_DISTANCE_MAX_RADII,
          step: 5,
          format: (v: number) => `${v} R⊕`,
          onChange: (v: number) => {
            centerSunEarthDistanceRadii = v;
            // Keeps Space View's zoom-out range comfortably ahead of the
            // orbit's actual size (3x margin) - never below the app's normal
            // default, so shrinking this slider back down doesn't leave the
            // zoom range stuck oddly small either.
            cameraManager.setSpaceMaxDistance(Math.max(EARTH_RADIUS * 200, v * EARTH_RADIUS * 3));
          },
        },
        moonDistance: {
          value: CENTER_SUN_MOON_DISTANCE_DEFAULT_RADII,
          min: CENTER_SUN_MOON_DISTANCE_MIN_RADII,
          max: CENTER_SUN_MOON_DISTANCE_MAX_RADII,
          step: 0.1,
          format: (v: number) => `${v.toFixed(1)} R⊕`,
          onChange: (v: number) => (centerSunMoonDistanceRadii = v),
        },
        sunSize: {
          value: CENTER_SUN_SUN_SIZE_DEFAULT_RADII,
          min: CENTER_SUN_SUN_SIZE_MIN_RADII,
          max: CENTER_SUN_SUN_SIZE_MAX_RADII,
          step: 0.1,
          format: (v: number) => `${v.toFixed(1)} R⊕`,
          onChange: (v: number) => realSunMarker.setMarkerSize(EARTH_RADIUS * v),
        },
        moonSize: {
          value: CENTER_SUN_MOON_SIZE_DEFAULT_RADII,
          min: CENTER_SUN_MOON_SIZE_MIN_RADII,
          max: CENTER_SUN_MOON_SIZE_MAX_RADII,
          step: 0.05,
          format: (v: number) => `${v.toFixed(2)} R⊕`,
          onChange: (v: number) => realMoonMarker.setMarkerSize(EARTH_RADIUS * v),
        },
      },
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
      // Sky-tier constellations - see stars.celestialSphere's globe-tier
      // pair below and ControlPanelConfig.stars' doc comment for why these
      // live on the star config they're adjacent to rather than in a
      // standalone section. Independent of star visibility itself
      // (resolved once against the shared catalog at load, not derived
      // from what's currently drawn - see constellationCatalog.ts).
      constellationLines: { checked: false, onChange: (v) => layers.show({ constellationLinesSky: v }) },
      constellationNames: { checked: false, onChange: (v) => layers.show({ constellationNamesSky: v }) },
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
      // Globe-tier constellations - see stars.background's sky-tier pair
      // above for the shared reasoning.
      constellationLines: { checked: false, onChange: (v) => layers.show({ constellationLinesGlobe: v }) },
      constellationNames: { checked: false, onChange: (v) => layers.show({ constellationNamesGlobe: v }) },
    },
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

  const universeState = groundModel.getState(getSimulationTime());

  // "Center: Sun" mode (see RenderCenter.ts): Earth's whole rig moves to its
  // real position relative to the Sun each frame, reusing the exact same
  // proven-model-agnostic function the Solar System side-diagram uses (see
  // astronomy/solarSystemDiagram.ts) - so this is provably identical
  // regardless of which model computed universeState. Reads the LIVE,
  // slider-adjustable centerSunEarthDistanceRadii (Camera panel section),
  // deliberately decoupled from the side-diagram's own fixed
  // SOLAR_SYSTEM_EARTH_ORBIT_SCALE - see config/constants.ts's doc comment
  // on CENTER_SUN_EARTH_DISTANCE_DEFAULT_RADII for why. "Center: Earth"
  // resets it to the origin every frame too (not just once on toggle),
  // which is cheap and keeps this branch the single source of truth for
  // Earth's position rather than relying on it being left over from a
  // previous mode.
  earthBase.setOrbitPosition(
    renderCenter === RenderCenter.Sun
      ? getEarthDiagramPosition(universeState, (EARTH_RADIUS * centerSunEarthDistanceRadii) / EARTH_ORBIT_RADIUS)
      : { x: 0, y: 0, z: 0 },
  );
  // realMoonMarker isn't registered in `layers` (see its own doc comment),
  // so its per-frame update() is called explicitly here, only while it's
  // actually visible - the Moon really does orbit Earth continuously in
  // this mode, unlike the fixed realSunMarker.
  if (renderCenter === RenderCenter.Sun) realMoonMarker.update();
  // "Center: Earth" mode's mirror image: Earth stays fixed (handled by
  // setOrbitPosition above), but its own Sun AND Moon markers both move,
  // so both need per-frame update() here - unlike Center:Sun mode, where
  // only the Moon moves and the Sun is fixed at the origin.
  if (renderCenter === RenderCenter.Earth) {
    earthCenteredSunMarker.update();
    earthCenteredMoonMarker.update();
  }

  // Real day/night terminator: the key light always comes from groundModel's
  // actual current Sun direction (see groundModel's own doc comment above -
  // fixed, not switchable). keyLight is parented under earthBase.object3D
  // (see the reparenting comment near celestialSphereShell above), so this
  // position is LOCAL to wherever Earth currently is - the model's own
  // coordinate origin does NOT always coincide with Earth either way
  // (Heliocentric puts the Sun near origin and moves Earth, Geocentric does
  // the opposite) - so this must use the RELATIVE vector (Sun - Earth),
  // exactly like GroundObserver.getDirectionTo, not either absolute position
  // alone. DirectionalLight only cares about direction, not distance, but a
  // position far outside Earth keeps the math the same shape as a real
  // light source.
  //
  // eclipticToWorld is REQUIRED here, not optional - models express
  // position in the ecliptic frame (Y = ecliptic pole), but Earth's real
  // geography (continents, the night-lights texture) spins around the
  // TILTED celestial-pole axis (world +Y, see EarthBase/frames.ts). Skipping
  // this rotation was a pre-existing simplification (silently treating the
  // two poles as the same axis, i.e. zero obliquity) that stayed invisible
  // as long as the night side was just flat ambient-lit gray - once real
  // night-lights geography made the terminator's exact position clearly
  // scrutinizable, the up-to-23.44deg error became a visible "the lit/dark
  // boundary doesn't line up with the continents" bug. Same fix
  // GroundObserver.getDirectionTo/OrbitLineLayer/SkyPathLineLayer already
  // apply to every other body-position consumer - this was the one place
  // it had been missed.
  const sunBody = universeState.bodies[BodyIds.Sun];
  const earthBody = universeState.bodies[BodyIds.Earth];
  const sunDirectionWorld = eclipticToWorld({
    x: sunBody.position.x - earthBody.position.x,
    y: sunBody.position.y - earthBody.position.y,
    z: sunBody.position.z - earthBody.position.z,
  });
  sunLightDirection.set(sunDirectionWorld.x, sunDirectionWorld.y, sunDirectionWorld.z).normalize();
  keyLight.position.copy(sunLightDirection).multiplyScalar(EARTH_RADIUS * 20);
  // Same direction keyLight itself just used - keeps the shader-blended
  // night-lights terminator and keyLight's own PBR-lit terminator in
  // perfect agreement (see ContinentsLayer's class doc comment).
  continents.setSunDirection(sunLightDirection);

  const activeLatLon = observerRegistry.getActive().station.getLatLon();
  controlPanel.setObserverLatLon(activeLatLon.latDeg, activeLatLon.lonDeg);

  const camera = cameraManager.getActiveCamera();
  cameraDirection.copy(camera.position).normalize();
  celestialSphereShell.updateHemisphereFade(cameraDirection);
  celestialSphereStars.updateHemisphereFade(cameraDirection);

  renderer.render(scene, camera);
});
