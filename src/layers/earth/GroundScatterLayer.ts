import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import { EARTH_RADIUS } from "../../config/constants";
import { computeNorthEast, latLonToSurfacePoint, surfacePointToLatLon } from "../../utils/geo";
import { embedOnSphere, tangentPolarPoint } from "../../utils/surfacePlacement";
import type { LandMaskSampler } from "../../utils/landMask";
import { nearestMountainRange } from "./mountainRanges";
import { buildMountain, buildRock, buildSailboat, buildTree } from "./lowPolyProps";

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const POLAR_AXIS = new THREE.Vector3(0, 1, 0);

// Live-tuned down from 12 - the first pass read as too dense/cluttered.
const PROP_COUNT = 2;
const SCATTER_MIN_RADIUS = EARTH_RADIUS * 0.06;
const SCATTER_MAX_RADIUS = EARTH_RADIUS * 0.22;
// Regenerate once the observer has walked roughly half the scatter radius
// from where the current cluster was generated - far enough that props
// don't pop in/out continuously mid-stride, close enough that new terrain
// keeps appearing as you actually explore.
const REGEN_THRESHOLD = EARTH_RADIUS * 0.12;
// Lat/lon rounded to this grid before seeding the RNG, so tiny repeated
// regenerateAround calls near the "same" spot (which won't land on the
// exact same float lat/lon twice) still converge on the same-looking
// cluster instead of drifting to a visibly different one each time.
const SEED_GRID_DEG = 0.5;
const SNOWY_LATITUDE_DEG = 55;

// Same "sink slightly below the true surface" fudge scenerySandbox.ts's
// prototype validated live - a rigid, flat-bottomed prop on a curved
// surface always shows some gap at its edges even when its own origin sits
// exactly on the sphere, since the sphere curves away beneath its extent.
const SURFACE_EMBED_DEPTH = EARTH_RADIUS * 0.015;

/** Tiny deterministic PRNG (mulberry32), seeded from location - see
 *  hashLatLon below, not from wall-clock time or call order. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashLatLon(latDeg: number, lonDeg: number): number {
  const key = `${latDeg.toFixed(2)},${lonDeg.toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  }
  return hash;
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const material = child.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  });
}

/**
 * Real, geography-pinned ground scenery: trees/rocks on land, boats/rocks
 * on water, rocks-only on ice (real ice sheets don't have forests), and
 * mountains near real mountain ranges (mountainRanges.ts) - see feedback
 * memory "no camera/observer-relative decoration" for why this replaced an
 * earlier, reverted HorizonSilhouetteLayer approach. Parented under
 * `earthBase.rotationGroup` (fixed to the globe, same frame ContinentsLayer's
 * mesh lives in) by main.ts, NOT under any ObserverStation - walking away
 * via WASD actually leaves a prop behind rather than dragging it along.
 *
 * Regenerates only a small LOCAL cluster around wherever `regenerateAround`
 * is last called from (main.ts's render loop pushes the active observer's
 * current lat/lon every frame; this is a cheap no-op unless it's moved past
 * REGEN_THRESHOLD) rather than pre-populating the whole globe: at this
 * app's scale the visible horizon from an observer's own height works out
 * to roughly sqrt(2*EARTH_RADIUS*OBSERVER_HEIGHT) ~= 0.7 units, so anything
 * scattered further away would almost never be seen from any single
 * vantage point anyway - pure wasted geometry.
 *
 * Deterministic per location: the scatter's RNG is seeded from lat/lon
 * rounded to SEED_GRID_DEG (see hashLatLon), not from call order or
 * wall-clock time, so walking away and back regenerates the same-looking
 * cluster instead of a fresh random one every time.
 */
export class GroundScatterLayer implements Layer {
  readonly id = "groundScatter";
  readonly label = "Ground Scatter (trees, rocks, mountains, boats)";
  readonly group: LayerGroup = "Earth.Environmental";
  readonly object3D: THREE.Group;

  private readonly landMask: LandMaskSampler;
  private lastOrigin?: THREE.Vector3;

  constructor(landMask: LandMaskSampler) {
    this.landMask = landMask;
    this.object3D = new THREE.Group();
    this.object3D.name = "GroundScatter";
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  /** Called every frame from main.ts's render loop with the active
   *  observer's current lat/lon - internally a no-op unless the observer
   *  has moved past REGEN_THRESHOLD since the last rebuild. */
  regenerateAround(latDeg: number, lonDeg: number): void {
    const origin = latLonToSurfacePoint(latDeg, lonDeg, EARTH_RADIUS);
    if (this.lastOrigin && this.lastOrigin.distanceTo(origin) < REGEN_THRESHOLD) return;
    this.lastOrigin = origin;
    this.rebuild(origin);
  }

  private rebuild(origin: THREE.Vector3): void {
    for (const child of [...this.object3D.children]) {
      this.object3D.remove(child);
      disposeObject3D(child);
    }

    const { latDeg: originLat, lonDeg: originLon } = surfacePointToLatLon(origin);
    const seedLat = Math.round(originLat / SEED_GRID_DEG) * SEED_GRID_DEG;
    const seedLon = Math.round(originLon / SEED_GRID_DEG) * SEED_GRID_DEG;
    const random = mulberry32(hashLatLon(seedLat, seedLon));

    const referenceUp = origin.clone().normalize();
    const { north, east } = computeNorthEast(referenceUp, POLAR_AXIS);

    for (let i = 0; i < PROP_COUNT; i++) {
      const bearingDeg = random() * 360;
      const radius = SCATTER_MIN_RADIUS + random() * (SCATTER_MAX_RADIUS - SCATTER_MIN_RADIUS);
      const offsetPoint = tangentPolarPoint(origin, north, east, bearingDeg, radius);
      const { latDeg: pointLat, lonDeg: pointLon } = surfacePointToLatLon(offsetPoint);

      const prop = this.choosePropForPoint(pointLat, pointLon, random);
      const { position, up } = embedOnSphere(offsetPoint, EARTH_RADIUS, SURFACE_EMBED_DEPTH);
      prop.position.copy(position);
      prop.quaternion.setFromUnitVectors(WORLD_UP, up);
      this.object3D.add(prop);
    }
  }

  private choosePropForPoint(latDeg: number, lonDeg: number, random: () => number): THREE.Object3D {
    const mountain = nearestMountainRange(latDeg, lonDeg);
    if (mountain) {
      const heightScale = Math.max(0.25, (0.5 + 0.5 * mountain.factor) * mountain.peakScale);
      return buildMountain(heightScale);
    }

    const cover = this.landMask.classify(latDeg, lonDeg);
    if (cover === "ocean") {
      return random() < 0.6
        ? buildSailboat(0.7 + random() * 0.6)
        : buildRock(0.6 + random() * 0.5, random() * Math.PI * 2);
    }
    if (cover === "ice") {
      return buildRock(0.7 + random() * 0.6, random() * Math.PI * 2);
    }
    const variant = Math.abs(latDeg) > SNOWY_LATITUDE_DEG ? "snowy" : "temperate";
    return random() < 0.7
      ? buildTree(variant, 0.7 + random() * 0.6)
      : buildRock(0.4 + random() * 0.5, random() * Math.PI * 2);
  }
}
