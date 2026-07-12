// Named, documented simplifications for the model layer. Timing constants
// are real (approximate) values; spatial magnitudes are intentionally
// exaggerated model-space units, NOT physically-scaled - only body
// DIRECTIONS (never these magnitudes) are consumed downstream, so the
// absolute numbers only need to keep Earth's orbit meaningfully larger than
// the Moon's for the geometry to read sensibly. See src/config/constants.ts
// for SIMULATED_DAY_DURATION_SECONDS (the seconds-per-simulated-day
// conversion, which lives with the render/display-scale constants since it's
// derived from the existing Earth spin rate, not a model concern).

export const DAYS_PER_YEAR = 365.25;
export const EARTH_ORBIT_PERIOD_DAYS = DAYS_PER_YEAR;

/** Sidereal month: Moon's orbital period relative to the stars (not phases). */
export const MOON_ORBIT_PERIOD_DAYS = 27.3;

/** Named/configurable rather than permanently identical to the ecliptic. */
export const MOON_ORBIT_INCLINATION_DEG = 5.14;

/** Wired into EarthBase's render-space tilt (settable via the UI slider,
 *  this is just the default) - see EarthBase.setAxialTilt. */
export const EARTH_AXIAL_TILT_DEG = 23.44;

// Model-space orbit SEMI-MAJOR AXES (not radii - both orbits are real
// ellipses, see ellipticalOrbitPosition/inclinedEllipticalOrbitPosition in
// vectorMath.ts). Deliberately NOT to real distance scale (real Earth-orbit
// : Moon-orbit ratio is ~389:1); kept close enough together to avoid float
// precision issues while preserving "Earth's orbit is much larger than the
// Moon's" for anyone inspecting raw model state directly.
export const EARTH_ORBIT_RADIUS = 100;
export const MOON_ORBIT_RADIUS = 5;

// Real eccentricities - these ARE physically accurate, unlike the radii
// above, since eccentricity is a dimensionless shape parameter independent
// of the model's compressed distance scale.
export const EARTH_ORBIT_ECCENTRICITY = 0.0167;
export const MOON_ORBIT_ECCENTRICITY = 0.0549;

/** Where in Earth's orbit perihelion falls, measured the same way
 *  circularOrbitPosition's angle is (from +X, in the X-Z ecliptic plane).
 *  Real value; this sim has no calendar-date epoch to anchor "perihelion
 *  happens in early January" against, so only the ORBIT SHAPE/relative
 *  timing (faster near perihelion, per Kepler's second law) is meaningful
 *  here, not a specific real calendar date. */
export const EARTH_ARGUMENT_OF_PERIHELION_DEG = 102.9;

/** Arbitrary reference (no real-world epoch to anchor it to - see above);
 *  argument-of-perigee precession (~8.85yr real period) is a smaller,
 *  secondary effect not modeled this pass, unlike nodal regression below. */
export const MOON_ARGUMENT_OF_PERIGEE_DEG = 0;

/** Real nodal regression period (~18.6 years) - the Moon's ascending node
 *  drifts backward around the ecliptic at this rate, which is what makes
 *  eclipse "seasons" cycle realistically instead of recurring at a fixed
 *  time every orbit. See inclinedEllipticalOrbitPosition. */
export const MOON_NODAL_REGRESSION_PERIOD_DAYS = 6798.38;

/** Arbitrary reference longitude for the ascending node at simulated t=0 -
 *  no real-world epoch to anchor this to either (see
 *  EARTH_ARGUMENT_OF_PERIHELION_DEG above). */
export const MOON_ASCENDING_NODE_DEG_AT_EPOCH = 0;
