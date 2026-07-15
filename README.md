# caveman_astronomy

A Three.js + TypeScript astronomy teaching sandbox. The goal is a
sandbox, not a fixed demo: every piece of the sky/Earth/observer system
should be independently toggleable and inspectable, with real astronomical
data and real orbital mechanics wherever that's feasible without making
the thing unusable.

## Design philosophy

- **One Scene, one everything.** There is exactly one Sun, one Moon, one
  Earth, one star field - never a second copy sitting behind a different
  checkbox. The single top-level choice is the **Scene**
  (Geocentric/Heliocentric - see `src/main.ts`'s `activeScene`): which body
  is treated as fixed at the world origin. Every other control (Sun/Moon
  visibility, distance, size, star density, grids, observers, Earth's axial
  tilt) is shared, persistent state that both Scenes render under -
  switching Scenes never resets or duplicates it. This replaced an earlier
  design with a Cartesian product of per-model, per-tier Sun/Moon/star
  representations (see git history) that made it possible to end up with
  several simultaneous "Suns" on screen at once - a real bug the current
  architecture makes structurally impossible, not just discouraged.
- **Full manual control, no hidden restrictions.** Any layer (stars,
  constellations, the Sun/Moon, the celestial sphere shell, grids) can be
  turned on/off from any camera view, at any radius/distance. Earlier
  versions gated some content by camera mode to avoid visually confusing
  parallax artifacts; that was removed on purpose - the user should be able
  to turn on anything from anywhere, including the "wrong-looking" result,
  since that's often a real teaching moment rather than a bug to hide.
- **Real data over invented data.** The star catalog is the real HYG
  database (naked-eye limit), constellation lines/names come from a real
  public dataset (D3-Celestial), and orbital mechanics use real Keplerian
  ellipses with real eccentricities - not because every number in the app
  is physically to scale (distances are compressed via live-adjustable
  sliders for legibility - see `src/config/constants.ts`), but because the
  *shapes* and *relationships* should be real astronomy, not a stylized
  invention.
- **One source of truth per concept, never a second copy.** The star
  catalog is loaded once and shared by every consumer (the star field,
  constellation lines, constellation labels, click-to-select).
  Constellation data never embeds coordinates - only references into the
  shared catalog. Two independent `AstronomyModel` implementations
  (heliocentric, geocentric) are provable-equivalent in apparent sky
  position (see `modelEquivalence.test.ts`); which one actually computes a
  given Scene's state is an internal implementation detail, never exposed
  as a separate user-facing choice or a second set of bodies.
- **Scene vs. camera are orthogonal.** Which Scene is active
  (Geocentric/Heliocentric) and which camera you're looking through
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
                     earth/ (Earth mesh, continents, axis), sky/ (the star
                     field, constellations, the Sun/Moon markers and their
                     orbit lines, the celestial sphere shell).
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
single concept has multiple render representations (e.g. "Show Orbit
Lines" drives both the Sun's and the Moon's orbit-line layers together).

**One shared sky radius**: the star field, constellations, the celestial
sphere wireframe shell, every observer's zenith marker/alt-az grid, and
the Sun/Moon sky-path lines all track one live-adjustable radius (see
`config/constants.ts`'s `STAR_RADIUS_*`) instead of existing as separate
parallel display tiers. Drag it down for a small, easy-to-reason-about
celestial-sphere demonstration (the observer at the center of a nearby
sphere of fixed stars); drag it up for an immersive, effectively-infinite
backdrop. All of it is observer-centered (`object3D.position` tracks the
active observer's live world position each frame), which is what makes
shrinking the radius an honest demonstration of "you are the center of
your own sky," not just a smaller prop.

**One Sun, one Moon, always.** Both markers (`OrbitingBodyMarkerLayer`
instances, see `main.ts`'s `sunMarker`/`moonMarker`) are positioned
Earth-relative and parented under `earthBase.object3D`. That single
positioning rule is correct in both Scenes with no branching: in
Geocentric, Earth never moves, so the Earth-relative offset *is* the world
position; in Heliocentric, Earth's own rig moves to its real position
around a Sun fixed at the world origin, using the exact same distance
scale the marker's own offset uses, so the two cancel and the Sun always
renders at the origin. See `src/astronomy/solarSystemDiagram.ts`'s doc
comments for the underlying vector math and its model-agnostic proof.

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
