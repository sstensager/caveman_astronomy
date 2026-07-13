import type { Vector3Like } from "./types";
import { EARTH_AXIAL_TILT_DEG } from "./constants";

const OBLIQUITY_RAD = (EARTH_AXIAL_TILT_DEG * Math.PI) / 180;
const COS_OBLIQUITY = Math.cos(OBLIQUITY_RAD);
const SIN_OBLIQUITY = Math.sin(OBLIQUITY_RAD);

/**
 * Rotates a model-space ECLIPTIC-frame vector (Y = ecliptic pole - the plane
 * every AstronomyModel's orbits live in, see vectorMath.ts's doc comments)
 * into the fixed world/EQUATORIAL frame that stars, Polaris, and every
 * render-space direction already use (Y = true celestial pole - see
 * EarthBase.ts's doc comment). Without this rotation, the ecliptic pole and
 * celestial pole are silently treated as the same axis (zero obliquity),
 * which is what previously made the Sun/Moon's apparent paths collapse onto
 * the celestial equator instead of swinging to +-23.44 degrees like reality.
 *
 * Always uses the REAL EARTH_AXIAL_TILT_DEG (23.44 degrees) - never
 * EarthBase's exploratory axial-tilt slider value. The obliquity of the
 * ecliptic is a fixed, permanent relationship between the ecliptic and the
 * fixed stars; EarthBase's slider only reorients Earth's own spin axis (and
 * every ground observer riding on it) relative to this fixed frame. If this
 * function used the live slider value instead, dragging the slider would
 * make the Sun/Moon/planets themselves move - i.e. the universe would
 * appear to change just because Earth's tilt changed, which is exactly what
 * it must never do. See GroundObserver.getDirectionTo, the one place this
 * is applied today.
 *
 * Rotates about the same world Z axis EarthBase.setAxialTilt uses, so
 * ECLIPTIC_POLE_IN_WORLD below lands exactly on the {sin, cos, 0} vector
 * ModernHeliocentricModel's (currently unused) EARTH_ROTATION_AXIS constant
 * already documents - a built-in cross-check that this is the right
 * axis/sign convention.
 */
export function eclipticToWorld(v: Vector3Like): Vector3Like {
  return {
    x: v.x * COS_OBLIQUITY + v.y * SIN_OBLIQUITY,
    y: -v.x * SIN_OBLIQUITY + v.y * COS_OBLIQUITY,
    z: v.z,
  };
}

/**
 * Fixed direction of the ecliptic pole in world space - ecliptic-frame +Y
 * rotated into the world/equatorial frame via eclipticToWorld. Constant
 * regardless of EarthBase's tilt slider (see eclipticToWorld's doc comment).
 * A future "ecliptic-up" camera mode can use this directly as camera.up,
 * alongside plain world +Y ("Earth/north-up") for the complementary mode.
 */
export const ECLIPTIC_POLE_IN_WORLD: Vector3Like = eclipticToWorld({ x: 0, y: 1, z: 0 });
