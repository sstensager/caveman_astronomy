import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import { EARTH_RADIUS } from "../../config/constants";
import { computeNorthEast, latLonToSurfacePoint } from "../../utils/geo";
import { embedOnSphere, tangentPolarPoint } from "../../utils/surfacePlacement";
import { computeHengeLayout } from "./hengeLayout";
import { buildStoneMonolith } from "./lowPolyProps";

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const POLAR_AXIS = new THREE.Vector3(0, 1, 0);

// Same fudge GroundScatterLayer uses - a rigid, flat-bottomed prop on a
// curved surface always shows some gap at its edges even when its own
// origin sits exactly on the sphere, see surfacePlacement.ts's doc comment.
const SURFACE_EMBED_DEPTH = EARTH_RADIUS * 0.015;

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
 * A solar-aligned stone circle: not a literal Stonehenge replica, but a
 * structure whose alignment stones are computed from this app's real solar
 * geometry (see hengeLayout.ts/sunHorizon.ts), demonstrating why an ancient
 * civilization at a given latitude might build one. Parented under
 * `earthBase.rotationGroup` in main.ts (same as GroundScatterLayer) -
 * geographically real, rigidly follows Earth's spin and the axial-tilt
 * slider like everything else standing on the ground.
 *
 * `place()` is a deliberate ONE-SHOT action, not an auto-following
 * `regenerateAround` like GroundScatterLayer: a henge is a singular,
 * deliberately-built structure demonstrating one location's solar geometry,
 * not ambient roaming clutter - walking away should leave it standing
 * where it was placed, not tear it down.
 */
export class StonehengeLayer implements Layer {
  readonly id = "stonehenge";
  readonly label = "Stonehenge (solar-aligned stone circle)";
  readonly group: LayerGroup = "Earth.Teaching";
  readonly object3D: THREE.Group;

  private placedLatDeg?: number;
  private placedLonDeg?: number;

  constructor() {
    this.object3D = new THREE.Group();
    this.object3D.name = "Stonehenge";
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  isPlaced(): boolean {
    return this.placedLatDeg !== undefined;
  }

  getPlacedLatLon(): { latDeg: number; lonDeg: number } | undefined {
    if (this.placedLatDeg === undefined || this.placedLonDeg === undefined) return undefined;
    return { latDeg: this.placedLatDeg, lonDeg: this.placedLonDeg };
  }

  /** Builds (or rebuilds, replacing whatever was there before) the monument
   *  at latDeg/lonDeg - see the class doc comment for why this is never
   *  called automatically from the render loop. */
  place(latDeg: number, lonDeg: number): void {
    for (const child of [...this.object3D.children]) {
      this.object3D.remove(child);
      disposeObject3D(child);
    }

    this.placedLatDeg = latDeg;
    this.placedLonDeg = lonDeg;

    const origin = latLonToSurfacePoint(latDeg, lonDeg, EARTH_RADIUS);
    const referenceUp = origin.clone().normalize();
    const { north, east } = computeNorthEast(referenceUp, POLAR_AXIS);

    for (const stone of computeHengeLayout(latDeg)) {
      const offsetPoint = tangentPolarPoint(origin, north, east, stone.bearingDeg, stone.radiusUnits);
      const { position, up } = embedOnSphere(offsetPoint, EARTH_RADIUS, SURFACE_EMBED_DEPTH);

      const prop = buildStoneMonolith(1, stone.kind === "marker");
      prop.position.copy(position);
      prop.quaternion.setFromUnitVectors(WORLD_UP, up);
      this.object3D.add(prop);
    }
  }
}
