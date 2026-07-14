// Central tuning knobs. Keep scene scale, colors, and counts here so
// entities and cameras never hardcode "magic numbers" inline.

import { EARTH_ORBIT_RADIUS, MOON_ORBIT_RADIUS } from "../astronomy/constants";

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

// The globe-tier alt/az grid's own dedicated radius - deliberately NOT tied
// to CELESTIAL_GLOBE_RADIUS (unlike the Sun/Moon globe markers and the
// wireframe shell). The grid is a personal "you are here, this is your
// horizon" diagram, not part of the explanatory-globe scene it used to
// share a radius with purely by reuse - at CELESTIAL_GLOBE_RADIUS scale it
// dwarfed the planet (25 vs EARTH_RADIUS=5); this keeps it snug around the
// observer instead.
export const OBSERVER_GRID_RADIUS = EARTH_RADIUS * 1.1;

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

// One color per observer, cycled by creation order (see main.ts's
// createObserverEntry) - lets multiple observers' pins/chevrons be told
// apart at a glance instead of every one rendering as the same red.
export const OBSERVER_COLORS = [0xff5f5f, 0x5fb8ff, 0x8dff5f, 0xffd75f, 0xd75fff, 0x5fffe0] as const;

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

// The Solar System diagram: a THIRD, separate display tier alongside "sky"
// and "globe" (see README's "Dual-tier display" - this makes it a third)
// showing TRUE relative motion in model space - Sun fixed at the diagram's
// own center, Earth and Moon actually orbiting it, unlike the globe tier's
// Earth-centered diagram (where Earth never moves - see EarthBase). Reuses
// CELESTIAL_GLOBE_RADIUS's value so the two diagrams read as comparably-
// scaled siblings, kept as an independent constant since this diagram may
// need its own radius slider later, decoupled from the globe's (the same
// reasoning OBSERVER_GRID_RADIUS already documents for its own split).
export const SOLAR_SYSTEM_DIAGRAM_RADIUS = CELESTIAL_GLOBE_RADIUS;

// World-space offset for the whole diagram, so its Sun-at-center marker
// doesn't land exactly on the real EarthBase mesh (permanently at the world
// origin - see EarthBase.ts) or overlap the origin-centered globe-tier
// diagram (CELESTIAL_GLOBE_RADIUS=25 there too). 3x that radius clears both
// with a comfortable gap. Every model's diagram (see main.ts's
// buildSolarSystemDiagram) shares this SAME offset - since the underlying
// Earth-relative-to-Sun vector is proven model-agnostic (see
// modelEquivalence.test.ts), both models' diagrams are meant to exactly
// coincide when shown together, the same way the globe-tier diagrams already
// do.
export const SOLAR_SYSTEM_DIAGRAM_OFFSET = { x: CELESTIAL_GLOBE_RADIUS * 3, y: 0, z: 0 } as const;

// Same "radius * orbitRadiusFraction / semiMajorAxis" formula
// OrbitLineLayer/buildSolarSystemDiagram already use, extracted here as a
// single source of truth so the Solar System SIDE-DIAGRAM's own Earth/Moon
// markers and orbit line don't silently drift out of sync with each other.
// NOT used by live "Center: Sun" mode's Earth-Sun distance anymore (see
// CENTER_SUN_EARTH_ORBIT_SCALE below) - kept small/legible on purpose, this
// is still what the side-diagram (its own separate, offset display) uses.
export const SOLAR_SYSTEM_EARTH_ORBIT_SCALE = (SOLAR_SYSTEM_DIAGRAM_RADIUS * SUN_GLOBE_ORBIT_FRACTION) / EARTH_ORBIT_RADIUS;
// Still used by the side-diagram only (see buildSolarSystemDiagram) - live
// Center:Sun mode has its own independent, slider-adjustable Moon distance
// now (CENTER_SUN_MOON_DISTANCE_DEFAULT_RADII below), for the same
// decoupling reason CENTER_SUN_EARTH_DISTANCE_DEFAULT_RADII is separate
// from SOLAR_SYSTEM_EARTH_ORBIT_SCALE above.
export const SOLAR_SYSTEM_MOON_ORBIT_SCALE = (SOLAR_SYSTEM_DIAGRAM_RADIUS * MOON_GLOBE_ORBIT_FRACTION) / MOON_ORBIT_RADIUS;

// --- "Center: Sun" live mode's own scale knobs ---------------------------
// All four below back the "Center: Sun Scale" sliders in the Camera panel
// section (main.ts) - DEFAULT is the slider's starting value, MIN/MAX its
// range. All expressed in "Earth radii" units (a distance/size of N means
// N * EARTH_RADIUS render units) since that's the one body whose own scale
// never changes in this mode, making it a stable, intuitive yardstick.
// Deliberately DECOUPLED from the side-diagram's own fixed scale constants
// above so dialing these in live can't silently distort or collide with
// the separate, fixed-offset side-diagram (see SOLAR_SYSTEM_DIAGRAM_OFFSET) -
// the render loop reads main.ts's mutable state (initialized from these
// DEFAULTs), not these constants directly, every frame.

