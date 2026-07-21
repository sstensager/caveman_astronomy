import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import type { Vector3Like } from "../../astronomy/types";

/** Dot-product half-width of the blended lit/dark edge - see
 *  ContinentsLayer's identical TERMINATOR_SOFTNESS for the reasoning
 *  (avoids an obviously artificial razor-sharp line). */
const DARK_SIDE_SOFTNESS = 0.08;

/** How much the LIT side fades toward the sky color, relative to the dark
 *  side, as the sky brightens (see setSkyBlend) - the dark side always fades
 *  all the way to 100% sky color (fully invisible) at full daylight, but the
 *  lit side only fades by this fraction, so it stays faintly visible instead
 *  of vanishing outright, the way a real daytime moon does. */
const DAYTIME_LIT_FADE_FRACTION = 0.55;

interface DarkSideUniforms {
  uSunDirectionWorld: { value: THREE.Vector3 };
  uDarkSideBrightness: { value: number };
  uSkyColor: { value: THREE.Color };
  uSkyBlendDark: { value: number };
  uSkyBlendLit: { value: number };
}

export interface OrbitingBodyMarkerOptions {
  id: string;
  label: string;
  group: LayerGroup;
  color: number;
  /** Fully-resolved position for this marker, in whatever THREE.Object3D
   *  this marker's object3D ends up parented under (e.g. main.ts's
   *  sunMarker/moonMarker, parented under earthBase.object3D - see their
   *  own doc comments), never raw model-space or world-space directly.
   *  Called fresh every update() - a pure function of current sim time, no
   *  internal memoization, same pattern as every other body-position
   *  consumer in this app. */
  getPosition: () => Vector3Like;
  /** Marker sphere radius, in the SAME local units getPosition() returns -
   *  there is no enclosing celestial-sphere radius to derive a size ratio
   *  from, so callers pass an absolute size directly (see main.ts for how
   *  each body's size is chosen). */
  markerSize: number;
  /** Optional image (served from public/, e.g. "/textures/earth1.png")
   *  mapped onto the marker sphere instead of a flat color. */
  textureUrl?: string;
  /** Default false (unlit `MeshBasicMaterial` - correct for a self-luminous
   *  body like the Sun). Set true for a body that should be genuinely
   *  SHADED by the scene's real keyLight instead (e.g. the Moon, for real
   *  phases) - `MeshStandardMaterial`, responds to the same lights
   *  regardless of where this marker is parented. */
  lit?: boolean;
  /** Only meaningful when `lit` is true. When provided, patches the
   *  compiled MeshStandardMaterial shader (same onBeforeCompile technique
   *  ContinentsLayer uses for Earth's day/night terminator) so the dark
   *  side's brightness is a live, independently-adjustable floor (see
   *  setDarkSideBrightness) instead of whatever the scene's global
   *  AmbientLight happens to be - the Moon's own "how dark is dark side"
   *  slider shouldn't be coupled to Earth's own night-side ambient. Omit
   *  entirely to leave a lit body's dark side as plain PBR ambient
   *  response (unchanged prior behavior). */
  darkSideBrightness?: number;
  /** How the marker's own mesh is oriented as it moves, independent of its
   *  ORBITAL position (which recompute() always computes correctly
   *  regardless of this setting). Default "still". "tidalLocked" keeps a
   *  fixed mesh-local face pointed at this marker's PARENT origin (its
   *  local (0,0,0) - e.g. Earth's own center, for a marker parented under
   *  earthBase.object3D) as it moves, the way the Moon's real near side
   *  always faces Earth. */
  spinMode?: "still" | "tidalLocked";
}

/**
 * A body marker positioned by raw, absolute (local) position rather than
 * apparent direction-from-an-observer - shows a body actually MOVING
 * through space (e.g. the Sun/Moon orbiting Earth) rather than its apparent
 * sky-direction as seen from a fixed observer. The app's one Sun marker and
 * one Moon marker (see main.ts's sunMarker/moonMarker) are both built from
 * this, via real relative-vector math (eclipticToWorld(subVectors(...))) -
 * see astronomy/solarSystemDiagram.ts - exactly like OrbitLineLayer's
 * ellipses, never a bespoke shortcut.
 */
