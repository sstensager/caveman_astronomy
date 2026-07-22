import * as THREE from "three";
import type { Layer } from "../Layer";
import type { Vector3Like } from "../../astronomy/types";
import { BASE_EARTH_ANGULAR_SPEED, COLORS, EARTH_RADIUS } from "../../config/constants";
import { EARTH_AXIAL_TILT_DEG } from "../../astronomy/constants";

/**
 * The fundamental Earth layer: an ocean-colored sphere plus the three
 * nested groups everything else on Earth attaches to:
 *  - `object3D` (orbitGroup): where Earth sits in space - see
 *    setOrbitPosition(), driven by main.ts's render loop from whether
 *    Heliocentric is the active astronomy model AND its Real Distance tier
 *    is on. Fixed at the origin otherwise (every other system's
 *    assumption); carries Earth's real position relative to the Sun only
 *    in that one combination.
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

  // update()'s deltaSeconds carries normal real-frame-timing noise (vsync/
  // GC/OS-scheduling jitter, typically a few percent of a frame) - at high
  // time-speed multipliers that same relative noise becomes a large
  // absolute wobble in the rotation step size, since deltaSeconds is
  // already scaled by timeSpeed by the time it gets here (see
  // SimulationClock.tick). Earth's own low-frequency surface geometry
  // never shows it (Ground View's camera is a rigid child of this same
  // rotationGroup, so it has zero relative motion against it at any
  // instant), but the star field - only ever seen through this rotation,
  // via a camera that's constantly re-deriving its orientation from it -
  // reads any frame-to-frame unevenness directly as visible vibration.
  // Smoothing the delta (an exponential moving average, not the resulting
  // angle - which would need wraparound-aware interpolation) damps that
  // high-frequency noise while preserving the correct long-run average
  // spin rate.
  private smoothedDeltaSeconds = 0;
  private static readonly ROTATION_DELTA_SMOOTHING = 0.2;

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

  /** Moves Earth's whole rig (mesh, continents, axis, every ObserverStation
   *  and everything parented under them - Ground View's camera, WASD, the
   *  personal zenith/alt-az grids - see GroundCameraRig.syncParent and
   *  GroundObserver.getFrame, both of which read the real world-position
   *  chain fresh each frame) to `position` in world space. Called every
   *  frame from main.ts's render loop, not just on toggle - see the
   *  Heliocentric-active-and-Real-Distance-on branch there. */
  setOrbitPosition(position: Vector3Like): void {
    this.object3D.position.set(position.x, position.y, position.z);
  }

  update(deltaSeconds: number): void {
    if (this.rotationEnabled) {
      // See smoothedDeltaSeconds's own doc comment for why the raw,
      // per-frame deltaSeconds isn't used directly here.
      this.smoothedDeltaSeconds += (deltaSeconds - this.smoothedDeltaSeconds) * EarthBase.ROTATION_DELTA_SMOOTHING;
      // Wrapped mod 2*PI rather than left to grow unboundedly - at high
      // time-speed multipliers this angle accumulates by many radians per
      // real frame, and letting it climb into the thousands+ over a play
      // session degrades Math.sin/cos's argument-reduction accuracy enough
      // to show up as visible jitter/wobble in everything downstream of
      // this rotation (Ground View's camera, in particular - see
      // GroundCameraRig). Wrapping keeps the value small without changing
      // the accumulation behavior itself (spin still resumes from wherever
      // it was left when re-enabled, not snapped to an absolute angle).
      this.rotationGroup.rotation.y = (this.rotationGroup.rotation.y + BASE_EARTH_ANGULAR_SPEED * this.smoothedDeltaSeconds) % (2 * Math.PI);
    }
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }
}
