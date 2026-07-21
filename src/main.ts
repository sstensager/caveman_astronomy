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
import { MilkyWayPanoramaLayer } from "./layers/sky/MilkyWayPanoramaLayer";
import { ConstellationLinesLayer } from "./layers/sky/ConstellationLinesLayer";
import { ConstellationLabelsLayer } from "./layers/sky/ConstellationLabelsLayer";
import { OrbitLineLayer } from "./layers/sky/OrbitLineLayer";
import { SkyPathLineLayer } from "./layers/sky/SkyPathLineLayer";
import { BodyLabelsLayer } from "./layers/sky/BodyLabelsLayer";
import { OrbitingBodyMarkerLayer } from "./layers/sky/OrbitingBodyMarkerLayer";
import { ModernHeliocentricModel } from "./astronomy/models/ModernHeliocentricModel";
import { GeocentricModel } from "./astronomy/models/GeocentricModel";
import { AstronomyModelRegistry } from "./astronomy/AstronomyModelRegistry";
import { BodyIds, type AstronomyModel, type SimulationTime } from "./astronomy/types";
import {
  getBodyOffsetFromEarth,
  getBodyOffsetFromSun,
  getEarthDiagramPosition,
  getMoonOffsetFromEarth,
  getSunOffsetFromEarth,
} from "./astronomy/solarSystemDiagram";
import { ptolemaicCapScaleFactor, synodicPeriodDays } from "./astronomy/planetPositions";
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
import { SunMode } from "./layers/sky/SunMode";
import { createSunGlowSprite } from "./layers/sky/sunGlow";
import { GroundMoveControls } from "./cameras/GroundMoveControls";
import { ControlPanel, type ControlPanelConfig, type ViewModeDef } from "./ui/ControlPanel";
import { TimeHud } from "./ui/TimeHud";
import { MinimapHud } from "./ui/MinimapHud";
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
  PLANET_VISIBILITY_BOOST_DEFAULT,
  PLANET_VISIBILITY_BOOST_MIN,
  PLANET_VISIBILITY_BOOST_MAX,
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
  SUN_GLOW_SCALE_MULTIPLIER,
  SUN_GLOW_OPACITY,
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
  PLANET_ORBITAL_ELEMENTS,
} from "./astronomy/constants";
import { PLANET_RENDER_CONFIG } from "./config/planets";
import { SCENE_STATE_VERSION, type SceneState } from "./scenes/SceneState";
import { EMPTY_VIDEO_LIBRARY, type VideoLibrary } from "./scenes/VideoLibrary";

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
let minimapOpacity = MINIMAP_OPACITY_DEFAULT;
let earthAxialTiltDeg = EARTH_AXIAL_TILT_DEG;
let hemisphereMode: HemisphereMode = "none";
const starSettings: { limitingMagnitude: number; size: number; brightness: number; opacity: number } = { ...STARS_DEFAULT };
// The click-to-target anchor/look-at body ids (see setAnchorBody/
// setLookAtBody below) - mirrored here purely so captureSceneState has a
// live value to read back, same reasoning as sunSizeRadii etc. above.
let anchorBodyId: string | undefined;
let lookAtBodyId: string | undefined;

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
const milkyWayPanorama = new MilkyWayPanoramaLayer(TEXTURES.milkyWay, skyRadius, getActiveObserver);

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
  milkyWayPanorama.setRadius(radius);
  sunEclipticPath.setRadius(radius);
  moonSkyPath.setRadius(radius);
  planetLayers.forEach((p) => p.skyPath.setRadius(radius));
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
// Mirrors of slider values that otherwise only ever flow straight into a
// setter (e.g. sunMarker.setMarkerSize) with nothing keeping the number
// itself around - captureSceneState needs a live value to read back, so
// each of these gets set alongside its real setter call in panelConfig
// below, never used for anything else.
let sunSizeRadii = SUN_SIZE_DEFAULT_RADII;
let moonSizeRadii = MOON_SIZE_DEFAULT_RADII;
let moonDarkSideBrightness = MOON_DARK_SIDE_BRIGHTNESS_DEFAULT;
let sunMode: SunMode = SunMode.Dim;
let wireframeOpacity = CELESTIAL_SPHERE_WIREFRAME_OPACITY_DEFAULT;

const sunMarker = new OrbitingBodyMarkerLayer({
  id: "sunMarker",
  label: "Sun",
  group: "Sky.Geometry",
  color: COLORS.sun,
  markerSize: SUN_MARKER_SIZE_DEFAULT,
  getPosition: () =>
    getSunOffsetFromEarth(getActiveModel().getState(getSimulationTime()), (EARTH_RADIUS * sunDistanceRadii) / EARTH_ORBIT_RADIUS),
});
// Parented under the Sun marker's own object3D (not tracked separately) so
// it inherits that marker's live position AND Sun-Size-slider scale for
// free - see createSunGlowSprite's doc comment. Only visible in Bright mode
// (see switchSunMode); BodyTargetPicker's raycast is non-recursive, so this
// child never interferes with click-to-target picking on the Sun itself.
const sunGlowSprite = createSunGlowSprite(SUN_MARKER_SIZE_DEFAULT, SUN_GLOW_SCALE_MULTIPLIER, SUN_GLOW_OPACITY);
sunMarker.object3D.add(sunGlowSprite);
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

/** Largest planet-to-Earth-orbit model-space ratio, used to widen Space
 *  View's max camera distance far enough to always reach Saturn's orbit
 *  (the outermost) regardless of the current Sun-distance slider value -
 *  see setSunDistanceRadii and its init-time counterpart below. */
const FARTHEST_PLANET_ORBIT_RATIO = Math.max(...Object.values(PLANET_ORBITAL_ELEMENTS).map((e) => e.orbitRadius / EARTH_ORBIT_RADIUS));

/** Every layer whose scale tracks the Sun's own distance slider. */
function setSunDistanceRadii(radii: number): void {
  sunDistanceRadii = radii;
  sunOrbitLine.setRadius(EARTH_RADIUS * radii);
  earthOrbitLine.setRadius(EARTH_RADIUS * radii);
  planetLayers.forEach((p) => {
    p.orbitLineHelio.setRadius(EARTH_RADIUS * radii);
    p.deferentGeo.setRadius(EARTH_RADIUS * radii);
    p.epicycleGeo.setRadius(EARTH_RADIUS * radii);
    p.ptolemaicDeferentGeo.setRadius(EARTH_RADIUS * radii * p.ptolemaicScaleFactor);
    p.ptolemaicEpicycleGeo.setRadius(EARTH_RADIUS * radii * p.ptolemaicScaleFactor);
    p.truePathGeo.setRadius(EARTH_RADIUS * radii);
  });
  cameraManager.setSpaceMaxDistance(Math.max(EARTH_RADIUS * 200, radii * EARTH_RADIUS * 3 * FARTHEST_PLANET_ORBIT_RATIO));
}
function setMoonDistanceRadii(radii: number): void {
  moonDistanceRadii = radii;
  moonOrbitLine.setRadius(EARTH_RADIUS * radii);
}

