import type * as THREE from "three";

// The category hierarchy from the project's layer roadmap. Purely
// organizational today (used for labeling/future grouped UI) - it costs
// nothing to attach now and pays off once the layer count grows past a
// flat checkbox list.
export type LayerGroup =
  | "Earth.Base"
  | "Earth.Geographic"
  | "Earth.Environmental"
  | "Earth.Measurement"
  | "Earth.Teaching"
  | "Sky.Observation"
  | "Sky.Geometry"
  | "Sky.Interpretation";

/**
 * A composable, independently-toggleable unit of the scene. Some layers
 * own geometry (`object3D` is set and gets added to the scene graph by
 * whoever constructs them); others just mutate a shared resource - e.g.
 * ContinentsLayer swaps a texture on Earth's existing mesh rather than
 * adding new geometry. Both are "layers" in this architecture: the
 * defining trait is being independently on/off, not owning a mesh.
 */
export interface Layer {
  readonly id: string;
  readonly label: string;
  readonly group: LayerGroup;
  readonly object3D?: THREE.Object3D;
  setVisible(visible: boolean): void;
  update?(deltaSeconds: number): void;
}
