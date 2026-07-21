import * as THREE from "three";

const GLOW_TEXTURE_SIZE = 64;

/** A small radial-falloff alpha mask (opaque white center, fully
 *  transparent edge), built from a raw pixel buffer rather than an
 *  offscreen <canvas> 2D context - canvas 2D isn't reliably available
 *  outside a real browser (e.g. under vitest), while a DataTexture is just
 *  a Uint8Array and works identically everywhere. RGB stays white
 *  throughout; the sprite that uses this tints via its own material.color
 *  instead. */
function createRadialGlowTexture(size = GLOW_TEXTURE_SIZE): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const alpha = Math.pow(Math.max(0, 1 - dist), 2);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** The Sun's "Bright" mode halo - an additive-blended billboard sprite that
 *  always faces the camera and (via SpriteMaterial's default
 *  sizeAttenuation) grows/shrinks with camera distance exactly like the Sun
 *  marker's own sphere. Meant to be added as a CHILD of the Sun marker's
 *  own object3D (see main.ts) so it inherits that marker's live position
 *  and Sun-Size-slider scale for free, rather than tracking either
 *  separately. Starts hidden - main.ts's switchSunMode toggles `.visible`,
 *  true only in Bright mode. */
export function createSunGlowSprite(sunMarkerRadius: number, scaleMultiplier: number, opacity: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: createRadialGlowTexture(),
    // Neutral white, matching the Bright-mode disc's own setFlatColor(0xffffff) -
    // a warmer tint here would recreate exactly the disc/halo color mismatch
    // that prompted this fix in the first place.
    color: 0xffffff,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(sunMarkerRadius * scaleMultiplier);
  sprite.visible = false;
  return sprite;
}
