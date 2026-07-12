import { CameraMode } from "../cameras/CameraMode";
import type { HemisphereMode } from "../utils/hemisphereFade";
import type { StarRecord } from "../astronomy/starCatalog";
import {
  createButton,
  createButtonGroup,
  createCheckbox,
  createPlaceholder,
  createSection,
  createSlider,
  createSubsectionHeading,
  type CheckboxControl,
} from "./controls";

export interface ToggleConfig {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export interface SliderConfig {
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export interface StarSystemConfig {
  visible: ToggleConfig;
  limitingMagnitude: SliderConfig;
  brightness: SliderConfig;
  size: SliderConfig;
  opacity: SliderConfig;
}

/** One view button, driven from a list rather than hardcoded here. */
export interface ViewModeDef {
  mode: CameraMode;
  label: string;
}

export interface ScenePresetDef {
  id: string;
  label: string;
  onApply: () => void;
}

/** One astronomy-model button - "Heliocentric"/"Geocentric" today, more
 *  later. Deliberately a separate control from ViewModeDef/camera: model
 *  choice (how bodies move) and view choice (how the result is displayed)
 *  are independent axes - see AstronomyModelRegistry in main.ts. */
export interface AstronomyModelEntryDef {
  id: string;
  label: string;
}

export interface AstronomyModelPanelConfig {
  entries: AstronomyModelEntryDef[];
  activeId: string;
  onSwitchActive: (id: string) => void;
}

export interface ObserverEntryDef {
  id: string;
  label: string;
}

export interface ObserverPanelConfig {
  entries: ObserverEntryDef[];
  activeId: string;
  onSwitchActive: (id: string) => void;
  onAddObserver: () => void;
  markersVisible: ToggleConfig;
  zenith: ToggleConfig;
  grid: ToggleConfig;
}

export interface ControlPanelConfig {
  scene: {
    presets: ScenePresetDef[];
  };
  earth: {
    visible: ToggleConfig;
    continents: ToggleConfig;
    rotation: ToggleConfig;
    axis: ToggleConfig;
    axialTilt: SliderConfig;
  };
  sunMoon: {
    sun: ToggleConfig;
    moon: ToggleConfig;
  };
  celestialSphere: {
    visible: ToggleConfig;
    wireframeOpacity: SliderConfig;
    radius: SliderConfig;
    onHemisphereModeChange: (mode: HemisphereMode) => void;
  };
  stars: {
    background: StarSystemConfig;
    celestialSphere: StarSystemConfig;
  };
  astronomyModel: AstronomyModelPanelConfig;
  observer: ObserverPanelConfig;
  camera: {
    viewModes: ViewModeDef[];
    onCameraModeChange: (mode: CameraMode) => void;
  };
  time: {
    onPlayPauseChange: (paused: boolean) => void;
    timeScale: SliderConfig;
    onStepHour: () => void;
    onStepDay: () => void;
    onStepMonth: () => void;
    onStepYear: () => void;
    onReset: () => void;
  };
}

const percentFormat = (v: number) => `${Math.round(v * 100)}%`;

function formatRaHours(raHours: number): string {
  const totalMinutes = raHours * 60;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h ${m}m`;
}

function formatDecDegrees(decDeg: number): string {
  const sign = decDeg >= 0 ? "+" : "-";
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${sign}${d}° ${m}′`;
}

/**
 * Plain-DOM control panel overlay, organized into collapsible sections that
 * mirror the app's visual hierarchy (Scene -> Earth -> Astronomy Model ->
 * Observer -> Sun & Moon -> Celestial Sphere (shell + its own stars) ->
 * Background Stars -> Guides -> Teaching -> Camera -> Time). Astronomy
 * Model (which rule system governs body motion) and Camera (which view
 * displays the result) are deliberately separate, independent sections -
 * see AstronomyModelRegistry in main.ts. Deliberately dumb: it only renders
 * inputs and reports changes via callbacks in `ControlPanelConfig` -
 * main.ts remains the composition root that wires those callbacks to
 * layers/clock/camera.
 */
export class ControlPanel {
  readonly element: HTMLElement;
  private readonly viewButtons: Partial<Record<CameraMode, HTMLButtonElement>> = {};
  private readonly modelButtons: Record<string, HTMLButtonElement> = {};
  private readonly observerButtons: Record<string, HTMLButtonElement> = {};
  private readonly layerCheckboxes: Record<string, HTMLInputElement> = {};
  private readonly selectedStarBody: HTMLElement;
  private selectedStarSection?: HTMLDetailsElement;
  private observerSwitcherElement?: HTMLElement;
  private observerLatLonLabel?: HTMLElement;
  private onSwitchActiveObserver?: (id: string) => void;