export class OrbitingBodyMarkerLayer implements Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D: THREE.Mesh;

  private readonly getPosition: () => Vector3Like;
  private readonly baseMarkerSize: number;
  private readonly spinMode: "still" | "tidalLocked";
  private readonly sunDirection = new THREE.Vector3(1, 0, 0);
  private readonly skyColor = new THREE.Color(0x000000);
  private readonly material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  /** This marker's true configured color, immutable - the tint setTexture
   *  restores baseColor to once a texture is cleared. */
  private readonly originalColor: THREE.Color;
  /** The color setColorBrightness multiplies from - options.color normally,
   *  or white while a texture is applied (see setTexture) so the texture's
   *  own colors show through untinted. Mutated in place (never reassigned)
   *  by setTexture, so readonly is safe here. */
  private readonly baseColor: THREE.Color;
  private readonly textureCache = new Map<string, THREE.Texture>();
  private brightnessMultiplier = 1;
  private darkSideBrightness: number;
  private darkSideUniforms?: DarkSideUniforms;

  constructor(options: OrbitingBodyMarkerOptions) {
    this.id = options.id;
    this.label = options.label;
    this.group = options.group;
    this.getPosition = options.getPosition;
    this.baseMarkerSize = options.markerSize;
    this.spinMode = options.spinMode ?? "still";
    this.darkSideBrightness = options.darkSideBrightness ?? 0;

    const geometry = new THREE.SphereGeometry(options.markerSize, 20, 14);
    const color = options.textureUrl ? 0xffffff : options.color;
    const material = options.lit
      ? new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 })
      : new THREE.MeshBasicMaterial({ color });
    if (options.textureUrl) {
      const texture = new THREE.TextureLoader().load(options.textureUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
    }
    this.material = material;
    this.originalColor = new THREE.Color(options.color);
    this.baseColor = material.color.clone();

    if (options.lit && options.darkSideBrightness !== undefined) {
      const standardMaterial = material as THREE.MeshStandardMaterial;
      standardMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uSunDirectionWorld = { value: this.sunDirection.clone() };
        shader.uniforms.uDarkSideBrightness = { value: this.darkSideBrightness };
        shader.uniforms.uSkyColor = { value: this.skyColor.clone() };
        shader.uniforms.uSkyBlendDark = { value: 0 };
        shader.uniforms.uSkyBlendLit = { value: 0 };
        this.darkSideUniforms = {
          uSunDirectionWorld: shader.uniforms.uSunDirectionWorld as { value: THREE.Vector3 },
          uDarkSideBrightness: shader.uniforms.uDarkSideBrightness as { value: number },
          uSkyColor: shader.uniforms.uSkyColor as { value: THREE.Color },
          uSkyBlendDark: shader.uniforms.uSkyBlendDark as { value: number },
          uSkyBlendLit: shader.uniforms.uSkyBlendLit as { value: number },
        };

        // Same world-space-normal technique as ContinentsLayer's day/night
        // terminator - objectNormal is only available in model space, so it
        // has to be re-derived into world space here rather than reusing
        // the standard material's own (view-space) vNormal varying.
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vWorldNormalDarkSide;")
          .replace(
            "#include <beginnormal_vertex>",
            "#include <beginnormal_vertex>\nvWorldNormalDarkSide = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);",
          );

        // Replaces the dark side's PBR ambient response (previously
        // whatever the scene's global AmbientLight produced - coupled to
        // Earth's own night-side brightness) with a flat tint of the
        // body's own diffuse color at uDarkSideBrightness, blended against
        // the lit side's normal full lighting response by the same
        // dot-product terminator ContinentsLayer uses.
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vWorldNormalDarkSide;\nuniform vec3 uSunDirectionWorld;\nuniform float uDarkSideBrightness;\nuniform vec3 uSkyColor;\nuniform float uSkyBlendDark;\nuniform float uSkyBlendLit;",
          )
          .replace(
            "#include <opaque_fragment>",
            `
	float darkSideFactor = smoothstep( -${DARK_SIDE_SOFTNESS.toFixed(3)}, ${DARK_SIDE_SOFTNESS.toFixed(3)}, dot( normalize( vWorldNormalDarkSide ), uSunDirectionWorld ) );
	vec3 darkSideColor = diffuseColor.rgb * uDarkSideBrightness;
	outgoingLight = mix( darkSideColor, outgoingLight, darkSideFactor );
	float skyBlendAmount = mix( uSkyBlendDark, uSkyBlendLit, darkSideFactor );
	outgoingLight = mix( outgoingLight, uSkyColor, skyBlendAmount );
	#include <opaque_fragment>`,
          );
      };
    }

    this.object3D = new THREE.Mesh(geometry, material);
    this.object3D.name = `OrbitingBodyMarker.${options.id}`;
    this.recompute();
  }

  update(): void {
    this.recompute();
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }

  /** Live-rescales the marker sphere after construction (the Sun & Moon
   *  section's Size sliders - see main.ts), via object3D.scale rather than
   *  rebuilding geometry - same pattern as ZenithLayer.setRadius. `size` is
   *  in the SAME local units the constructor's `markerSize` option is. */
  setMarkerSize(size: number): void {
    this.object3D.scale.setScalar(size / this.baseMarkerSize);
  }

  /** Live brightness multiplier on this marker's own base color (the color
   *  passed at construction, or white if textured) - see the Planets
   *  section's "Visibility Boost" slider (main.ts). 1 reproduces the
   *  original color exactly; values above 1 push each channel toward (and
   *  past, letting the renderer clip) white, a cheap way to make a small,
   *  flat, unlit marker pop against the black background without touching
   *  its geometry. Works regardless of lit/unlit - just scales whatever
   *  the material's own diffuse color is. */
  setColorBrightness(multiplier: number): void {
    this.brightnessMultiplier = multiplier;
    this.material.color.copy(this.baseColor).multiplyScalar(multiplier);
  }

  /** Replaces baseColor outright (rather than scaling this marker's
   *  ORIGINAL color, like setColorBrightness does) - see the Sun's "Bright"
   *  mode (main.ts's switchSunMode). Necessary because THREE.Color works in
   *  linear light with an sRGB encode on output: multiplying an already-hued
   *  color (e.g. the Sun's warm 0xffcc55) up to and past clipping does NOT
   *  land on neutral white, since the encode curve is nonlinear and the
   *  blue channel starts from a much lower linear value than red/green -
   *  the result reads as a yellow-tinted blowout, not a true white one.
   *  Setting the target color directly (typically white) sidesteps that
   *  entirely. Reapplies the current brightness multiplier afterward, same
   *  as setTexture. */
  setFlatColor(color: number): void {
    this.baseColor.set(color);
    this.setColorBrightness(this.brightnessMultiplier);
  }

  /** Live-swaps (or clears, via `null`) this marker's texture map - see the
   *  Sun's "Textury" mode (main.ts's switchSunMode). Loaded textures are
   *  cached per URL so repeated mode toggling doesn't re-fetch. Forces
   *  material.needsUpdate since three.js only compiles the USE_MAP shader
   *  path in when a map was present at the material's last compile - merely
   *  assigning `.map` afterward is silently ignored otherwise. baseColor
   *  switches to white while textured (so the image shows untinted) and
   *  back to this marker's original color once cleared, then
   *  setColorBrightness re-applies on top so the current brightness mode
   *  survives the swap. */
  setTexture(url: string | null): void {
    if (url) {
      let texture = this.textureCache.get(url);
      if (!texture) {
        texture = new THREE.TextureLoader().load(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        this.textureCache.set(url, texture);
      }
      this.material.map = texture;
      this.baseColor.set(0xffffff);
    } else {
      this.material.map = null;
      this.baseColor.copy(this.originalColor);
    }
    this.material.needsUpdate = true;
    this.setColorBrightness(this.brightnessMultiplier);
  }

  /** Pushed once per frame from main.ts's render loop (see
   *  ContinentsLayer.setSunDirection's identical doc comment) - only takes
   *  effect if `darkSideBrightness` was supplied at construction; harmless
   *  no-op otherwise. Safe to call before the shader has actually compiled -
   *  the direction is cached either way and pushed into the live uniform
   *  once onBeforeCompile has run. */
  setDarkSideLightDirection(direction: THREE.Vector3): void {
    this.sunDirection.copy(direction);
    if (this.darkSideUniforms) this.darkSideUniforms.uSunDirectionWorld.value.copy(direction);
  }

  /** Live "how dark is the dark side" control - see the Sun & Moon
   *  section's Dark Side Brightness slider (main.ts). 0 reads as basically
   *  black; small positive values read as "mostly dark but not pitch
   *  black," selling the crescent/gibbous phases without losing the
   *  unlit hemisphere into pure black. Only meaningful if
   *  `darkSideBrightness` was supplied at construction. */
  setDarkSideBrightness(value: number): void {
    this.darkSideBrightness = value;
    if (this.darkSideUniforms) this.darkSideUniforms.uDarkSideBrightness.value = value;
  }

  /** Fades this body toward `skyColor` as `dayFactor` (0 = night, 1 = full
   *  daylight - see AtmosphereLayer.getDayFactor) increases: the DARK side
   *  fades all the way to 100% sky color at dayFactor=1 (vanishes
   *  completely, matching how the unlit hemisphere of a real daytime moon
   *  is imperceptible against a bright sky), while the LIT side only fades
   *  by DAYTIME_LIT_FADE_FRACTION of that (stays faintly visible rather
   *  than disappearing outright). Only meaningful if `darkSideBrightness`
   *  was supplied at construction, like setDarkSideLightDirection/
   *  setDarkSideBrightness - harmless no-op otherwise, and safe to call
   *  before the shader has compiled. */
  setSkyBlend(skyColor: THREE.Color, dayFactor: number): void {
    this.skyColor.copy(skyColor);
    if (!this.darkSideUniforms) return;
    this.darkSideUniforms.uSkyColor.value.copy(skyColor);
    this.darkSideUniforms.uSkyBlendDark.value = dayFactor;
    this.darkSideUniforms.uSkyBlendLit.value = dayFactor * DAYTIME_LIT_FADE_FRACTION;
  }

  private recompute(): void {
    const p = this.getPosition();
    this.object3D.position.set(p.x, p.y, p.z);
    if (this.spinMode === "tidalLocked") {
      this.object3D.lookAt(0, 0, 0);
    }
  }
}
