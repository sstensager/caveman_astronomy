export interface MountainRangeSegment {
  readonly name: string;
  readonly latDeg: number;
  readonly lonDeg: number;
  /** Degrees of arc - flat lat/lon Euclidean distance, not a great-circle
   *  geodesic. Fine for a decorative "is this near a famous range" check;
   *  not meant as a precise boundary. */
  readonly radiusDeg: number;
  /** 0-1, this segment's peak height relative to the tallest range
   *  (Himalaya = 1) - see GroundScatterLayer's use of it. */
  readonly peakScale: number;
}

/**
 * A curated list of real mountain ranges, NOT derived from the continents
 * texture - earth1.png carries no usable elevation/relief signal (see
 * landMask.ts's doc comment for the empirical check that ruled this out),
 * so "is this location mountainous" has to come from real-world knowledge
 * instead of pixel data. Elongated ranges (Andes, Rockies, Urals,
 * Appalachians) are modeled as several circular segments strung along their
 * real length rather than one big circle, which would either miss most of
 * the range or bleed into unrelated flat terrain on either side.
 *
 * Approximate real centers/extents, not surveyed boundaries - this is a
 * decorative "which famous range am I near" lookup, not a GIS dataset.
 */
export const MOUNTAIN_RANGE_SEGMENTS: MountainRangeSegment[] = [
  { name: "Himalaya", latDeg: 28, lonDeg: 84, radiusDeg: 6, peakScale: 1.0 },
  { name: "Andes (north)", latDeg: 5, lonDeg: -76, radiusDeg: 4, peakScale: 0.75 },
  { name: "Andes (central)", latDeg: -13, lonDeg: -74, radiusDeg: 4, peakScale: 0.8 },
  { name: "Andes (south)", latDeg: -33, lonDeg: -70, radiusDeg: 4, peakScale: 0.75 },
  { name: "Andes (Patagonia)", latDeg: -50, lonDeg: -73, radiusDeg: 3, peakScale: 0.6 },
  { name: "Rocky Mountains (north)", latDeg: 50, lonDeg: -115, radiusDeg: 4, peakScale: 0.65 },
  { name: "Rocky Mountains (south)", latDeg: 39, lonDeg: -107, radiusDeg: 4, peakScale: 0.7 },
  { name: "Alps", latDeg: 46, lonDeg: 9, radiusDeg: 3, peakScale: 0.6 },
  { name: "Ural Mountains", latDeg: 60, lonDeg: 59, radiusDeg: 3, peakScale: 0.4 },
  { name: "Atlas Mountains", latDeg: 31, lonDeg: -6, radiusDeg: 3, peakScale: 0.45 },
  { name: "Caucasus", latDeg: 43, lonDeg: 44, radiusDeg: 3, peakScale: 0.65 },
  { name: "Southern Alps (NZ)", latDeg: -43, lonDeg: 171, radiusDeg: 2.5, peakScale: 0.6 },
  { name: "Appalachian Mountains", latDeg: 40, lonDeg: -78, radiusDeg: 4, peakScale: 0.35 },
  { name: "Ethiopian Highlands", latDeg: 9, lonDeg: 38, radiusDeg: 3, peakScale: 0.5 },
];

export interface MountainRangeMatch {
  /** 0 at the segment's radius edge, 1 at its exact center. */
  readonly factor: number;
  readonly peakScale: number;
  readonly name: string;
}

/** Nearest mountain range segment containing this lat/lon, or undefined if
 *  it isn't within any range at all - picks the segment with the HIGHEST
 *  factor (deepest into its own radius) when a point falls within more than
 *  one overlapping segment, not just the first match. */
export function nearestMountainRange(latDeg: number, lonDeg: number): MountainRangeMatch | undefined {
  let best: MountainRangeMatch | undefined;
  for (const segment of MOUNTAIN_RANGE_SEGMENTS) {
    const dLat = latDeg - segment.latDeg;
    const dLon = lonDeg - segment.lonDeg;
    const distanceDeg = Math.sqrt(dLat * dLat + dLon * dLon);
    if (distanceDeg > segment.radiusDeg) continue;
    const factor = 1 - distanceDeg / segment.radiusDeg;
    if (!best || factor > best.factor) {
      best = { factor, peakScale: segment.peakScale, name: segment.name };
    }
  }
  return best;
}
