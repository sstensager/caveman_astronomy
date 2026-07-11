// Central tuning knobs. Keep scene scale, colors, and counts here so
// entities and cameras never hardcode "magic numbers" inline.

export const EARTH_RADIUS = 5;

// Stars are rendered on a sphere far larger than Earth so parallax is
// imperceptible - they read as "infinitely far away" as requested.
export const CELESTIAL_SPHERE_RADIUS = 2000;
export const STAR_COUNT = 6000;

export const AXIS_LENGTH = EARTH_RADIUS * 1.6;

// Default observer position on Earth's surface, in degrees.
export const DEFAULT_LATITUDE_DEG = 45;
export const DEFAULT_LONGITUDE_DEG = 0;
export const OBSERVER_HEIGHT = 0.05;

// Sidereal-ish rotation rate: radians of Earth spin per real second at 1x
// time speed. Tuned for a visually clear demo, not physical accuracy.
export const BASE_EARTH_ANGULAR_SPEED = 0.15;

export const TIME_SPEED_MIN = 0;
export const TIME_SPEED_MAX = 20;
export const TIME_SPEED_DEFAULT = 1;

export const COLORS = {
  background: 0x02030a,
  earth: 0x2a6fd6,
  axis: 0xe0e0e0,
  star: 0xffffff,
} as const;
