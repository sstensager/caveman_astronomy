import { CameraMode } from "../cameras/CameraMode";
import { CameraUpMode } from "../cameras/CameraUpMode";
import { RenderCenter } from "../cameras/RenderCenter";
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

/** One up-mode button ("North Up"/"Ecliptic Up") - only meaningful for
 *  Space View, see OrbitCameraRig.setUpMode. */
export interface CameraUpModeEntryDef {
  id: CameraUpMode;
  label: string;
}

export interface CameraUpModePanelConfig {
  entries: CameraUpModeEntryDef[];
  activeId: CameraUpMode;
  onSwitchActive: (id: CameraUpMode) => void;
}

/** One "Center" button ("Center: Earth"/"Center: Sun") - which body sits
 *  fixed at the world origin, see cameras/RenderCenter.ts. Orthogonal to
 *  camera mode and up mode - affects Ground View and Space View alike. */
export interface RenderCenterEntryDef {
  id: RenderCenter;
  label: string;
}

export interface RenderCenterPanelConfig {
  entries: RenderCenterEntryDef[];
  activeId: RenderCenter;
  onSwitchActive: (id: RenderCenter) => void;
}

/** One Center mode's own live scale knobs - mirrors the Celestial Sphere
 *  section's radius slider pattern, but for that mode's Sun-Earth/
 *  Moon-Earth distances and Sun/Moon marker sizes (see
 *  config/constants.ts's CENTER_SUN_ and CENTER_EARTH_ DEFAULT_RADII
 *  constants). Same shape for both modes (see
 *  SunAndMoonPanelConfig.realDistance) - each mode's own set is fully
 *  independent, dialing one in never affects the other's. `sunDistance`
 *  reads naturally either way - "how far away is the Sun" - regardless of
 *  whether the Sun or Earth is the one actually moving in that mode. */
export interface CenterScalePanelConfig {
  /** Master switch for this mode's own real Sun+Moon markers - OFF by
   *  default (see main.ts's sunCenteredBodiesVisible/earthCenteredBodiesVisible
   *  and applyRealBodyVisibility) so switching to, or loading directly
   *  into, this Center mode doesn't immediately show a body sitting right
   *  next to Earth unasked. */
  bodiesVisible: ToggleConfig;
  sunDistance: SliderConfig;
  moonDistance: SliderConfig;
  sunSize: SliderConfig;
  moonSize: SliderConfig;
}

export interface ScenePresetDef {
  id: string;
  label: string;
  onApply: () => void;
}

/** One model's own explanatory-globe controls - "Heliocentric"/"Geocentric"
 *  today, more later. There is no "active" model anymore (see
 *  AstronomyModelRegistry) - each model's Sun/Moon/orbit-lines are fully
 *  independent toggles, so multiple models' diagrams can be shown at once
 *  to compare them directly. Nested under SunAndMoonPanelConfig.explanatoryGlobe
 *  rather than its own top-level section - every field here is a Sun/Moon
 *  body representation, so it lives with every other tier of the same two
 *  bodies (see SunAndMoonPanelConfig's doc comment). */
export interface ExplanatoryGlobeModelEntry {
  id: string;
  label: string;
  sun: ToggleConfig;
  moon: ToggleConfig;
  orbitLines: ToggleConfig;
}

/** A THIRD diagram tier (alongside a model's sky marker and explanatory-globe
 *  marker): the Solar System diagram, where the Sun sits fixed at its own
 *  diagram center and Earth/Moon actually move through real model-space
 *  orbits - see main.ts's buildSolarSystemDiagram. Nested under
 *  SunAndMoonPanelConfig.solarSystemDiagram for the same reason
 *  ExplanatoryGlobeModelEntry is nested there instead of standing alone. */
export interface SolarSystemDiagramModelEntry {
  id: string;
  label: string;
  bodies: ToggleConfig;
  earthPath: ToggleConfig;
}

/** Every Sun/Moon representation in the app, in one place, organized tier-
 *  first (which kind of picture is this - immersive sky, explanatory globe,
 *  solar-system diagram, or true-distance) rather than scattered across
 *  unrelated sections by incidental UI history. Model/mode is a SUB-label
 *  within the two tiers that have one (explanatoryGlobe/solarSystemDiagram
 *  are one entry per registered AstronomyModel; realDistance is one entry
 *  per RenderCenter mode) - this exists specifically so "what moon is that"
 *  always has exactly one place to look. */
