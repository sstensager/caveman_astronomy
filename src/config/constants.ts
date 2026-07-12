// Central tuning knobs. Keep scene scale, colors, and counts here so
// entities and cameras never hardcode "magic numbers" inline.

export const EARTH_RADIUS = 5;

// Stars are rendered on a sphere far larger than Earth so parallax is
// imperceptible - they read as "infinitely far away" as requested.
export const CELESTIAL_SPHERE_RADIUS = 2000;

// A second, much smaller projection radius for the "explanatory globe" view,
// where Earth needs to read as a small comprehensible globe wrapped snugly
// by the sphere rather than an imperceptible speck 2000 units away. Sun/Moon
// globe markers and the celestial sphere shell/stars all share this radius -
// see CompositeLayer / CelestialSphereShell.
export const CELESTIAL_GLOBE_RADIUS = EARTH_RADIUS * 5;

// Background Stars and Celestial Sphere Stars are two independent systems
// (see StarsLayer) that both read from the one shared real star catalog
// (src/astronomy/starCatalog.ts) and only differ in these tuning defaults.
// The celestial sphere's are deliberately sparser/dimmer/smaller than the
// background so it reads as a geometry teaching aid rather than competing
// visually with the background starfield - see "Visual Hierarchy" in the
// UI cleanup pass. `size` is a multiplier on each star's own magnitude-
// derived base size, not a flat pixel value.
export const BACKGROUND_STARS_DEFAULT = {
  limitingMagnitude: 6.5,
  size: 1,
  brightness: 0.9,
  opacity: 0.85,
} as const;

export const CELESTIAL_SPHERE_STARS_DEFAULT = {
  limitingMagnitude: 4,
  size: 1,
  brightness: 0.6,
  opacity: 0.45,
} as const;

// Just past Sirius (mag -1.44), the brightest real star in the catalog, so
// the slider can reach "show only the single brightest star." Max matches
// the catalog's own preprocessing cutoff (scripts/build-star-catalog.mjs) -
// slider-at-max cleanly means "show the entire catalog," no special case.
export const STAR_LIMITING_MAGNITUDE_MIN = -1.5;
export const STAR_LIMITING_MAGNITUDE_MAX = 6.5;

// Raycaster.params.Points.threshold, expressed as a ratio of each StarsLayer
// instance's display-radius scale - see StarPicker for why this ratio (not
// a flat world-space threshold) gives both the sky-scale and globe-scale
// star fields the same effective angular pick tolerance.
export const POINTS_PICK_THRESHOLD_RATIO = 0.015;

export const CELESTIAL_SPHERE_WIREFRAME_OPACITY_DEFAULT = 0.2;

// Must stay comfortably above EARTH_RADIUS so the globe never shrinks
// smaller than Earth itself.
export const CELESTIAL_SPHERE_RADIUS_MIN = 10;
export const CELESTIAL_SPHERE_RADIUS_MAX = 60;

// Simulated-day step sizes for the Time section's Step Hour/Day/Month/Year
// buttons. Month/Year are calendar approximations, not astronomically
// derived - fine for a scrubbing control, not a physical quantity.
export const TIME_STEP_HOUR_DAYS = 1 / 24;
export const TIME_STEP_DAY_DAYS = 1;
export const TIME_STEP_MONTH_DAYS = 30;
export const TIME_STEP_YEAR_DAYS = 365;

export const AXIS_LENGTH = EARTH_RADIUS * 1.6;

// Default observer position on Earth's surface, in degrees.
export const DEFAULT_LATITUDE_DEG = 45;
export const DEFAULT_LONGITUDE_DEG = 0;
export const OBSERVER_HEIGHT = 0.05;

// WASD ground-movement speed, in the same tangent-plane units ObserverStation
// works in (comparable to EARTH_RADIUS) per second. Tuned for a walking
// feel (~1.4 degrees/second, ~64s equator-to-pole) - the original 0.3
// multiplier was ~12x too fast (~17deg/sec, crossing 26 degrees of
// latitude in 1.5s of holding W).
export const OBSERVER_MOVE_SPEED = EARTH_RADIUS * 0.025;

// Sidereal-ish rotation rate: radians of Earth spin per real second at 1x
// time speed. Tuned for a visually clear demo, not physical accuracy.
export const BASE_EARTH_ANGULAR_SPEED = 0.15;

// How many real seconds (at 1x time speed) make up one simulated day, used
// to convert elapsed clock time into the astronomy model's day-based time
// units. Deliberately DERIVED from the spin rate above (one full rotation =
// one simulated day) rather than a realistic 86400s/day - a realistic value
// would make Sun/Moon orbital motion imperceptibly slow relative to Earth's
// already-compressed, non-realtime spin. Keeping this derived (not a second,
// independently-tunable magic number) means retuning spin speed can't let
// day-length silently drift out of sync with it.
export const SIMULATED_DAY_DURATION_SECONDS = (2 * Math.PI) / BASE_EARTH_ANGULAR_SPEED;

export const TIME_SPEED_MIN = 0;
export const TIME_SPEED_MAX = 20;
export const TIME_SPEED_DEFAULT = 1;

export const COLORS = {
  background: 0x02030a,
  earth: 0x2a6fd6,
  axis: 0xe0e0e0,
  star: 0xffffff,
  sun: 0xffcc55,
  moon: 0xd8dee6,
} as const;

// Celestial marker size as a fraction of whichever sphere radius it's
// projected onto, so one ratio scales correctly for both the sky-scale and
// explanatory-globe-scale instances instead of needing two tuned constants.
export const CELESTIAL_MARKER_SIZE_RATIO = 0.02;

// Globe-tier Sun/Moon markers project at a FRACTION of CELESTIAL_GLOBE_RADIUS
// rather than flattened onto it like the fixed stars - they're meant to read
// as orbiting bodies inside the celestial sphere, not smeared onto its
// surface. Still artistic, not physically-proportional - the real Sun:Moon
// distance ratio is ~389:1 (Sun ~23,455 Earth radii away, Moon ~60), which
// would place the Moon indistinguishably close to Earth's own EARTH_RADIUS=5
// surface in a 25-unit globe - but pushed as far toward the real ordering as
// this fixed-size shell allows: Sun near the shell's edge (it should read as
// "very far"), Moon pulled in close to Earth (it should read as "comparatively
// very close"), instead of the two sitting at a similar, arbitrary-feeling
// distance from each other. Applies identically regardless of which
// AstronomyModel is active - this is a pure display choice, not model-specific.
export const SUN_GLOBE_ORBIT_FRACTION = 0.95;
export const MOON_GLOBE_ORBIT_FRACTION = 0.3;

export const TEXTURES = {
  continents: "/textures/earth1.png",
} as const;
