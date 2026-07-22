import { latLonToCanvasPixel } from "../utils/equirectangular";
import { TEXTURES } from "../config/constants";

// Matches earth1.png's own ~2:1 aspect ratio (1774x887) at a small,
// glanceable overlay size rather than the source image's full resolution.
const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 100;
const DOT_RADIUS_PX = 3.5;
const ACTIVE_DOT_RADIUS_PX = 5;

export interface MinimapObserverDot {
  latDeg: number;
  lonDeg: number;
  /** 0xRRGGBB, matching this observer's own marker/zenith color - see
   *  createObserverEntry in main.ts. */
  color: number;
  active: boolean;
}

/**
 * A tiny top-down map overlay showing where every observer currently
 * stands - same "external push once per frame" pattern as TimePanel's
 * date/rate readout (not a toggleable Layer). Draws the SAME continents
 * texture Ground View's globe uses (`TEXTURES.continents`) once, then re-plots a dot per observer each
 * frame via `latLonToCanvasPixel` - shared math with any future land/water
 * scenery classifier, so a dot's position on this map and where that
 * observer's feet actually land on the real Earth mesh can never disagree.
 *
 * Dots never need to track Earth's live spin: a station's lat/lon is fixed
 * relative to the continents texture itself (both live in the rotationGroup-
 * relative frame - see ObserverStation), so redrawing only needs to react to
 * the observer list, not the current rotation angle.
 *
 * Only meaningful while actually standing on the ground (Space View already
 * shows every observer's real position directly) - `setVisible` is pushed
 * from main.ts's render loop each frame, ANDed from two independent
 * sources: the same `groundViewActive` check the atmosphere/day-sky fade
 * already uses, AND a manual "Show Minimap" checkbox (ControlPanel's Camera
 * section) so it can still be suppressed on demand while in Ground View
 * (e.g. for a clean video shot).
 *
 * This widget is interactive (the minimize button and, while minimized,
 * the map itself) despite the container itself being pointer-events:none
 * (so empty space around the canvas stays click-through) - `pointer-events`
 * is re-enabled on those two elements specifically - see the CSS.
 * Minimizing shrinks the canvas's DISPLAYED size only (CSS width/height) rather than hiding it -
 * an earlier version used `display:none`, which left only the corner
 * button visible and, combined with its intentionally-overflowing corner
 * position, could render partially outside the viewport. Keeping a small
 * but still-visible map avoids that entirely and matches what a minimized
 * widget should look like: a small map, plus something to click.
 */
export class MinimapHud {
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly toggleButton: HTMLButtonElement;
  private readonly mapImage: HTMLImageElement;
  private mapLoaded = false;
  private minimized = false;

  constructor(container: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "minimap-hud";

    this.toggleButton = document.createElement("button");
    this.toggleButton.type = "button";
    this.toggleButton.className = "minimap-hud-toggle";
    this.toggleButton.setAttribute("aria-label", "Minimize minimap");
    this.toggleButton.textContent = "–"; // en dash, reads as a minimize glyph
    this.toggleButton.addEventListener("click", () => this.setMinimized(!this.minimized));

    this.canvas = document.createElement("canvas");
    this.canvas.className = "minimap-hud-canvas";
    // Internal drawing resolution always stays full size - only the
    // DISPLAYED size (CSS width/height, see .minimap-hud-minimized) shrinks
    // when minimized, so the map stays crisp at either size and update()
    // never needs to know which one is showing.
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    // Clicking the map itself also restores it when minimized - the
    // shrunken map doubles as its own "click to expand" affordance, not
    // just the corner button.
    this.canvas.addEventListener("click", () => {
      if (this.minimized) this.setMinimized(false);
    });
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("MinimapHud: 2D canvas context unavailable");
    this.ctx = ctx;

    this.mapImage = new Image();
    this.mapImage.onload = () => {
      this.mapLoaded = true;
    };
    this.mapImage.src = TEXTURES.continents;

    this.element.appendChild(this.toggleButton);
    this.element.appendChild(this.canvas);
    container.appendChild(this.element);
  }

  private setMinimized(minimized: boolean): void {
    this.minimized = minimized;
    this.element.classList.toggle("minimap-hud-minimized", minimized);
    this.toggleButton.textContent = minimized ? "□" : "–"; // small square (restore) / en dash (minimize)
    this.toggleButton.setAttribute("aria-label", minimized ? "Restore minimap" : "Minimize minimap");
  }

  /** Pushed once per frame from main.ts's render loop - only relevant in
   *  Ground View, see the class doc comment. */
  setVisible(visible: boolean): void {
    this.element.style.display = visible ? "" : "none";
  }

  /** 0 (invisible) to 1 (fully opaque) - applied to the map canvas only, not
   *  the minimize button, so the button stays fully visible/clickable no
   *  matter how low the map's own opacity is dialed. */
  setOpacity(opacity: number): void {
    this.canvas.style.opacity = String(opacity);
  }

  /** Pushed once per frame from main.ts's render loop - keeps drawing even
   *  while minimized, since the shrunken map is still visible (see the
   *  class doc comment), just smaller. */
  update(observers: MinimapObserverDot[]): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (this.mapLoaded) {
      ctx.drawImage(this.mapImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      ctx.fillStyle = "#0a0c14";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    for (const observer of observers) {
      const { x, y } = latLonToCanvasPixel(observer.latDeg, observer.lonDeg, CANVAS_WIDTH, CANVAS_HEIGHT);
      const radius = observer.active ? ACTIVE_DOT_RADIUS_PX : DOT_RADIUS_PX;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `#${observer.color.toString(16).padStart(6, "0")}`;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
      ctx.stroke();
    }
  }
}
