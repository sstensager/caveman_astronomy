import * as THREE from "three";
import type { Layer, LayerGroup } from "../layers/Layer";

const VERTEX_SHADER = /* glsl */ `
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 26.0;
  }
`;

/** Default pin/map-marker silhouette: a circular head with a tapering point
 *  below it and a small hole punched near the top, drawn procedurally via
 *  gl_PointCoord - no texture/CanvasTexture infrastructure needed. Exported
 *  so a future pass can swap in a different look via ObserverMarkerOptions
 *  without touching this class. */
export const PIN_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;

  void main() {
    vec2 uv = gl_PointCoord;
    vec2 headCenter = vec2(0.5, 0.38);
    float headRadius = 0.24;
    float distHead = length(uv - headCenter);
    float headMask = 1.0 - smoothstep(headRadius - 0.03, headRadius, distHead);

    float tipStart = 0.38;
    float tipEnd = 0.92;
    float t = clamp((uv.y - tipStart) / (tipEnd - tipStart), 0.0, 1.0);
    float halfWidth = mix(0.22, 0.0, t);
    float distFromCenterX = abs(uv.x - 0.5);
    float inTipRange = step(tipStart, uv.y) * step(uv.y, tipEnd);
    float tipMask = inTipRange * (1.0 - smoothstep(halfWidth - 0.03, halfWidth, distFromCenterX));

    float mask = max(headMask, tipMask);
    if (mask <= 0.0) discard;

    float holeRadius = 0.09;
    float holeMask = 1.0 - smoothstep(holeRadius - 0.02, holeRadius, distHead);
    mask *= (1.0 - holeMask * 0.6);

    gl_FragColor = vec4(uColor, mask);
  }
`;

export interface ObserverMarkerOptions {
  color?: number;
  fragmentShader?: string;
}

/**
 * A small fixed-pixel-size pin marking an observer's exact world position.
 * Reuses SelectedStarMarker's shader-billboard technique (THREE.Points,
 * single vertex, fixed gl_PointSize, no distance attenuation) with a pin
 * silhouette instead of a ring. Not dual-tier like Sun/Moon markers - it
 * sits at the observer's true EARTH_RADIUS-scale world position, which
 * renders correctly in both Space and Ground modes without reprojection
 * onto a celestial sphere.
 */
export class ObserverMarker implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup = "Earth.Teaching";
  readonly object3D: THREE.Points;

  private readonly geometry: THREE.BufferGeometry;
  private readonly getWorldPosition: () => THREE.Vector3;

  constructor(id: string, label: string, getWorldPosition: () => THREE.Vector3, options?: ObserverMarkerOptions) {
    this.id = id;
    this.label = label;
    this.getWorldPosition = getWorldPosition;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));

    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(options?.color ?? 0xff5f5f) } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: options?.fragmentShader ?? PIN_FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    this.object3D = new THREE.Points(this.geometry, material);
    this.object3D.name = `ObserverMarker.${id}`;
    this.object3D.renderOrder = 998;
    this.update();
  }

  update(): void {
    const pos = this.getWorldPosition();
    const attr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.setXYZ(0, pos.x, pos.y, pos.z);
    attr.needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }
}
