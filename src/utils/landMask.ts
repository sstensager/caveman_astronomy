import { latLonToCanvasPixel } from "./equirectangular";

export type LandCover = "land" | "ocean" | "ice";

/** Pure pixel-color classifier, calibrated empirically against
 *  earth1.png's actual palette (see equirectangular.ts's own calibration
 *  notes): ocean reads as a distinctly blue-dominant color, ice/snow as a
 *  bright, low-saturation near-white, everything else as land. Confirmed
 *  earth1.png carries NO usable elevation/relief signal (Rockies vs. Great
 *  Plains, Alps vs. the North German plain are near-identical RGB) - real
 *  mountain placement instead comes from a curated coordinate list, see
 *  mountainRanges.ts, not from this classifier. */
export function classifyLandCoverColor(r: number, g: number, b: number): LandCover {
  const brightness = (r + g + b) / 3;
  if (brightness > 195 && Math.abs(r - b) < 45) return "ice";
  if (b > r + 15 && b >= g - 10) return "ocean";
  return "land";
}

export interface LandMaskSampler {
  classify(latDeg: number, lonDeg: number): LandCover;
}

/** Real, canvas-based sampler - loads the given continents texture into an
 *  offscreen canvas once and classifies pixel color via
 *  latLonToCanvasPixel, so a sampled point always agrees with what the
 *  actual continents texture shows there (same shared math MinimapHud uses
 *  for its dots). Deliberately NOT unit-tested directly (touches `Image`/
 *  `document`, unavailable in this project's "node" vitest environment,
 *  see vitest.config.ts) - GroundScatterLayer takes a LandMaskSampler by
 *  interface so tests inject a trivial stub instead, same pattern
 *  ConstellationLabelsLayer's `createTexture` option already uses.
 *
 *  Falls back to "land" until the image has finished loading (a few ms at
 *  startup) - harmless for a decorative feature, and self-corrects the next
 *  time GroundScatterLayer regenerates once `isReady()` goes true. */
export class ImageLandMask implements LandMaskSampler {
  private ctx?: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor(imageUrl: string, createCanvas: () => HTMLCanvasElement = () => document.createElement("canvas")) {
    const image = new Image();
    image.onload = () => {
      const canvas = createCanvas();
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      this.ctx = ctx;
      this.width = image.width;
      this.height = image.height;
    };
    image.src = imageUrl;
  }

  isReady(): boolean {
    return this.ctx !== undefined;
  }

  classify(latDeg: number, lonDeg: number): LandCover {
    if (!this.ctx) return "land";
    const { x, y } = latLonToCanvasPixel(latDeg, lonDeg, this.width, this.height);
    const px = Math.min(this.width - 1, Math.max(0, Math.round(x)));
    const py = Math.min(this.height - 1, Math.max(0, Math.round(y)));
    const data = this.ctx.getImageData(px, py, 1, 1).data;
    return classifyLandCoverColor(data[0], data[1], data[2]);
  }
}
