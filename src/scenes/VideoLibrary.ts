import type { SceneState } from "./SceneState";

/** One shot within a video - a title plus the SceneState delta that
 *  reproduces it. `state` only needs to carry whatever differs from
 *  main.ts's DEFAULT_SCENE_STATE (see SceneState.ts's diffSceneState/
 *  mergeSceneState) - a full SceneState works too, it just means every
 *  field happens to be an explicit delta. Applying a shot is
 *  applySceneState(mergeSceneState(shot.state, DEFAULT_SCENE_STATE)) -
 *  see main.ts's selectShot. */
export interface ShotDef {
  id: string;
  title: string;
  state: Partial<SceneState>;
}

export interface VideoDef {
  id: string;
  title: string;
  shots: ShotDef[];
}

/** The root shape of public/videos.json - fetched at runtime (not a static
 *  import) so editing the file never requires a rebuild, just a browser
 *  refresh, and a missing/malformed file degrades to an empty library
 *  instead of breaking the app (see main.ts's fetch). Private working data,
 *  not committed - see .gitignore. */
export interface VideoLibrary {
  videos: VideoDef[];
}

export const EMPTY_VIDEO_LIBRARY: VideoLibrary = { videos: [] };
