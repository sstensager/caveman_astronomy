// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { OrbitCameraRig } from "./OrbitCameraRig";

function createRig(): OrbitCameraRig {
  return new OrbitCameraRig({
    domElement: document.createElement("canvas"),
    initialPosition: [15, 10, 15],
    minDistance: 1,
    maxDistance: 1000,
  });
}

describe("OrbitCameraRig follow-target + setDistance interaction", () => {
  it("does NOT move camera position just because the follow target eases toward a new point", () => {
    const rig = createRig();
    const startPos = rig.camera.position.clone();

    const farAway = new THREE.Vector3(300, 0, 0);
    rig.setFollowTarget(() => farAway);

    // Simulate many frames of easing with no user input.
    for (let i = 0; i < 200; i++) rig.update();

    // Confirms the "target moving pulls the camera along" assumption is
    // WRONG for this control scheme: position is invariant under target
    // changes alone (see OrbitControls.update()'s _v = position - target
    // re-derivation each frame - it's a no-op transform without an
    // explicit rotate/zoom delta). Only the camera's orientation
    // (lookAt) changes to keep the target centered in frame.
    expect(rig.camera.position.distanceTo(startPos)).toBeLessThan(1e-6);
  });

  it("setDistance measured from a STALE target does not end up near the real target after it eases in", () => {
    const rig = createRig();
    const farAway = new THREE.Vector3(300, 0, 0);
    rig.setFollowTarget(() => farAway);

    // This mirrors the bug: setDistance is called while controls.target is
    // still near the origin (stale), THEN the follow-target eases in over
    // subsequent frames.
    rig.setDistance(20);
    for (let i = 0; i < 200; i++) rig.update();

    // Camera stays ~20 units from the OLD (near-origin) target point, so
    // it ends up far from the body it's supposedly "framing".
    expect(rig.camera.position.distanceTo(farAway)).toBeGreaterThan(250);
  });

  it("snapping the target FIRST, then setting distance, correctly frames the real target", () => {
    const rig = createRig();
    const farAway = new THREE.Vector3(300, 0, 0);
    rig.setFollowTarget(() => farAway);

    rig.snapTarget(farAway);
    rig.setDistance(20);
    for (let i = 0; i < 5; i++) rig.update();

    expect(rig.camera.position.distanceTo(farAway)).toBeCloseTo(20, 5);
  });
});
