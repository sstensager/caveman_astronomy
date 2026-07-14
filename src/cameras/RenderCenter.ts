/** Which body sits fixed at the world origin - see EarthBase.setOrbitPosition
 *  and main.ts's render loop. Earth (the default, and the only mode that
 *  existed before this) keeps every existing system's assumption that
 *  Earth's mesh never moves. Sun instead fixes the Sun at the origin and
 *  moves Earth (and everything riding on it - Ground View, WASD observers,
 *  day/night lighting) to its real position, reusing the same model-
 *  agnostic math the Solar System side-diagram already proved correct (see
 *  astronomy/solarSystemDiagram.ts). Orthogonal to CameraMode and
 *  AstronomyModel - see README's "Model vs. view are orthogonal". */
export const RenderCenter = {
  Earth: "earth",
  Sun: "sun",
} as const;

export type RenderCenter = (typeof RenderCenter)[keyof typeof RenderCenter];