export interface SunAndMoonPanelConfig {
  /** The always-on immersive sky markers - "what's actually in today's sky",
   *  not tied to any model's own diagram (driven by a single fixed model,
   *  see main.ts's groundModel). */
  sky: {
    sun: ToggleConfig;
    moon: ToggleConfig;
    sunEclipticPath: ToggleConfig;
    moonSkyPath: ToggleConfig;
  };
  explanatoryGlobe: ExplanatoryGlobeModelEntry[];
  solarSystemDiagram: SolarSystemDiagramModelEntry[];
  /** The Center:Earth/Center:Sun real-distance bodies - one CenterScalePanelConfig
   *  per RenderCenter mode, formerly attached to the top View tab strip (see
   *  CenterScalePanelConfig's doc comment) and moved here since they're just
   *  another Sun/Moon tier, not a property of the tab strip itself. */
  realDistance: {
    earth: CenterScalePanelConfig;
    sun: CenterScalePanelConfig;
  };
}

export interface ObserverEntryDef {
  id: string;
  label: string;
}

/** One observer's own Zenith/Grid toggles - independent of which observer
 *  is "active" (see ObserverRegistry's doc comment). */
export interface ObserverEntryPanelConfig {
  id: string;
  label: string;
  zenith: ToggleConfig;
  grid: ToggleConfig;
}

export interface ObserverPanelConfig {
  entries: ObserverEntryDef[];
  activeId: string;
  onSwitchActive: (id: string) => void;
  onAddObserver: () => void;
  markersVisible: ToggleConfig;
  /** Independent of markersVisible - "hide observer markers" removes them
   *  entirely, while this only changes what a far-side (occluded) marker
   *  looks like: the chevron shader (checked, default) vs. hidden until
   *  it rotates back into view (unchecked) - see ObserverMarker.
   *  setFarSideIndicatorEnabled. */
  farSideIndicatorVisible: ToggleConfig;
  observerToggles: ObserverEntryPanelConfig[];
}

export interface ControlPanelConfig {
  /** Top-level "which body is fixed" tab strip - the very first thing in
   *  the panel (see the constructor). A bare mode switch: everything else
   *  in this config is Center-mode-agnostic (Ground View, WASD, Sun & Moon,
   *  Sky content etc. all already work identically regardless of which tab
   *  is active - confirmed when this was built), and even the Center-mode-
   *  SPECIFIC real-distance bodies live under `sunAndMoon.realDistance`
   *  rather than here - see SunAndMoonPanelConfig's doc comment for why. */
  view: {
    renderCenter: RenderCenterPanelConfig;
  };
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
  sunAndMoon: SunAndMoonPanelConfig;
  celestialSphere: {
    visible: ToggleConfig;
    wireframeOpacity: SliderConfig;
    radius: SliderConfig;
    onHemisphereModeChange: (mode: HemisphereMode) => void;
  };
  /** Constellation toggles live INSIDE each star config below (adjacent to
   *  that tier's own star sliders) rather than as a standalone section -
   *  they're always an annotation on top of one specific star layer, never
   *  an independent thing, so "sky-tier constellations" sits next to
   *  Background Stars' own controls and "globe-tier constellations" sits
   *  next to Celestial Sphere's own Stars controls. Still fully independent
   *  of star visibility itself (constellation data is resolved once against
   *  the shared catalog at load, not derived from what's currently drawn -
   *  see constellationCatalog.ts) - adjacency here is about where the
   *  control LIVES, not a dependency between the two. */
  stars: {
    background: StarSystemConfig & { constellationLines: ToggleConfig; constellationNames: ToggleConfig };
    celestialSphere: StarSystemConfig & { constellationLines: ToggleConfig; constellationNames: ToggleConfig };
  };
  observer: ObserverPanelConfig;
  camera: {
    viewModes: ViewModeDef[];
    onCameraModeChange: (mode: CameraMode) => void;
    upMode: CameraUpModePanelConfig;
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
 * mirror the app's visual hierarchy (View tab strip -> Scene -> Earth ->
 * Sun & Moon (every Sun/Moon tier - sky, explanatory globe, solar system
 * diagram, real distance - in one place) -> Sky (Celestial Sphere,
 * Background Stars, each with its own adjacent constellation toggles) ->
 * Observer -> Selected Star -> Camera -> Time). Sun & Moon (which rule
 * system governs body motion, and every resulting representation of the
 * two bodies) and Camera (which view displays the result) are deliberately
 * separate, independent sections - see AstronomyModelRegistry in main.ts.
 * Deliberately dumb: it only renders inputs and reports changes via
 * callbacks in `ControlPanelConfig` - main.ts remains the composition root
 * that wires those callbacks to layers/clock/camera.
 */
export class ControlPanel {
  readonly element: HTMLElement;
  private readonly viewButtons: Partial<Record<CameraMode, HTMLButtonElement>> = {};
  private readonly upModeButtons: Partial<Record<CameraUpMode, HTMLButtonElement>> = {};
  private readonly viewTabButtons: Partial<Record<RenderCenter, HTMLButtonElement>> = {};
  private readonly observerButtons: Record<string, HTMLButtonElement> = {};
  private readonly layerCheckboxes: Record<string, HTMLInputElement> = {};
  private readonly selectedStarBody: HTMLElement;
  private selectedStarSection?: HTMLDetailsElement;
  private observerSwitcherElement?: HTMLElement;
  private observerTogglesContainer?: HTMLElement;
  private observerLatLonLabel?: HTMLElement;
  private onSwitchActiveObserver?: (id: string) => void;

