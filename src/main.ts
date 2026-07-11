import * as THREE from "three";
import "./style.css";
import "./ui/controlPanel.css";

import { SimulationClock } from "./core/SimulationClock";
import { LayerRegistry } from "./layers/LayerRegistry";
import { CompositeLayer } from "./layers/CompositeLayer";
import { EarthBase } from "./layers/earth/EarthBase";
import { ContinentsLayer } from "./layers/earth/ContinentsLayer";
import { AxisLayer } from "./layers/earth/AxisLayer";
import { StarsLayer, buildStarGeometry } from "./layers/sky/StarsLayer";
import { CelestialMarkerLayer } from "./layers/sky/CelestialMarkerLayer";
import { CelestialSphereShell } from "./layers/sky/CelestialSphereShell";
import { ModernHeliocentricModel } from "./astronomy/models/ModernHeliocentricModel";
import { generatePlaceholderStarCatalog } from "./astronomy/starCatalog";
import { BodyIds } from "./astronomy/types";
import { GroundObserver } from "./observers/GroundObserver";
import { CameraManager } from "./cameras/CameraManager";
import { CameraMode } from "./cameras/CameraMode";
import { ControlPanel, type LayerToggleDef, type ViewModeDef } from "./ui/ControlPanel";
import { CELESTIAL_GLOBE_RADIUS, CELESTIAL_SPHERE_RADIUS, COLORS, STAR_COUNT } from "./config/constants";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) throw new Error("#app container not found");

// --- Renderer & scene -------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.background);

// Flat, non-toggleable scene lighting so Earth reads as a sphere.
// Replaced by a real Sun layer in a later milestone.
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(5, 3, 5);
scene.add(keyLight);

// --- Simulation clock -----------------------------------------------------

const simClock = new SimulationClock();

// --- Astronomy: model + observer -------------------------------------------
// The model never touches THREE.js; GroundObserver is the one place its
// plain domain values become THREE.Vector3s. See src/astronomy and
// src/observers for the full pipeline this feeds into.

const astronomyModel = new ModernHeliocentricModel();

// --- Layers ---------------------------------------------------------------
// Every independently-toggleable piece of the scene registers here. Adding
// a new layer later means: write a Layer, register it, add a toggle def -
// no changes to ControlPanel or the render loop required.
//
// Stars and Sun/Moon markers each exist as TWO render representations - an
// immersive sky-scale one (radius CELESTIAL_SPHERE_RADIUS, used by Space and
// Ground views) and a small "explanatory globe" one (radius
// CELESTIAL_GLOBE_RADIUS, used by the Celestial Sphere view) - fused under
// ONE CompositeLayer/checkbox per concept so the toggle count doesn't
// double. Both representations are driven by the identical model+observer
// pipeline; only the projection radius differs.

const layers = new LayerRegistry();

const earthBase = new EarthBase();
const continents = new ContinentsLayer(earthBase.mesh, earthBase.oceanMaterial);
const axis = new AxisLayer(earthBase.rotationGroup);

const groundObserver = new GroundObserver(earthBase.groundStation);
const getSimulationTime = () => simClock.getElapsedDays();

const starCatalog = generatePlaceholderStarCatalog(STAR_COUNT);
const starGeometry = buildStarGeometry(starCatalog);
const starsSky = new StarsLayer(starGeometry, CELESTIAL_SPHERE_RADIUS, "starsSky", "Stars (sky)");
const starsGlobe = new StarsLayer(starGeometry, CELESTIAL_GLOBE_RADIUS, "starsGlobe", "Stars (globe)");
const stars = new CompositeLayer("stars", "Show Stars", "Sky.Observation", [starsSky, starsGlobe]);

