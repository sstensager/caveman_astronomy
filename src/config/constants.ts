// Central tuning knobs. Keep scene scale, colors, and counts here so
// entities and cameras never hardcode "magic numbers" inline.

export const EARTH_RADIUS = 5;

// The ONE sky/celestial-sphere display radius, shared by stars,
// constellations, the celestial sphere wireframe shell, and the Sun/Moon
// sky-path lines. A single live-adjustable slider spans from a small,
// comprehensible "diagram" scale (MIN, close to EARTH_RADIUS so the
// celestial-sphere concept - "you are the center of a sphere of fixed
// stars" - is easy to see and reason about) up to an effectively-infinite
// immersive backdrop (MAX, where parallax against the observer's own
// position becomes imperceptible). There used to be two entirely separate
// radii/tiers (a "sky" instance pinned near MAX and a "globe" instance
// pinned near MIN) each with its own duplicated set of density/brightness/
// size controls - collapsed to one tier, one radius, one set of controls;
// zoom the radius instead of maintaining two parallel scenes.
export const STAR_RADIUS_DEFAULT = 2000;
export const STAR_RADIUS_MIN = 10;
export const STAR_RADIUS_MAX = 2000;

// A SEPARATE, tiny, fixed radius for each observer's alt-az grid -
// deliberately NOT tied to STAR_RADIUS_*. Unlike the star field (which is
// meant to visibly BE "the sky, at whatever scale") or the zenith (a real
// point on the celestial sphere - see ZENITH_DOT_SIZE below), the alt-az
// grid is a personal "you are here, this is your horizon" prop - from
// Space View, it should read as a barely-visible dome sitting on the
// planet at the observer's feet, not balloon out to anywhere near Earth's
// own scale. A small fraction of EARTH_RADIUS, just enough to clear the
// ground mesh instead of intersecting it.
export const ALT_AZ_DOME_RADIUS = EARTH_RADIUS * 0.06;

// The zenith marker's own dot size, in world units - deliberately a FIXED
// absolute size, independent of the (now sky-radius-scale, up to 2000)
// `radius` its point/line project to - see ZenithLayer's doc comment for
// why decoupling these two was necessary once the zenith line started
// reaching out to the shared sky radius instead of a small fixed value.
export const ZENITH_DOT_SIZE = EARTH_RADIUS * 0.015;

export const STARS_DEFAULT = {
  limitingMagnitude: 6.5,
  size: 1,
  brightness: 0.9,
  opacity: 0.85,
} as const;

// Just past Sirius (mag -1.44), the brightest real star in the catalog, so
// the slider can reach "show only the single brightest star." Max matches
// the catalog's own preprocessing cutoff (scripts/build-star-catalog.mjs) -
// slider-at-max cleanly means "show the entire catalog," no special case.
export const STAR_LIMITING_MAGNITUDE_MIN = -1.5;
export const STAR_LIMITING_MAGNITUDE_MAX = 6.5;

// Raycaster.params.Points.threshold, expressed as a ratio of the StarsLayer's
// display-radius scale - gives the star field the same effective angular
// pick tolerance at any radius.
export const POINTS_PICK_THRESHOLD_RATIO = 0.015;

export const CELESTIAL_SPHERE_WIREFRAME_OPACITY_DEFAULT = 0.2;

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
// feel (~1.4 degrees/second, ~64s equator-to-pole).
export const OBSERVER_MOVE_SPEED = EARTH_RADIUS * 0.025;

// Sidereal-ish rotation rate: radians of Earth spin per real second at 1x
// time speed. Tuned for a visually clear demo, not physical accuracy.
export const BASE_EARTH_ANGULAR_SPEED = 0.15;

// How many real seconds (at 1x time speed) make up one simulated day, used
// to convert elapsed clock time into the astronomy model's day-based time
// units. Deliberately DERIVED from the spin rate above (one full rotation =
// one simulated day) rather than a realistic 86400s/day - a realistic value
// would make Sun/Moon orbital motion imperceptibly slow relative to Earth's
// already-compressed, non-realtime spin.
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

// One color per observer, cycled by creation order - lets multiple
// observers' pins/chevrons be told apart at a glance instead of every one
// rendering as the same red.
export const OBSERVER_COLORS = [0xff5f5f, 0x5fb8ff, 0x8dff5f, 0xffd75f, 0xd75fff, 0x5fffe0] as const;

// Zenith marker size as a fraction of the shared sky radius (see ZenithLayer).
export const CELESTIAL_MARKER_SIZE_RATIO = 0.02;

// --- Sun/Moon distance & size ---------------------------------------------
// ONE set of knobs, not one per scene: the physical distance between Earth
// and the Sun/Moon doesn't change depending on which body a Scene treats as
// "fixed" (see main.ts's Scene concept) - only which body actually moves in
// the render does. Expressed in "Earth radii" units (a distance/size of N
// means N * EARTH_RADIUS render units), the one body whose own scale never
// changes, making it a stable, intuitive yardstick.

// Earth-Sun distance. Real ratio is ~23,455 Earth radii - MAX stays nowhere
// near that (still needs to be findable at any zoom), but leaves a lot of
// room to push further. Changing this also grows CameraManager's Space View
// maxDistance to match (see main.ts).
export const SUN_DISTANCE_DEFAULT_RADII = 60;
export const SUN_DISTANCE_MIN_RADII = 10;
export const SUN_DISTANCE_MAX_RADII = 400;

// Moon-Earth distance - independent of the Sun distance above (real
// Earth-Sun distance is ~389x real Earth-Moon distance, so they should
// never be forced to scale together).
export const MOON_DISTANCE_DEFAULT_RADII = 10;
export const MOON_DISTANCE_MIN_RADII = 1.1;
export const MOON_DISTANCE_MAX_RADII = 20;

// Sun marker size. Live-tested at EARTH_RADIUS*2 first (filled roughly half
// the sky from Ground View - overwhelming), then EARTH_RADIUS exactly (made
// the Sun literally the SAME SIZE as Earth's own mesh sitting right next to
// it - reads as two peer planets, not a star and the planet orbiting it).
// Settled on 2x - clearly bigger than Earth in Space View, still
// dramatic-not-absurd from Ground View.
export const SUN_SIZE_DEFAULT_RADII = 2;
export const SUN_SIZE_MIN_RADII = 0.3;
export const SUN_SIZE_MAX_RADII = 6;

// Moon marker size - needs to stay noticeably smaller than Earth (unlike the
// Sun, which needs to be bigger) to read as the smaller body looping around
// it, without visually overlapping Earth's own mesh at the default distance.
export const MOON_SIZE_DEFAULT_RADII = 0.35;
export const MOON_SIZE_MIN_RADII = 0.1;
export const MOON_SIZE_MAX_RADII = 3;

// The Sun/Moon markers' INITIAL sizes at construction (main.ts) - derived
// from the DEFAULT_RADII constants above so there's exactly one authored
// number per default. Live changes go through
// OrbitingBodyMarkerLayer.setMarkerSize() (wired to the sliders), not these.
export const SUN_MARKER_SIZE_DEFAULT = EARTH_RADIUS * SUN_SIZE_DEFAULT_RADII;
export const MOON_MARKER_SIZE_DEFAULT = EARTH_RADIUS * MOON_SIZE_DEFAULT_RADII;

export const TEXTURES = {
  continents: "/textures/earth1.png",
  continentsNight: "/textures/earth_night2.png",
} as const;
