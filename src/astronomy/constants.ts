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

/** Architecture slot for Earth's axial tilt - not yet wired into rendering. */
export const EARTH_AXIAL_TILT_DEG = 23.44;

// Model-space orbit radii. Deliberately NOT to real scale (real Earth-orbit :
// Moon-orbit ratio is ~389:1); kept close enough together to avoid float
// precision issues while preserving "Earth's orbit is much larger than the
// Moon's" for anyone inspecting raw model state directly.
export const EARTH_ORBIT_RADIUS = 100;
export const MOON_ORBIT_RADIUS = 5;
