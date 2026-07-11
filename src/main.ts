import * as THREE from "three";
import "./style.css";
import "./ui/controlPanel.css";

import { SimulationClock } from "./core/SimulationClock";
import { LayerRegistry } from "./layers/LayerRegistry";
import { EarthBase } from "./layers/earth/EarthBase";
import { ContinentsLayer } from "./layers/earth/ContinentsLayer";
import { AxisLayer } from "./layers/earth/AxisLayer";
import { StarsLayer } from "./layers/sky/StarsLayer";
import { CameraManager } from "./cameras/CameraManager";
import { CameraMode } from "./cameras/CameraMode";
import { ControlPanel, type LayerToggleDef } from "./ui/ControlPanel";
import { COLORS } from "./config/constants";

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

// --- Layers ---------------------------------------------------------------
// Every independently-toggleable piece of the scene registers here. Adding
// a new layer later means: write a Layer, register it, add a toggle def -
// no changes to ControlPanel or the render loop required.

const layers = new LayerRegistry();

const earthBase = new EarthBase();
const continents = new ContinentsLayer(earthBase.mesh, earthBase.oceanMaterial);
const axis = new AxisLayer(earthBase.rotationGroup);
const stars = new StarsLayer();

layers.register(earthBase);
layers.register(continents);
layers.register(axis);
layers.register(stars);

scene.add(earthBase.object3D);
scene.add(stars.object3D);

const layerToggles: LayerToggleDef[] = [
  { id: earthBase.id, label: earthBase.label, defaultVisible: true },
  { id: continents.id, label: continents.label, defaultVisible: true },
  { id: stars.id, label: stars.label, defaultVisible: true },
  { id: axis.id, label: axis.label, defaultVisible: true },
];
layers.show(Object.fromEntries(layerToggles.map((t) => [t.id, t.defaultVisible])));

// --- Cameras --------------------------------------------------------------

const cameraManager = new CameraManager(earthBase.groundStation, renderer.domElement);

// --- Simulation clock -----------------------------------------------------

const simClock = new SimulationClock();

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
