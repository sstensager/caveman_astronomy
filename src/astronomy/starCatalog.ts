import type { Vector3Like } from "./types";
import rawStars from "../data/stars.json";

/** One real star, magnitude-limited to ~naked-eye (mag <= 6.5). Sourced from
 *  the HYG Database (CC BY-SA 4.0, see src/data/NOTICE.md) via
 *  scripts/build-star-catalog.mjs - not fetched at runtime. `constellation`/
 *  `designation`/`hip` are unused this pass, kept so a future constellation-
 *  lines/labels feature isn't a schema rewrite. */
export interface StarRecord {
  hip?: number;
  properName?: string;
  /** Bayer/Flamsteed designation, e.g. "9Alp CMa". */
  designation?: string;
  /** 3-letter constellation abbreviation, e.g. "CMa". */
  constellation?: string;
  /** Right ascension, hours [0, 24). */
  ra: number;
  /** Declination, degrees [-90, 90]. */
  dec: number;
  /** Apparent magnitude (lower = brighter). */
  mag: number;
  /** B-V color index, when known. */
  colorIndex?: number;
  /** Unit direction in this app's world frame, derived from ra/dec at load
   *  time - see raDecToVector3 for the convention. */
  direction: Vector3Like;
}

interface RawStarRecord {
  hip?: number;
  properName?: string;
  designation?: string;
  constellation?: string;
  ra: number;
  dec: number;
  mag: number;
  colorIndex?: number;
}

/**
 * Converts right ascension/declination into a unit-direction vector in this
 * app's world frame. Convention (chosen here - nothing upstream defines one):
 * Dec=+90 -> world +Y, matching the app's existing polar axis
 * (GroundObserver's WORLD_POLAR_AXIS and EarthBase's Y-only spin); RA=0h ->
 * world +X, matching vectorMath.ts's circularOrbitPosition(radius, angle=0)
 * convention. Not tied to any real calendar date or sidereal time - this app
 * has no epoch-sync, so it's an internally-consistent reference only, not a
 * "the sky looked like this on date X" claim.
 */
export function raDecToVector3(raHours: number, decDeg: number): Vector3Like {
  const ra = (raHours / 24) * Math.PI * 2;
  const dec = (decDeg * Math.PI) / 180;
  return {
    x: Math.cos(dec) * Math.cos(ra),
    y: Math.sin(dec),
    z: Math.cos(dec) * Math.sin(ra),
  };
}

/** The full real star catalog, computed once at module load. ES modules are
 *  singletons, so every importer shares this exact array reference - that
 *  sharing (not a shared scene-graph transform) is what guarantees the
 *  sky-scale and globe-scale star renderers show the same sky. Sorted
 *  ascending by magnitude (brightest first) - StarsLayer's limiting-
 *  magnitude filtering and its raycast-index lookup both depend on this
 *  ordering being preserved exactly as built here. */
export const STAR_CATALOG: StarRecord[] = (rawStars.stars as RawStarRecord[]).map((star) => ({
  ...star,
  direction: raDecToVector3(star.ra, star.dec),
}));

export const STAR_CATALOG_META = rawStars.meta;