// --- Planets: Mercury, Venus, Mars, Jupiter, Saturn ------------------------
// The MARKER uses the same Earth-relative parenting trick as the Sun/Moon
// markers above (see their own doc comment) - one instance correct in BOTH
// Scenes with no branching, since a planet's real Earth-relative offset
// (via getBodyOffsetFromEarth) is exactly its correct apparent wandering
// path (including retrograde loops) regardless of which model computes it.
//
// The ORBIT LINE is one user-facing toggle backed by real geometry that
// looks different per Scene, because the real geometry IS different per
// Scene - not an approximation choice. In Heliocentric, the real path is a
// Sun-relative ellipse (orbitLineHelio - same shape as sunOrbitLine's own
// construction, since the Sun sits at the world origin there).
//
// In Geocentric, a planet's true position is planetHelio - earthHelio. Split
// at the minus sign into +planetHelio and -earthHelio, and EACH term is
// itself one body's own real, unmodified orbital ellipse around the Sun -
// which is exactly a deferent+epicycle decomposition, not a simplification
// of one (this is the actual historical justification for epicycles: two
// real elliptical motions around the Sun, re-expressed relative to Earth,
// algebraically ARE one big ellipse plus one small ellipse riding on it -
// see deferentGeo's own doc comment for the sign details, which matter: the
// "-earthHelio" term is Earth's orbit MIRRORED, not Earth's orbit directly,
// which is why it's built from the model's own Sun-relative-to-Earth vector
// rather than Earth-relative-to-Sun). For a SUPERIOR planet (Mars/Jupiter/
// Saturn, orbitRadius > Earth's), the deferent carries +planetHelio (the
// planet's own real orbit) and the epicycle carries -earthHelio (Earth's
// orbit, mirrored). For an INFERIOR planet (Mercury/Venus) it flips: the
// deferent carries -earthHelio and the epicycle carries +planetHelio. This
// holds EXACTLY (pure vector algebra - the Sun terms cancel identically,
// no small-eccentricity approximation needed, unlike a naive "sample the
// compound path directly" approach would require). applyPlanetOrbitLineVisibility
// shows whichever pair matches the active Scene and hides the other - never
// more than one path per planet.
//
// Markers/orbit lines all reuse the SUN's own live sunDistanceRadii scale
// factor rather than getting a separate distance slider each (see
// config/planets.ts's doc comment) - every planet's distance is
// real-derived from its own orbital elements, not an artistic free
// parameter the way Sun/Moon's own distance is, so dragging "Sun distance"
// scales the whole solar system together correctly.
//
// Getting that shared factor right requires the marker's getPosition scale
// AND every orbit line's own (radius*orbitRadiusFraction)/semiMajorAxis
// scale to divide by the SAME reference constant - EARTH_ORBIT_RADIUS, the
// same one sunOrbitLine/sunMarker themselves divide by (see their own
// construction above), NOT each planet's own orbitRadius. A planet's own
// orbitRadius already fully determines its real orbit SHAPE (it's baked
// into the model's own position math - see planetPositions.ts) - it isn't
// also a per-body display-scale knob the way MOON_ORBIT_RADIUS is for the
// Moon's own independently-slidered orbit line.
const planetLayers = PLANET_RENDER_CONFIG.map((cfg) => {
  const elements = PLANET_ORBITAL_ELEMENTS[cfg.id];
  const isInferior = elements.orbitRadius < EARTH_ORBIT_RADIUS;
  const marker = new OrbitingBodyMarkerLayer({
    id: `${cfg.id}Marker`,
    label: cfg.label,
    group: "Sky.Geometry",
    color: cfg.color,
    markerSize: EARTH_RADIUS * cfg.markerSizeRadii,
    getPosition: () =>
      getBodyOffsetFromEarth(getActiveModel().getState(getSimulationTime()), cfg.id, (EARTH_RADIUS * sunDistanceRadii) / EARTH_ORBIT_RADIUS),
  });
  const orbitLineHelio = new OrbitLineLayer({
    id: `${cfg.id}OrbitLineHelio`,
    label: `${cfg.label} Orbit (Heliocentric)`,
    group: "Sky.Geometry",
    bodyId: cfg.id,
    relativeToId: BodyIds.Sun,
    periodDays: elements.periodDays,
    semiMajorAxis: EARTH_ORBIT_RADIUS,
    getModel: getActiveModel,
    getSimulationTime,
    radius: EARTH_RADIUS * sunDistanceRadii,
    orbitRadiusFraction: 1,
    color: cfg.color,
  });
  // Deferent: the "big ring around Earth" - the planet's own real orbit for
  // a superior planet (bodyId=planet, relativeToId=Sun, same shape as
  // orbitLineHelio), or Earth's own real orbit MIRRORED for an inferior one
  // (bodyId=Sun, relativeToId=Earth - the "+M(t)"/"-E(t)" split below
  // explains why it's the SUN's geocentric orbit, not Earth's heliocentric
  // one). Same OrbitLineLayer machinery as orbitLineHelio, just re-parented
  // under earthBase.object3D instead of scene root, so it renders centered
  // on wherever Earth currently is (the world origin, in Geocentric).
  //
  // The sign here is NOT arbitrary: true geocentric position is
  // planetHelio - earthHelio. Split at the minus sign into two terms,
  // +planetHelio (the planet's own real orbit, unmirrored) and -earthHelio
  // (Earth's own real orbit, MIRRORED - i.e. rotated 180deg, which is
  // EXACTLY what GeocentricModel's own Sun position already is via its
  // mirror-trick construction - see GeocentricModel's doc comment). So the
  // "-earthHelio" term is always constructed as bodyId=Sun, relativeToId=
  // Earth (reads the model's own already-correct Sun-relative-to-Earth
  // vector), NEVER as bodyId=Earth, relativeToId=Sun (which would give the
  // wrong, unmirrored sign). This holds exactly (not just approximately -
  // pure vector algebra, no small-eccentricity approximation needed) as
  // long as carrier position and epicycle shape are assigned consistently
  // below.
  const deferentGeo = new OrbitLineLayer({
    id: `${cfg.id}DeferentGeo`,
    label: `${cfg.label} Deferent (Geocentric)`,
    group: "Sky.Geometry",
    bodyId: isInferior ? BodyIds.Sun : cfg.id,
    relativeToId: isInferior ? BodyIds.Earth : BodyIds.Sun,
    periodDays: isInferior ? EARTH_ORBIT_PERIOD_DAYS : elements.periodDays,
    semiMajorAxis: EARTH_ORBIT_RADIUS,
    getModel: getActiveModel,
    getSimulationTime,
    radius: EARTH_RADIUS * sunDistanceRadii,
    orbitRadiusFraction: 1,
    color: cfg.color,
    opacity: 0.5,
  });
  // Epicycle: the small ring riding on the deferent - whichever of the two
  // terms above ISN'T the deferent. Parented under `carrier` (below), NOT
  // earthBase directly, so its own center moves along the deferent each
  // frame instead of sitting fixed at Earth. Dimmer than the deferent (a
  // lower opacity, not a different color) so the two read as "primary ring"
  // + "secondary ring riding on it" at a glance, rather than two
  // equally-weighted unrelated circles - see the spoke line below for the
  // same goal from a different angle.
  const epicycleGeo = new OrbitLineLayer({
    id: `${cfg.id}EpicycleGeo`,
    label: `${cfg.label} Epicycle (Geocentric)`,
    group: "Sky.Geometry",
    bodyId: isInferior ? cfg.id : BodyIds.Sun,
    relativeToId: isInferior ? BodyIds.Sun : BodyIds.Earth,
    periodDays: isInferior ? elements.periodDays : EARTH_ORBIT_PERIOD_DAYS,
    semiMajorAxis: EARTH_ORBIT_RADIUS,
    getModel: getActiveModel,
    getSimulationTime,
    radius: EARTH_RADIUS * sunDistanceRadii,
    orbitRadiusFraction: 1,
    color: cfg.color,
    opacity: 0.25,
  });
  // The epicycle's own moving center - the SAME real body the deferent
  // traces (the planet's own position for a superior planet, Earth's own
  // position for an inferior one), repositioned every frame in the render
  // loop below from the live universeState. A plain THREE.Group, not a
  // registered Layer - it has no independent visibility of its own, it's
  // purely a moving pivot the epicycle ring rides on.
  const epicycleCarrier = new THREE.Group();
  epicycleCarrier.name = `${cfg.id}EpicycleCarrier`;
  epicycleCarrier.add(epicycleGeo.object3D);
  // A thin line from Earth to the epicycle's current carrier position -
  // makes the "this small ring rides HERE, this far out on the deferent"
  // relationship visually unambiguous, rather than leaving the epicycle
  // looking like an unrelated floating circle. Both endpoints are in
  // earthBase.object3D's own local space (Earth at local origin), updated
  // every frame in the render loop below alongside epicycleCarrier itself.
  const epicycleSpokeLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]),
    new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.3 }),
  );
  epicycleSpokeLine.name = `${cfg.id}EpicycleSpoke`;
  const epicycleSpoke: Layer = {
    id: `${cfg.id}EpicycleSpoke`,
    label: `${cfg.label} Epicycle Spoke`,
    group: "Sky.Geometry",
    object3D: epicycleSpokeLine,
    setVisible: (visible: boolean) => {
      epicycleSpokeLine.visible = visible;
    },
  };
  // Ptolemaic: the REAL historical Ptolemaic construction - deliberately
  // NOT mathematically exact for Mercury/Venus (see PlanetEntryPanelConfig's
  // doc comment in ControlPanel.ts for the full history). Same deferent+
  // epicycle SHAPE and DIRECTION as the Tychonic pair above (same bodyId/
  // relativeToId), but both radii AND the carrier's own distance are scaled
  // down by ptolemaicScaleFactor so their combined maximum reach exactly
  // equals the Sun's own average distance - the actual "nested crystalline
  // spheres don't overlap" cosmological assumption. Scaling deferent and
  // epicycle by the SAME factor preserves the ratio between them, which is
  // what determines apparent DIRECTION (max elongation) - so this still
  // predicts the correct sky position, exactly like the real historical
  // model did; it just can never place the planet beyond the Sun, which is
  // exactly why it structurally cannot produce Venus's gibbous phases. For
  // Mars/Jupiter/Saturn, ptolemaicScaleFactor is exactly 1 (no cap needed) -
  // real Ptolemaic superior-planet epicycles (epicycle vector always
  // parallel to the Earth-Sun line) are already mathematically exact, so
  // this ends up geometrically identical to the Tychonic pair for those
  // three, by construction - a genuine historical fact, not a shortcut.
  const ptolemaicScaleFactor = isInferior ? ptolemaicCapScaleFactor(elements.orbitRadius) : 1;
  const ptolemaicDeferentGeo = new OrbitLineLayer({
    id: `${cfg.id}PtolemaicDeferentGeo`,
    label: `${cfg.label} Ptolemaic Deferent`,
    group: "Sky.Geometry",
    bodyId: isInferior ? BodyIds.Sun : cfg.id,
    relativeToId: isInferior ? BodyIds.Earth : BodyIds.Sun,
    periodDays: isInferior ? EARTH_ORBIT_PERIOD_DAYS : elements.periodDays,
    semiMajorAxis: EARTH_ORBIT_RADIUS,
    getModel: getActiveModel,
    getSimulationTime,
    radius: EARTH_RADIUS * sunDistanceRadii * ptolemaicScaleFactor,
    orbitRadiusFraction: 1,
    color: cfg.color,
    opacity: 0.5,
  });
  const ptolemaicEpicycleGeo = new OrbitLineLayer({
    id: `${cfg.id}PtolemaicEpicycleGeo`,
    label: `${cfg.label} Ptolemaic Epicycle`,
    group: "Sky.Geometry",
    bodyId: isInferior ? cfg.id : BodyIds.Sun,
    relativeToId: isInferior ? BodyIds.Sun : BodyIds.Earth,
    periodDays: isInferior ? elements.periodDays : EARTH_ORBIT_PERIOD_DAYS,
    semiMajorAxis: EARTH_ORBIT_RADIUS,
    getModel: getActiveModel,
    getSimulationTime,
    radius: EARTH_RADIUS * sunDistanceRadii * ptolemaicScaleFactor,
    orbitRadiusFraction: 1,
    color: cfg.color,
    opacity: 0.25,
  });
  // Same "moving pivot the epicycle rides on" role as epicycleCarrier
  // above, just scaled down to match the Ptolemaic-capped deferent (see
  // the render loop below).
  const ptolemaicCarrier = new THREE.Group();
  ptolemaicCarrier.name = `${cfg.id}PtolemaicCarrier`;
  ptolemaicCarrier.add(ptolemaicEpicycleGeo.object3D);
  const ptolemaicSpokeLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]),
    new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.3 }),
  );
  ptolemaicSpokeLine.name = `${cfg.id}PtolemaicSpoke`;
  const ptolemaicSpoke: Layer = {
    id: `${cfg.id}PtolemaicSpoke`,
    label: `${cfg.label} Ptolemaic Spoke`,
    group: "Sky.Geometry",
    object3D: ptolemaicSpokeLine,
    setVisible: (visible: boolean) => {
      ptolemaicSpokeLine.visible = visible;
    },
  };
  // Direction-only (see class doc comment), so the retrograde loop shape
  // that matters here is the SYNODIC repeat cycle - the real "how does the
  // apparent direction against the fixed stars loop back on itself"
  // period - not the planet's own sidereal orbital period. Using the
  // sidereal period here was a real bug (fixed once for the now-removed
  // Geocentric orbit line, then this second, separate consumer needed the
  // same fix - see synodicPeriodDays' own doc comment): it doesn't
  // correspond to any real repeat cycle, so the sampled loop wouldn't
  // close. Model-agnostic - the real retrograde loop against the stars is
  // the same physical phenomenon regardless of which Scene is active.
  const skyPath = new SkyPathLineLayer({
    id: `${cfg.id}SkyPath`,
    label: `${cfg.label} Sky Path`,
    group: "Sky.Observation",
    bodyId: cfg.id,
    relativeToId: BodyIds.Earth,
    periodDays: synodicPeriodDays(elements.periodDays),
    getModel: getActiveModel,
    getObserver: getActiveObserver,
    getSimulationTime,
    radius: skyRadius,
    color: cfg.color,
  });
  // True Path: the REAL, non-decomposed geocentric path - bodyId=planet,
  // relativeToId=Earth, at REAL distance (unlike Sky Path, which flattens
  // onto the shared sky radius). This is the actual compound retrograde
  // loop a planet traces in space relative to Earth - the same curve the
  // deferent+epicycle pair above is mathematically identical to, just not
  // decomposed into two legible circles. Also sampled over one synodic
  // period so it closes into a single clean loop instead of the tangled
  // many-loop mess sampling a full sidereal period would produce (the
  // original bug that motivated building the deferent+epicycle
  // decomposition in the first place). Geocentric-only (paired with
  // deferent+epicycle, which are also Geocentric-only) - in Heliocentric,
  // orbitLineHelio already IS the one clean real path, no compound
  // curve needed there.
  const truePathGeo = new OrbitLineLayer({
    id: `${cfg.id}TruePathGeo`,
    label: `${cfg.label} True Path (Geocentric)`,
    group: "Sky.Geometry",
    bodyId: cfg.id,
    relativeToId: BodyIds.Earth,
    periodDays: synodicPeriodDays(elements.periodDays),
    semiMajorAxis: EARTH_ORBIT_RADIUS,
    getModel: getActiveModel,
    getSimulationTime,
    radius: EARTH_RADIUS * sunDistanceRadii,
    orbitRadiusFraction: 1,
    color: cfg.color,
  });
  // One label per PATH TYPE (not just one per planet - see planetLabels
  // below), so overlapping same-colored paths (Tychonic/Ptolemaic/True
  // Path all share this planet's own color) can be told apart at a
  // glance. Each is anchored at a point genuinely ON its own path, reusing
  // the exact same live position formula that path's own geometry/carrier
  // uses - not an approximation:
  // - Tychonic: the deferent's own carrier position (see the render loop's
  //   carrierPos - same formula, duplicated here as a closure since
  //   BodyLabelsLayer needs its own live getPosition callback).
  // - Ptolemaic: the same carrier position, scaled by ptolemaicScaleFactor
  //   (matching ptolemaicCarrier's own position).
  // - True Path: the marker's own live position - True Path's sampled
  //   curve starts (t=now) exactly there, by construction.
  // - Sky Path: direction-only, like the path itself (see
  //   SkyPathLineLayer's own doc comment) - observer world position plus
  //   direction-to-body times the shared sky radius, NOT Earth-relative
  //   like the other three, so parented at scene root instead of under
  //   earthBase.object3D (matching skyPath.object3D's own parenting below).
  const tychonicLabel = new BodyLabelsLayer({
    id: `${cfg.id}TychonicLabel`,
    label: `${cfg.label} Tychonic Label`,
    group: "Sky.Geometry",
    entries: [
      {
        text: `${cfg.label} Tychonic`,
        color: `#${cfg.color.toString(16).padStart(6, "0")}`,
        getPosition: () => {
          const state = getActiveModel().getState(getSimulationTime());
          const scale = (EARTH_RADIUS * sunDistanceRadii) / EARTH_ORBIT_RADIUS;
          return isInferior ? getSunOffsetFromEarth(state, scale) : getBodyOffsetFromSun(state, cfg.id, scale);
        },
      },
    ],
  });
  const ptolemaicLabel = new BodyLabelsLayer({
    id: `${cfg.id}PtolemaicLabel`,
    label: `${cfg.label} Ptolemaic Label`,
    group: "Sky.Geometry",
    entries: [
      {
        text: `${cfg.label} Ptolemaic`,
        color: `#${cfg.color.toString(16).padStart(6, "0")}`,
        getPosition: () => {
          const state = getActiveModel().getState(getSimulationTime());
          const scale = ((EARTH_RADIUS * sunDistanceRadii) / EARTH_ORBIT_RADIUS) * ptolemaicScaleFactor;
          return isInferior ? getSunOffsetFromEarth(state, scale) : getBodyOffsetFromSun(state, cfg.id, scale);
        },
      },
    ],
  });
  const truePathLabel = new BodyLabelsLayer({
    id: `${cfg.id}TruePathLabel`,
    label: `${cfg.label} True Path Label`,
    group: "Sky.Geometry",
    entries: [
      {
        text: `${cfg.label} True Path`,
        color: `#${cfg.color.toString(16).padStart(6, "0")}`,
        getPosition: () =>
          getBodyOffsetFromEarth(getActiveModel().getState(getSimulationTime()), cfg.id, (EARTH_RADIUS * sunDistanceRadii) / EARTH_ORBIT_RADIUS),
      },
    ],
  });
  const skyPathLabel = new BodyLabelsLayer({
    id: `${cfg.id}SkyPathLabel`,
    label: `${cfg.label} Sky Path Label`,
    group: "Sky.Observation",
    entries: [
      {
        text: `${cfg.label} Sky Path`,
        color: `#${cfg.color.toString(16).padStart(6, "0")}`,
        getPosition: () => {
          const state = getActiveModel().getState(getSimulationTime());
          const observer = getActiveObserver();
          const direction = observer.getDirectionTo(cfg.id, state);
          const worldPos = observer.getFrame().worldPosition;
          return {
            x: worldPos.x + direction.x * skyRadius,
            y: worldPos.y + direction.y * skyRadius,
            z: worldPos.z + direction.z * skyRadius,
          };
        },
      },
    ],
  });
  // orbitLineHelio is Sun-relative, meaningful only when the Sun sits at
  // the world origin (Heliocentric) - root-parented like earthOrbitLine.
  // deferentGeo/epicycleCarrier/ptolemaicDeferentGeo/ptolemaicCarrier/
  // truePathGeo/the three Earth-relative labels are all Earth-relative,
  // meaningful only when Earth sits at the world origin (Geocentric) -
  // parented under earthBase.object3D like the marker, same "correct
  // position in whichever Scene has that body fixed" trick. skyPathLabel
  // is root-parented like skyPath itself (see skyPath's own scene.add call
  // below).
  earthBase.object3D.add(
    marker.object3D,
    deferentGeo.object3D,
    epicycleCarrier,
    epicycleSpokeLine,
    ptolemaicDeferentGeo.object3D,
    ptolemaicCarrier,
    ptolemaicSpokeLine,
    truePathGeo.object3D,
    tychonicLabel.object3D,
    ptolemaicLabel.object3D,
    truePathLabel.object3D,
  );
  scene.add(orbitLineHelio.object3D, skyPath.object3D, skyPathLabel.object3D);
  return {
    cfg,
    elements,
    isInferior,
    marker,
    orbitLineHelio,
    deferentGeo,
    epicycleGeo,
    epicycleCarrier,
    epicycleSpoke,
    epicycleSpokeLine,
    ptolemaicScaleFactor,
    ptolemaicDeferentGeo,
    ptolemaicEpicycleGeo,
    ptolemaicCarrier,
    ptolemaicSpoke,
    ptolemaicSpokeLine,
    truePathGeo,
    skyPath,
    tychonicLabel,
    ptolemaicLabel,
    truePathLabel,
    skyPathLabel,
    orbitLineVisible: false,
    ptolemaicVisible: false,
    truePathVisible: false,
    skyPathVisible: false,
  };
});

