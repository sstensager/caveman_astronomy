// Domain layer. Deliberately THREE-free: an AstronomyModel must never touch
// mutable Three.js objects, so future models (Ptolemaic epicycles, Tychonic,
// hypothetical tidally-locked Earth, ...) stay swappable without the renderer,
// cameras, or celestial sphere needing to change. See src/observers/ for the
// boundary where these plain values become THREE.Vector3.

/** Days since simulation epoch. NOT seconds - see SimulationClock.getElapsedDays(). */
export type SimulationTime = number;

export const BodyIds = {
  Sun: "sun",
  Earth: "earth",
  Moon: "moon",
} as const;
export type BodyId = (typeof BodyIds)[keyof typeof BodyIds];

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface BodyState {
  id: BodyId;
  /** Informational hierarchy metadata only. `position` is always fully resolved
   *  in the model's single global frame - never required to resolve position
   *  by walking parents. */
  parentId?: BodyId;
  /** Fully-resolved position in the model's global/inertial frame. Only the
   *  DIRECTION between two bodies' positions is ever consumed downstream, so
   *  the frame's origin and unit scale are arbitrary per-model choices. */
  position: Vector3Like;
  /** Unused this iteration (always identity) - schema-only slot for future
   *  use (e.g. a model-driven Earth spin for a tidally-locked variant). */
  orientation: QuaternionLike;
  /** Unused this iteration (markers are fixed-size dots) - schema-only slot
   *  for future true-scale body rendering. */
  radius: number;
  /** Unused this iteration - schema-only slot for axial tilt. */
  rotationAxis?: Vector3Like;
}

export interface UniverseState {
  time: SimulationTime;
  bodies: Record<BodyId, BodyState>;
}

export interface AstronomyModel {
  readonly id: string;
  readonly name: string;
  /** Pure function of time: same time in, same state out, no internal
   *  mutation/memoization. This purity is what makes a future deferent+epicycle
   *  model expressible as "just a different getState() implementation". */
  getState(time: SimulationTime): UniverseState;
}
