import * as THREE from "three";
import { latLonToSurfacePoint } from "./geo";

/**
 * Maps a lat/lon (degrees) to the (u, v) texture coordinate that Earth's
 * continents texture actually shows there - the exact inverse of
 * THREE.SphereGeometry's own vertex-to-UV formula (see its source:
 * vertex.x = -ringRadius*cos(phi), vertex.z = ringRadius*sin(phi),
 * y = radius*cos(theta), stored uv = (phi/2pi, ...)), applied to the SAME
 * surface point geo.ts's latLonToSurfacePoint already produces (the function
 * ObserverStation/GroundObserver use, so this stays consistent with where
 * observers actually stand).
 *
 * NOT derived by intuition - verified against a real `THREE.SphereGeometry`
 * instance's own `uv` attribute (see equirectangular.test.ts), because a
 * hand-derived guess here previously disagreed with the real attribute on
 * the v axis. u is untouched by texture.flipY (WebGL's flipY only reverses
 * row order, never column order), so u matches the raw UV.x attribute
 * directly; v is calibrated against the real geometry too, then confirmed
 * against the texture's own pole asymmetry (Antarctica is a solid landmass
 * band at v close to 1, the Arctic is mostly open ocean at v close to 0 -
 * only correct one way round). If `EarthBase`'s mesh ever stops using a
 * default-UV `THREE.SphereGeometry`, this must be re-derived, not assumed.
 */
export function latLonToUV(latDeg: number, lonDeg: number): { u: number; v: number } {
  const p = latLonToSurfacePoint(latDeg, lonDeg, 1);
  const theta = Math.acos(THREE.MathUtils.clamp(p.y, -1, 1));
  const phi = Math.atan2(p.z, -p.x);
  const u = (((phi / (2 * Math.PI)) % 1) + 1) % 1;
  const v = 1 - theta / Math.PI;
  return { u, v };
}

/**
 * Pixel coordinates within a `width`x`height` canvas holding the RAW
 * continents PNG (e.g. drawn via `ctx.drawImage` with no WebGL involved) for
 * a given lat/lon - what MinimapHud and any future land/water sampler
 * should actually call, rather than scaling latLonToUV's (u, v) directly.
 *
 * NOT the same scaling: THREE's texture pipeline applies `texture.flipY`
 * (default true) to a loaded 2D texture, which un-does a vertical inversion
 * already baked into SphereGeometry's own UV generation (see latLonToUV's
 * doc comment) before the GPU ever samples it. A canvas draw of the same PNG
 * file goes through no such flip, so this function re-applies the missing
 * inversion itself. Verified against the texture's own pole asymmetry
 * (Antarctica is a solid landmass band near the SOUTH edge of the image, the
 * Arctic is mostly open ocean near the NORTH edge - only correct one way
 * round) rather than derived by hand alone.
 */
export function latLonToCanvasPixel(
  latDeg: number,
  lonDeg: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const { u, v } = latLonToUV(latDeg, lonDeg);
  return { x: u * width, y: (1 - v) * height };
}
