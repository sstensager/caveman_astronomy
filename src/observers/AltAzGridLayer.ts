import * as THREE from "three";
import type { Layer, LayerGroup } from "../layers/Layer";
import type { Observer } from "./Observer";

const ALTITUDE_CIRCLES_DEG = [0, 30, 60];
const ALTITUDE_CIRCLE_SEGMENTS = 48;
const AZIMUTH_MERIDIAN_COUNT = 8;
const AZIMUTH_MERIDIAN_SEGMENTS = 12;

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
  getActiveObserver: () => Observer;
}

/**
 * The active observer's personal altitude/azimuth grid: 3 altitude circles
 * (0/30/60 degrees) and 8 azimuth meridians (horizon to zenith), built from
 * the standard ENU parametrization direction(alt,az) = up*sin(alt) +
 * (north*cos(az) + east*sin(az))*cos(alt).
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

    positions.needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  setRadius(radius: number): void {
    this.radius = radius;
  }
}
