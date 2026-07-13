# caveman_astronomy

A Three.js + TypeScript astronomy teaching sandbox. The goal is a
sandbox, not a fixed demo: every piece of the sky/Earth/observer system
should be independently toggleable and inspectable, with real astronomical
data and real orbital mechanics wherever that's feasible without making
the thing unusable.

## Design philosophy

- **Full manual control, no hidden restrictions.** Any layer (stars,
  constellations, the Sun/Moon, the celestial sphere diagram, grids) can be
  turned on/off from any camera view. Earlier versions gated some content
  by camera mode to avoid visually confusing parallax artifacts; that was
  removed on purpose - the user should be able to turn on anything from
  anywhere, including the "wrong-looking" result, since that's often a
  real teaching moment rather than a bug to hide.
- **Real data over invented data.** The star catalog is the real HYG
  database (naked-eye limit), constellation lines/names come from a real
  public dataset (D3-Celestial), and orbital mechanics use real Keplerian
  ellipses with real eccentricities - not because every number in the app
  is physically to scale (most distances are deliberately compressed for
  legibility - see `src/astronomy/constants.ts`), but because the *shapes*
  and *relationships* should be real astronomy, not a stylized invention.
- **One source of truth per concept, never a second copy.** The star
  catalog is loaded once and shared by every consumer (both display tiers,
  constellation lines, constellation labels, click-to-select). Constellation
  data never embeds coordinates - only references into the shared catalog.
  Two independent `AstronomyModel` implementations (heliocentric,
  geocentric) are provable-equivalent in apparent sky position, and exactly
  one is ever active at a time, feeding every view identically.
- **Model vs. view are orthogonal.** Which astronomy model is active
  (heliocentric/geocentric) and which camera you're looking through
  (Space/Ground) are independent controls. Neither should imply the other.

## Project structure

```
src/
  astronomy/        Domain layer - THREE-free. AstronomyModel interface,
                     the two real model implementations (Modern
                     Heliocentric, Geocentric), the real star catalog,
                     the constellation catalog, shared vector math
                     (elliptical orbits, inclination, node precession).
  observers/         An "observer" is a movable entity standing on Earth's
                     surface (or elsewhere later) with its own frame
                     (up/north/east), used for apparent-direction
                     calculations, zenith, alt/az grid, and camera
                     attachment. Multiple observers can coexist.
  layers/            The Layer architecture - composable, independently
                     toggleable scene pieces (see below). Subfolders:
                     earth/ (Earth mesh, continents, axis), sky/ (stars,
                     constellations, Sun/Moon markers, the celestial
                     sphere diagram shell).
  cameras/           Camera rigs (free-roam orbit camera, first-person
                     ground camera) and the manager that switches between
                     them. Ground-view look/move controls live here too.
  interaction/       Pointer-driven interactions: click-to-select a star,
                     hover-and-drag an observer's pin.
  ui/                The control panel (plain DOM, no framework) and scene
                     presets.
  core/               Simulation clock (sim time vs. real time, play/pause,
                     speed).
  config/, utils/    Display-scale constants and small shared helpers
                     (hemisphere fade, geo conversions).
scripts/             One-time/occasional data-preprocessing tools (fetch a
                     public dataset, resolve it against this app's own
                     catalog, write a compact local JSON). Not run as part
                     of dev/build - re-run manually if source data changes.
src/data/            The preprocessed local datasets these scripts produce,
                     plus NOTICE.md documenting third-party data licensing.
```

## The Layer architecture

Almost everything visible is a `Layer` (`src/layers/Layer.ts`): an id,
label, an optional `object3D`, `setVisible()`, and an optional per-frame
`update()`. A `LayerRegistry` holds every layer and is what the control
panel's checkboxes and scene presets both drive (`layers.show({ id: bool
})`). `CompositeLayer` fuses several layers under one checkbox when a
single concept has multiple render representations (e.g. one "Show Sun"
checkbox drives both the immersive sky-scale marker and the small
explanatory-globe-scale marker).

**Dual-tier display**: most sky content exists in two parallel instances -
a "sky tier" (radius ~2000, effectively-infinite immersive backdrop,
observer-centered) and a "globe tier" (radius ~25, a small external
explanatory diagram, Earth-centered). Both read from the same underlying
data (star catalog, constellation catalog, active `AstronomyModel`); the
tier is purely a display-radius/centering choice, applied via the same
`object3D.scale`/`position` pattern everywhere so attached content (like
constellation lines, which reference star directions) automatically stays
correct under either transform with no extra per-frame work.

## Running things

- `npm run dev` - dev server.
- `npm test` - vitest, runs fast (~100+ tests, no browser needed for most
  of them - pure functions and constructed-in-memory Layer instances).
- `npx tsc --noEmit` - typecheck.
- `npm run build` - typecheck + production build.

There's no browser-testing framework wired into `npm test`; live UI/visual
verification during development has been done ad hoc with Playwright
(not a committed dependency - installed into a scratch dir per-session
when needed).
