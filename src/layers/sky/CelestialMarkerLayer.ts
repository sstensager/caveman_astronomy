import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { AstronomyModel, BodyId, SimulationTime } from "../../astronomy/types";
import type { Observer } from "../../observers/Observer";
import { projectDirectionToSphere } from "../../observers/projection";
import { CELESTIAL_MARKER_SIZE_RATIO } from "../../config/constants";

export interface CelestialMarkerOptions {
  id: string;
  label: string;
  color: number;
  /** The celestial sphere radius to project this marker onto. */
  radius: number;
}

/**
 * A generic, body-agnostic marker on a celestial sphere. NEVER computes its
 * own orbital position - each update() call is exactly:
 * model.getState() -> observer.getDirectionTo() -> projectDirectionToSphere().
 * Instantiated once per (body, sphere radius) pair - see main.ts, where
 * "Show Sun"/"Show Moon" each fuse a sky-scale and globe-scale instance of
 * this same class under one CompositeLayer.
 */
export class CelestialMarkerLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup = "Sky.Observation";
  readonly object3D: THREE.Mesh;

  private readonly bodyId: BodyId;
  private readonly model: AstronomyModel;
  private readonly observer: Observer;
  private readonly getSimulationTime: () => SimulationTime;
  private readonly radius: number;

  constructor(
    bodyId: BodyId,
    model: AstronomyModel,
    observer: Observer,
    getSimulationTime: () => SimulationTime,
    options: CelestialMarkerOptions,
  ) {
    this.bodyId = bodyId;
    this.model = model;
    this.observer = observer;
    this.getSimulationTime = getSimulationTime;
    this.radius = options.radius;
    this.id = options.id;
    this.label = options.label;

    const markerSize = options.radius * CELESTIAL_MARKER_SIZE_RATIO;
    const geometry = new THREE.SphereGeometry(markerSize, 16, 12);
    const material = new THREE.MeshBasicMaterial({ color: options.color });
    this.object3D = new THREE.Mesh(geometry, material);
    this.object3D.name = `CelestialMarker.${options.id}`;
  }

  update(): void {
    const time = this.getSimulationTime();
    const state = this.model.getState(time);
    const direction = this.observer.getDirectionTo(this.bodyId, state);
    this.object3D.position.copy(projectDirectionToSphere(direction, this.radius));
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }
}
