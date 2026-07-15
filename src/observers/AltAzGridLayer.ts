import * as THREE from "three";
import type { Layer, LayerGroup } from "../layers/Layer";
import type { Observer } from "./Observer";
import { createLabelTexture } from "../utils/canvasLabel";

const ALTITUDE_CIRCLES_DEG = [0, 30, 60];
const ALTITUDE_CIRCLE_SEGMENTS = 48;
const AZIMUTH_MERIDIAN_COUNT = 8;
const AZIMUTH_MERIDIAN_SEGMENTS = 12;

// Compass-letter sprite size as a fraction of the grid's own radius. Since
// the letters sit AT `radius` distance from the observer (on the horizon
// circle) and Ground View's camera sits AT the observer, this ratio is
// approximately the letter's own angular size in the view (size/distance
// cancels the radius) - independent of whatever ALT_AZ_DOME_RADIUS happens
// to be. ~0.06 rad is roughly 3.5 degrees, comfortably readable up close
// without dominating the view (0.35 here previously produced letters
// spanning a good fraction of the whole screen in Ground View).
const COMPASS_LABEL_SIZE_RATIO = 0.06;

/** createLabelTexture's default canvas (256x64) is tuned for word-shaped
 *  constellation names - a single compass letter drawn centered on it would
 *  occupy a small fraction of the width, rendering as a tiny, hard-to-see
 *  glyph lost in mostly-empty space. Square canvas + a font sized to fill
 *  it instead. */
function createCompassLetterTexture(text: string, color: string): THREE.CanvasTexture {
  return createLabelTexture(text, color, { width: 64, height: 64, font: "bold 44px sans-serif" });
}

/** North at azimuth 0, increasing clockwise through East - matches
 *  buildAltAzSamples'/update()'s direction(alt,az) parametrization exactly,
 *  so a compass letter always sits precisely on the horizon circle it labels. */
const COMPASS_POINTS: { letter: string; azimuthRad: number }[] = [
  { letter: "N", azimuthRad: 0 },
  { letter: "E", azimuthRad: Math.PI / 2 },
  { letter: "S", azimuthRad: Math.PI },
  { letter: "W", azimuthRad: (3 * Math.PI) / 2 },
];

interface AltAzSample {
  alt: number;
  az: number;
}

/** Fixed (alt, az) sample pairs for the grid pattern itself - computed once
 *  and reused forever, since the PATTERN (which altitudes/azimuths to draw)
 *  never changes; only the world-space basis (up/north/east) used to
 *  convert them changes, each frame, as the observer moves. LineSegments
 *  pairs: each adjacent sample pair is one line segment. */
function buildAltAzSamples(): AltAzSample[] {
  const samples: AltAzSample[] = [];

  for (const altDeg of ALTITUDE_CIRCLES_DEG) {
    const alt = THREE.MathUtils.degToRad(altDeg);
    for (let i = 0; i < ALTITUDE_CIRCLE_SEGMENTS; i++) {
      samples.push({ alt, az: (i / ALTITUDE_CIRCLE_SEGMENTS) * Math.PI * 2 });
      samples.push({ alt, az: ((i + 1) / ALTITUDE_CIRCLE_SEGMENTS) * Math.PI * 2 });
    }
  }

  for (let m = 0; m < AZIMUTH_MERIDIAN_COUNT; m++) {
    const az = (m / AZIMUTH_MERIDIAN_COUNT) * Math.PI * 2;
    for (let i = 0; i < AZIMUTH_MERIDIAN_SEGMENTS; i++) {
      samples.push({ alt: (i / AZIMUTH_MERIDIAN_SEGMENTS) * (Math.PI / 2), az });
      samples.push({ alt: ((i + 1) / AZIMUTH_MERIDIAN_SEGMENTS) * (Math.PI / 2), az });
    }
  }

  return samples;
}

export interface AltAzGridLayerOptions {
  id: string;
  label: string;
  radius: number;
  color?: number;
  /** Color for the N/S/E/W compass letters - defaults to white for
   *  legibility against the grid's own (dimmer, semi-transparent) lines. */
  compassColor?: string;
  getActiveObserver: () => Observer;
  /** Defaults to createLabelTexture (real canvas text rendering) -
   *  injectable so tests can verify the position/update math without a
   *  canvas 2D context, which this project's vitest environment ("node",
   *  not "jsdom") doesn't provide. Same pattern as ConstellationLabelsLayer. */
  createTexture?: (text: string, color: string) => THREE.Texture;
}

