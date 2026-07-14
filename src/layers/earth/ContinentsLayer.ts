import * as THREE from "three";
import type { Layer } from "../Layer";
import { TEXTURES } from "../../config/constants";

/** Dot-product half-width of the blended day/night edge - 0 would be a
 *  razor-sharp terminator line; this softens it slightly to avoid an
 *  obviously artificial hard edge, without moving it far enough to look
 *  wrong (the real terminator is fairly sharp too, just not infinitely so
 *  once you account for atmospheric scattering - not modeled here, this is
 *  purely a visual anti-aliasing choice). */
const TERMINATOR_SOFTNESS = 0.08;

/** Multiplier on the night-lights texture's own brightness - source city-
 *  light imagery is naturally fairly dim/subtle at this resolution, boosted
 *  here so it actually reads against the (still slightly ambient-lit) dark
 *  hemisphere rather than disappearing into it. Tune directly if it looks
 *  over/under-done. */
const NIGHT_LIGHTS_INTENSITY = 1.6;

interface DayNightUniforms {
  uNightMap: { value: THREE.Texture };
  uSunDirectionWorld: { value: THREE.Vector3 };
}

/**
 * Continents/coastlines as a texture on Earth's existing mesh - not a
 * separate mesh of its own. Toggling swaps the mesh's material between
 * the flat ocean-only material (EarthBase's default) and a textured one,
 * rather than baking geography permanently into Earth's appearance. That
 * keeps "plain blue sphere" available as its own teaching moment (e.g.
 * "here's Earth with no geography, just rotation") independent of this
 * layer.
 *
 * The textured material also blends in a real day/night terminator: a
 * SECOND texture (real night-lights imagery) that only becomes visible on
 * the dark hemisphere, computed per-fragment from the actual current Sun
 * direction (see setSunDirection - pushed once per frame from main.ts's
 * render loop, the exact same vector keyLight itself uses, so this
 * terminator and keyLight's own PBR-lit terminator always agree exactly).
 * Implemented by patching the compiled MeshStandardMaterial shader via
 * onBeforeCompile rather than a separate custom ShaderMaterial or a second
 * overlay mesh.
 *
 * The day render (map texture + Three.js's own ambient+directional PBR
 * lighting) is faded to black by dayNightFactor before the night lights are
 * added, rather than left at its dim ambient-lit brightness - the day and
 * night source images aren't pixel-aligned with each other (different
 * imagery, not derived from one master), so letting the day map's faint
 * ambient-lit continents show through past the terminator would visibly
 * clash against the night map's own, differently-aligned coastlines. Fading
 * the day side fully out means only ONE image is ever visible at a given
 * point on the sphere, so misalignment between the two source images is
 * never visible. The night lights themselves stay UNLIT/constant-brightness
 * (added after the fade, not multiplied by it) - real city lights don't
 * darken with viewing angle.
 */
export class ContinentsLayer implements Layer {
  readonly id = "continents";
  readonly label = "Show Continents";
  readonly group = "Earth.Geographic" as const;

  private readonly mesh: THREE.Mesh;
  private readonly oceanMaterial: THREE.Material;
  private readonly texturedMaterial: THREE.MeshStandardMaterial;
  private readonly sunDirection = new THREE.Vector3(1, 0, 0);
  private dayNightUniforms?: DayNightUniforms;

  constructor(mesh: THREE.Mesh, oceanMaterial: THREE.Material) {
    this.mesh = mesh;
    this.oceanMaterial = oceanMaterial;

    const dayTexture = new THREE.TextureLoader().load(TEXTURES.continents);
    dayTexture.colorSpace = THREE.SRGBColorSpace;
    const nightTexture = new THREE.TextureLoader().load(TEXTURES.continentsNight);
    nightTexture.colorSpace = THREE.SRGBColorSpace;

    this.texturedMaterial = new THREE.MeshStandardMaterial({
      map: dayTexture,
      roughness: 1,
      metalness: 0,
    });

    this.texturedMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uNightMap = { value: nightTexture };
      shader.uniforms.uSunDirectionWorld = { value: this.sunDirection.clone() };
      this.dayNightUniforms = {
        uNightMap: shader.uniforms.uNightMap as { value: THREE.Texture },
        uSunDirectionWorld: shader.uniforms.uSunDirectionWorld as { value: THREE.Vector3 },
      };

      // objectNormal (raw model-space normal) is available right after
      // beginnormal_vertex - transform it into WORLD space here (via the
      // built-in modelMatrix uniform) rather than reusing the standard
      // material's own vNormal varying, which is VIEW-space and would tie
      // this to the camera instead of the actual Sun direction.
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldNormalDayNight;")
        .replace(
          "#include <beginnormal_vertex>",
          "#include <beginnormal_vertex>\nvWorldNormalDayNight = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);",
        );

      // vMapUv (the day map's own UV varying) is already declared by
      // <uv_pars_fragment> since USE_MAP is defined - reused directly for
      // the night map rather than adding a second UV set, since both
      // textures share the same equirectangular projection.
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vWorldNormalDayNight;\nuniform sampler2D uNightMap;\nuniform vec3 uSunDirectionWorld;",
        )
        .replace(
          "#include <opaque_fragment>",
          `
	float dayNightFactor = smoothstep( -${TERMINATOR_SOFTNESS.toFixed(3)}, ${TERMINATOR_SOFTNESS.toFixed(3)}, dot( normalize( vWorldNormalDayNight ), uSunDirectionWorld ) );
	vec4 nightSample = texture2D( uNightMap, vMapUv );
	outgoingLight *= dayNightFactor;
	outgoingLight += nightSample.rgb * ( 1.0 - dayNightFactor ) * ${NIGHT_LIGHTS_INTENSITY.toFixed(3)};
	#include <opaque_fragment>`,
        );
    };
  }

  setVisible(visible: boolean): void {
    this.mesh.material = visible ? this.texturedMaterial : this.oceanMaterial;
  }

  /** Pushed once per frame from main.ts's render loop, using the SAME
   *  sunLightDirection vector keyLight itself is positioned from - not a
   *  lazy getter, since the render loop already computes this value once
   *  per frame and every consumer should read that exact instant's result
   *  rather than risk independently recomputing a slightly different one.
   *  Safe to call before the shader has actually compiled (e.g. before the
   *  first render) - the direction is cached either way and pushed into
   *  the live uniform once onBeforeCompile has run. */
  setSunDirection(direction: THREE.Vector3): void {
    this.sunDirection.copy(direction);
    if (this.dayNightUniforms) this.dayNightUniforms.uSunDirectionWorld.value.copy(direction);
  }
}
