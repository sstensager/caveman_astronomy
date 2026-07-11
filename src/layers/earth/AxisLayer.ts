import * as THREE from "three";
import type { Layer } from "../Layer";
import { AXIS_LENGTH, COLORS } from "../../config/constants";

/** Earth's rotation axis, drawn as a simple line through the poles. */
export class AxisLayer implements Layer {
  readonly id = "axis";
  readonly label = "Show Axis";
  readonly group = "Earth.Measurement" as const;
  readonly object3D: THREE.Line;

  constructor(parent: THREE.Object3D) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -AXIS_LENGTH, 0),
      new THREE.Vector3(0, AXIS_LENGTH, 0),
    ]);
    const material = new THREE.LineBasicMaterial({ color: COLORS.axis });
    this.object3D = new THREE.Line(geometry, material);
    this.object3D.name = "Earth.axis";
    parent.add(this.object3D);
  }

  setVisible(visible: boolean): void {
    this.object3D.visible = visible;
  }
}
