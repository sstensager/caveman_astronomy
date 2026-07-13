import * as THREE from "three";
import type { Layer, LayerGroup } from "../layers/Layer";

/** Exported so ObserverDragHandler's hover/pick threshold can be derived
 *  from it instead of hardcoding a second, easily-drifting copy of the same
 *  number (see HOVER_THRESHOLD_PX there). */
export const POINT_SIZE_PX = 48.0;

const VERTEX_SHADER = /* glsl */ `
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = ${POINT_SIZE_PX.toFixed(1)};
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

/** Shown instead of PIN_FRAGMENT_SHADER when the marker is geometrically on
 *  the far side of Earth from the camera (see ObserverMarker.update's
 *  occlusion check) - a downward chevron ("v" of two line segments),
 *  distinct at a glance from the normal pin, signaling "this observer is
 *  behind the planet from here" rather than silently drawing the same pin
 *  on top of Earth regardless of real occlusion (both materials keep
 *  depthTest off, so the marker is always found at its correct screen
 *  position either way - only the SHAPE changes). */
export const CHEVRON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;

  float segmentDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    vec2 uv = gl_PointCoord;
    float d1 = segmentDist(uv, vec2(0.22, 0.28), vec2(0.5, 0.68));
    float d2 = segmentDist(uv, vec2(0.5, 0.68), vec2(0.78, 0.28));
    float d = min(d1, d2);
    float thickness = 0.08;
    float mask = 1.0 - smoothstep(thickness - 0.02, thickness, d);
    if (mask <= 0.0) discard;
    gl_FragColor = vec4(uColor, mask);
  }
`;

export interface ObserverMarkerOptions {
  color?: number;
  fragmentShader?: string;
  occludedFragmentShader?: string;
}

/**
 * A small fixed-pixel-size pin marking an observer's exact world position.
 * Reuses SelectedStarMarker's shader-billboard technique (THREE.Points,
 * single vertex, fixed gl_PointSize, no distance attenuation) with a pin
 * silhouette instead of a ring. Not dual-tier like Sun/Moon markers - it
 * sits at the observer's true EARTH_RADIUS-scale world position, which
 * renders correctly in both Space and Ground modes without reprojection
 * onto a celestial sphere.
 *
 * depthTest is off, so the marker always draws on top of Earth regardless
 * of real 3D occlusion - correct for "always findable," but on its own it
 * means a pin on the far side of the planet looks identical to one on the
 * near side, which reads as wrong once you know where the observer actually
 * is. setCameraPositionGetter enables a cheap self-occlusion check (is this
 * point on Earth's near or far hemisphere from the camera - see update())
 * that swaps to CHEVRON_FRAGMENT_SHADER when occluded, keeping the marker
 * always visible at its correct screen position while being honest about
 * whether it's actually in view.
 */
export class ObserverMarker implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup = "Earth.Teaching";
  readonly object3D: THREE.Points;

  private readonly geometry: THREE.BufferGeometry;
  private readonly getWorldPosition: () => THREE.Vector3;
  private readonly visibleMaterial: THREE.ShaderMaterial;
  private readonly occludedMaterial: THREE.ShaderMaterial;
  private getCameraPosition?: () => THREE.Vector3;

  constructor(id: string, label: string, getWorldPosition: () => THREE.Vector3, options?: ObserverMarkerOptions) {
    this.id = id;
    this.label = label;
    this.getWorldPosition = getWorldPosition;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));

    const color = new THREE.Color(options?.color ?? 0xff5f5f);
    const baseMaterialOptions = { transparent: true, depthTest: false, depthWrite: false };
    this.visibleMaterial = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: options?.fragmentShader ?? PIN_FRAGMENT_SHADER,
      ...baseMaterialOptions,
    });
    this.occludedMaterial = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: options?.occludedFragmentShader ?? CHEVRON_FRAGMENT_SHADER,
      ...baseMaterialOptions,
    });

    this.object3D = new THREE.Points(this.geometry, this.visibleMaterial);
    this.object3D.name = `ObserverMarker.${id}`;
    this.object3D.renderOrder = 998;
    // A single-vertex geometry's CPU-side bounding sphere would need
    // recomputing every time the vertex moves (drag-to-relocate,
    // WASD movement) to keep Three.js's frustum-culling check accurate -
    // this marker is meant to always be findable regardless of where it's
    // moved to, so skip that check entirely rather than risk it silently
    // going stale and hiding an actually-visible marker after a move.
    this.object3D.frustumCulled = false;
    this.update();
  }

  /** Wired in from main.ts once CameraManager exists (constructed AFTER the
   *  default observer's marker - see main.ts) - optional, and update() is
   *  self-occlusion-check-free until this is called, exactly like
   *  `controlPanel` is referenced before assignment elsewhere in main.ts. */
  setCameraPositionGetter(getter: () => THREE.Vector3): void {
    this.getCameraPosition = getter;
  }

  update(): void {
    const pos = this.getWorldPosition();
    const attr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.setXYZ(0, pos.x, pos.y, pos.z);
    attr.needsUpdate = true;

    if (this.getCameraPosition) {
      // Earth's center is always the world origin (see EarthBase) - the
      // observer sits essentially ON Earth's surface, so normalize(pos) IS
      // the outward surface normal at the marker's position. If that
      // normal points away from the camera, the marker is on the sphere's
      // far hemisphere - the same self-occlusion test used for back-face
      // culling, applied to a single point rather than a mesh triangle.
      const toCamera = this.getCameraPosition().clone().sub(pos).normalize();
      const surfaceNormal = pos.clone().normalize();
      const occluded = surfaceNormal.dot(toCamera) < 0;
      this.object3D.material = occluded ? this.occludedMaterial : this.visibleMaterial;
    }
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }
}
