const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export type SunHorizonEvent =
  | { kind: "normal"; sunriseAzimuthDeg: number; sunsetAzimuthDeg: number }
  /** Sun never sets that day at that latitude - midnight sun. */
  | { kind: "polarDay" }
  /** Sun never rises that day at that latitude. */
  | { kind: "polarNight" };

/**
 * Classical spherical-astronomy closed form for sunrise/sunset compass
 * bearing (clockwise from true north) at a given latitude and solar
 * declination - no simulation of Earth's daily rotation needed at all,
 * which matters here because `EarthBase.rotationGroup`'s rotation is only
 * an accumulating per-frame delta, not a pure function of simulated time
 * (see NOTES.md's deferred "day-arc path" item - this deliberately avoids
 * depending on that gap).
 *
 * cos(azimuth) = sin(declination) / cos(latitude)
 *
 * At the equinox (declination = 0) this gives exactly 90/270 degrees (due
 * east/west) at ANY latitude - sunrise/sunset direction only depends on
 * latitude once the Sun has a nonzero declination, which is exactly why a
 * solstice alignment (unlike an equinox one) has to be surveyed separately
 * at every different latitude - see hengeLayout.ts.
 *
 * Ignores atmospheric refraction and the Sun's small angular radius (both
 * shift real sunrise/sunset by a fraction of a degree) - a deliberate
 * simplification consistent with this app's other "not literally
 * ephemeris-grade, but real geometry" astronomy (see eclipseFinder.ts).
 */
export function sunHorizonAzimuths(latitudeDeg: number, declinationDeg: number): SunHorizonEvent {
  const latRad = latitudeDeg * DEG_TO_RAD;
  const decRad = declinationDeg * DEG_TO_RAD;

  // Altitude at upper culmination (local solar noon, hour angle = 0) and
  // lower culmination (local solar midnight, hour angle = 180deg) - same
  // trig family as the sunrise/sunset formula itself
  // (sin(alt) = sin(lat)sin(dec) + cos(lat)cos(dec)cos(hourAngle)), just
  // evaluated at the two extremes instead of solved for alt=0. If the lower
  // culmination altitude is still positive, the Sun never dips below the
  // horizon that day (polar day); if the upper culmination altitude is
  // still negative, it never rises (polar night).
  const upperCulminationAltitudeDeg = 90 - Math.abs(latitudeDeg - declinationDeg);
  const lowerCulminationAltitudeDeg = Math.abs(latitudeDeg + declinationDeg) - 90;

  if (lowerCulminationAltitudeDeg > 0) return { kind: "polarDay" };
  if (upperCulminationAltitudeDeg < 0) return { kind: "polarNight" };

  const cosAzimuth = Math.sin(decRad) / Math.cos(latRad);
  const sunriseAzimuthDeg = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) * RAD_TO_DEG;
  const sunsetAzimuthDeg = 360 - sunriseAzimuthDeg;

  return { kind: "normal", sunriseAzimuthDeg, sunsetAzimuthDeg };
}
