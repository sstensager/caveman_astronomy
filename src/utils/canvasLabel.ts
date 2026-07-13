import * as THREE from "three";

const DEFAULT_WIDTH = 256;
const DEFAULT_HEIGHT = 64;
const DEFAULT_FONT = "32px sans-serif";

export interface CanvasLabelOptions {
  width?: number;
  height?: number;
  font?: string;
}

/** Renders `text` onto an offscreen canvas ONCE and wraps it as a
 *  CanvasTexture - no DOM element is ever attached to the page; the canvas
 *  exists only as a texture source. Shared by every sprite-label layer
 *  (ConstellationLabelsLayer, AltAzGridLayer's compass letters) so there's
 *  one source of truth for "how do we bake text into a sprite" instead of a
 *  copy per layer. */
export function createLabelTexture(text: string, color: string, options?: CanvasLabelOptions): THREE.CanvasTexture {
  const width = options?.width ?? DEFAULT_WIDTH;
  const height = options?.height ?? DEFAULT_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = options?.font ?? DEFAULT_FONT;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
