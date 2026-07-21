import * as THREE from "three";
import type { Observer } from "../../observers/Observer";
import type { Layer, LayerGroup } from "../Layer";

const vertexShader = /* glsl */ `
  varying vec3 vEquatorialDirection;

  void main() {
    vEquatorialDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uPanorama;
  uniform float uOpacity;
  varying vec3 vEquatorialDirection;

  const float PI = 3.141592653589793;

  void main() {
    // This app stores equatorial directions as X=RA 0h, Y=Dec +90deg,
    // Z=RA 6h. Reorder into the conventional Cartesian basis before using
    // the standard J2000 equatorial-to-galactic rotation matrix.
    vec3 eq = vec3(vEquatorialDirection.x, vEquatorialDirection.z, vEquatorialDirection.y);
    vec3 gal = vec3(
      dot(vec3(-0.0548755604, -0.8734370902, -0.4838350155), eq),
      dot(vec3( 0.4941094279, -0.4448296300,  0.7469822445), eq),
      dot(vec3(-0.8676661490, -0.1980763734,  0.4559837762), eq)
    );

    float longitude = atan(gal.y, gal.x);
    float latitude = asin(clamp(gal.z, -1.0, 1.0));
    vec2 uv = vec2(fract(0.5 + longitude / (2.0 * PI)), 0.5 + latitude / PI);
    vec3 color = texture2D(uPanorama, uv).rgb;
    gl_FragColor = vec4(color, uOpacity);
  }
`;

/** Observer-centered photographic Milky Way backdrop. The ESO source is
 * authored with Galactic longitude/latitude, while the app's stars use
 * equatorial RA/Dec; the fragment shader performs that frame conversion so
 * both layers share the same celestial directions. */
export class MilkyWayPanoramaLayer implements Layer {
  readonly id = "milkyWayPanorama";
  readonly label = "Milky Way Panorama";
  readonly group: LayerGroup = "Sky.Observation";
  readonly object3D: THREE.Mesh;

  private readonly material: THREE.ShaderMaterial;
  private readonly getObserver: () => Observer;

  constructor(textureUrl: string, radius: number, getObserver: () => Observer) {
    this.getObserver = getObserver;
    const texture = new THREE.TextureLoader().load(textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPanorama: { value: texture },
        uOpacity: { value: 0.42 },
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });

    this.object3D = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.material);
    this.object3D.name = "MilkyWayPanorama";
    this.object3D.renderOrder = -1000;
    this.object3D.scale.setScalar(radius * 1.01);
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  update(): void {
    this.object3D.position.copy(this.getObserver().getFrame().worldPosition);
  }

  setRadius(radius: number): void {
    this.object3D.scale.setScalar(radius * 1.01);
  }

  setDayNightFactor(factor: number): void {
    this.material.uniforms.uOpacity.value = (1 - factor) * 0.42;
  }
}
