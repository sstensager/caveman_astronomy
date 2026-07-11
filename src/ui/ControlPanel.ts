import { CameraMode } from "../cameras/CameraMode";
import { TIME_SPEED_DEFAULT, TIME_SPEED_MAX, TIME_SPEED_MIN } from "../config/constants";

/** One checkbox, driven from a registered layer rather than hardcoded here. */
export interface LayerToggleDef {
  id: string;
  label: string;
  defaultVisible: boolean;
}

/** One view button, driven from a list rather than hardcoded here. */
export interface ViewModeDef {
  mode: CameraMode;
  label: string;
}

export interface ControlPanelCallbacks {
  layerToggles: LayerToggleDef[];
  onLayerToggle: (id: string, visible: boolean) => void;
  onRotateEarthChange: (enabled: boolean) => void;
  onTimeSpeedChange: (speed: number) => void;
  viewModes: ViewModeDef[];
  onCameraModeChange: (mode: CameraMode) => void;
}

/**
 * Plain-DOM control panel overlay. Deliberately dumb: it only renders
 * inputs and reports changes via callbacks. New layers appear here
 * automatically via `layerToggles` - adding a layer never requires
 * editing this file.
 */
export class ControlPanel {
  readonly element: HTMLElement;
  private readonly viewButtons: Partial<Record<CameraMode, HTMLButtonElement>> = {};

  constructor(container: HTMLElement, callbacks: ControlPanelCallbacks) {
    this.element = document.createElement("div");
    this.element.className = "control-panel";

    this.element.appendChild(this.buildToggles(callbacks));
    this.element.appendChild(this.buildViewButtons(callbacks));
    this.element.appendChild(this.buildTimeSpeedSlider(callbacks));

    container.appendChild(this.element);
  }

  setActiveCameraMode(mode: CameraMode): void {
    for (const [buttonMode, button] of Object.entries(this.viewButtons)) {
      button?.classList.toggle("active", buttonMode === mode);
    }
  }

  private buildToggles(callbacks: ControlPanelCallbacks): HTMLElement {
    const section = document.createElement("div");
    section.className = "control-section";

    section.appendChild(this.createCheckbox("Rotate Earth", true, callbacks.onRotateEarthChange));

    for (const layerToggle of callbacks.layerToggles) {
      section.appendChild(
        this.createCheckbox(layerToggle.label, layerToggle.defaultVisible, (checked) =>
          callbacks.onLayerToggle(layerToggle.id, checked),
        ),
      );
    }

    return section;
  }

  private buildViewButtons(callbacks: ControlPanelCallbacks): HTMLElement {
    const section = document.createElement("div");
    section.className = "control-section control-section--row";

    for (const viewMode of callbacks.viewModes) {
      const button = this.createButton(viewMode.label, () => callbacks.onCameraModeChange(viewMode.mode));
      this.viewButtons[viewMode.mode] = button;
      section.appendChild(button);
    }

    return section;
  }

  private buildTimeSpeedSlider(callbacks: ControlPanelCallbacks): HTMLElement {
    const section = document.createElement("div");
    section.className = "control-section";

    const label = document.createElement("label");
    label.className = "control-label";
    label.textContent = "Time Speed";

    const valueLabel = document.createElement("span");
    valueLabel.className = "control-value";
    valueLabel.textContent = `${TIME_SPEED_DEFAULT}x`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(TIME_SPEED_MIN);
    slider.max = String(TIME_SPEED_MAX);
    slider.step = "0.1";
    slider.value = String(TIME_SPEED_DEFAULT);
    slider.addEventListener("input", () => {
      const speed = Number(slider.value);
      valueLabel.textContent = `${speed}x`;
      callbacks.onTimeSpeedChange(speed);
    });

    label.appendChild(valueLabel);
    section.appendChild(label);
    section.appendChild(slider);
    return section;
  }

  private createCheckbox(
    labelText: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLElement {
    const label = document.createElement("label");
    label.className = "control-checkbox";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));

    label.appendChild(input);
    label.appendChild(document.createTextNode(labelText));
    return label;
  }

  private createButton(labelText: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-button";
    button.textContent = labelText;
    button.addEventListener("click", onClick);
    return button;
  }
}
