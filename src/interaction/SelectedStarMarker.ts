import * as THREE from "three";

const VERTEX_SHADER = /* glsl */ `
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 22.0;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float dist = length(centered);
    float ring = smoothstep(0.32, 0.38, dist) - smoothstep(0.42, 0.48, dist);
    if (ring <= 0.0) discard;
    gl_FragColor = vec4(uColor, ring);
  }
`;

/**
 * A small fixed-pixel-size ring marking the currently selected star's exact
 * world position (see StarPicker, which supplies the raycast hit point
 * directly - no need to know which display radius/tier the star came from).
 * Reuses the same gl_PointSize/no-attenuation technique as StarsLayer, so it
 * reads at a constant, correct screen size regardless of whether the pick
 * came from the sky-scale or globe-scale star field. Hidden until a
 * selection is made.
 */
export class SelectedStarMarker {
  readonly object3D: THREE.Points;
  private readonly geometry: THREE.BufferGeometry;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));

    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x7fe0ff) } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    this.object3D = new THREE.Points(this.geometry, material);
    this.object3D.name = "SelectedStarMarker";
    this.object3D.renderOrder = 999;
    this.object3D.visible = false;
  }

  setWorldPosition(position: THREE.Vector3 | undefined): void {
    if (!position) {
      this.object3D.visible = false;
      return;
    }
    const attr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.setXYZ(0, position.x, position.y, position.z);
    attr.needsUpdate = true;
    this.object3D.visible = true;
  }
}
