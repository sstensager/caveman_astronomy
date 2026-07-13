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
 *    around a fixed world Z axis - a FIXED direction in the ecliptic/world
 *    frame, not relative to Earth's current orbital position, matching how
 *    real axial tilt stays pointed at the same direction in space as Earth
 *    orbits (that constancy is what causes seasons).
 *
 *    World +Y is NOT the ecliptic pole here - it's the true celestial pole,
 *    i.e. wherever the star catalog's Dec=+90 (very close to Polaris) is
 *    drawn (see starCatalog.ts's raDecToVector3), since that's the one
 *    fixed reference every rendered star position already uses. So
 *    setAxialTilt(EARTH_AXIAL_TILT_DEG) - the real, default tilt - has to
 *    put the axis EXACTLY at world +Y to line up with the real Polaris,
 *    not tilted away from it: the tilt applied here is the DEVIATION from
 *    EARTH_AXIAL_TILT_DEG, not the raw slider value. Only deviating from
 *    the real value should visibly swing the axis away from Polaris - that
 *    misalignment is the whole point of letting the tilt be explored
 *    ("what if Earth's tilt were different, what would the pole star be
 *    instead"), so it must be zero exactly at the real value, not for
 *    every value.
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
   *  stay orbit-position-independent, and why the actual rotation applied
   *  is the deviation from EARTH_AXIAL_TILT_DEG (the real value), not
   *  `tiltDeg` itself - only that deviation should swing the axis away
   *  from world +Y/Polaris. */
  setAxialTilt(tiltDeg: number): void {
    this.tiltGroup.rotation.z = -THREE.MathUtils.degToRad(tiltDeg - EARTH_AXIAL_TILT_DEG);
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
