import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { Observer } from "../../observers/Observer";
import type { ResolvedConstellation } from "../../astronomy/constellationCatalog";

/** Builds ONE batched position buffer (2 vertices per segment, unit-radius
 *  direction vectors straight from the shared STAR_CATALOG's StarRecord.
 *  direction) rather than one THREE.Line per segment - the whole point of
 *  resolving segments ahead of time in constellationCatalog.ts is that this
 *  function does zero star lookups, only reads already-resolved directions. */
function buildConstellationLineGeometry(constellations: ResolvedConstellation[]): THREE.BufferGeometry {
  let segmentCount = 0;
  for (const constellation of constellations) segmentCount += constellation.segments.length;

  const positions = new Float32Array(segmentCount * 2 * 3);
  let i = 0;
  for (const constellation of constellations) {
    for (const { a, b } of constellation.segments) {
      positions[i++] = a.direction.x;
      positions[i++] = a.direction.y;
      positions[i++] = a.direction.z;
      positions[i++] = b.direction.x;
      positions[i++] = b.direction.y;
      positions[i++] = b.direction.z;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export interface ConstellationLinesLayerOptions {
  id: string;
  label: string;
  group: LayerGroup;
  /** Display radius - mirrors StarsLayer's sky-scale ("effectively
   *  infinitely far") vs globe-scale (small explanatory sphere) split. */
  radius: number;
  constellations: ResolvedConstellation[];
  color?: number;
  opacity?: number;
  /** Same meaning as StarsLayer's getObserver - only the sky-tier instance
   *  sets this, tracking the active observer's world position each frame;
   *  the globe-tier instance stays Earth-centered by leaving it unset. */
  getObserver?: () => Observer;
}

/**
 * Constellation stick-figure lines, drawn from already-resolved star
 * references (see constellationCatalog.ts's ResolvedConstellation - never
 * this layer's own copy of a position). One batched THREE.LineSegments per
 * instance, positioned via the identical object3D scale/position pattern
 * StarsLayer uses for its points, built from the SAME StarRecord.direction
 * values - that shared math, not any per-frame star lookup, is what keeps
 * lines exactly attached to their stars under every transform (observer
 * movement, radius changes) with zero per-frame recomputation.
 */
export class ConstellationLinesLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D: THREE.LineSegments;

  private readonly material: THREE.LineBasicMaterial;
  private readonly getObserver?: () => Observer;

  constructor(options: ConstellationLinesLayerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.group = options.group;
    this.getObserver = options.getObserver;

    this.material = new THREE.LineBasicMaterial({
      color: options.color ?? 0x6699cc,
      transparent: true,
      opacity: options.opacity ?? 0.5,
    });

    const geometry = buildConstellationLineGeometry(options.constellations);
    this.object3D = new THREE.LineSegments(geometry, this.material);
    this.object3D.name = `ConstellationLinesLayer.${options.id}`;
    this.object3D.scale.setScalar(options.radius);
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  /** No-op unless an observer getter was supplied - identical shape to
   *  StarsLayer.update. */
  update(_deltaSeconds: number): void {
    if (!this.getObserver) return;
    this.object3D.position.copy(this.getObserver().getFrame().worldPosition);
  }

  setRadius(radius: number): void {
    this.object3D.scale.setScalar(radius);
  }

  setOpacity(value: number): void {
    this.material.opacity = value;
  }
}
