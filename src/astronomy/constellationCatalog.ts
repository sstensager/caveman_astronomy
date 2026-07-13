import type { Vector3Like } from "./types";
import { raDecToVector3, STAR_CATALOG } from "./starCatalog";
import type { StarRecord } from "./starCatalog";
import rawConstellations from "../data/constellations.json";

/** A Hipparcos catalog number, same identifier StarRecord.hip already uses -
 *  the one thing every constellation segment is allowed to reference. */
export type StarId = number;

/** On-disk shape (src/data/constellations.json) - deliberately stores ONLY
 *  star ids in segments, never coordinates. See
 *  scripts/build-constellations.mjs, which is the one place a raw
 *  RA/Dec-to-star resolution happens; everything downstream of that script
 *  (this module included) only ever sees ids. */
export interface ConstellationDefinition {
  id: string;
  name: string;
  /** Label anchor point. Hours, matching StarRecord.ra's convention (the
   *  source dataset uses degrees - converted once at build time so this
   *  app has exactly one RA convention, not two). */
  labelRaHours: number;
  labelDecDeg: number;
  segments: Array<[StarId, StarId]>;
}

export interface ConstellationCulture {
  id: string;
  name: string;
  constellations: ConstellationDefinition[];
}

/** A segment resolved to actual StarRecords from the shared catalog -
 *  resolution happens once at module load (see resolveCulture), never
 *  per-frame. Renderers consume this, never the raw hip-id segments. */
export interface ResolvedConstellationSegment {
  a: StarRecord;
  b: StarRecord;
}

export interface ResolvedConstellation {
  id: string;
  name: string;
  labelDirection: Vector3Like;
  segments: ResolvedConstellationSegment[];
}

export interface ResolvedConstellationCulture {
  id: string;
  name: string;
  constellations: ResolvedConstellation[];
}

/** Resolves every segment's star ids against the shared catalog exactly
 *  once. `hipIndex` is built by the caller (once, not per culture) since
 *  every culture resolves against the SAME shared catalog - see
 *  buildHipIndex/CONSTELLATION_CULTURES below. A segment whose star id
 *  isn't found (stars.json and constellations.json could in principle drift
 *  out of sync if one is rebuilt without the other) is dropped rather than
 *  throwing - a missing line is a much smaller problem than a crash. */
export function resolveCulture(culture: ConstellationCulture, hipIndex: Map<StarId, StarRecord>): ResolvedConstellationCulture {
  return {
    id: culture.id,
    name: culture.name,
    constellations: culture.constellations.map((c) => ({
      id: c.id,
      name: c.name,
      labelDirection: raDecToVector3(c.labelRaHours, c.labelDecDeg),
      segments: c.segments.reduce<ResolvedConstellationSegment[]>((acc, [aId, bId]) => {
        const a = hipIndex.get(aId);
        const b = hipIndex.get(bId);
        if (a && b) acc.push({ a, b });
        return acc;
      }, []),
    })),
  };
}

export function buildHipIndex(catalog: StarRecord[]): Map<StarId, StarRecord> {
  const index = new Map<StarId, StarRecord>();
  for (const star of catalog) {
    if (star.hip !== undefined) index.set(star.hip, star);
  }
  return index;
}

export const CONSTELLATION_CULTURES: ConstellationCulture[] = (rawConstellations as unknown as { cultures: ConstellationCulture[] }).cultures;

export const CONSTELLATION_CATALOG_META = rawConstellations.meta;

/** The app's actual consumption path: every culture resolved against the
 *  one shared STAR_CATALOG, computed once at module load (same "ES modules
 *  are singletons" reasoning STAR_CATALOG itself relies on - see
 *  starCatalog.ts). Only one culture ships today (western), but every
 *  layer built on this reads an array, not a single hardcoded culture, so
 *  adding a second is additive - see ConstellationCulture. */
const HIP_INDEX = buildHipIndex(STAR_CATALOG);
export const RESOLVED_CONSTELLATION_CULTURES: ResolvedConstellationCulture[] = CONSTELLATION_CULTURES.map((culture) =>
  resolveCulture(culture, HIP_INDEX),
);
