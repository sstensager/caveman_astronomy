import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { StarRecord } from "../../astronomy/starCatalog";
import type { Observer } from "../../observers/Observer";
import { starColorFromColorIndex } from "../../astronomy/starColor";
import { hemisphereFadeFactor, type HemisphereMode } from "../../utils/hemisphereFade";

const BRIGHT_MAG_REF = -1.5;
const FAINT_MAG_REF = 6.5;
const MIN_POINT_SIZE = 1;
const MAX_POINT_SIZE = 8;

/** Per-star base point size in px, from apparent magnitude. Sub-linear
 *  (sqrt) so the long faint tail doesn't collapse to indistinguishable dots
 *  next to a handful of very bright stars. A rendering-tuning concern, not
 *  an astronomical one, so it lives here rather than in starCatalog.ts. */
function starPointSize(mag: number): number {
  const clamped = Math.min(Math.max(mag, BRIGHT_MAG_REF), FAINT_MAG_REF);
  const t = (FAINT_MAG_REF - clamped) / (FAINT_MAG_REF - BRIGHT_MAG_REF);
  return MIN_POINT_SIZE + Math.sqrt(t) * (MAX_POINT_SIZE - MIN_POINT_SIZE);
}

/** Builds a unit-radius BufferGeometry from a star catalog: position (unit
 *  direction), size and color (baked once from magnitude/B-V), and a fade
 *  scalar (mutable per-frame by hemisphere fade, kept separate from color
 *  so that machinery never needs to know/re-multiply each star's own base
 *  color - see updateHemisphereFade). */
