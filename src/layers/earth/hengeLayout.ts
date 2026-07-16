import { EARTH_AXIAL_TILT_DEG } from "../../astronomy/constants";
import { sunHorizonAzimuths } from "../../astronomy/sunHorizon";
import { EARTH_RADIUS } from "../../config/constants";

export interface HengeStone {
  bearingDeg: number;
  radiusUnits: number;
  kind: "ring" | "marker";
  label?: string;
}

export interface HengeLayoutOptions {
  ringCount?: number;
  ringRadius?: number;
  markerRadius?: number;
}

const DEFAULT_RING_COUNT = 12;
const DEFAULT_RING_RADIUS = EARTH_RADIUS * 0.05;
// Pushed out from an original 0.09 - too close, made a marker stone loom
// large enough (see buildStoneMonolith's doc comment) to visually swallow
// the sun rising behind it instead of reading as a small, distant feature
// near the horizon like the real Heel Stone. Still comfortably within
// naked-eye range at this app's scale: the distance at which a `height`
// object's TOP clears an observer's own horizon is
// sqrt(2*EARTH_RADIUS*OBSERVER_HEIGHT) + sqrt(2*EARTH_RADIUS*height) - with
// a marker stone's real height (see buildStoneMonolith), that's roughly 1.9
// render units, well past this radius.
const DEFAULT_MARKER_RADIUS = EARTH_RADIUS * 0.16;

// Real Stonehenge leaves a gap in the circle at each real alignment - you
// sight OUT through the gap toward the Heel Stone, you don't watch the sun
// through solid stone. A ring stone placed right at (or near) a marker's own
// bearing would block that exact sightline from the center, so any ring
// position within this angle of a marker bearing is skipped entirely rather
// than placed - expressed as a fraction of the per-stone spacing so it
// scales sensibly with a custom ringCount instead of a fixed degree value.
const RING_GAP_FRACTION_OF_SPACING = 0.6;

function angularDistanceDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Pure stone layout for a solar-aligned henge at a given latitude: a ring
 * of evenly-spaced generic stones, plus up to 5 standalone "marker" stones
 * at the real sunrise/sunset bearings for the solstice and equinox axes
 * (see sunHorizon.ts). Markers sit at a LARGER radius than the ring, as
 * standalone outliers rather than forced onto the ring's own grid - closer
 * to the real thing (Stonehenge's Heel Stone stands outside the Sarsen
 * Circle, not as one of its uprights).
 *
 * The real Stonehenge axis - summer-solstice SUNRISE + winter-solstice
 * SUNSET, always exactly 180deg apart (see sunHorizon.test.ts), so together
 * they form a single straight line through the henge - plus the equinox
 * sunrise/sunset axis (always due east/west), PLUS a winter-solstice
 * SUNRISE marker: not part of the real monument's own alignment (that
 * would be a THIRD axis, summer-sunset/winter-sunrise, of which only the
 * winter half is included here), added so every "jump to solstice/equinox"
 * UI action can consistently target sunrise - see main.ts's
 * snapRotationToStonehengeAlignment. Deliberately still not the full
 * 6-stone set (summer sunset is left out - nothing in the UI needs it).
 *
 * Depends ONLY on latitude, via EARTH_AXIAL_TILT_DEG (always exactly the
 * solstice declination) and 0 (always exactly the equinox declination) -
 * both constants, no simulated-day scan needed. seasons.ts's
 * findSeasonalMarkers is a fully separate function (only used for the
 * "jump the clock to this date" UI convenience) precisely so this layout
 * never depends on it.
 *
 * A polarDay/polarNight result from sunHorizonAzimuths (an observer far
 * enough into the Arctic/Antarctic that the sun never rises/sets that
 * solstice) simply omits that marker rather than throwing - fewer stones,
 * not an error. The equinox markers never hit this case (declination 0
 * only produces polarDay/polarNight past the poles themselves).
 */
export function computeHengeLayout(latitudeDeg: number, options?: HengeLayoutOptions): HengeStone[] {
  const ringCount = options?.ringCount ?? DEFAULT_RING_COUNT;
  const ringRadius = options?.ringRadius ?? DEFAULT_RING_RADIUS;
  const markerRadius = options?.markerRadius ?? DEFAULT_MARKER_RADIUS;

  const markers: HengeStone[] = [];

  const summerSolstice = sunHorizonAzimuths(latitudeDeg, EARTH_AXIAL_TILT_DEG);
  if (summerSolstice.kind === "normal") {
    markers.push({
      bearingDeg: summerSolstice.sunriseAzimuthDeg,
      radiusUnits: markerRadius,
      kind: "marker",
      label: "Summer Solstice Sunrise",
    });
  }

  const winterSolstice = sunHorizonAzimuths(latitudeDeg, -EARTH_AXIAL_TILT_DEG);
  if (winterSolstice.kind === "normal") {
    markers.push({
      bearingDeg: winterSolstice.sunsetAzimuthDeg,
      radiusUnits: markerRadius,
      kind: "marker",
      label: "Winter Solstice Sunset",
    });
    markers.push({
      bearingDeg: winterSolstice.sunriseAzimuthDeg,
      radiusUnits: markerRadius,
      kind: "marker",
      label: "Winter Solstice Sunrise",
    });
  }

  const equinox = sunHorizonAzimuths(latitudeDeg, 0);
  if (equinox.kind === "normal") {
    markers.push({
      bearingDeg: equinox.sunriseAzimuthDeg,
      radiusUnits: markerRadius,
      kind: "marker",
      label: "Equinox Sunrise (due east)",
    });
    markers.push({
      bearingDeg: equinox.sunsetAzimuthDeg,
      radiusUnits: markerRadius,
      kind: "marker",
      label: "Equinox Sunset (due west)",
    });
  }

  // Leave a "window" gap in the ring at each marker's bearing (see
  // RING_GAP_FRACTION_OF_SPACING's doc comment) - computed AFTER the
  // markers so the gaps land exactly where they're actually needed, not
  // guessed at independently.
  const gapDeg = (360 / ringCount) * RING_GAP_FRACTION_OF_SPACING;
  const ringStones: HengeStone[] = [];
  for (let i = 0; i < ringCount; i++) {
    const bearingDeg = (i / ringCount) * 360;
    const blocksAMarker = markers.some((marker) => angularDistanceDeg(bearingDeg, marker.bearingDeg) < gapDeg);
    if (!blocksAMarker) ringStones.push({ bearingDeg, radiusUnits: ringRadius, kind: "ring" });
  }

  return [...ringStones, ...markers];
}
