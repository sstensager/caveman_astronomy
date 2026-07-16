import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BodyTargetPicker, type TargetableBody } from "./BodyTargetPicker";

const LONG_PRESS_MS = 500;

/** Minimal addEventListener/removeEventListener/getBoundingClientRect stand-in
 *  for HTMLElement - this repo's vitest environment is "node" (no jsdom), so
 *  BodyTargetPicker is exercised against a plain fake rather than a real DOM
 *  element. Only the subset of the interface BodyTargetPicker actually uses. */
class FakeDomElement {
  private listeners: Record<string, ((event: PointerEvent) => void)[]> = {};

  addEventListener(type: string, handler: (event: PointerEvent) => void): void {
    (this.listeners[type] ??= []).push(handler);
  }

  removeEventListener(type: string, handler: (event: PointerEvent) => void): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((h) => h !== handler);
  }

  dispatch(type: string, event: Partial<PointerEvent>): void {
    for (const handler of this.listeners[type] ?? []) handler(event as PointerEvent);
  }

  getBoundingClientRect(): DOMRect {
    return { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) };
  }
}

function pointerEvent(clientX: number, clientY: number): Partial<PointerEvent> {
  return { clientX, clientY };
}

describe("BodyTargetPicker", () => {
  let dom: FakeDomElement;
  let camera: THREE.PerspectiveCamera;
  let body: TargetableBody;
  let onSelectAnchor: (bodyId: string | undefined) => void;
  let onSelectLookAt: (bodyId: string | undefined) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    dom = new FakeDomElement();
    // Looks down -Z from (0,0,10) with identity rotation, straight through
    // the origin - center-of-viewport clicks (clientX/Y = 50,50, the
    // FakeDomElement rect's midpoint) hit anything placed at (0,0,0).
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    // Raycaster reads matrixWorld, which THREE only recomputes automatically
    // during a render loop - there is none here, so it needs a manual nudge.
    camera.updateMatrixWorld(true);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    mesh.position.set(0, 0, 0);
    mesh.updateMatrixWorld(true);
    body = { id: "sun", label: "Sun", object3D: mesh };
    onSelectAnchor = vi.fn<(bodyId: string | undefined) => void>();
    onSelectLookAt = vi.fn<(bodyId: string | undefined) => void>();
    new BodyTargetPicker(() => camera, dom as unknown as HTMLElement, [body], onSelectAnchor, onSelectLookAt);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a quick click on a body sets the anchor", () => {
    dom.dispatch("pointerdown", pointerEvent(50, 50));
    dom.dispatch("pointerup", pointerEvent(50, 50));
    expect(onSelectAnchor).toHaveBeenCalledWith("sun");
    expect(onSelectLookAt).not.toHaveBeenCalled();
  });

  it("a quick click on empty space releases the anchor", () => {
    dom.dispatch("pointerdown", pointerEvent(0, 0));
    dom.dispatch("pointerup", pointerEvent(0, 0));
    expect(onSelectAnchor).toHaveBeenCalledWith(undefined);
    expect(onSelectLookAt).not.toHaveBeenCalled();
  });

  it("a held press past the long-press threshold sets the look-at target and suppresses the click", () => {
    dom.dispatch("pointerdown", pointerEvent(50, 50));
    vi.advanceTimersByTime(LONG_PRESS_MS + 50);
    expect(onSelectLookAt).toHaveBeenCalledWith("sun");

    dom.dispatch("pointerup", pointerEvent(50, 50));
    expect(onSelectAnchor).not.toHaveBeenCalled();
  });

  it("a held press over empty space releases the look-at target", () => {
    dom.dispatch("pointerdown", pointerEvent(0, 0));
    vi.advanceTimersByTime(LONG_PRESS_MS + 50);
    expect(onSelectLookAt).toHaveBeenCalledWith(undefined);
  });

  it("moving past the drag threshold before the long-press timer fires cancels it", () => {
    dom.dispatch("pointerdown", pointerEvent(50, 50));
    dom.dispatch("pointermove", pointerEvent(70, 70));
    vi.advanceTimersByTime(LONG_PRESS_MS + 50);
    expect(onSelectLookAt).not.toHaveBeenCalled();

    dom.dispatch("pointerup", pointerEvent(70, 70));
    expect(onSelectAnchor).not.toHaveBeenCalled();
  });

  it("releasing before the long-press threshold is a plain click, not a long press", () => {
    dom.dispatch("pointerdown", pointerEvent(50, 50));
    vi.advanceTimersByTime(LONG_PRESS_MS - 100);
    dom.dispatch("pointerup", pointerEvent(50, 50));
    expect(onSelectAnchor).toHaveBeenCalledWith("sun");
    expect(onSelectLookAt).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LONG_PRESS_MS + 50);
    expect(onSelectLookAt).not.toHaveBeenCalled();
  });
});