const sunMarkerSky = new CelestialMarkerLayer(BodyIds.Sun, astronomyModel, groundObserver, getSimulationTime, {
  id: "sunMarkerSky",
  label: "Sun (sky)",
  color: COLORS.sun,
  radius: CELESTIAL_SPHERE_RADIUS,
});
const sunMarkerGlobe = new CelestialMarkerLayer(BodyIds.Sun, astronomyModel, groundObserver, getSimulationTime, {
  id: "sunMarkerGlobe",
  label: "Sun (globe)",
  color: COLORS.sun,
  radius: CELESTIAL_GLOBE_RADIUS,
});
const sunMarker = new CompositeLayer("sunMarker", "Show Sun", "Sky.Observation", [sunMarkerSky, sunMarkerGlobe]);

const moonMarkerSky = new CelestialMarkerLayer(BodyIds.Moon, astronomyModel, groundObserver, getSimulationTime, {
  id: "moonMarkerSky",
  label: "Moon (sky)",
  color: COLORS.moon,
  radius: CELESTIAL_SPHERE_RADIUS,
});
const moonMarkerGlobe = new CelestialMarkerLayer(BodyIds.Moon, astronomyModel, groundObserver, getSimulationTime, {
  id: "moonMarkerGlobe",
  label: "Moon (globe)",
  color: COLORS.moon,
  radius: CELESTIAL_GLOBE_RADIUS,
});
const moonMarker = new CompositeLayer("moonMarker", "Show Moon", "Sky.Observation", [moonMarkerSky, moonMarkerGlobe]);

const celestialSphereShell = new CelestialSphereShell(CELESTIAL_GLOBE_RADIUS);

layers.register(earthBase);
layers.register(continents);
layers.register(axis);
layers.register(stars);
layers.register(sunMarker);
layers.register(moonMarker);
layers.register(celestialSphereShell);

scene.add(earthBase.object3D);
scene.add(starsSky.object3D, starsGlobe.object3D);
scene.add(sunMarkerSky.object3D, sunMarkerGlobe.object3D);
scene.add(moonMarkerSky.object3D, moonMarkerGlobe.object3D);
scene.add(celestialSphereShell.object3D);

const layerToggles: LayerToggleDef[] = [
  { id: earthBase.id, label: earthBase.label, defaultVisible: true },
  { id: continents.id, label: continents.label, defaultVisible: true },
  { id: stars.id, label: stars.label, defaultVisible: true },
  { id: axis.id, label: axis.label, defaultVisible: true },
  { id: sunMarker.id, label: sunMarker.label, defaultVisible: true },
  { id: moonMarker.id, label: moonMarker.label, defaultVisible: true },
  { id: celestialSphereShell.id, label: celestialSphereShell.label, defaultVisible: true },
];
layers.show(Object.fromEntries(layerToggles.map((t) => [t.id, t.defaultVisible])));

// --- Cameras --------------------------------------------------------------

const cameraManager = new CameraManager(earthBase.groundStation, renderer.domElement);

const viewModes: ViewModeDef[] = [
  { mode: CameraMode.Space, label: "Space View" },
  { mode: CameraMode.Ground, label: "Ground View" },
  { mode: CameraMode.CelestialSphere, label: "Celestial Sphere" },
];

// --- UI ---------------------------------------------------------------

const controlPanel = new ControlPanel(container, {
  layerToggles,
  onLayerToggle: (id, visible) => {
    layers.show({ [id]: visible });
  },
  onRotateEarthChange: (enabled) => {
    earthBase.rotationEnabled = enabled;
  },
  onTimeSpeedChange: (speed) => {
    simClock.timeSpeed = speed;
  },
  viewModes,
  onCameraModeChange: (mode) => {
    cameraManager.setMode(mode);
    controlPanel.setActiveCameraMode(mode);
  },
});
controlPanel.setActiveCameraMode(CameraMode.Space);

// --- Render loop --------------------------------------------------------

function onResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  cameraManager.setAspect(width / height);
}
window.addEventListener("resize", onResize);
onResize();

renderer.setAnimationLoop(() => {
  const deltaSeconds = simClock.tick();
  layers.update(deltaSeconds);
  cameraManager.update();
  renderer.render(scene, cameraManager.getActiveCamera());
});
