import type { UniverseState, Vector3Like } from "./types";
import { BodyIds } from "./types";
import { eclipticToWorld } from "./frames";
import { subVectors } from "./vectorMath";

/**
 * Earth's position for the Solar System diagram (see main.ts's
 * buildSolarSystemDiagram) - Earth-relative-to-Sun, rotated into world space
 * and scaled for display, in the SAME diagram-local coordinate frame
 * OrbitLineLayer's Earth-orbit ellipse uses (same `orbitScale` value keeps
 * the marker and its path line reading as one diagram).
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
 * The Moon's offset from EARTH (not from the Sun/diagram origin) - rotated
 * into world space and scaled by `moonOrbitScale`, deliberately a SEPARATE
 * scale from `earthOrbitScale` (matching the globe-tier diagram's
 * SUN_GLOBE_ORBIT_FRACTION/MOON_GLOBE_ORBIT_FRACTION split - the Moon's loop
 * is meant to read as "small and close to Earth", not to the same scale as
 * Earth's own orbit around the Sun).
 *
 * This is the number a marker PARENTED UNDER Earth's own moving anchor
 * needs (see main.ts's realMoonMarker, a child of earthBase.object3D) -
 * Earth's own position is already supplied by the parent transform, so
 * adding it again here would double-count it. getMoonDiagramPosition below
 * is for the opposite case: a marker NOT parented under Earth (the Solar
 * System side-diagram, parented under its own fixed-offset group), which
 * needs the full Sun-relative position instead.
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
 * The Sun's offset from EARTH - for "Center: Earth" mode's own real Sun
 * marker (main.ts's earthCenteredSunMarker), the mirror image of
 * getEarthDiagramPosition above: instead of moving the real Earth mesh
 * around a fixed Sun, this keeps Earth fixed and moves a Sun MARKER around
 * it. This is literally this app's ORIGINAL, most-proven relative vector -
 * the same Sun-relative-to-Earth vector GroundObserver.getDirectionTo and
 * the existing globe-tier Sun orbit ellipse already use (see
 * OrbitLineLayer.test.ts's "real model equivalence" block) - so it's
 * already proven model-agnostic by the app's oldest equivalence tests,
 * re-confirmed directly in solarSystemDiagram.test.ts for this scaled
 * form.
 */
export function getSunOffsetFromEarth(state: UniverseState, sunOrbitScale: number): Vector3Like {
  const rel = eclipticToWorld(subVectors(state.bodies[BodyIds.Sun].position, state.bodies[BodyIds.Earth].position));
  return { x: rel.x * sunOrbitScale, y: rel.y * sunOrbitScale, z: rel.z * sunOrbitScale };
}

/**
 * The Moon's position for the Solar System diagram - Earth's own diagram
 * position (see getEarthDiagramPosition) plus its offset from Earth (see
 * getMoonOffsetFromEarth) - for a marker NOT parented under Earth's own
 * anchor (the side-diagram's fixed-offset group - see main.ts's
 * buildSolarSystemDiagram).
 *
 * Composes TWO independently-proven model-agnostic relative vectors
 * (Earth-from-Sun, Moon-from-Earth) - the sum of two model-agnostic
 * quantities is itself model-agnostic, so this is too. See
 * solarSystemDiagram.test.ts.
 */
export function getMoonDiagramPosition(state: UniverseState, earthOrbitScale: number, moonOrbitScale: number): Vector3Like {
  const earth = getEarthDiagramPosition(state, earthOrbitScale);
  const moonOffset = getMoonOffsetFromEarth(state, moonOrbitScale);
  return { x: earth.x + moonOffset.x, y: earth.y + moonOffset.y, z: earth.z + moonOffset.z };
}