/**
 * The active observer's personal altitude/azimuth grid: 3 altitude circles
 * (0/30/60 degrees), 8 azimuth meridians (horizon to zenith), and 4 N/S/E/W
 * compass letters sitting on the horizon circle - all built from the
 * standard ENU parametrization direction(alt,az) = up*sin(alt) +
 * (north*cos(az) + east*sin(az))*cos(alt) (the compass letters are just this
 * formula at alt=0, where the up term drops out).
 *
 * Always observer-centered on both display tiers (unconditionally offset
 * by frame.worldPosition) - same reasoning as ZenithLayer: altitude/azimuth
 * are inherently defined relative to the observer's own horizon, with no
 * Earth-center equivalent to fall back to.
 *
 * Full rebuild every frame - not just cheap (only ~480 vertices, no worse
 * than StarsLayer's hemisphere-fade rewrite) but a correctness requirement:
 * if Earth's rotation is ever re-enabled, a statically-built grid would go
 * stale the instant Earth spins, since north/east rotate with it. Rewrites
 * the existing position attribute in place each frame rather than
 * reallocating geometry, since the sample COUNT never changes.
 */
export class AltAzGridLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup = "Sky.Interpretation";
  readonly object3D: THREE.LineSegments;

  private readonly samples: AltAzSample[];
  private readonly getActiveObserver: () => Observer;
  private readonly compassSprites: { letter: string; azimuthRad: number; sprite: THREE.Sprite }[];
  private radius: number;

  constructor(options: AltAzGridLayerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.radius = options.radius;
    this.getActiveObserver = options.getActiveObserver;
    this.samples = buildAltAzSamples();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.samples.length * 3), 3));
    const material = new THREE.LineBasicMaterial({ color: options.color ?? 0x66ccff, transparent: true, opacity: 0.5 });
    this.object3D = new THREE.LineSegments(geometry, material);
    this.object3D.name = `AltAzGridLayer.${options.id}`;

    const createTexture = options.createTexture ?? createCompassLetterTexture;
    const compassColor = options.compassColor ?? "#ffffff";
    // Scaled off `radius` (world units, sizeAttenuation true) rather than a
    // fixed screen-space size - this grid is a small personal dome (see
    // config/constants.ts's ALT_AZ_DOME_RADIUS), so its labels need to
    // shrink into invisibility from far away exactly like the dome itself
    // does, not stay pinned at a constant on-screen size regardless of
    // camera distance (that used to make them dwarf the entire planet from
    // Space View).
    const compassSize = options.radius * COMPASS_LABEL_SIZE_RATIO;
    this.compassSprites = COMPASS_POINTS.map(({ letter, azimuthRad }) => {
      const spriteMaterial = new THREE.SpriteMaterial({
        map: createTexture(letter, compassColor),
        sizeAttenuation: true,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(compassSize, compassSize, 1);
      sprite.renderOrder = 997;
      this.object3D.add(sprite);
      return { letter, azimuthRad, sprite };
    });
  }

  update(): void {
    const frame = this.getActiveObserver().getFrame();
    if (!frame.north || !frame.east) return;

    const positions = this.object3D.geometry.getAttribute("position") as THREE.BufferAttribute;
    const direction = new THREE.Vector3();
    const world = new THREE.Vector3();

    this.samples.forEach((sample, i) => {
      const cosAlt = Math.cos(sample.alt);
      direction
        .copy(frame.up)
        .multiplyScalar(Math.sin(sample.alt))
        .addScaledVector(frame.north!, Math.cos(sample.az) * cosAlt)
        .addScaledVector(frame.east!, Math.sin(sample.az) * cosAlt);
      world.copy(frame.worldPosition).addScaledVector(direction, this.radius);
      positions.setXYZ(i, world.x, world.y, world.z);
    });

    // Compass letters sit on the horizon (alt=0), so cosAlt=1 and the up
    // term drops out - direction(az) = north*cos(az) + east*sin(az).
    for (const point of this.compassSprites) {
      direction
        .copy(frame.north!)
        .multiplyScalar(Math.cos(point.azimuthRad))
        .addScaledVector(frame.east!, Math.sin(point.azimuthRad));
      point.sprite.position.copy(frame.worldPosition).addScaledVector(direction, this.radius);
    }

    positions.needsUpdate = true;
    // REQUIRED, not just good practice: this object3D's own transform stays
    // at identity forever (every position above is written directly into
    // world-space vertex data, never via object3D.position) - unlike a
    // transform-based mover, Three.js has no other signal that this
    // geometry's shape changed. Its `geometry.boundingSphere` gets
    // lazily auto-computed ONCE, on the very first frustum-culling check,
    // then never again - without this call, that first frame's (whatever
    // it happened to be, e.g. the default observer's initial position)
    // bounding sphere stays cached forever, and the whole grid silently
    // stops rendering (frustum-culled as "out of view") the moment the
    // observer walks far enough that the camera's frustum no longer
    // overlaps that stale sphere, even though the grid itself is right
    // there. See OrbitLineLayer/SkyPathLineLayer for the same pattern.
    this.object3D.geometry.computeBoundingSphere();
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  setRadius(radius: number): void {
    this.radius = radius;
  }
}
