import * as THREE from "three";
import type { Layer } from "../Layer";
import { BASE_EARTH_ANGULAR_SPEED, COLORS, EARTH_RADIUS } from "../../config/constants";
import { EARTH_AXIAL_TILT_DEG } from "../../astronomy/constants";

/**
 * The fundamental Earth layer: an ocean-colored sphere plus the three
 * nested groups everything else on Earth attaches to:
 *  - `object3D` (orbitGroup): where Earth sits in space. Idle today,
 *    will carry Earth's revolution around the Sun later.
 *  - `tiltGroup`: fixed axial tilt, settable via setAxialTilt(). Tilts
 *    around the same world Z axis as ModernHeliocentricModel's
 *    (unused-so-far) EARTH_ROTATION_AXIS constant ({x:sin(tilt),
 *    y:cos(tilt), z:0}) - a FIXED direction in the ecliptic/world frame,
 *    not relative to Earth's current orbital position, matching how real
 *    axial tilt stays pointed at the same direction in space as Earth
 *    orbits (that constancy is what causes seasons). Keeping this
 *    convention consistent now means a future Sun-direction-tracking
 *    light (day/night terminator) will show correct seasonal behavior
 *    without EarthBase needing to know anything about orbital position.
 *  - `rotationGroup`: spins around the (tilted) axis. Geographic/
 *    environmental layers (continents, clouds, grids, the axis line) and
 *    any number of ObserverStation instances all parent into this so they
 *    rotate rigidly with the planet. EarthBase itself owns no observer/
 *    ground-station state - see src/observers/ObserverStation.ts.
 *
 * Unlike most layers this one can't be fully hidden - "Show Earth" only
 * toggles the mesh itself, since the rotation frame is load-bearing for
 * every other Earth layer and for Ground View.
 */
export class EarthBase implements Layer {
  readonly id = "earthBase";
  readonly label = "Show Earth";
  readonly group = "Earth.Base" as const;

  readonly object3D: THREE.Group;
  readonly tiltGroup: THREE.Group;
  readonly rotationGroup: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly oceanMaterial: THREE.MeshStandardMaterial;

  rotationEnabled = true;

  constructor() {
    this.object3D = new THREE.Group();
    this.object3D.name = "Earth.orbitGroup";

    this.tiltGroup = new THREE.Group();
    this.tiltGroup.name = "Earth.tiltGroup";
    this.object3D.add(this.tiltGroup);
    this.setAxialTilt(EARTH_AXIAL_TILT_DEG);

    this.rotationGroup = new THREE.Group();
    this.rotationGroup.name = "Earth.rotationGroup";
    this.tiltGroup.add(this.rotationGroup);

    this.oceanMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.earth,
      roughness: 1,
      metalness: 0,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 48, 32), this.oceanMaterial);
    this.mesh.name = "Earth.mesh";
    this.rotationGroup.add(this.mesh);
  }

  /** Tilts the rotation axis by `tiltDeg` from vertical, around a fixed
   *  world-space direction - see the class doc comment for why this must
   *  stay orbit-position-independent. 0 = no tilt (straight up). */
  setAxialTilt(tiltDeg: number): void {
    this.tiltGroup.rotation.z = -THREE.MathUtils.degToRad(tiltDeg);
  }

  update(deltaSeconds: number): void {
    if (this.rotationEnabled) {
      this.rotationGroup.rotation.y += BASE_EARTH_ANGULAR_SPEED * deltaSeconds;
    }
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }
}
