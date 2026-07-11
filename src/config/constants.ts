// Central tuning knobs. Keep scene scale, colors, and counts here so
// entities and cameras never hardcode "magic numbers" inline.

export const EARTH_RADIUS = 5;

// Stars are rendered on a sphere far larger than Earth so parallax is
// imperceptible - they read as "infinitely far away" as requested.
export const CELESTIAL_SPHERE_RADIUS = 2000;
export const STAR_COUNT = 6000;

// A second, much smaller projection radius for the "explanatory globe" view,
// where Earth needs to read as a small comprehensible globe wrapped snugly
// by the sphere rather than an imperceptible speck 2000 units away. Same
// projected directions as CELESTIAL_SPHERE_RADIUS, just a different display
// scale - see CompositeLayer / CelestialSphereShell.
export const CELESTIAL_GLOBE_RADIUS = EARTH_RADIUS * 5;

export const AXIS_LENGTH = EARTH_RADIUS * 1.6;

// Default observer position on Earth's surface, in degrees.
export const DEFAULT_LATITUDE_DEG = 45;
export const DEFAULT_LONGITUDE_DEG = 0;
export const OBSERVER_HEIGHT = 0.05;

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

export const TEXTURES = {
  continents: "/textures/earth1.png",
} as const;