// One label per planet, tracking the SAME getBodyOffsetFromEarth position
// each marker itself uses (so it stays glued to its marker in both
// Scenes), offset slightly above so it doesn't sit directly on top of the
// dot. Since every path shares its planet's own color already, this
// doubles as identifying which path belongs to which planet, not just the
// marker. Parented under earthBase.object3D like the markers themselves,
// same "correct position in either Scene" reasoning.
const planetLabels = new BodyLabelsLayer({
  id: "planetLabels",
  label: "Planet Labels",
  group: "Sky.Geometry",
  entries: planetLayers.map((p) => ({
    text: p.cfg.label,
    color: `#${p.cfg.color.toString(16).padStart(6, "0")}`,
    getPosition: () =>
      getBodyOffsetFromEarth(getActiveModel().getState(getSimulationTime()), p.cfg.id, (EARTH_RADIUS * sunDistanceRadii) / EARTH_ORBIT_RADIUS),
    offset: { x: 0, y: EARTH_RADIUS * p.cfg.markerSizeRadii * 1.8, z: 0 },
  })),
});
earthBase.object3D.add(planetLabels.object3D);

/** One "Orbit Line" checkbox per planet, backed by real layers that differ
 *  per Scene - shows whichever set is geometrically correct for the active
 *  Scene and hides the rest, so the user only ever sees (and only ever
 *  needs to think about) one path per planet, never more than one at once
 *  (see planetLayers' own doc comment). Re-applied whenever a per-planet
 *  orbit-line checkbox changes OR the Scene switches. */