// Earth-Sun distance. Default matches this mode's original live-tested
// value (EARTH_RADIUS*60, ~4.75x -> this became the same number expressed
// differently once decoupled - see NOTES.md for the "fairly massively
// increasing the scale" pass this came from). Real ratio is ~23,455 Earth
// radii - MAX stays nowhere near that (still needs to be findable at any
// zoom), but leaves a lot of room to push further. Changing this slider
// also grows CameraManager's Space View maxDistance to match (see
// main.ts) - MAX here is chosen so that auto-adjustment stays sane.
export const CENTER_SUN_EARTH_DISTANCE_DEFAULT_RADII = 60;
export const CENTER_SUN_EARTH_DISTANCE_MIN_RADII = 10;
export const CENTER_SUN_EARTH_DISTANCE_MAX_RADII = 400;

// Moon-Earth distance - independent of the Earth-Sun slider above (real
// Earth-Sun distance is ~389x real Earth-Moon distance, so they should
// never be forced to scale together). Default matches the side-diagram's
// own existing Moon distance (SOLAR_SYSTEM_MOON_ORBIT_SCALE *
// MOON_ORBIT_RADIUS / EARTH_RADIUS = 1.5) purely as a familiar starting
// point, not because they're linked.
export const CENTER_SUN_MOON_DISTANCE_DEFAULT_RADII = 1.5;
export const CENTER_SUN_MOON_DISTANCE_MIN_RADII = 1.1;
export const CENTER_SUN_MOON_DISTANCE_MAX_RADII = 20;

// Sun marker size. Live-tested at EARTH_RADIUS*2 first (filled roughly half
// the sky from Ground View - overwhelming), then EARTH_RADIUS exactly (fixed
// Ground View, but from Space View made the Sun literally the SAME SIZE as
// the real, detailed Earth mesh sitting right next to it - reads as two
// peer planets, not a star and the planet orbiting it). Settled on 1.5x -
// clearly bigger than Earth in Space View, still dramatic-not-absurd from
// Ground View.
export const CENTER_SUN_SUN_SIZE_DEFAULT_RADII = 1.5;
export const CENTER_SUN_SUN_SIZE_MIN_RADII = 0.3;
export const CENTER_SUN_SUN_SIZE_MAX_RADII = 6;

// Moon marker size - needs to stay noticeably smaller than Earth (unlike
// the Sun, which needs to be bigger) to read as the smaller body looping
// around it, without visually overlapping Earth's own mesh at the default
// Moon distance above.
export const CENTER_SUN_MOON_SIZE_DEFAULT_RADII = 0.35;
export const CENTER_SUN_MOON_SIZE_MIN_RADII = 0.1;
export const CENTER_SUN_MOON_SIZE_MAX_RADII = 3;

// The real Sun/Moon markers' INITIAL sizes at construction (main.ts) -
// derived from the DEFAULT_RADII constants above so there's exactly one
// authored number per default, not two that could drift apart. Live
// changes after construction go through OrbitingBodyMarkerLayer.
// setMarkerSize() (wired to the sliders), not these.
export const REAL_SUN_MARKER_SIZE = EARTH_RADIUS * CENTER_SUN_SUN_SIZE_DEFAULT_RADII;
export const REAL_MOON_MARKER_SIZE = EARTH_RADIUS * CENTER_SUN_MOON_SIZE_DEFAULT_RADII;

// --- "Center: Earth" live mode's own scale knobs -------------------------
// The mirror image of the CENTER_SUN_* block above: Earth stays fixed at
// the origin (as it always has), and a real Sun marker (main.ts's
// earthCenteredSunMarker) truly orbits it with real elliptical distance,
// instead of the existing globe/sky-tier markers' fixed-fraction/
// direction-only placement. A SEPARATE set of constants from CENTER_SUN_*
// (not shared) - same reasoning as everywhere else this session: dialing
// in one mode's scale must never silently affect the other's. Values
// mirror CENTER_SUN_*'s defaults purely as a familiar/symmetric starting
// point, not because the two modes are linked.
export const CENTER_EARTH_SUN_DISTANCE_DEFAULT_RADII = 60;
export const CENTER_EARTH_SUN_DISTANCE_MIN_RADII = 10;
export const CENTER_EARTH_SUN_DISTANCE_MAX_RADII = 400;

export const CENTER_EARTH_MOON_DISTANCE_DEFAULT_RADII = 1.5;
export const CENTER_EARTH_MOON_DISTANCE_MIN_RADII = 1.1;
export const CENTER_EARTH_MOON_DISTANCE_MAX_RADII = 20;

export const CENTER_EARTH_SUN_SIZE_DEFAULT_RADII = 1.5;
export const CENTER_EARTH_SUN_SIZE_MIN_RADII = 0.3;
export const CENTER_EARTH_SUN_SIZE_MAX_RADII = 6;

export const CENTER_EARTH_MOON_SIZE_DEFAULT_RADII = 0.35;
export const CENTER_EARTH_MOON_SIZE_MIN_RADII = 0.1;
export const CENTER_EARTH_MOON_SIZE_MAX_RADII = 3;

// Center:Earth's real Sun/Moon markers' INITIAL sizes at construction -
// same "single authored number" reasoning as REAL_SUN_MARKER_SIZE above.
export const EARTH_CENTERED_SUN_MARKER_SIZE = EARTH_RADIUS * CENTER_EARTH_SUN_SIZE_DEFAULT_RADII;
export const EARTH_CENTERED_MOON_MARKER_SIZE = EARTH_RADIUS * CENTER_EARTH_MOON_SIZE_DEFAULT_RADII;

export const TEXTURES = {
  continents: "/textures/earth1.png",
  continentsNight: "/textures/earth_night2.png",
} as const;
