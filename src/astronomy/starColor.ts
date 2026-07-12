/** Approximate stellar RGB color from B-V color index, via piecewise-linear
 *  interpolation between a handful of representative spectral-class control
 *  points (O/B blue -> A white -> F/G yellow-white -> K orange -> M red).
 *  Artistic approximation, not a physical blackbody model - good enough to
 *  make bright hot/cool stars visibly distinct without per-star lookup
 *  tables. Falls back to flat white when no color index is known, matching
 *  the app's previous flat-white star color. */

type RGB = [number, number, number];

const CONTROL_POINTS: Array<[bv: number, rgb: RGB]> = [
  [-0.4, [0.61, 0.7, 1.0]],
  [-0.1, [0.79, 0.85, 1.0]],
  [0.0, [1.0, 1.0, 1.0]],
  [0.3, [1.0, 0.98, 0.9]],
  [0.6, [1.0, 0.92, 0.75]],
  [1.0, [1.0, 0.8, 0.6]],
  [1.5, [1.0, 0.65, 0.45]],
  [2.0, [1.0, 0.5, 0.35]],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function starColorFromColorIndex(colorIndex?: number): RGB {
  if (colorIndex === undefined || Number.isNaN(colorIndex)) return [1, 1, 1];

  const bv = Math.min(Math.max(colorIndex, CONTROL_POINTS[0][0]), CONTROL_POINTS[CONTROL_POINTS.length - 1][0]);

  for (let i = 0; i < CONTROL_POINTS.length - 1; i++) {
    const [bv0, rgb0] = CONTROL_POINTS[i];
    const [bv1, rgb1] = CONTROL_POINTS[i + 1];
    if (bv >= bv0 && bv <= bv1) {
      const t = bv1 === bv0 ? 0 : (bv - bv0) / (bv1 - bv0);
      return [lerp(rgb0[0], rgb1[0], t), lerp(rgb0[1], rgb1[1], t), lerp(rgb0[2], rgb1[2], t)];
    }
  }

  return [1, 1, 1];
}