function applyPlanetOrbitLineVisibility(): void {
  layers.show(
    Object.fromEntries(
      planetLayers.flatMap((p) => [
        [p.orbitLineHelio.id, p.orbitLineVisible && activeScene === "heliocentric"],
        [p.deferentGeo.id, p.orbitLineVisible && activeScene === "geocentric"],
        [p.epicycleGeo.id, p.orbitLineVisible && activeScene === "geocentric"],
        [p.epicycleSpoke.id, p.orbitLineVisible && activeScene === "geocentric"],
      ]),
    ),
  );
  applyPathLabelsVisibility();
}

/** "True Path" (the real, non-decomposed compound geocentric curve - see
 *  planetLayers' own doc comment) is Geocentric-only, same reasoning as
 *  deferent+epicycle: only meaningful when Earth sits at the world origin.
 *  Re-applied whenever a per-planet True Path checkbox changes OR the
 *  Scene switches. */
function applyPlanetTruePathVisibility(): void {
  layers.show(Object.fromEntries(planetLayers.map((p) => [p.truePathGeo.id, p.truePathVisible && activeScene === "geocentric"])));
  applyPathLabelsVisibility();
}

/** The Ptolemaic deferent+epicycle+spoke (see planetLayers' own doc
 *  comment) is Geocentric-only, and unlike the Tychonic pair has NO
 *  Heliocentric equivalent at all (there's nothing to show there - it's
 *  specifically a geocentric cosmological model). Re-applied whenever a
 *  per-planet Ptolemaic checkbox changes OR the Scene switches. */
