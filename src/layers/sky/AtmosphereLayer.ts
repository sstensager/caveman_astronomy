import * as THREE from "three";
import type { Layer, LayerGroup } from "../Layer";
import { computeDayFactor, computeSunsetFactor } from "../../utils/atmosphere";
import {
  ATMOSPHERE_DAY_NIGHT_SOFTNESS,
  ATMOSPHERE_SUNSET_BAND,
  ATMOSPHERE_SUNSET_STRENGTH,
  COLORS,
} from "../../config/constants";

/**
 * Ground View's sky color - a flat, whole-sky tint (not a per-direction
 * gradient) that reads blue while the sun is up for the active observer,
 * fades to the existing near-black background at night, and optionally
 * washes warm near the sunrise/sunset transition. Owns `scene.background`
 * directly rather than a mesh: a real sky-dome mesh would need to be either
 * huge (to avoid ever occluding the Sun/Moon markers, whose distance is
 * user-adjustable up to 2000 units) or small (to stay unobtrusive from Space
 * View) - those two constraints conflict, so mutating the one shared
 * background color instead sidesteps the sizing problem entirely. Space
 * View is deliberately never affected: `updateSky()` takes an explicit
 * `groundViewActive` flag and simply parks the color at `COLORS.background`
 * whenever it's false, since there's no real "sky" concept once you're
 * looking at the solar system from outside.
 *
 * Night deliberately reuses `COLORS.background` exactly (no separate "night
 * sky" color) - guarantees zero visual diff at night or whenever this layer
 * is off/inactive, so the feature is purely additive and only ever visible
 * during daytime in Ground View.
 */
export class AtmosphereLayer implements Layer {
  readonly id = "atmosphere";
  readonly label = "Show Atmosphere";
  readonly group: LayerGroup = "Sky.Observation";

  private readonly scene: THREE.Scene;
  private readonly color: THREE.Color;
  private readonly scratch = new THREE.Color();
  private readonly nightColor = new THREE.Color(COLORS.background);
  private readonly dayColor = new THREE.Color(COLORS.atmosphereDay);
  private readonly sunsetColor = new THREE.Color(COLORS.atmosphereSunset);
  private enabled = false;
  private lastDayFactor = 0;
  private lastFadeFactor = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.color = new THREE.Color(COLORS.background);
    this.scene.background = this.color;
  }

  setVisible(visible: boolean): void {
    this.enabled = visible;
    if (!visible) {
      this.color.copy(this.nightColor);
      this.lastDayFactor = 0;
      this.lastFadeFactor = 0;
    }
  }

  /** Bespoke per-frame push, like ContinentsLayer.setSunDirection - not the
   *  generic Layer.update?(deltaSeconds) hook, since this needs this
   *  frame's already-computed sun direction/observer up/camera mode rather
   *  than a delta. */
  updateSky(sunDirectionWorld: THREE.Vector3, observerUp: THREE.Vector3, groundViewActive: boolean): void {
    if (!this.enabled || !groundViewActive) {
      this.color.copy(this.nightColor);
      this.lastDayFactor = 0;
      this.lastFadeFactor = 0;
      return;
    }

    const dayFactor = computeDayFactor(observerUp, sunDirectionWorld, ATMOSPHERE_DAY_NIGHT_SOFTNESS);
    this.scratch.copy(this.nightColor).lerp(this.dayColor, dayFactor);

    // Raw (uncapped) sunset factor - peaks at 1 right at the horizon
    // crossing. Used TWICE, deliberately differently: the sky's own COLOR
    // blend below only takes a fraction of it (ATMOSPHERE_SUNSET_STRENGTH -
    // a tint, not a full color replace), but getFadeFactor() below uses the
    // raw, uncapped value - the sunset moment is already plenty bright/
    // colorful even though the sky hasn't fully switched to orange, so
    // anything fading into "how bright is the sky right now" (the Moon,
    // stars) shouldn't wait for dayFactor's own later saturation point.
    const rawSunsetFactor = computeSunsetFactor(observerUp, sunDirectionWorld, ATMOSPHERE_SUNSET_BAND);
    this.scratch.lerp(this.sunsetColor, rawSunsetFactor * ATMOSPHERE_SUNSET_STRENGTH);

    this.color.copy(this.scratch);
    this.lastDayFactor = dayFactor;
    this.lastFadeFactor = Math.max(dayFactor, rawSunsetFactor);
  }

  /** How "daytime-bright" the sky currently reads, in the pure sun-elevation
   *  sense (0 = night, 1 = sun comfortably above the horizon) - main.ts
   *  doesn't currently consume this directly (see getFadeFactor for what
   *  drives actual fading), kept as the one place that pure day/night state
   *  is computed. */
  getDayFactor(): number {
    return this.lastDayFactor;
  }

  /** How much anything sitting in front of the sky (Moon, stars) should
   *  fade into it right now - the day/night factor OR the (uncapped) sunset
   *  transition, whichever is higher. Without the sunset term, things would
   *  only fully fade once the sun was comfortably above the horizon,
   *  leaving them half-faded and looking wrong right at the colorful
   *  sunset/sunrise moment itself, when the sky is already plenty bright. */
  getFadeFactor(): number {
    return this.lastFadeFactor;
  }

  /** The live color `scene.background` currently holds - the same object
   *  reference, not a copy. Read-only for callers (e.g. the Moon marker
   *  fading into the sky, see OrbitingBodyMarkerLayer.setSkyBlend) - mutate
   *  it only from within this class. */
  getColor(): THREE.Color {
    return this.color;
  }
}
