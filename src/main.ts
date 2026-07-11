import * as THREE from "three";
import "./style.css";
import "./ui/controlPanel.css";

import { SimulationClock } from "./core/SimulationClock";
import { Earth } from "./entities/Earth";
import { StarSphere } from "./entities/StarSphere";
import type { Entity } from "./entities/Entity";
import { CameraManager } from "./cameras/CameraManager";
import { CameraMode } from "./cameras/CameraMode";
import { ControlPanel } from "./ui/ControlPanel";
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
// Replaced by a real Sun entity in a later milestone.
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(5, 3, 5);
scene.add(keyLight);

// --- Entities -----------------------------------------------------------

const earth = new Earth();
const starSphere = new StarSphere();
const entities: Entity[] = [earth, starSphere];

scene.add(earth.object3D);
scene.add(starSphere.object3D);

// --- Cameras --------------------------------------------------------------

const cameraManager = new CameraManager(earth.groundStation, renderer.domElement);

// --- Simulation clock -----------------------------------------------------

const simClock = new SimulationClock();

// --- UI ---------------------------------------------------------------

const controlPanel = new ControlPanel(container, {
  onRotateEarthChange: (enabled) => {
    earth.rotationEnabled = enabled;
  },
  onShowEarthChange: (visible) => {
    earth.setVisible(visible);
  },
  onShowStarsChange: (visible) => {
    starSphere.setVisible(visible);
  },
  onShowAxisChange: (visible) => {
    earth.setAxisVisible(visible);
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
  for (const entity of entities) {
    entity.update(deltaSeconds);
  }
  cameraManager.update();
  renderer.render(scene, cameraManager.getActiveCamera());
});