  constructor(container: HTMLElement, config: ControlPanelConfig) {
    this.element = document.createElement("div");
    this.element.className = "control-panel";

    this.selectedStarBody = document.createElement("div");

    this.element.appendChild(this.buildViewSection(config));
    this.element.appendChild(this.buildSceneSection(config));
    this.element.appendChild(this.buildEarthSection(config));
    this.element.appendChild(this.buildSunAndMoonSection(config));
    this.element.appendChild(this.buildSkySection(config));
    this.element.appendChild(this.buildObserverSection(config));
    this.element.appendChild(this.buildSelectedStarSection());
    this.element.appendChild(this.buildCameraSection(config));
    this.element.appendChild(this.buildTimeSection(config));

    container.appendChild(this.element);
  }

  setActiveCameraMode(mode: CameraMode): void {
    for (const [buttonMode, button] of Object.entries(this.viewButtons)) {
      button?.classList.toggle("active", buttonMode === mode);
    }
  }

  setActiveUpMode(mode: CameraUpMode): void {
    for (const [buttonMode, button] of Object.entries(this.upModeButtons)) {
      button?.classList.toggle("active", buttonMode === mode);
    }
  }

  /** Switches the top-level View tab's active button state. Purely a mode
   *  switch now - the Scale sliders that used to live under each tab moved
   *  into the Sun & Moon section's "Real Distance" tier (see
   *  SunAndMoonPanelConfig.realDistance), so there's no per-tab content to
   *  swap here anymore. */
  setActiveRenderCenter(mode: RenderCenter): void {
    for (const [buttonMode, button] of Object.entries(this.viewTabButtons)) {
      button?.classList.toggle("active", buttonMode === mode);
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

  /** Appends a new observer's Zenith/Grid toggle row - used when "Add
   *  Observer" creates a new entry at runtime, mirroring addObserverButton
   *  (the toggle list isn't fixed at construction either). */
  addObserverToggleRow(entry: ObserverEntryPanelConfig): void {
    if (!this.observerTogglesContainer) return;
    this.observerTogglesContainer.appendChild(this.buildObserverToggleRow(entry));
  }

  private buildObserverToggleRow(entry: ObserverEntryPanelConfig): HTMLElement {
    return createSection(entry.label, false, [
      this.registerLayerCheckbox(`${entry.id}Zenith`, createCheckbox("Show Zenith", entry.zenith.checked, entry.zenith.onChange)).element,
      this.registerLayerCheckbox(`${entry.id}AltAzGrid`, createCheckbox("Show Alt/Az Grid", entry.grid.checked, entry.grid.onChange))
        .element,
    ]);
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

  /** The single home for every Sun/Moon representation in the app - see
   *  SunAndMoonPanelConfig's doc comment for why this exists (previously
   *  scattered across "Astronomy Model," "Sky > Sun & Moon," and the top
   *  View tab strip). Organized tier-first via createSubsectionHeading
   *  (Sky / Explanatory Globe / Solar System Diagram / Real Distance), with
   *  model/mode as a nested <details> sub-label only within the tiers that
   *  have more than one (no "active" model - see AstronomyModelRegistry -
   *  so every model's diagram is independently toggleable, same as before
   *  this reorg). Layer ids here (`${id}SunMarkerGlobe` etc.) must match the
   *  naming buildModelDiagram/buildSolarSystemDiagram use in main.ts. */
  private buildSunAndMoonSection(config: ControlPanelConfig): HTMLElement {
    const sm = config.sunAndMoon;

    const buildRealDistanceContent = (scale: CenterScalePanelConfig, visibleId: string): HTMLElement[] => [
      this.registerLayerCheckbox(visibleId, createCheckbox("Show Real Sun & Moon", scale.bodiesVisible.checked, scale.bodiesVisible.onChange))
        .element,
      createSlider({ ...scale.sunDistance, label: "Sun-Earth Distance" }).element,
      createSlider({ ...scale.moonDistance, label: "Moon-Earth Distance" }).element,
      createSlider({ ...scale.sunSize, label: "Sun Size" }).element,
      createSlider({ ...scale.moonSize, label: "Moon Size" }).element,
    ];

    return createSection("Sun & Moon", true, [
      createSubsectionHeading("Sky"),
      this.registerLayerCheckbox("sunMarkerSky", createCheckbox("Sun visible", sm.sky.sun.checked, sm.sky.sun.onChange)).element,
      this.registerLayerCheckbox("moonMarkerSky", createCheckbox("Moon visible", sm.sky.moon.checked, sm.sky.moon.onChange)).element,
      this.registerLayerCheckbox(
        "sunEclipticPath",
        createCheckbox("Sun Ecliptic Path", sm.sky.sunEclipticPath.checked, sm.sky.sunEclipticPath.onChange),
      ).element,
      this.registerLayerCheckbox(
        "moonSkyPath",
        createCheckbox("Moon Sky Path", sm.sky.moonSkyPath.checked, sm.sky.moonSkyPath.onChange),
      ).element,

      createSubsectionHeading("Explanatory Globe"),
      ...sm.explanatoryGlobe.map((entry) =>
        createSection(entry.label, false, [
          this.registerLayerCheckbox(`${entry.id}SunMarkerGlobe`, createCheckbox("Sun visible", entry.sun.checked, entry.sun.onChange))
            .element,
          this.registerLayerCheckbox(`${entry.id}MoonMarkerGlobe`, createCheckbox("Moon visible", entry.moon.checked, entry.moon.onChange))
            .element,
          this.registerLayerCheckbox(
            `${entry.id}OrbitLines`,
            createCheckbox("Show Orbital Lines", entry.orbitLines.checked, entry.orbitLines.onChange),
          ).element,
        ]),
      ),

      createSubsectionHeading("Solar System Diagram"),
      ...sm.solarSystemDiagram.map((entry) =>
        createSection(entry.label, false, [
          this.registerLayerCheckbox(
            `${entry.id}SolarSystemBodies`,
            createCheckbox("Show Sun/Earth/Moon orbiting", entry.bodies.checked, entry.bodies.onChange),
          ).element,
          this.registerLayerCheckbox(
            `${entry.id}SolarSystemEarthPath`,
            createCheckbox("Show Earth's Orbital Path", entry.earthPath.checked, entry.earthPath.onChange),
          ).element,
        ]),
      ),

      createSubsectionHeading("Real Distance"),
      createSection(
        config.view.renderCenter.entries.find((e) => e.id === RenderCenter.Earth)!.label,
        false,
        buildRealDistanceContent(sm.realDistance.earth, "earthCenteredBodiesVisible"),
      ),
      createSection(
        config.view.renderCenter.entries.find((e) => e.id === RenderCenter.Sun)!.label,
        false,
        buildRealDistanceContent(sm.realDistance.sun, "sunCenteredBodiesVisible"),
      ),

      createPlaceholder("Model paths - coming soon."),
    ]);
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

    this.observerTogglesContainer = document.createElement("div");
    this.observerTogglesContainer.className = "control-panel-section-body";
    for (const entry of obs.observerToggles) {
      this.observerTogglesContainer.appendChild(this.buildObserverToggleRow(entry));
    }

    const content = [
      switcherElement,
      addButton,
      this.observerLatLonLabel,
      createPlaceholder("Hover an observer pin for a hand cursor, then drag to move it."),
      this.registerLayerCheckbox("observerMarkers", createCheckbox("Show Observer Markers", obs.markersVisible.checked, obs.markersVisible.onChange))
        .element,
      this.registerLayerCheckbox(
        "observerFarSideIndicator",
        createCheckbox("Show Far-Side Indicator (chevron)", obs.farSideIndicatorVisible.checked, obs.farSideIndicatorVisible.onChange),
      ).element,
      createSubsectionHeading("Per-Observer Zenith / Grid"),
      this.observerTogglesContainer,
      createPlaceholder("Heading and Altitude are coming soon."),
    ];
    return createSection("Observer", false, content);
  }

  /** The starry backdrop - the celestial sphere diagram and both star
   *  fields - nested one level under a single "Sky" accordion instead of
   *  standing as separate top-level sections. Each star field carries its
   *  own constellation toggles directly (see buildCelestialSphereSection/
   *  buildBackgroundStarsSection) rather than constellations having a
   *  section of their own, since they're always an annotation on top of one
   *  specific star layer, never an independent thing. */
  private buildSkySection(config: ControlPanelConfig): HTMLElement {
    return createSection("Sky", true, [this.buildCelestialSphereSection(config), this.buildBackgroundStarsSection(config)]);
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
      createSubsectionHeading("Constellations"),
      ...this.buildConstellationControls("constellationLinesGlobe", "constellationNamesGlobe", config.stars.celestialSphere),
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
    const content = [
      ...this.buildStarSystemControls("backgroundStars", config.stars.background),
      createSubsectionHeading("Constellations"),
      ...this.buildConstellationControls("constellationLinesSky", "constellationNamesSky", config.stars.background),
    ];
    return createSection("Background Stars", false, content);
  }

  /** Independent of the star toggles it sits next to - turning stars off
   *  doesn't destroy constellation data (it's resolved once against the
   *  shared catalog at load, not derived from what's currently drawn - see
   *  constellationCatalog.ts), and turning constellation lines/names off
   *  doesn't affect stars either. Adjacency here is about where the control
   *  lives (next to the star layer it overlays), not a dependency between
   *  the two - see ControlPanelConfig.stars' doc comment. Called once for
   *  the sky-tier pair (from buildBackgroundStarsSection) and once for the
   *  globe-tier pair (from buildCelestialSphereSection), since "show
   *  constellations in the immersive sky" and "show them on the small
   *  explanatory globe" are independent teaching choices. */
  private buildConstellationControls(
    linesId: string,
    namesId: string,
    config: { constellationLines: ToggleConfig; constellationNames: ToggleConfig },
  ): HTMLElement[] {
    return [
      this.registerLayerCheckbox(linesId, createCheckbox("Constellation Lines", config.constellationLines.checked, config.constellationLines.onChange))
        .element,
      this.registerLayerCheckbox(namesId, createCheckbox("Constellation Names", config.constellationNames.checked, config.constellationNames.onChange))
        .element,
    ];
  }

  private buildSelectedStarSection(): HTMLElement {
    this.setSelectedStarInfo(undefined);
    const section = createSection("Selected Star", true, [this.selectedStarBody]);
    this.selectedStarSection = section;
    return section;
  }

  /** The top-level "which body is fixed" tab strip - see
   *  ControlPanelConfig.view's doc comment for why this lives outside/
   *  above every other section instead of nested in Camera. A bare mode
   *  switch now - the per-mode Scale sliders + "Show Real Sun & Moon"
   *  checkbox that used to render under each tab live in the Sun & Moon
   *  section's "Real Distance" tier instead (see buildSunAndMoonSection),
   *  so there's no per-tab content to build here anymore. */
  private buildViewSection(config: ControlPanelConfig): HTMLElement {
    const view = config.view;

    const { element: tabBar, buttons: tabButtons } = createButtonGroup(
      view.renderCenter.entries.map((entry) => ({
        key: entry.id,
        label: entry.label,
        onClick: () => view.renderCenter.onSwitchActive(entry.id),
      })),
    );
    for (const [id, button] of Object.entries(tabButtons)) {
      this.viewTabButtons[id as RenderCenter] = button;
    }
    this.setActiveRenderCenter(view.renderCenter.activeId);

    const section = document.createElement("div");
    section.className = "control-view-section";
    section.append(tabBar);
    return section;
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

    // Only affects Space View (see OrbitCameraRig.setUpMode) - left always
    // clickable rather than disabled in Ground View, since picking a mode
    // there is harmless and just takes effect next time you're in Space.
    const { element: upModeElement, buttons: upModeButtons } = createButtonGroup(
      config.camera.upMode.entries.map((entry) => ({
        key: entry.id,
        label: entry.label,
        onClick: () => config.camera.upMode.onSwitchActive(entry.id),
      })),
    );
    for (const [id, button] of Object.entries(upModeButtons)) {
      this.upModeButtons[id as CameraUpMode] = button;
    }
    this.setActiveUpMode(config.camera.upMode.activeId);

    return createSection("Camera", true, [element, createSubsectionHeading("Up (Space View)"), upModeElement]);
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
