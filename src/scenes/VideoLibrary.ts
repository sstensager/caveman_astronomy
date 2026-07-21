import type { SceneState } from "./SceneState";

/** One shot within a video - a title plus the full SceneState that
 *  reproduces it. Applying a shot is just applySceneState(shot.state) -
 *  see main.ts. */
export interface ShotDef {
  id: string;
  title: string;
  state: SceneState;
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