  constructor(container: HTMLElement, config: ControlPanelConfig) {
    this.element = document.createElement("div");
    this.element.className = "control-panel";

    this.selectedStarBody = document.createElement("div");

    this.element.appendChild(this.buildSceneSection(config));
    this.element.appendChild(this.buildEarthSection(config));
    this.element.appendChild(this.buildAstronomyModelSection(config));
    this.element.appendChild(this.buildObserverSection(config));
    this.element.appendChild(this.buildSunMoonSection(config));
    this.element.appendChild(this.buildCelestialSphereSection(config));
    this.element.appendChild(this.buildBackgroundStarsSection(config));
    this.element.appendChild(this.buildSelectedStarSection());
    this.element.appendChild(this.buildGuidesSection());
    this.element.appendChild(this.buildTeachingSection());
    this.element.appendChild(this.buildCameraSection(config));
    this.element.appendChild(this.buildTimeSection(config));

    container.appendChild(this.element);
  }

  setActiveCameraMode(mode: CameraMode): void {
    for (const [buttonMode, button] of Object.entries(this.viewButtons)) {
      button?.classList.toggle("active", buttonMode === mode);
    }
  }

  setActiveAstronomyModel(id: string): void {
    for (const [entryId, button] of Object.entries(this.modelButtons)) {
      button.classList.toggle("active", entryId === id);
    }
  }

  setActiveObserver(id: string): void {
    for (const [entryId, button] of Object.entries(this.observerButtons)) {
      button.classList.toggle("active", entryId === id);
    }
  }

  /** Appends a new observer button to the switcher - used when "Add
   *  Observer" creates a new entry at runtime, since the switcher's button
   *  list isn't fixed at construction like the Camera/Astronomy Model
   *  sections' are. */
  addObserverButton(entry: ObserverEntryDef): void {
    if (!this.observerSwitcherElement || !this.onSwitchActiveObserver) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-button";
    button.textContent = entry.label;
    button.addEventListener("click", () => this.onSwitchActiveObserver?.(entry.id));
    this.observerButtons[entry.id] = button;
    this.observerSwitcherElement.appendChild(button);
  }

  /** Live lat/lon readout for the active observer - pushed once per frame
   *  from main.ts's render loop, mirroring setSelectedStarInfo's external-
   *  push pattern (the state originates from WASD/drag movement, not from
   *  an input on the panel itself). */
  setObserverLatLon(latDeg: number, lonDeg: number): void {
    if (!this.observerLatLonLabel) return;
    const latText = `${Math.abs(latDeg).toFixed(1)}°${latDeg >= 0 ? "N" : "S"}`;
    const lonText = `${Math.abs(lonDeg).toFixed(1)}°${lonDeg >= 0 ? "E" : "W"}`;
    this.observerLatLonLabel.textContent = `${latText}, ${lonText}`;
  }

  /** Reflects a programmatic layer-visibility change (e.g. a scene preset)
   *  in the checkbox UI, since that path bypasses the checkboxes entirely. */
  syncLayerToggles(visibility: Record<string, boolean>): void {
    for (const [id, visible] of Object.entries(visibility)) {
      const checkbox = this.layerCheckboxes[id];
      if (checkbox) checkbox.checked = visible;
    }
  }

