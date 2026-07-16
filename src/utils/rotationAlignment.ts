import * as THREE from "three";
import { computeNorthEast, latLonToSurfacePoint } from "./geo";

const WORLD_Y = new THREE.Vector3(0, 1, 0);

interface HorizonCrossing {
  theta: number;
  azimuthDeg: number;
}

function angularDifferenceDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Both altitude(theta)=0 crossings (any direction) within one full
 *  rotation, each refined by linear interpolation between the two
 *  straddling samples and paired with the observer's actual local compass
 *  bearing to `bodyWorldDir` AT that crossing (via the same computeNorthEast
 *  math GroundObserver uses) - deliberately NOT assuming which one is
 *  "rising" vs "setting" corresponds to which real-world compass direction,
 *  since that depends on this app's own (internally-consistent but
 *  otherwise arbitrary) coordinate handedness. Comparing actual computed
 *  bearings against a known target (see findRotationForHorizonAzimuth)
 *  sidesteps needing to know that convention at all. */
function findHorizonCrossings(
  tiltQuaternion: THREE.Quaternion,
  bodyWorldDir: THREE.Vector3,
  latDeg: number,
  lonDeg: number,
  stepRad: number,
): HorizonCrossing[] {
  const localPoint = latLonToSurfacePoint(latDeg, lonDeg, 1);

  const upAt = (theta: number): THREE.Vector3 => localPoint.clone().applyAxisAngle(WORLD_Y, theta).applyQuaternion(tiltQuaternion);
  const altitudeAt = (up: THREE.Vector3): number => bodyWorldDir.dot(up);
  const azimuthAt = (up: THREE.Vector3): number => {
    const { north, east } = computeNorthEast(up, WORLD_Y);
    const bearingRad = Math.atan2(bodyWorldDir.dot(east), bodyWorldDir.dot(north));
    return (THREE.MathUtils.radToDeg(bearingRad) + 360) % 360;
  };

  const crossings: HorizonCrossing[] = [];
  let previousTheta = 0;
  let previousUp = upAt(0);
  let previousAltitude = altitudeAt(previousUp);

  for (let theta = stepRad; theta <= Math.PI * 2 + stepRad; theta += stepRad) {
    const up = upAt(theta);
    const altitude = altitudeAt(up);

    if ((previousAltitude < 0) !== (altitude < 0)) {
      const t = previousAltitude / (previousAltitude - altitude);
      const crossingTheta = previousTheta + t * (theta - previousTheta);
      const crossingUp = upAt(crossingTheta);
      crossings.push({ theta: crossingTheta, azimuthDeg: azimuthAt(crossingUp) });
    }

    previousTheta = theta;
    previousUp = up;
    previousAltitude = altitude;
  }

  return crossings;
}

/**
 * Finds the EarthBase.rotationGroup rotation angle (radians, matches
 * rotation.y directly) at which a fixed lat/lon point's local horizon
 * bearing to `bodyWorldDir` matches `targetAzimuthDeg` as closely as
 * possible, among the (at most two) moments that day the body is actually
 * ON the horizon at all.
 *
 * Deliberately compares ACTUAL computed bearings rather than assuming
 * "ascending crossing = sunrise" - the direction rotationGroup.rotation.y
 * increasing corresponds to isn't necessarily real-world eastward
 * (verified empirically: it wasn't, for this app's specific coordinate
 * setup - see rotationAlignment.test.ts). Callers should pass
 * `targetAzimuthDeg` straight from the SAME sunHorizonAzimuths call that
 * placed the alignment marker stone they want to demonstrate (see
 * StonehengeLayer/hengeLayout.ts), guaranteeing the found rotation angle
 * matches that exact stone, not a guessed rising/setting label.
 *
 * `tiltQuaternion` should be EarthBase.tiltGroup's LIVE world quaternion so
 * this stays correct even if the axial-tilt slider has been moved.
 *
 * Returns undefined if the body never crosses the horizon there that day
 * (polar day/night).
 */
export function findRotationForHorizonAzimuth(
  tiltQuaternion: THREE.Quaternion,
  bodyWorldDir: THREE.Vector3,
  latDeg: number,
  lonDeg: number,
  targetAzimuthDeg: number,
  stepRad = THREE.MathUtils.degToRad(0.1),
): number | undefined {
  const crossings = findHorizonCrossings(tiltQuaternion, bodyWorldDir, latDeg, lonDeg, stepRad);
  if (crossings.length === 0) return undefined;

  let best = crossings[0];
  let bestDiff = angularDifferenceDeg(best.azimuthDeg, targetAzimuthDeg);
  for (const crossing of crossings.slice(1)) {
    const diff = angularDifferenceDeg(crossing.azimuthDeg, targetAzimuthDeg);
    if (diff < bestDiff) {
      best = crossing;
      bestDiff = diff;
    }
  }

  return best.theta;
}