export function buildStarGeometry(catalog: StarRecord[]): THREE.BufferGeometry {
  const positions = new Float32Array(catalog.length * 3);
  const sizes = new Float32Array(catalog.length);
  const colors = new Float32Array(catalog.length * 3);
  const fades = new Float32Array(catalog.length).fill(1);

  catalog.forEach((star, i) => {
    positions[i * 3] = star.direction.x;
    positions[i * 3 + 1] = star.direction.y;
    positions[i * 3 + 2] = star.direction.z;
    sizes[i] = starPointSize(star.mag);
    const [r, g, b] = starColorFromColorIndex(star.colorIndex);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aFade", new THREE.BufferAttribute(fades, 1));
  return geometry;
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aFade;

  uniform float uSizeScale;

  varying vec3 vColor;
  varying float vFade;

  void main() {
    vColor = aColor;
    vFade = aFade;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uSizeScale;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uBrightness;
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vFade;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float dist = length(centered);
    float mask = 1.0 - smoothstep(0.4, 0.5, dist);
    if (mask <= 0.0) discard;
    gl_FragColor = vec4(vColor * uBrightness, mask * uOpacity * vFade);
  }
`;

export interface StarsLayerOptions {
  id: string;
  label: string;
  group: LayerGroup;
  /** Display radius - "effectively infinitely far away" for the sky-scale
   *  system, a small comprehensible globe for the celestial-sphere system. */
  radius: number;
  /** The shared real star catalog (see src/astronomy/starCatalog.ts),
   *  sorted ascending by magnitude. Both StarsLayer instances in the app
   *  are given the SAME array reference - that sharing, not a shared
   *  scene-graph transform, is what guarantees they show the same sky. */
  catalog: StarRecord[];
  /** Only stars at or brighter than this magnitude are drawn. */
  limitingMagnitude: number;
  /** Multiplier applied on top of each star's own magnitude-derived size. */
  size: number;
  brightness: number;
  opacity: number;
  /** Only the celestial-sphere star system needs the hemisphere-fade
   *  machinery; the background starfield's fade attribute stays at 1. */
  supportsHemisphereFade?: boolean;
  /** When provided, the star field's position tracks this getter's live
   *  observer world position each frame instead of assuming it sits at the
   *  scene origin - exact rather than a negligible approximation once
   *  radius isn't huge relative to the observer's distance from Earth's
   *  center. A lazy getter (not a fixed Observer) so this always follows
   *  whichever observer is currently active - see ObserverRegistry in
   *  main.ts. Only backgroundStars (sky tier) sets this; celestialSphereStars
   *  (globe tier) stays Earth-centered by leaving it unset. */
  getObserver?: () => Observer;
}

/**
 * A sphere of points representing a star field, drawn from the app's one
 * shared real star catalog (src/astronomy/starCatalog.ts). Two independent
 * instances exist - Background Stars (immersive, sky-scale) and Celestial
 * Sphere Stars (teaching aid, globe-scale) - each with its own live-tunable
 * limiting magnitude, brightness, size, and opacity, but both reading from
 * the SAME catalog array, so they always show the same sky. Turning one
 * off/on never affects the other.
 */
export class StarsLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D: THREE.Points;

  private readonly catalog: StarRecord[];
  private readonly material: THREE.ShaderMaterial;
  private readonly supportsHemisphereFade: boolean;
  private readonly getObserver?: () => Observer;
  private hemisphereMode: HemisphereMode = "none";

  constructor(options: StarsLayerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.group = options.group;
    this.catalog = options.catalog;
    this.supportsHemisphereFade = options.supportsHemisphereFade ?? false;
    this.getObserver = options.getObserver;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSizeScale: { value: options.size },
        uBrightness: { value: options.brightness },
        uOpacity: { value: options.opacity },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });

    const geometry = buildStarGeometry(this.catalog);

    this.object3D = new THREE.Points(geometry, this.material);
    this.object3D.name = `StarsLayer.${options.id}`;
    this.object3D.scale.setScalar(options.radius);
    this.setLimitingMagnitude(options.limitingMagnitude);
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  /** No-op unless an observer getter was supplied - see StarsLayerOptions.getObserver. */
  update(_deltaSeconds: number): void {
    if (!this.getObserver) return;
    this.object3D.position.copy(this.getObserver().getFrame().worldPosition);
  }

  /** Draws only stars at or brighter than magLimit. The catalog is sorted
   *  ascending by magnitude, so this is a binary search for the cutoff
   *  index followed by a drawRange change - no geometry reallocation. */
  setLimitingMagnitude(magLimit: number): void {
    let lo = 0;
    let hi = this.catalog.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.catalog[mid].mag <= magLimit) lo = mid + 1;
      else hi = mid;
    }
    this.object3D.geometry.setDrawRange(0, lo);
  }

  setBrightness(value: number): void {
    this.material.uniforms.uBrightness.value = value;
  }

  setSize(scale: number): void {
    this.material.uniforms.uSizeScale.value = scale;
  }

  setOpacity(value: number): void {
    this.material.uniforms.uOpacity.value = value;
  }

  setRadius(radius: number): void {
    this.object3D.scale.setScalar(radius);
  }

  setHemisphereMode(mode: HemisphereMode): void {
    this.hemisphereMode = mode;
  }

  /** No-op unless this instance supports hemisphere fade and a mode other
   *  than "none" is active - cheap to call unconditionally each frame. */
  updateHemisphereFade(cameraDirection: THREE.Vector3): void {
    if (!this.supportsHemisphereFade || this.hemisphereMode === "none") return;

    const position = this.object3D.geometry.getAttribute("position") as THREE.BufferAttribute;
    const fade = this.object3D.geometry.getAttribute("aFade") as THREE.BufferAttribute;
    const direction = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      direction.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
      fade.setX(i, hemisphereFadeFactor(direction, cameraDirection, this.hemisphereMode));
    }
    fade.needsUpdate = true;
  }

  /** Resolves a raycast hit's vertex index back to the star it represents.
   *  Relies on vertex order === catalog order, an invariant setDrawRange
   *  preserves (it truncates, never reorders). */
  getStarAt(vertexIndex: number): StarRecord | undefined {
    return this.catalog[vertexIndex];
  }
}