  /** Reflects a click-to-select star pick (see StarPicker) in the "Selected
   *  Star" readout - the panel has no input control of its own for this,
   *  the state always originates from a 3D-scene interaction. A successful
   *  pick force-opens the section: without this, a click on a star with the
   *  section collapsed updates the DOM with zero visible feedback, which
   *  reads as "clicking does nothing" even though selection is working. */
  setSelectedStarInfo(star: StarRecord | undefined): void {
    this.selectedStarBody.replaceChildren();
    if (!star) {
      this.selectedStarBody.appendChild(createPlaceholder("Click a star to see its name."));
      return;
    }
    if (this.selectedStarSection) this.selectedStarSection.open = true;

    const name = star.properName ?? star.designation ?? "Unnamed star";
    const lines = [name];
    if (star.hip !== undefined) lines.push(`HIP ${star.hip}`);
    lines.push(`Magnitude ${star.mag.toFixed(2)}`);
    lines.push(`RA ${formatRaHours(star.ra)}`);
    lines.push(`Dec ${formatDecDegrees(star.dec)}`);
    if (star.constellation) lines.push(`Constellation: ${star.constellation}`);

    for (const line of lines) {
      const row = document.createElement("div");
      row.className = "control-selected-star-line";
      row.textContent = line;
      this.selectedStarBody.appendChild(row);
    }
  }

  private registerLayerCheckbox(id: string, checkbox: CheckboxControl): CheckboxControl {
    this.layerCheckboxes[id] = checkbox.input;
    return checkbox;
  }

  private buildSceneSection(config: ControlPanelConfig): HTMLElement {
    const { element } = createButtonGroup(
      config.scene.presets.map((preset) => ({ key: preset.id, label: preset.label, onClick: preset.onApply })),
    );
    const presetGrid = document.createElement("div");
    presetGrid.className = "control-preset-grid";
    presetGrid.appendChild(element);

    return createSection("Scene", true, [
      presetGrid,
      createPlaceholder("Background - coming soon"),
      createPlaceholder("Lighting - coming soon"),
    ]);
  }