function applyPlanetPtolemaicVisibility(): void {
  layers.show(
    Object.fromEntries(
      planetLayers.flatMap((p) => [
        [p.ptolemaicDeferentGeo.id, p.ptolemaicVisible && activeScene === "geocentric"],
        [p.ptolemaicEpicycleGeo.id, p.ptolemaicVisible && activeScene === "geocentric"],
        [p.ptolemaicSpoke.id, p.ptolemaicVisible && activeScene === "geocentric"],
      ]),
    ),
  );
  applyPathLabelsVisibility();
}

/** Master "Show Path Labels" state - independent of any single path's own
 *  visibility (see the per-path onChange handlers in panelConfig, all of
 *  which call this after updating their own p.*Visible flag). A path's
 *  label only ever shows when BOTH this is on AND that specific path is
 *  currently visible - never a label floating with no corresponding line,
 *  and never silently hidden just because this master switch happens to be
 *  off while the user is toggling individual paths. Re-applied whenever
 *  this master flag changes, any per-path visibility changes, OR the Scene
 *  switches (Ptolemaic/True Path labels are Geocentric-only, matching
 *  their own lines). */
let pathLabelsVisible = false;
function applyPathLabelsVisibility(): void {
  layers.show(
    Object.fromEntries(
      planetLayers.flatMap((p) => [
        [p.tychonicLabel.id, pathLabelsVisible && p.orbitLineVisible],
        [p.ptolemaicLabel.id, pathLabelsVisible && p.ptolemaicVisible && activeScene === "geocentric"],
        [p.truePathLabel.id, pathLabelsVisible && p.truePathVisible && activeScene === "geocentric"],
        [p.skyPathLabel.id, pathLabelsVisible && p.skyPathVisible],
      ]),
    ),
  );
}

/** One combined "easier to spot" knob for all 5 planets at once - see the
 *  Planets section's "Visibility Boost" slider and PLANET_VISIBILITY_BOOST_*
 *  in config/constants.ts. Scales each marker's own authored size AND its
 *  color brightness together, since planets are small, flat-colored, and
 *  dim against the star field by default. */
let planetVisibilityBoost = PLANET_VISIBILITY_BOOST_DEFAULT;
function setPlanetVisibilityBoost(multiplier: number): void {
  planetVisibilityBoost = multiplier;
  for (const p of planetLayers) {
    p.marker.setMarkerSize(EARTH_RADIUS * p.cfg.markerSizeRadii * multiplier);
    p.marker.setColorBrightness(multiplier);
  }
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
layers.register(milkyWayPanorama);
layers.register(sunEclipticPath);
layers.register(moonSkyPath);
layers.register(sunMarker);
layers.register(moonMarker);
layers.register(sunOrbitLine);
layers.register(moonOrbitLine);
layers.register(orbitLines);
layers.register(earthOrbitLine);
planetLayers.forEach((p) => {
  layers.register(p.marker);
  layers.register(p.orbitLineHelio);
  layers.register(p.deferentGeo);
  layers.register(p.epicycleGeo);
  layers.register(p.epicycleSpoke);
  layers.register(p.ptolemaicDeferentGeo);
  layers.register(p.ptolemaicEpicycleGeo);
  layers.register(p.ptolemaicSpoke);
  layers.register(p.truePathGeo);
  layers.register(p.skyPath);
  layers.register(p.tychonicLabel);
  layers.register(p.ptolemaicLabel);
  layers.register(p.truePathLabel);
  layers.register(p.skyPathLabel);
});
layers.register(planetLabels);
layers.register(observerMarkersLayer);
layers.register(observerFarSideIndicatorLayer);
layers.register(targetReticles);

scene.add(earthBase.object3D);
scene.add(stars.object3D);
scene.add(constellationLines.object3D);
scene.add(constellationNames.object3D);
scene.add(celestialSphereShell.object3D);
scene.add(milkyWayPanorama.object3D);
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
  milkyWayPanorama: true,
  sunEclipticPath: false,
  moonSkyPath: false,
  sunMarker: true,
  moonMarker: true,
  orbitLines: false,
  earthOrbitLine: false,
  observerMarkers: true,
  observerFarSideIndicator: true,
  targetReticles: true,
  planetLabels: false,
  ...Object.fromEntries(planetLayers.flatMap((p) => [
    [p.marker.id, true],
    [p.orbitLineHelio.id, false],
    [p.deferentGeo.id, false],
    [p.epicycleGeo.id, false],
    [p.epicycleSpoke.id, false],
    [p.ptolemaicDeferentGeo.id, false],
    [p.ptolemaicEpicycleGeo.id, false],
    [p.ptolemaicSpoke.id, false],
    [p.truePathGeo.id, false],
    [p.skyPath.id, false],
    [p.tychonicLabel.id, false],
    [p.ptolemaicLabel.id, false],
    [p.truePathLabel.id, false],
    [p.skyPathLabel.id, false],
  ])),
};
layers.show(defaultLayerVisibility);

// --- Cameras --------------------------------------------------------------

const cameraManager = new CameraManager(() => observerRegistry.getActive().station.object3D, renderer.domElement);
cameraManager.setSpaceMaxDistance(Math.max(EARTH_RADIUS * 200, sunDistanceRadii * EARTH_RADIUS * 3 * FARTHEST_PLANET_ORBIT_RATIO));

const getCameraPosition = () => cameraManager.getActiveCamera().position;
defaultObserverEntry.marker.setCameraPositionGetter(getCameraPosition);

const viewModes: ViewModeDef[] = [
  { mode: CameraMode.Space, label: "Space View" },
  { mode: CameraMode.Ground, label: "Ground View" },
];

