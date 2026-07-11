import * as THREE from "three";
import type { Layer } from "../Layer";
import { TEXTURES } from "../../config/constants";

/**
 * Continents/coastlines as a texture on Earth's existing mesh - not a
 * separate mesh of its own. Toggling swaps the mesh's material between
 * the flat ocean-only material (EarthBase's default) and a textured one,
 * rather than baking geography permanently into Earth's appearance. That
 * keeps "plain blue sphere" available as its own teaching moment (e.g.
 * "here's Earth with no geography, just rotation") independent of this
 * layer.
 */
export class ContinentsLayer implements Layer {
  readonly id = "continents";
  readonly label = "Show Continents";
  readonly group = "Earth.Geographic" as const;

  private readonly mesh: THREE.Mesh;
  private readonly oceanMaterial: THREE.Material;
  private readonly texturedMaterial: THREE.MeshStandardMaterial;

  constructor(mesh: THREE.Mesh, oceanMaterial: THREE.Material) {
    this.mesh = mesh;
    this.oceanMaterial = oceanMaterial;

    const texture = new THREE.TextureLoader().load(TEXTURES.continents);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.texturedMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
    });
  }

  setVisible(visible: boolean): void {
    this.mesh.material = visible ? this.texturedMaterial : this.oceanMaterial;
  }
}