  private buildEarthSection(config: ControlPanelConfig): HTMLElement {
    // Captured at construction time, so "reset" always means "back to
    // whatever default this panel was built with" (23.44deg in practice -
    // see main.ts's EARTH_AXIAL_TILT_DEG wiring) without ControlPanel
    // needing its own import of that astronomy constant.
    const defaultTiltDeg = config.earth.axialTilt.value;
    const tiltSlider = createSlider({ ...config.earth.axialTilt, label: "Axial Tilt", format: config.earth.axialTilt.format ?? ((v) => `${v}°`) });
    const resetTiltButton = createButton(`Reset to ${defaultTiltDeg}°`, () => {
      tiltSlider.input.value = String(defaultTiltDeg);
      tiltSlider.input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const content = [
      this.registerLayerCheckbox("earthBase", createCheckbox("Visible", config.earth.visible.checked, config.earth.visible.onChange)).element,
      this.registerLayerCheckbox("continents", createCheckbox("Continents", config.earth.continents.checked, config.earth.continents.onChange)).element,
      createCheckbox("Rotation", config.earth.rotation.checked, config.earth.rotation.onChange).element,
      this.registerLayerCheckbox("axis", createCheckbox("Axis", config.earth.axis.checked, config.earth.axis.onChange)).element,
      tiltSlider.element,
      resetTiltButton,
    ];
    return createSection("Earth", true, content);
  }

  private buildAstronomyModelSection(config: ControlPanelConfig): HTMLElement {
    const { element, buttons } = createButtonGroup(
      config.astronomyModel.entries.map((entry) => ({
        key: entry.id,
        label: entry.label,
        onClick: () => config.astronomyModel.onSwitchActive(entry.id),
      })),
    );
    for (const [id, button] of Object.entries(buttons)) {
      this.modelButtons[id] = button;
    }
    this.setActiveAstronomyModel(config.astronomyModel.activeId);

    return createSection("Astronomy Model", true, [element, createPlaceholder("Model paths - coming soon.")]);
  }

  private buildObserverSection(config: ControlPanelConfig): HTMLElement {
    const obs = config.observer;
    this.onSwitchActiveObserver = obs.onSwitchActive;

    const { element: switcherElement, buttons } = createButtonGroup(
      obs.entries.map((entry) => ({ key: entry.id, label: entry.label, onClick: () => obs.onSwitchActive(entry.id) })),
    );
    for (const [id, button] of Object.entries(buttons)) {
      this.observerButtons[id] = button;
    }
    this.observerSwitcherElement = switcherElement;
    this.setActiveObserver(obs.activeId);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "control-button";
    addButton.textContent = "Add Observer";
    addButton.addEventListener("click", obs.onAddObserver);

    this.observerLatLonLabel = document.createElement("div");
    this.observerLatLonLabel.className = "control-selected-star-line";

    const content = [
      switcherElement,
      addButton,
      this.observerLatLonLabel,
      createPlaceholder("Hover an observer pin for a hand cursor, then drag to move it."),
      this.registerLayerCheckbox("observerMarkers", createCheckbox("Show Observer Markers", obs.markersVisible.checked, obs.markersVisible.onChange))
        .element,
      this.registerLayerCheckbox("zenith", createCheckbox("Show Zenith", obs.zenith.checked, obs.zenith.onChange)).element,
      this.registerLayerCheckbox("altAzGrid", createCheckbox("Show Alt/Az Grid", obs.grid.checked, obs.grid.onChange)).element,
      createPlaceholder("Heading and Altitude are coming soon."),
    ];
    return createSection("Observer", false, content);
  }

  private buildSunMoonSection(config: ControlPanelConfig): HTMLElement {
    const content = [
      this.registerLayerCheckbox("sunMarker", createCheckbox("Sun visible", config.sunMoon.sun.checked, config.sunMoon.sun.onChange)).element,
      this.registerLayerCheckbox("moonMarker", createCheckbox("Moon visible", config.sunMoon.moon.checked, config.sunMoon.moon.onChange)).element,
      createPlaceholder("Labels and Trails - coming soon"),
    ];
    return createSection("Sun & Moon", false, content);
  }

  private buildCelestialSphereSection(config: ControlPanelConfig): HTMLElement {
    const cs = config.celestialSphere;

    const visible = this.registerLayerCheckbox(
      "celestialSphereShell",
      createCheckbox("Visible", cs.visible.checked, cs.visible.onChange),
    );

    // Obscures the NEAR hemisphere (facing the external camera) rather than
    // the far one: the near side sits visually between the camera and
    // Earth, cluttering the view - hiding it and keeping the far side is
    // the more useful/recognizable default for this outside-looking-in
    // view. See hemisphereFadeFactor for the actual near/far math.
    const hide = createCheckbox("Hide near hemisphere", false, (checked) => {
      if (checked) fade.input.checked = false;
      applyHemisphereMode();
    });
    const fade = createCheckbox("Fade near hemisphere", false, (checked) => {
      if (checked) hide.input.checked = false;
      applyHemisphereMode();
    });
    const applyHemisphereMode = (): void => {
      const mode: HemisphereMode = hide.input.checked ? "hide" : fade.input.checked ? "fade" : "none";
      cs.onHemisphereModeChange(mode);
    };

    const content = [
      visible.element,
      createSlider({ ...cs.wireframeOpacity, label: "Wireframe Opacity", format: cs.wireframeOpacity.format ?? percentFormat }).element,
      createSlider({ ...cs.radius, label: "Radius" }).element,
      hide.element,
      fade.element,
      createSubsectionHeading("Stars"),
      ...this.buildStarSystemControls("celestialSphereStars", config.stars.celestialSphere, { showAllButton: true }),
    ];
    return createSection("Celestial Sphere", false, content);
  }

  private buildStarSystemControls(
    layerId: string,
    star: StarSystemConfig,
    options?: { showAllButton?: boolean },
  ): HTMLElement[] {
    const visible = this.registerLayerCheckbox(layerId, createCheckbox("Visible", star.visible.checked, star.visible.onChange));
    const magnitudeSlider = createSlider({
      ...star.limitingMagnitude,
      label: "Limiting Magnitude",
      format: star.limitingMagnitude.format ?? ((v) => v.toFixed(1)),
    });

    const elements = [
      visible.element,
      magnitudeSlider.element,
      createSlider({ ...star.brightness, label: "Brightness", format: star.brightness.format ?? percentFormat }).element,
      createSlider({ ...star.size, label: "Size" }).element,
      createSlider({ ...star.opacity, label: "Opacity", format: star.opacity.format ?? percentFormat }).element,
    ];

    if (options?.showAllButton) {
      const showAllButton = document.createElement("button");
      showAllButton.type = "button";
      showAllButton.className = "control-button";
      showAllButton.textContent = "Show All Stars";
      showAllButton.addEventListener("click", () => {
        magnitudeSlider.input.value = String(star.limitingMagnitude.max);
        magnitudeSlider.input.dispatchEvent(new Event("input"));
      });
      elements.push(showAllButton);
    }

    return elements;
  }

  private buildBackgroundStarsSection(config: ControlPanelConfig): HTMLElement {
    return createSection("Background Stars", false, this.buildStarSystemControls("backgroundStars", config.stars.background));
  }

  private buildSelectedStarSection(): HTMLElement {
    this.setSelectedStarInfo(undefined);
    const section = createSection("Selected Star", true, [this.selectedStarBody]);
    this.selectedStarSection = section;
    return section;
  }

  private buildGuidesSection(): HTMLElement {
    return createSection("Guides", false, [createPlaceholder("Grids and Labels are coming soon.")]);
  }

  private buildTeachingSection(): HTMLElement {
    return createSection("Teaching", false, [
      createPlaceholder("Motion Trails, Highlights, and Ghost Positions are coming soon."),
    ]);
  }

  private buildCameraSection(config: ControlPanelConfig): HTMLElement {
    const { element, buttons } = createButtonGroup(
      config.camera.viewModes.map((viewMode) => ({
        key: viewMode.mode,
        label: viewMode.label,
        onClick: () => config.camera.onCameraModeChange(viewMode.mode),
      })),
    );
    for (const [mode, button] of Object.entries(buttons)) {
      this.viewButtons[mode as CameraMode] = button;
    }
    return createSection("Camera", true, [element]);
  }

  private buildTimeSection(config: ControlPanelConfig): HTMLElement {
    let paused = false;
    const playPauseButton = document.createElement("button");
    playPauseButton.type = "button";
    playPauseButton.className = "control-button";
    playPauseButton.textContent = "Pause";
    playPauseButton.addEventListener("click", () => {
      paused = !paused;
      playPauseButton.textContent = paused ? "Play" : "Pause";
      config.time.onPlayPauseChange(paused);
    });

    const { element: stepButtons } = createButtonGroup([
      { key: "hour", label: "+1 Hour", onClick: config.time.onStepHour },
      { key: "day", label: "+1 Day", onClick: config.time.onStepDay },
      { key: "month", label: "+1 Month", onClick: config.time.onStepMonth },
      { key: "year", label: "+1 Year", onClick: config.time.onStepYear },
    ]);

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "control-button";
    resetButton.textContent = "Reset Time";
    resetButton.addEventListener("click", config.time.onReset);

    const content = [
      playPauseButton,
      createSlider({ ...config.time.timeScale, label: "Time Scale", format: config.time.timeScale.format ?? ((v) => `${v}x`) }).element,
      stepButtons,
      resetButton,
    ];
    return createSection("Time", true, content);
  }
}
