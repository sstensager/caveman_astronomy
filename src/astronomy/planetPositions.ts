import type { PlanetOrbitalElements } from "./constants";
import { EARTH_ARGUMENT_OF_PERIHELION_DEG, EARTH_ORBIT_ECCENTRICITY, EARTH_ORBIT_PERIOD_DAYS, EARTH_ORBIT_RADIUS } from "./constants";
import type { SimulationTime, Vector3Like } from "./types";
import { ellipticalOrbitPosition, inclinedEllipticalOrbitPosition } from "./vectorMath";

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

/**
 * A planet's real heliocentric position (Sun at the origin), shared by both
 * ModernHeliocentricModel (used directly) and GeocentricModel (subtracted
 * against earthHeliocentricPosition below) - the single source of truth for
 * "where is this planet, really, around the Sun" regardless of which model
 * is asking. Ascending node is a fixed constant here (unlike the Moon's
 * time-varying regression - see MOON_NODAL_REGRESSION_PERIOD_DAYS), matching
 * PlanetOrbitalElements's own doc comment on why nodal precession is skipped
 * for planets.
 */
export function planetHeliocentricPosition(elements: PlanetOrbitalElements, time: SimulationTime): Vector3Like {
  const meanAnomaly = elements.meanAnomalyAtEpochDeg * DEG_TO_RAD + (time / elements.periodDays) * TWO_PI;
  return inclinedEllipticalOrbitPosition(
    elements.orbitRadius,
    elements.eccentricity,
    elements.argumentOfPeriapsisDeg * DEG_TO_RAD,
    meanAnomaly,
    elements.inclinationDeg,
    elements.ascendingNodeDeg * DEG_TO_RAD,
  );
}

/**
 * Earth's own real heliocentric position - duplicates ModernHeliocentricModel's
 * Earth computation exactly (same constants, same formula), extracted here so
 * GeocentricModel can compute it ONCE per getState() call and reuse it for
 * all 5 planets' geocentric subtraction, rather than re-deriving it 5x
 * inline. Not used by the Sun's own geocentric position, which relies on the
 * separate, already-proven mirror-trick identity instead (see
 * GeocentricModel's doc comment) - this function exists for the planets,
 * which have no such shortcut available.
 */
export function earthHeliocentricPosition(time: SimulationTime): Vector3Like {
  const earthMeanAnomaly = (time / EARTH_ORBIT_PERIOD_DAYS) * TWO_PI;
  return ellipticalOrbitPosition(EARTH_ORBIT_RADIUS, EARTH_ORBIT_ECCENTRICITY, EARTH_ARGUMENT_OF_PERIHELION_DEG * DEG_TO_RAD, earthMeanAnomaly);
}

/**
 * The real synodic period between Earth and a planet of the given sidereal
 * period - the time for the Earth-Sun-planet configuration (and therefore
 * the planet's apparent retrograde loop, whether viewed as a real 3D
 * geocentric path or projected onto the sky against the fixed stars) to
 * repeat, as opposed to the planet's own sidereal period (time to complete
 * one lap around the Sun). Standard mean-motion formula, valid for both
 * inner planets (period < Earth's, e.g. Mercury/Venus) and outer planets
 * (period > Earth's) via the absolute value.
 *
 * This is the period main.ts's planet SkyPathLineLayer and "True Path"
 * OrbitLineLayer instances both sample over - using the planet's own
 * sidereal period instead (a real bug this fixed once already, then had to
 * fix again for a second consumer - see git history) packs many overlapping
 * retrograde loops into one tangled, non-closing line, since Earth "laps"
 * the planet more than once over one planetary year.
 *
 * Only approximately closes the sampled curve (real eccentric-orbit angular
 * rates aren't perfectly constant the way this mean-motion formula assumes),
 * consistent with this app's "not ephemeris-grade" precision elsewhere - the
 * deferent+epicycle decomposition (GeocentricModel's own construction in
 * main.ts) is the EXACT version of this same real path, proven algebraically
 * exact in solarSystemDiagram.test.ts.
 */
export function synodicPeriodDays(planetPeriodDays: number): number {
  return 1 / Math.abs(1 / EARTH_ORBIT_PERIOD_DAYS - 1 / planetPeriodDays);
}

/**
 * The real historical Ptolemaic construction for an INFERIOR planet
 * (Mercury/Venus) scales its deferent+epicycle down from the mathematically
 * exact Tychonic pair (see main.ts's planetLayers doc comment) so their
 * combined maximum reach never exceeds the Sun's own average distance - the
 * actual "nested crystalline spheres don't overlap" cosmological assumption
 * that made the strict Ptolemaic model structurally incapable of placing a
 * planet beyond the Sun (and therefore of producing Venus's observed
 * gibbous phases).
 *
 * Scaling BOTH the deferent and epicycle by this SAME factor is what
 * preserves the deferent-epicycle RATIO - and therefore the correct
 * apparent max elongation/direction, exactly like the real historical model
 * predicted correct sky positions despite getting absolute distances wrong.
 * Derivation: real deferent radius = EARTH_ORBIT_RADIUS (the Sun's own
 * average geocentric distance), real epicycle radius = planetOrbitRadius;
 * solving `k * EARTH_ORBIT_RADIUS + k * planetOrbitRadius =
 * EARTH_ORBIT_RADIUS` for k (their scaled sum touching, not exceeding, the
 * Sun's own distance) gives this formula.
 *
 * For a superior planet this isn't meaningful (real Ptolemaic superior-
 * planet epicycles are already mathematically exact - no cap needed, see
 * main.ts) - callers should pass 1 for those instead of calling this.
 */
export function ptolemaicCapScaleFactor(planetOrbitRadius: number): number {
  return EARTH_ORBIT_RADIUS / (EARTH_ORBIT_RADIUS + planetOrbitRadius);
}
