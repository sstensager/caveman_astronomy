import type { BodyId, UniverseState, Vector3Like } from "./types";
import { BodyIds } from "./types";
import { eclipticToWorld } from "./frames";
import { subVectors } from "./vectorMath";

/**
 * A body's offset from EARTH - rotated into world space and scaled by
 * `scale` - the general form of getSunOffsetFromEarth/getMoonOffsetFromEarth
 * below (both now thin wrappers over this), and what each planet marker's
 * getPosition closure in main.ts calls directly. Provably model-agnostic
 * for any bodyId the same way the Sun/Moon-specific forms already are (see
 * their own doc comments) - it's the same subtract-then-rotate-then-scale
 * computation regardless of which body is named.
 */
export function getBodyOffsetFromEarth(state: UniverseState, bodyId: BodyId, scale: number): Vector3Like {
  const rel = eclipticToWorld(subVectors(state.bodies[bodyId].position, state.bodies[BodyIds.Earth].position));
  return { x: rel.x * scale, y: rel.y * scale, z: rel.z * scale };
}

/**
 * A body's offset from the SUN - rotated into world space and scaled by
 * `scale` - the general form of getEarthDiagramPosition below (now a thin
 * wrapper over this). Used for a planet's real Sun-centered orbital
 * position independent of Earth - e.g. main.ts's Geocentric deferent/
 * epicycle construction, which decomposes a planet's true geocentric
 * position into two real Sun-relative ellipses (see PLANET_ORBITAL_ELEMENTS'
 * own doc comment for the underlying algebra: bodyPos-Earth = (bodyPos-Sun)
 * - (Earth-Sun), i.e. exactly the sum of two independent Sun-relative
 * offsets, which is what makes a real deferent+epicycle decomposition exact
 * rather than approximate for circular orbits, and very close for our small
 * eccentricities).
 */
export function getBodyOffsetFromSun(state: UniverseState, bodyId: BodyId, scale: number): Vector3Like {
  const rel = eclipticToWorld(subVectors(state.bodies[bodyId].position, state.bodies[BodyIds.Sun].position));
  return { x: rel.x * scale, y: rel.y * scale, z: rel.z * scale };
}

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
  return getBodyOffsetFromSun(state, BodyIds.Earth, orbitScale);
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
  return getBodyOffsetFromEarth(state, BodyIds.Moon, moonOrbitScale);
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
  return getBodyOffsetFromEarth(state, BodyIds.Sun, sunOrbitScale);
}
