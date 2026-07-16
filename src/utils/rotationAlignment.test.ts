import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { findRotationForHorizonAzimuth } from "./rotationAlignment";
import { computeNorthEast, latLonToSurfacePoint } from "./geo";
import { sunHorizonAzimuths } from "../astronomy/sunHorizon";

const IDENTITY = new THREE.Quaternion();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const STONEHENGE_LAT_DEG = 51.1789;
const STONEHENGE_LON_DEG = -1.8262;
const EARTH_AXIAL_TILT_DEG = 23.44;

/** A world-space sun direction with exactly the given declination - the
 *  specific "right ascension" doesn't matter for these tests (only the
 *  found rotation angle's absolute value would shift, not whether a match
 *  exists or what local bearing it has). */
function sunDirForDeclination(declinationDeg: number): THREE.Vector3 {
  const rad = THREE.MathUtils.degToRad(declinationDeg);
  return new THREE.Vector3(Math.cos(rad), Math.sin(rad), 0);
}

/** Recomputes the observer's local compass bearing to `bodyDir` at a given
 *  rotation angle theta, independent of rotationAlignment.ts's own
 *  internals - so this test can't pass merely by agreeing with itself. */
function bearingAtRotation(theta: number, latDeg: number, lonDeg: number, bodyDir: THREE.Vector3): number {
  const up = latLonToSurfacePoint(latDeg, lonDeg, 1).applyAxisAngle(WORLD_UP, theta);
  const { north, east } = computeNorthEast(up, WORLD_UP);
  const bearingRad = Math.atan2(bodyDir.dot(east), bodyDir.dot(north));
  return (THREE.MathUtils.radToDeg(bearingRad) + 360) % 360;
}

describe("findRotationForHorizonAzimuth", () => {
  it("finds the rotation angle whose actual local bearing matches the target sunrise azimuth", () => {
    const sunDir = sunDirForDeclination(EARTH_AXIAL_TILT_DEG);
    const expected = sunHorizonAzimuths(STONEHENGE_LAT_DEG, EARTH_AXIAL_TILT_DEG);
    expect(expected.kind).toBe("normal");
    if (expected.kind !== "normal") return;

    const theta = findRotationForHorizonAzimuth(IDENTITY, sunDir, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, expected.sunriseAzimuthDeg);
    expect(theta).toBeDefined();
    const actualBearing = bearingAtRotation(theta!, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, sunDir);
    expect(actualBearing).toBeCloseTo(expected.sunriseAzimuthDeg, 0);
  });

  it("finds the rotation angle whose actual local bearing matches the target sunset azimuth", () => {
    const sunDir = sunDirForDeclination(-EARTH_AXIAL_TILT_DEG);
    const expected = sunHorizonAzimuths(STONEHENGE_LAT_DEG, -EARTH_AXIAL_TILT_DEG);
    expect(expected.kind).toBe("normal");
    if (expected.kind !== "normal") return;

    const theta = findRotationForHorizonAzimuth(IDENTITY, sunDir, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, expected.sunsetAzimuthDeg);
    expect(theta).toBeDefined();
    const actualBearing = bearingAtRotation(theta!, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, sunDir);
    expect(actualBearing).toBeCloseTo(expected.sunsetAzimuthDeg, 0);
  });

  it("picks whichever of the two horizon crossings is actually closest to the target azimuth", () => {
    // Equinox: sunrise=90 (east), sunset=270 (west) - two very different
    // crossings, unambiguous which one a given target should match.
    const sunDir = sunDirForDeclination(0);
    const thetaEast = findRotationForHorizonAzimuth(IDENTITY, sunDir, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, 90);
    const thetaWest = findRotationForHorizonAzimuth(IDENTITY, sunDir, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, 270);
    expect(thetaEast).toBeDefined();
    expect(thetaWest).toBeDefined();
    expect(thetaEast).not.toBeCloseTo(thetaWest!, 2);
    expect(bearingAtRotation(thetaEast!, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, sunDir)).toBeCloseTo(90, 0);
    expect(bearingAtRotation(thetaWest!, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, sunDir)).toBeCloseTo(270, 0);
  });

  it("returns undefined for polar day/night (no horizon crossing that day)", () => {
    const sunDir = sunDirForDeclination(EARTH_AXIAL_TILT_DEG);
    // lat=70 + summer solstice declination = polar day (see sunHorizon.test.ts).
    const theta = findRotationForHorizonAzimuth(IDENTITY, sunDir, 70, 0, 50);
    expect(theta).toBeUndefined();
  });

  it("respects a non-identity tilt quaternion rather than assuming the default axis", () => {
    const sunDir = sunDirForDeclination(0);
    const tiltedQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(5));
    const thetaIdentity = findRotationForHorizonAzimuth(IDENTITY, sunDir, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, 90);
    const thetaTilted = findRotationForHorizonAzimuth(tiltedQuaternion, sunDir, STONEHENGE_LAT_DEG, STONEHENGE_LON_DEG, 90);
    expect(thetaIdentity).toBeDefined();
    expect(thetaTilted).toBeDefined();
    expect(thetaTilted).not.toBeCloseTo(thetaIdentity!, 2);
  });
});