// --- UI ---------------------------------------------------------------

let controlPanel: ControlPanel;

const onHemisphereModeChange = (mode: HemisphereMode): void => {
  hemisphereMode = mode;
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
  ...planetLayers.map((p) => ({ id: p.cfg.id, label: p.cfg.label, object3D: p.marker.object3D })),
];

function bodyPositionGetter(body: TargetableBody | undefined): (() => THREE.Vector3) | undefined {
  return body ? () => body.object3D.getWorldPosition(new THREE.Vector3()) : undefined;
}

function setAnchorBody(id: string | undefined): void {
  const body = id ? targetableBodies.find((b) => b.id === id) : undefined;
  anchorBodyId = body?.id;
  cameraManager.setSpaceFollowTarget(bodyPositionGetter(body));
  targetReticles.setAnchorTarget(bodyPositionGetter(body));
  controlPanel.setAnchorBody(body?.label);
}

function setLookAtBody(id: string | undefined): void {
  const body = id ? targetableBodies.find((b) => b.id === id) : undefined;
  lookAtBodyId = body?.id;
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

/** Combines OrbitingBodyMarkerLayer's two generic primitives
 *  (setTexture/setColorBrightness) into the Sun's three named looks - see
 *  layers/sky/SunMode.ts. */
function switchSunMode(mode: SunMode): void {
  sunMode = mode;
  switch (mode) {
    case SunMode.Dim:
      sunMarker.setTexture(null);
      sunMarker.setColorBrightness(1);
      break;
    case SunMode.Bright:
      sunMarker.setTexture(null);
      sunMarker.setFlatColor(0xffffff);
      break;
    case SunMode.Textury:
      sunMarker.setTexture(TEXTURES.sunHalpha);
      sunMarker.setColorBrightness(1);
      break;
  }
  sunGlowSprite.visible = mode === SunMode.Bright;
  controlPanel.setActiveSunMode(mode);
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
  applyPlanetOrbitLineVisibility();
  applyPlanetPtolemaicVisibility();
  applyPlanetTruePathVisibility();
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

/** Pulls every piece of control-panel-reachable state into one serializable
 *  snapshot - see scenes/SceneState.ts's own doc comment for why this (not
 *  a hand-picked subset) is the contract. */
function captureSceneState(): SceneState {
  return {
    version: SCENE_STATE_VERSION,
    scene: activeScene,
    simDay: getSimulationTime(),
    timeSpeed: simClock.timeSpeed,
    paused: simClock.paused,
    cameraMode: cameraManager.getMode(),
    cameraUpMode: cameraManager.getSpaceUpMode(),
    spaceCameraDistance: cameraManager.getSpaceDistance(),
    hemisphereMode,
    skyRadius,
    wireframeOpacity,
    sunDistanceRadii,
    moonDistanceRadii,
    sunSizeRadii,
    moonSizeRadii,
    sunMode,
    moonDarkSideBrightness,
    earthAxialTiltDeg,
    earthRotationEnabled: earthBase.rotationEnabled,
    planetVisibilityBoost,
    pathLabelsVisible,
    earthOrbitPathVisible,
    starLimitingMagnitude: starSettings.limitingMagnitude,
    starBrightness: starSettings.brightness,
    starSize: starSettings.size,
    starOpacity: starSettings.opacity,
    observers: observerRegistry.all().map((entry) => {
      const { latDeg, lonDeg } = entry.station.getLatLon();
      return { id: entry.id, label: entry.label, latDeg, lonDeg };
    }),
    activeObserverId: observerRegistry.getActiveId(),
    observerMarkersVisible,
    observerFarSideIndicatorEnabled,
    minimapVisible: minimapManuallyVisible,
    minimapOpacity,
    stonehengePlacedAt: stonehenge.getPlacedLatLon(),
    anchorBodyId,
    lookAtBodyId,
    planets: Object.fromEntries(
      planetLayers.map((p) => [
        p.cfg.id,
        { orbitLine: p.orbitLineVisible, ptolemaic: p.ptolemaicVisible, truePath: p.truePathVisible, skyPath: p.skyPathVisible },
      ]),
    ),
    layers: layers.getVisibility(),
  };
}

/** The inverse of captureSceneState - restores every field, then re-runs
 *  every scene-dependent recompute (planet path gating, path labels,
 *  Earth's own orbit path) exactly like a manual Scene switch or checkbox
 *  click would, and finally pushes the result back into the panel's own
 *  checkbox/slider DOM via syncLayerToggles/syncSliders (see those methods'
 *  doc comments) so the panel never shows stale controls after a JSON
 *  apply. Observers are add-only (see ObserverRegistry's own doc comment) -
 *  if the target state has more observers than currently exist, enough new
 *  ones are created via addObserver() to match; matching an existing entry
 *  to a state entry is by id, which only lines up correctly if that id
 *  followed the same observer-1/observer-2/... convention addObserver()
 *  itself uses (true for any state this app itself produced). */
function applySceneState(state: SceneState): void {
  switchScene(state.scene);
  simClock.setElapsedDays(state.simDay);
  simClock.timeSpeed = state.timeSpeed;
  simClock.paused = state.paused;

  switchCameraMode(state.cameraMode);
  switchCameraUpMode(state.cameraUpMode);
  onHemisphereModeChange(state.hemisphereMode);

  setSkyRadius(state.skyRadius);
  wireframeOpacity = state.wireframeOpacity;
  celestialSphereShell.setWireframeOpacity(state.wireframeOpacity);
  setSunDistanceRadii(state.sunDistanceRadii);
  setMoonDistanceRadii(state.moonDistanceRadii);

  sunSizeRadii = state.sunSizeRadii;
  sunMarker.setMarkerSize(EARTH_RADIUS * state.sunSizeRadii);
  switchSunMode(state.sunMode);
  moonSizeRadii = state.moonSizeRadii;
  moonMarker.setMarkerSize(EARTH_RADIUS * state.moonSizeRadii);
  moonDarkSideBrightness = state.moonDarkSideBrightness;
  moonMarker.setDarkSideBrightness(state.moonDarkSideBrightness);

  earthAxialTiltDeg = state.earthAxialTiltDeg;
  earthBase.setAxialTilt(state.earthAxialTiltDeg);
  earthBase.rotationEnabled = state.earthRotationEnabled;

  setPlanetVisibilityBoost(state.planetVisibilityBoost);
  pathLabelsVisible = state.pathLabelsVisible;
  earthOrbitPathVisible = state.earthOrbitPathVisible;

  starSettings.limitingMagnitude = state.starLimitingMagnitude;
  stars.setLimitingMagnitude(state.starLimitingMagnitude);
  starSettings.brightness = state.starBrightness;
  stars.setBrightness(state.starBrightness);
  starSettings.size = state.starSize;
  stars.setSize(state.starSize);
  starSettings.opacity = state.starOpacity;
  stars.setOpacity(state.starOpacity);

  while (observerRegistry.all().length < state.observers.length) addObserver();
  for (const obsState of state.observers) {
    observerRegistry.get(obsState.id)?.station.setLatLon(obsState.latDeg, obsState.lonDeg);
  }
  if (observerRegistry.get(state.activeObserverId)) {
    observerRegistry.setActive(state.activeObserverId);
    controlPanel.setActiveObserver(state.activeObserverId);
  }
  observerMarkersVisible = state.observerMarkersVisible;
  observerFarSideIndicatorEnabled = state.observerFarSideIndicatorEnabled;

  minimapManuallyVisible = state.minimapVisible;
  minimapOpacity = state.minimapOpacity;
  minimapHud.setOpacity(state.minimapOpacity);

  if (state.stonehengePlacedAt) {
    stonehenge.place(state.stonehengePlacedAt.latDeg, state.stonehengePlacedAt.lonDeg);
    controlPanel.setStonehengeLocation(state.stonehengePlacedAt);
  }

  setAnchorBody(state.anchorBodyId);
  setLookAtBody(state.lookAtBodyId);
  // Snap the orbit target to the anchor body's CURRENT live position before
  // setting distance - setAnchorBody only registers the ongoing per-frame
  // ease (see OrbitCameraRig.snapTarget's doc comment for why relying on
  // that ease alone leaves setSpaceDistance measuring from a stale point,
  // framing wherever the camera happened to be instead of the body).
  const anchoredBody = state.anchorBodyId ? targetableBodies.find((b) => b.id === state.anchorBodyId) : undefined;
  if (anchoredBody) cameraManager.setSpaceTarget(anchoredBody.object3D.getWorldPosition(new THREE.Vector3()));
  cameraManager.setSpaceDistance(state.spaceCameraDistance);

  for (const p of planetLayers) {
    const planetState = state.planets[p.cfg.id];
    if (!planetState) continue;
    p.orbitLineVisible = planetState.orbitLine;
    p.ptolemaicVisible = planetState.ptolemaic;
    p.truePathVisible = planetState.truePath;
    p.skyPathVisible = planetState.skyPath;
  }

  // Plain layer toggles first, then every scene-dependent recompute on top -
  // these win over whatever the raw ids above just set for the specific
  // sub-layers they each gate (see applyPlanetOrbitLineVisibility etc.'s own
  // doc comments).
  layers.show(state.layers);
  applyEarthOrbitPathVisibility();
  applyPlanetOrbitLineVisibility();
  applyPlanetPtolemaicVisibility();
  applyPlanetTruePathVisibility();
  layers.show(Object.fromEntries(planetLayers.map((p) => [p.skyPath.id, p.skyPathVisible])));
  applyPathLabelsVisibility();

  controlPanel.setActiveScene(state.scene);
  controlPanel.syncLayerToggles({
    ...state.layers,
    hideNearHemisphere: state.hemisphereMode === "hide",
    fadeNearHemisphere: state.hemisphereMode === "fade",
    minimapVisible: state.minimapVisible,
    earthRotation: state.earthRotationEnabled,
    ...Object.fromEntries(
      planetLayers.flatMap((p) => [
        [`${p.cfg.id}OrbitLine`, p.orbitLineVisible],
        [`${p.cfg.id}Ptolemaic`, p.ptolemaicVisible],
        [`${p.cfg.id}TruePath`, p.truePathVisible],
        [`${p.cfg.id}SkyPath`, p.skyPathVisible],
      ]),
    ),
  });
  controlPanel.syncSliders({
    skyRadius: state.skyRadius,
    wireframeOpacity: state.wireframeOpacity,
    sunDistanceRadii: state.sunDistanceRadii,
    moonDistanceRadii: state.moonDistanceRadii,
    sunSizeRadii: state.sunSizeRadii,
    moonSizeRadii: state.moonSizeRadii,
    moonDarkSideBrightness: state.moonDarkSideBrightness,
    axialTilt: state.earthAxialTiltDeg,
    planetVisibilityBoost: state.planetVisibilityBoost,
    starLimitingMagnitude: state.starLimitingMagnitude,
    starBrightness: state.starBrightness,
    starSize: state.starSize,
    starOpacity: state.starOpacity,
    minimapOpacity: state.minimapOpacity,
    timeScale: state.timeSpeed,
  });
}

// Fetched at runtime (not a static import) - see VideoLibrary.ts's own doc
// comment for why: public/videos.json is Claude's private working file
// (gitignored), so a missing/malformed file degrades to an empty library
// instead of breaking the whole app's build. A page refresh after Claude
// edits the file is all that's needed to pick up changes - no rebuild.
const videoLibrary: VideoLibrary = await fetch("/videos.json")
  .then((res) => (res.ok ? (res.json() as Promise<VideoLibrary>) : EMPTY_VIDEO_LIBRARY))
  .catch(() => EMPTY_VIDEO_LIBRARY);

function selectShot(videoId: string, shotId: string): void {
  const shot = videoLibrary.videos.find((v) => v.id === videoId)?.shots.find((s) => s.id === shotId);
  if (!shot) {
    console.warn(`selectShot: unknown video/shot "${videoId}/${shotId}"`);
    return;
  }
  applySceneState(shot.state);
  controlPanel.setActiveShot(videoId, shotId);
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
  videos: {
    videos: videoLibrary.videos,
    onSelectShot: selectShot,
  },
  sceneIO: {
    getCurrentStateJson: () => JSON.stringify(captureSceneState(), null, 2),
    onApplyJson: (json) => {
      try {
        const state = JSON.parse(json) as SceneState;
        if (state.version !== SCENE_STATE_VERSION) {
          console.warn(`Scene JSON version ${state.version} != current ${SCENE_STATE_VERSION} - applying anyway.`);
        }
        applySceneState(state);
      } catch (err) {
        console.error("Failed to apply scene JSON:", err);
        alert(`Couldn't apply that scene JSON - see console for details.\n${(err as Error).message}`);
      }
    },
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
      onChange: (v) => {
        earthAxialTiltDeg = v;
        earthBase.setAxialTilt(v);
      },
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
    sunMode: {
      entries: [
        { id: SunMode.Dim, label: "Dim" },
        { id: SunMode.Bright, label: "Bright" },
        { id: SunMode.Textury, label: "Textury" },
      ],
      activeId: sunMode,
      onSwitchActive: switchSunMode,
    },
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
      onChange: (v: number) => {
        sunSizeRadii = v;
        sunMarker.setMarkerSize(EARTH_RADIUS * v);
      },
    },
    moonSize: {
      value: MOON_SIZE_DEFAULT_RADII,
      min: MOON_SIZE_MIN_RADII,
      max: MOON_SIZE_MAX_RADII,
      step: 0.05,
      format: (v: number) => `${v.toFixed(2)} R⊕`,
      onChange: (v: number) => {
        moonSizeRadii = v;
        moonMarker.setMarkerSize(EARTH_RADIUS * v);
      },
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
      onChange: (v: number) => {
        moonDarkSideBrightness = v;
        moonMarker.setDarkSideBrightness(v);
      },
    },
  },
  planets: {
    allMarkersVisible: {
      checked: true,
      onChange: (v: boolean) => {
        const visibility = Object.fromEntries(planetLayers.map((p) => [p.marker.id, v]));
        layers.show(visibility);
        controlPanel.syncLayerToggles(visibility);
      },
    },
    allOrbitLinesVisible: {
      checked: false,
      onChange: (v: boolean) => {
        for (const p of planetLayers) p.orbitLineVisible = v;
        applyPlanetOrbitLineVisibility();
        // The checkbox is registered under `${id}OrbitLine` (see
        // ControlPanel's buildPlanetToggleRow) - a UI-only id, distinct
        // from the real layer ids (OrbitLineHelio/DeferentGeo/EpicycleGeo)
        // it controls, since only some of those are ever actually visible
        // at once.
        controlPanel.syncLayerToggles(Object.fromEntries(planetLayers.map((p) => [`${p.cfg.id}OrbitLine`, v])));
      },
    },
    allPtolemaicVisible: {
      checked: false,
      onChange: (v: boolean) => {
        for (const p of planetLayers) p.ptolemaicVisible = v;
        applyPlanetPtolemaicVisibility();
        // Same UI-only-id reasoning as allOrbitLinesVisible above - the
        // checkbox is registered under `${id}Ptolemaic`, distinct from the
        // real PtolemaicDeferentGeo/PtolemaicEpicycleGeo layer ids.
        controlPanel.syncLayerToggles(Object.fromEntries(planetLayers.map((p) => [`${p.cfg.id}Ptolemaic`, v])));
      },
    },
    allTruePathsVisible: {
      checked: false,
      onChange: (v: boolean) => {
        for (const p of planetLayers) p.truePathVisible = v;
        applyPlanetTruePathVisibility();
        // Same UI-only-id reasoning as allOrbitLinesVisible above - the
        // checkbox is registered under `${id}TruePath`, distinct from the
        // real TruePathGeo layer id.
        controlPanel.syncLayerToggles(Object.fromEntries(planetLayers.map((p) => [`${p.cfg.id}TruePath`, v])));
      },
    },
    allSkyPathsVisible: {
      checked: false,
      onChange: (v: boolean) => {
        // Sky Path has no Scene gating (see its own construction above -
        // it's model-agnostic, correct in both Scenes) - unlike the two
        // master toggles above, the checkbox id and the real layer id are
        // the same, so a single fan-out covers both effects.
        for (const p of planetLayers) p.skyPathVisible = v;
        const visibility = Object.fromEntries(planetLayers.map((p) => [p.skyPath.id, v]));
        layers.show(visibility);
        controlPanel.syncLayerToggles(visibility);
        applyPathLabelsVisibility();
      },
    },
    labelsVisible: {
      checked: false,
      onChange: (v: boolean) => layers.show({ planetLabels: v }),
    },
    pathLabelsVisible: {
      checked: false,
      onChange: (v: boolean) => {
        pathLabelsVisible = v;
        applyPathLabelsVisibility();
      },
    },
    visibilityBoost: {
      value: PLANET_VISIBILITY_BOOST_DEFAULT,
      min: PLANET_VISIBILITY_BOOST_MIN,
      max: PLANET_VISIBILITY_BOOST_MAX,
      step: 0.1,
      format: (v: number) => `${v.toFixed(1)}x`,
      onChange: setPlanetVisibilityBoost,
    },
    entries: planetLayers.map((p) => ({
      id: p.cfg.id,
      label: p.cfg.label,
      marker: { checked: defaultLayerVisibility[p.marker.id], onChange: (v: boolean) => layers.show({ [p.marker.id]: v }) },
      orbitLine: {
        checked: false,
        onChange: (v: boolean) => {
          p.orbitLineVisible = v;
          applyPlanetOrbitLineVisibility();
        },
      },
      ptolemaic: {
        checked: false,
        onChange: (v: boolean) => {
          p.ptolemaicVisible = v;
          applyPlanetPtolemaicVisibility();
        },
      },
      truePath: {
        checked: false,
        onChange: (v: boolean) => {
          p.truePathVisible = v;
          applyPlanetTruePathVisibility();
        },
      },
      skyPath: {
        checked: false,
        onChange: (v: boolean) => {
          p.skyPathVisible = v;
          layers.show({ [p.skyPath.id]: v });
          applyPathLabelsVisibility();
        },
      },
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
    milkyWayVisible: { checked: true, onChange: (v) => layers.show({ milkyWayPanorama: v }) },
    wireframeOpacity: {
      value: CELESTIAL_SPHERE_WIREFRAME_OPACITY_DEFAULT,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (v) => {
        wireframeOpacity = v;
        celestialSphereShell.setWireframeOpacity(v);
      },
    },
    onHemisphereModeChange,
    stars: {
      visible: { checked: true, onChange: (v) => layers.show({ stars: v }) },
      limitingMagnitude: {
        value: STARS_DEFAULT.limitingMagnitude,
        min: STAR_LIMITING_MAGNITUDE_MIN,
        max: STAR_LIMITING_MAGNITUDE_MAX,
        step: 0.1,
        onChange: (v) => {
          starSettings.limitingMagnitude = v;
          stars.setLimitingMagnitude(v);
        },
      },
      brightness: {
        value: STARS_DEFAULT.brightness,
        min: 0.1,
        max: 1,
        step: 0.05,
        onChange: (v) => {
          starSettings.brightness = v;
          stars.setBrightness(v);
        },
      },
      size: {
        value: STARS_DEFAULT.size,
        min: 0.25,
        max: 4,
        step: 0.25,
        onChange: (v) => {
          starSettings.size = v;
          stars.setSize(v);
        },
      },
      opacity: {
        value: STARS_DEFAULT.opacity,
        min: 0.1,
        max: 1,
        step: 0.05,
        onChange: (v) => {
          starSettings.opacity = v;
          stars.setOpacity(v);
        },
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
      onChange: (v) => {
        minimapOpacity = v;
        minimapHud.setOpacity(v);
      },
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

  // Each planet's epicycle rides on a carrier positioned at wherever its
  // OWN deferent currently sits (see planetLayers' own deferentGeo doc
  // comment for the sign reasoning) - the planet's own real Sun-relative
  // position (+planetHelio) for a superior planet, or the Sun's own real
  // Earth-relative position (-earthHelio, isInferior) for an inferior one.
  // Only visually matters in Geocentric, but cheap enough to keep live
  // unconditionally (same rationale as groundScatter.regenerateAround
  // below).
  for (const p of planetLayers) {
    const scale = (EARTH_RADIUS * sunDistanceRadii) / EARTH_ORBIT_RADIUS;
    const carrierPos = p.isInferior ? getSunOffsetFromEarth(universeState, scale) : getBodyOffsetFromSun(universeState, p.cfg.id, scale);
    p.epicycleCarrier.position.set(carrierPos.x, carrierPos.y, carrierPos.z);
    // Spoke line's far endpoint follows the same carrier position - its
    // near endpoint stays at (0,0,0) (Earth, in earthBase.object3D's own
    // local space) always.
    const spokePositions = p.epicycleSpokeLine.geometry.attributes.position;
    spokePositions.setXYZ(1, carrierPos.x, carrierPos.y, carrierPos.z);
    spokePositions.needsUpdate = true;

    // Ptolemaic carrier: the SAME direction as the Tychonic carrier above
    // (same real body, same real angular position - that's what preserves
    // correct apparent DIRECTION), just scaled down by ptolemaicScaleFactor
    // to match the capped deferent/epicycle radii (see planetLayers' own
    // doc comment).
    const ptolemaicCarrierPos = {
      x: carrierPos.x * p.ptolemaicScaleFactor,
      y: carrierPos.y * p.ptolemaicScaleFactor,
      z: carrierPos.z * p.ptolemaicScaleFactor,
    };
    p.ptolemaicCarrier.position.set(ptolemaicCarrierPos.x, ptolemaicCarrierPos.y, ptolemaicCarrierPos.z);
    const ptolemaicSpokePositions = p.ptolemaicSpokeLine.geometry.attributes.position;
    ptolemaicSpokePositions.setXYZ(1, ptolemaicCarrierPos.x, ptolemaicCarrierPos.y, ptolemaicCarrierPos.z);
    ptolemaicSpokePositions.needsUpdate = true;
  }

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
  milkyWayPanorama.setDayNightFactor(skyFadeFactor);
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
