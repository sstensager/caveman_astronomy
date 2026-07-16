import * as THREE from "three";
import type { Layer, LayerGroup } from "../layers/Layer";
import { createLabelTexture } from "../utils/canvasLabel";
import { COLORS, TARGET_RETICLE_SIZE } from "../config/constants";

// Built lazily once, not per constructor call - like ZenithLayer's dot
// texture, these never depend on any instance's own state. Two distinct
// glyphs/colors (diamond for the orbit anchor, bullseye for the look-at
// target - see OrbitCameraRig.setFollowTarget/setLookAtTarget) so the two
// reticle kinds read as different things at a glance, not just "a marker is
// on this body somewhere."
let anchorTexture: THREE.CanvasTexture | undefined;
function getAnchorTexture(): THREE.CanvasTexture {
  anchorTexture ??= createLabelTexture("◇", "#ffffff", { width: 64, height: 64, font: "64px sans-serif" });
  return anchorTexture;
}

let lookAtTexture: THREE.CanvasTexture | undefined;
function getLookAtTexture(): THREE.CanvasTexture {
  lookAtTexture ??= createLabelTexture("◎", "#ffffff", { width: 64, height: 64, font: "64px sans-serif" });
  return lookAtTexture;
}

function createReticleSprite(texture: THREE.CanvasTexture, color: number, name: string): THREE.Sprite {
  // sizeAttenuation:false - same constant-screen-space reasoning as
  // ZenithLayer's dot - a true-scale ring would shrink to invisible at Sun
  // distance or swallow Earth whole up close.
  //
  // depthTest/depthWrite off + a high renderOrder - same technique as
  // ObserverMarker/SelectedStarMarker/AltAzGridLayer's sprites. Required
  // here specifically because the reticle's position is the TARGET BODY'S
  // CENTER (see setAnchorTarget/setLookAtTarget's getters, which read the
  // body mesh's own world position) - that point sits behind the body's own
  // near-side surface from the camera's view, so normal depth-testing would
  // hide the reticle behind the very body it's marking.
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    sizeAttenuation: false,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(TARGET_RETICLE_SIZE, TARGET_RETICLE_SIZE, 1);
  sprite.name = name;
  sprite.renderOrder = 999;
  sprite.visible = false;
  return sprite;
}

/**
 * Shows which body (if any) is the current orbit ANCHOR vs. LOOK-AT target
 * (see OrbitCameraRig.setFollowTarget/setLookAtTarget and
 * BodyTargetPicker's click/long-press split) - two independent Sprites, each
 * only visible while its own target getter is set, both hideable together
 * via setVisible (the panel's "Show Target Reticles" checkbox) regardless of
 * whether either target is currently set.
 */
export class TargetReticleLayer implements Layer {
  readonly id = "targetReticles";
  readonly label = "Target Reticles";
  readonly group: LayerGroup = "Sky.Interpretation";
  readonly object3D: THREE.Group;

  private readonly anchorSprite: THREE.Sprite;
  private readonly lookAtSprite: THREE.Sprite;
  private anchorGetter?: () => THREE.Vector3;
  private lookAtGetter?: () => THREE.Vector3;

  constructor() {
    this.anchorSprite = createReticleSprite(getAnchorTexture(), COLORS.targetReticleAnchor, "TargetReticleLayer.anchor");
    this.lookAtSprite = createReticleSprite(getLookAtTexture(), COLORS.targetReticleLookAt, "TargetReticleLayer.lookAt");

    this.object3D = new THREE.Group();
    this.object3D.name = "TargetReticleLayer";
    this.object3D.add(this.anchorSprite, this.lookAtSprite);
  }

  setAnchorTarget(getter: (() => THREE.Vector3) | undefined): void {
    this.anchorGetter = getter;
    this.anchorSprite.visible = getter !== undefined;
  }

  setLookAtTarget(getter: (() => THREE.Vector3) | undefined): void {
    this.lookAtGetter = getter;
    this.lookAtSprite.visible = getter !== undefined;
  }

  update(): void {
    if (this.anchorGetter) this.anchorSprite.position.copy(this.anchorGetter());
    if (this.lookAtGetter) this.lookAtSprite.position.copy(this.lookAtGetter());
  }

  /** Master "hide reticles" toggle - hides both sprites regardless of
   *  whether either target is currently set, distinct from each sprite's
   *  own per-target visibility above. */
  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }
}
