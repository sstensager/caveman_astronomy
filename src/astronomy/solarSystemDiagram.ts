import type { UniverseState, Vector3Like } from "./types";
import { BodyIds } from "./types";
import { eclipticToWorld } from "./frames";
import { subVectors } from "./vectorMath";

/**
 * Earth's world position under main.ts's Heliocentric Scene - Earth-
 * relative-to-Sun, rotated into world space and scaled for display, in the
 * SAME scale earthOrbitLine's ellipse uses (see main.ts's
 * setSunDistanceRadii) so the moving Earth mesh and its path line stay in
 * sync. Fixed at the origin instead under the Geocentric Scene (see
 * earthBase.setOrbitPosition in main.ts's render loop).
 *
 * This is exactly the negation of the Sun-relative-to-Earth vector already
 * proven model-agnostic (see OrbitLineLayer.test.ts's "real model
 * equivalence" block and GeocentricModel's mirror-trick doc comment) - so
 * this is provably identical whichever AstronomyModel computes `state`, with
 * no separate proof needed. See solarSystemDiagram.test.ts.
 */
export function getEarthDiagramPosition(state: UniverseState, orbitScale: number): Vector3Like {
  const rel = eclipticToWorld(subVectors(state.bodies[BodyIds.Earth].position, state.bodies[BodyIds.Sun].position));
  return { x: rel.x * orbitScale, y: rel.y * orbitScale, z: rel.z * orbitScale };
}

/**
 * The Moon's offset from EARTH - rotated into world space and scaled by
 * `moonOrbitScale`, deliberately a SEPARATE scale from `earthOrbitScale`
 * (the Moon's loop is meant to read as "small and close to Earth", not to
 * the same scale as Earth's own orbit around the Sun).
 *
 * This is the number a marker PARENTED UNDER Earth's own moving anchor
 * needs (see main.ts's sunMarker/moonMarker, both children of
 * earthBase.object3D) - Earth's own position is already supplied by the
 * parent transform, so adding it again here would double-count it.
 *
 * Proven model-agnostic the same way OrbitLineLayer's Moon-relative-to-Earth
 * ellipse already is (see OrbitLineLayer.test.ts's equivalence test) - see
 * solarSystemDiagram.test.ts.
 */
export function getMoonOffsetFromEarth(state: UniverseState, moonOrbitScale: number): Vector3Like {
  const rel = eclipticToWorld(subVectors(state.bodies[BodyIds.Moon].position, state.bodies[BodyIds.Earth].position));
  return { x: rel.x * moonOrbitScale, y: rel.y * moonOrbitScale, z: rel.z * moonOrbitScale };
}

/**
 * The Sun's offset from EARTH - main.ts's sunMarker position, the mirror
 * image of getEarthDiagramPosition above: in the Geocentric Scene, Earth
 * stays fixed and this offset moves the Sun MARKER around it directly; in
 * the Heliocentric Scene, this offset plus earthBase's own
 * getEarthDiagramPosition-derived world position exactly cancel to zero, so
 * the same marker always renders at the world origin there too (see
 * sunMarker's doc comment in main.ts). This is literally this app's
 * ORIGINAL, most-proven relative vector - the same Sun-relative-to-Earth
 * vector GroundObserver.getDirectionTo and sunOrbitLine's ellipse already
 * use (see OrbitLineLayer.test.ts's "real model equivalence" block) - so
 * it's already proven model-agnostic by the app's oldest equivalence tests,
 * re-confirmed directly in solarSystemDiagram.test.ts for this scaled form.
 */
export function getSunOffsetFromEarth(state: UniverseState, sunOrbitScale: number): Vector3Like {
  const rel = eclipticToWorld(subVectors(state.bodies[BodyIds.Sun].position, state.bodies[BodyIds.Earth].position));
  return { x: rel.x * sunOrbitScale, y: rel.y * sunOrbitScale, z: rel.z * sunOrbitScale };
}
