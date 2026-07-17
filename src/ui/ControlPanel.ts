import { CameraMode } from "../cameras/CameraMode";
import { CameraUpMode } from "../cameras/CameraUpMode";
import type { HemisphereMode } from "../utils/hemisphereFade";
import type { StarRecord } from "../astronomy/starCatalog";
import {
  createButton,
  createButtonGroup,
  createCheckbox,
  createDateInput,
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

/** One Scene button ("Heliocentric"/"Geocentric") - the ONE top-level
 *  choice in the app: which body is treated as fixed at the world origin.
 *  Every other control (Sun & Moon, Sky, Observer, Earth) is shared,
 *  persistent state that both Scenes render under - switching here never
 *  resets or duplicates any of it, so there is nothing else for this
 *  section to contain. See main.ts's switchScene. */
export interface SceneEntryDef {
  id: string;
  label: string;
}

export interface ScenePanelConfig {
  entries: SceneEntryDef[];
  activeId: string;
  onSwitchActive: (id: string) => void;
}

export interface ScenePresetDef {
  id: string;
  label: string;
  onApply: () => void;
}

/** Solar-aligned stone circle monument (StonehengeLayer) - one placement
 *  action ("place at wherever the active observer currently stands", a
 *  one-shot snapshot, not a live follow), plus buttons to jump the
 *  simulated clock to whichever alignment date each marker stone
 *  demonstrates (findSeasonalMarkers in main.ts). */
export interface StonehengePanelConfig {
  visible: ToggleConfig;
  onPlaceAtObserver: () => void;
  onJumpToJuneSolstice: () => void;
  onJumpToDecemberSolstice: () => void;
  onJumpToMarchEquinox: () => void;
  onJumpToSeptemberEquinox: () => void;
}

/** The single home for every Sun/Moon control in the app - one Sun, one
 *  Moon, always, regardless of which Scene is active. Distance/size are
 *  continuous sliders (Earth-radii units) rather than a fixed set of
 *  display tiers - drag them down for a small comprehensible diagram, up
 *  for true-feeling scale; presets (see ScenePresetDef) can dial in
 *  good-looking combinations. */
export interface SunAndMoonPanelConfig {
  sun: ToggleConfig;
  moon: ToggleConfig;
  sunEclipticPath: ToggleConfig;
  moonSkyPath: ToggleConfig;
  /** Real elliptical orbit shapes (true eccentricity) around Earth, at the
   *  bodies' current distance scale - fused under one checkbox. */
  orbitLines: ToggleConfig;
  /** Earth's own real elliptical path around the Sun - only visually
   *  meaningful in Heliocentric (Earth is the body that actually moves
   *  there); main.ts force-hides it in Geocentric regardless of this
   *  checkbox's own state. */
  earthOrbitPath: ToggleConfig;
  sunDistance: SliderConfig;
  moonDistance: SliderConfig;
  sunSize: SliderConfig;
  moonSize: SliderConfig;
  /** How bright the Moon's own dark (unlit) side reads, independent of
   *  Earth's own night-side ambient - 0 is basically black, higher values
   *  are "mostly dark" but still a visible gray sphere. See
   *  OrbitingBodyMarkerLayer.setDarkSideBrightness. */
  moonDarkSideBrightness: SliderConfig;
}

export interface ObserverEntryDef {
  id: string;
  label: string;
}

/** One planet's own marker/path toggles - the planets analog of
 *  ObserverEntryPanelConfig below, array-driven for the same reason (5
 *  near-identical entries, unlike Sun/Moon's flat hand-named fields in
 *  SunAndMoonPanelConfig). No distance/size slider - see
 *  PlanetsPanelConfig's doc comment.
 *
 *  Four distinct paths, each answering a different question (see main.ts's
 *  planetLayers doc comment for the full reasoning):
 *  - `orbitLine` ("Tychonic Path"): the real, mathematically EXACT position
 *    decomposed into two legible circles (a Sun-relative ellipse in
 *    Heliocentric; a deferent+epicycle pair in Geocentric where the Sun
 *    genuinely carries the planet, matching Tycho Brahe's real
 *    geo-heliocentric system - for Mercury/Venus specifically this
 *    generalizes Heraclides of Pontus's earlier partial version of the
 *    same idea).
 *  - `ptolemaic` ("Ptolemaic Path", Geocentric only): the REAL historical
 *    Ptolemaic construction, deliberately imperfect for Mercury/Venus - a
 *    deferent+epicycle scaled down so their combined reach never exceeds
 *    the Sun's own distance (the actual "nested crystalline spheres don't
 *    overlap" cosmological assumption), correctly preserving apparent
 *    DIRECTION but unable to place the planet on the far side of the Sun -
 *    structurally incapable of showing Venus's gibbous phases, which is
 *    exactly why that 1610 observation broke the model. For Mars/Jupiter/
 *    Saturn this is identical to the Tychonic path - Ptolemy's real
 *    superior-planet epicycles (epicycle radius vector always parallel to
 *    the Earth-Sun line) already happen to be mathematically exact.
 *  - `truePath` (Geocentric only): the SAME exact real position as
 *    `orbitLine`, NOT decomposed - the actual compound curve a planet
 *    traces relative to Earth. Proves the Tychonic deferent+epicycle pair
 *    is exactly this curve, not an approximation of it.
 *  - `skyPath`: direction ONLY (no real distance), projected onto the
 *    shared sky radius - literally "which way do I point a telescope,
 *    relative to the fixed stars" - the actual historical problem
 *    Ptolemy's epicycles were built to predict. */
export interface PlanetEntryPanelConfig {
  id: string;
  label: string;
  marker: ToggleConfig;
  orbitLine: ToggleConfig;
  ptolemaic: ToggleConfig;
  truePath: ToggleConfig;
  skyPath: ToggleConfig;
}

/** The 5 naked-eye planets' controls, one collapsible row per planet (see
 *  buildPlanetToggleRow) - modeled on ObserverPanelConfig.observerToggles's
 *  array-driven pattern rather than SunAndMoonPanelConfig's flat hand-named
 *  fields, since these 5 bodies are regular enough that per-body free
 *  fields would just be duplication. No distance slider per planet -
 *  unlike Sun/Moon, a planet's distance is real-derived from its own
 *  orbital elements plus the shared Sun-distance scale, not an artistic
 *  free parameter (see config/planets.ts). `allMarkersVisible`/
 *  `allOrbitLinesVisible`/`allPtolemaicVisible`/`allTruePathsVisible`/
 *  `allSkyPathsVisible` are master toggles fanning out to every entry's own
 *  checkbox (and syncing them via ControlPanel.syncLayerToggles) - planets
 *  are small and easy to miss individually, so a single "show them all"
 *  action matters more here than it does for Sun/Moon's own 2-body
 *  section. `visibilityBoost` is a single slider scaling every planet's
 *  marker size AND color brightness together, for the same reason.
 *  `labelsVisible` shows each planet's name near its own marker - since
 *  paths share their planet's own color, this doubles as identifying which
 *  path belongs to which planet. `pathLabelsVisible` goes one step further -
 *  a "{Planet} {Path Type}" label anchored on each individual VISIBLE path
 *  (not just the marker), for when multiple same-colored paths for one
 *  planet are shown at once and even the marker label can't disambiguate
 *  which line is which. */
export interface PlanetsPanelConfig {
  allMarkersVisible: ToggleConfig;
  allOrbitLinesVisible: ToggleConfig;
  allPtolemaicVisible: ToggleConfig;
  allTruePathsVisible: ToggleConfig;
  allSkyPathsVisible: ToggleConfig;
  labelsVisible: ToggleConfig;
  pathLabelsVisible: ToggleConfig;
  visibilityBoost: SliderConfig;
  entries: PlanetEntryPanelConfig[];
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

/** The ONE sky/celestial-sphere tier - stars, constellations, the
 *  wireframe shell, all sharing one live-adjustable radius (see
 *  config/constants.ts's STAR_RADIUS_* doc comment). Shrink it for a small,
 *  easy-to-reason-about celestial-sphere demonstration; grow it for an
 *  immersive backdrop. There used to be two entirely separate tiers here
 *  ("Background Stars" and "Celestial Sphere") each with its own duplicated
 *  controls - collapsed to one. */
export interface SkyPanelConfig {
  atmosphereVisible: ToggleConfig;
  radius: SliderConfig;
  shellVisible: ToggleConfig;
  wireframeOpacity: SliderConfig;
  onHemisphereModeChange: (mode: HemisphereMode) => void;
  stars: StarSystemConfig;
  constellationLines: ToggleConfig;
  constellationNames: ToggleConfig;
}

export interface ControlPanelConfig {
  scene: ScenePanelConfig;
  presets: {
    presets: ScenePresetDef[];
  };
  earth: {
    visible: ToggleConfig;
    continents: ToggleConfig;
    rotation: ToggleConfig;
    axis: ToggleConfig;
    axialTilt: SliderConfig;
    /** Real, geography-pinned trees/rocks/mountains/boats near wherever the
     *  active observer currently stands - see GroundScatterLayer. */
    groundScatter: ToggleConfig;
  };
  stonehenge: StonehengePanelConfig;
  sunAndMoon: SunAndMoonPanelConfig;
  planets: PlanetsPanelConfig;
  sky: SkyPanelConfig;
  observer: ObserverPanelConfig;
  camera: {
    viewModes: ViewModeDef[];
    onCameraModeChange: (mode: CameraMode) => void;
    upMode: CameraUpModePanelConfig;
    /** Releases whatever's currently targeted - BOTH the click-set anchor
     *  and the long-press-set look-at target (see BodyTargetPicker/
     *  setAnchorBody/setLookAtBody in main.ts) - same effect as pressing
     *  Escape or clicking/pressing empty space, exposed here as a button
     *  for discoverability. */
    onClearTarget: () => void;
    /** Master "hide reticles" toggle - see TargetReticleLayer.setVisible. */
    reticles: ToggleConfig;
    /** MinimapHud is ALSO only ever shown in Ground View (see main.ts's
     *  render loop, which ANDs this with the live camera-mode check) - this
     *  lets it be suppressed on demand even while in Ground View. */
    minimapVisible: ToggleConfig;
    /** Only controls how opaque/bright the minimap reads while visible, not
     *  whether it's shown at all - see minimapVisible above. */
    minimapOpacity: SliderConfig;
  };
  time: {
    onPlayPauseChange: (paused: boolean) => void;
    timeScale: SliderConfig;
    onStepHour: () => void;
    onStepDay: () => void;
    onStepMonth: () => void;
    onStepYear: () => void;
    onReset: () => void;
    /** Seeds the date picker's initial value only (like every other
     *  control's construction-time `value`) - it does NOT stay live-synced
     *  while time passes (play/step buttons/speed all move the clock too);
     *  the always-visible TimeHud is what shows the live current date. */
    currentDate: Date;
    onSelectDate: (date: Date) => void;
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
 * mirror the app's visual hierarchy (Scene tab strip -> Presets -> Earth ->
 * Sun & Moon -> Sky (Celestial Sphere/Stars/Constellations, one shared
 * radius) -> Observer -> Selected Star -> Camera -> Time). Scene is the ONE
 * top-level choice (Geocentric/Heliocentric - see ScenePanelConfig's doc
 * comment) - everything else is shared, persistent state that both Scenes
 * render under. Deliberately dumb: it only renders inputs and reports
 * changes via callbacks in `ControlPanelConfig` - main.ts remains the
 * composition root that wires those callbacks to layers/clock/camera.
 */
export class ControlPanel {
  readonly element: HTMLElement;
  private readonly viewButtons: Partial<Record<CameraMode, HTMLButtonElement>> = {};
  private readonly upModeButtons: Partial<Record<CameraUpMode, HTMLButtonElement>> = {};
  private readonly sceneButtons: Record<string, HTMLButtonElement> = {};
  private readonly observerButtons: Record<string, HTMLButtonElement> = {};
  private readonly layerCheckboxes: Record<string, HTMLInputElement> = {};
  private readonly sliders: Record<string, HTMLInputElement> = {};
  private readonly selectedStarBody: HTMLElement;
  private selectedStarSection?: HTMLDetailsElement;
  private observerSwitcherElement?: HTMLElement;
  private observerTogglesContainer?: HTMLElement;
  private observerLatLonLabel?: HTMLElement;
  private targetedBodyLabel?: HTMLElement;
  private lookAtBodyLabel?: HTMLElement;
  private stonehengeLocationLabel?: HTMLElement;
  private onSwitchActiveObserver?: (id: string) => void;

  constructor(container: HTMLElement, config: ControlPanelConfig) {
    this.element = document.createElement("div");
    this.element.className = "control-panel";

    this.selectedStarBody = document.createElement("div");

    this.element.appendChild(this.buildSceneSection(config));
    this.element.appendChild(this.buildPresetsSection(config));
    this.element.appendChild(this.buildEarthSection(config));
    this.element.appendChild(this.buildStonehengeSection(config));
    this.element.appendChild(this.buildSunAndMoonSection(config));
    this.element.appendChild(this.buildPlanetsSection(config));
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

  /** Switches the top-level Scene tab strip's active button state. Unlike
   *  the old per-model "Real Distance" tier, nothing else needs rebuilding
   *  here - every Sun & Moon/Sky/Observer control is shared state, not
   *  per-Scene. */
  setActiveScene(id: string): void {
    for (const [entryId, button] of Object.entries(this.sceneButtons)) {
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
   *  list isn't fixed at construction like the Camera/Scene sections' are. */
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

  /** Reflects the current orbit ANCHOR body (see BodyTargetPicker/
   *  setAnchorBody in main.ts) in the Camera section - pass undefined when
   *  tracking is released (Escape, clicking elsewhere, or the Clear Target
   *  button). */
  setAnchorBody(label: string | undefined): void {
    if (!this.targetedBodyLabel) return;
    this.targetedBodyLabel.textContent = label ? `Following: ${label} (click elsewhere to release)` : "";
  }

  /** Reflects the current LOOK-AT body (see BodyTargetPicker/setLookAtBody
   *  in main.ts) - independent of setAnchorBody above, set via a long-press
   *  instead of a click. Pass undefined when released (Escape, a long-press
   *  on empty space, or the Clear Target button). */
  setLookAtBody(label: string | undefined): void {
    if (!this.lookAtBodyLabel) return;
    this.lookAtBodyLabel.textContent = label ? `Looking at: ${label} (long-press elsewhere to release)` : "";
  }

  /** Reflects where StonehengeLayer was last place()'d - pushed once, right
   *  after the "Place Henge at My Location" button's onClick runs (not
   *  every frame, unlike setObserverLatLon - the henge doesn't move once
   *  placed). Pass undefined for the initial "not yet placed" state. */
  setStonehengeLocation(latLon: { latDeg: number; lonDeg: number } | undefined): void {
    if (!this.stonehengeLocationLabel) return;
    if (!latLon) {
      this.stonehengeLocationLabel.textContent = "Not yet placed";
      return;
    }
    const latText = `${Math.abs(latLon.latDeg).toFixed(1)}°${latLon.latDeg >= 0 ? "N" : "S"}`;
    const lonText = `${Math.abs(latLon.lonDeg).toFixed(1)}°${latLon.lonDeg >= 0 ? "E" : "W"}`;
    this.stonehengeLocationLabel.textContent = `Placed at ${latText}, ${lonText}`;
  }

  /** Reflects a programmatic layer-visibility change (e.g. a scene preset)
   *  in the checkbox UI, since that path bypasses the checkboxes entirely. */
  syncLayerToggles(visibility: Record<string, boolean>): void {
    for (const [id, visible] of Object.entries(visibility)) {
      const checkbox = this.layerCheckboxes[id];
      if (checkbox) checkbox.checked = visible;
    }
  }

  /** Reflects a programmatic slider change (e.g. a scene preset's
   *  skyRadius/sunDistanceRadii/moonDistanceRadii override) in the slider
   *  UI - re-dispatches a real "input" event (same pattern as the Earth
   *  section's axial-tilt reset button) so the value label text updates
   *  too, not just the thumb position. Re-invoking that slider's own
   *  onChange this way is redundant with the preset having already applied
   *  the value directly, but harmless (pure idempotent setters). */
  syncSliders(values: Partial<Record<string, number>>): void {
    for (const [id, value] of Object.entries(values)) {
      if (value === undefined) continue;
      const input = this.sliders[id];
      if (!input) continue;
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
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

  private registerSlider(id: string, slider: { element: HTMLElement; input: HTMLInputElement }): { element: HTMLElement; input: HTMLInputElement } {
    this.sliders[id] = slider.input;
    return slider;
  }

  /** The top-level "which body is fixed at the world origin" tab strip -
   *  see ScenePanelConfig's doc comment. A bare mode switch with no content
   *  of its own; every other control lives in its own section below,
   *  shared across both Scenes. */
  private buildSceneSection(config: ControlPanelConfig): HTMLElement {
    const { element: tabBar, buttons: tabButtons } = createButtonGroup(
      config.scene.entries.map((entry) => ({
        key: entry.id,
        label: entry.label,
        onClick: () => config.scene.onSwitchActive(entry.id),
      })),
    );
    for (const [id, button] of Object.entries(tabButtons)) {
      this.sceneButtons[id] = button;
    }
    this.setActiveScene(config.scene.activeId);

    const section = document.createElement("div");
    section.className = "control-view-section";
    section.append(tabBar);
    return section;
  }

  private buildPresetsSection(config: ControlPanelConfig): HTMLElement {
    const { element } = createButtonGroup(
      config.presets.presets.map((preset) => ({ key: preset.id, label: preset.label, onClick: preset.onApply })),
    );
    const presetGrid = document.createElement("div");
    presetGrid.className = "control-preset-grid";
    presetGrid.appendChild(element);

    return createSection("Presets", true, [presetGrid]);
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
      this.registerLayerCheckbox(
        "groundScatter",
        createCheckbox("Ground Scatter (Ground View)", config.earth.groundScatter.checked, config.earth.groundScatter.onChange),
      ).element,
    ];
    return createSection("Earth", true, content);
  }

  /** See StonehengePanelConfig's doc comment. */
  private buildStonehengeSection(config: ControlPanelConfig): HTMLElement {
    const sh = config.stonehenge;

    const placeButton = createButton("Place Henge at My Location", sh.onPlaceAtObserver);

    this.stonehengeLocationLabel = document.createElement("div");
    this.stonehengeLocationLabel.className = "control-selected-star-line";
    this.setStonehengeLocation(undefined);

    const { element: jumpButtons } = createButtonGroup([
      { key: "june", label: "June Solstice", onClick: sh.onJumpToJuneSolstice },
      { key: "december", label: "December Solstice", onClick: sh.onJumpToDecemberSolstice },
      { key: "march", label: "March Equinox", onClick: sh.onJumpToMarchEquinox },
      { key: "september", label: "September Equinox", onClick: sh.onJumpToSeptemberEquinox },
    ]);

    return createSection("Stonehenge", false, [
      this.registerLayerCheckbox("stonehenge", createCheckbox("Show Stonehenge", sh.visible.checked, sh.visible.onChange)).element,
      placeButton,
      this.stonehengeLocationLabel,
      createSubsectionHeading("Jump to Alignment Date"),
      jumpButtons,
    ]);
  }

  /** The single home for every Sun/Moon control - see SunAndMoonPanelConfig's
   *  doc comment. One Sun, one Moon, always: no per-Scene or per-tier
   *  sub-sections to disambiguate between. */
  private buildSunAndMoonSection(config: ControlPanelConfig): HTMLElement {
    const sm = config.sunAndMoon;

    return createSection("Sun & Moon", true, [
      this.registerLayerCheckbox("sunMarker", createCheckbox("Sun visible", sm.sun.checked, sm.sun.onChange)).element,
      this.registerLayerCheckbox("moonMarker", createCheckbox("Moon visible", sm.moon.checked, sm.moon.onChange)).element,
      this.registerLayerCheckbox(
        "sunEclipticPath",
        createCheckbox("Sun Ecliptic Path", sm.sunEclipticPath.checked, sm.sunEclipticPath.onChange),
      ).element,
      this.registerLayerCheckbox(
        "moonSkyPath",
        createCheckbox("Moon Sky Path", sm.moonSkyPath.checked, sm.moonSkyPath.onChange),
      ).element,
      this.registerLayerCheckbox(
        "orbitLines",
        createCheckbox("Show Orbit Lines", sm.orbitLines.checked, sm.orbitLines.onChange),
      ).element,
      this.registerLayerCheckbox(
        "earthOrbitLine",
        createCheckbox("Show Earth's Orbital Path (Heliocentric)", sm.earthOrbitPath.checked, sm.earthOrbitPath.onChange),
      ).element,

      createSubsectionHeading("Distance & Size"),
      this.registerSlider("sunDistanceRadii", createSlider({ ...sm.sunDistance, label: "Sun-Earth Distance" })).element,
      this.registerSlider("moonDistanceRadii", createSlider({ ...sm.moonDistance, label: "Moon-Earth Distance" })).element,
      createSlider({ ...sm.sunSize, label: "Sun Size" }).element,
      createSlider({ ...sm.moonSize, label: "Moon Size" }).element,
      createSlider({ ...sm.moonDarkSideBrightness, label: "Moon Dark Side Brightness" }).element,
    ]);
  }

  /** One collapsible row per planet - see PlanetsPanelConfig's doc comment
   *  for why this mirrors buildObserverSection's array-driven pattern
   *  rather than buildSunAndMoonSection's flat hand-named fields. Unlike
   *  Observer's rows, planets are fixed at construction (no "Add Planet"),
   *  so there's no addPlanetToggleRow counterpart to addObserverToggleRow. */
  private buildPlanetsSection(config: ControlPanelConfig): HTMLElement {
    const planets = config.planets;
    const rows = planets.entries.map((entry) => this.buildPlanetToggleRow(entry));
    return createSection("Planets", false, [
      createCheckbox("Show All Planets", planets.allMarkersVisible.checked, planets.allMarkersVisible.onChange).element,
      createCheckbox("Show All Tychonic Paths", planets.allOrbitLinesVisible.checked, planets.allOrbitLinesVisible.onChange).element,
      createCheckbox("Show All Ptolemaic Paths", planets.allPtolemaicVisible.checked, planets.allPtolemaicVisible.onChange).element,
      createCheckbox("Show All True Paths", planets.allTruePathsVisible.checked, planets.allTruePathsVisible.onChange).element,
      createCheckbox("Show All Sky Paths", planets.allSkyPathsVisible.checked, planets.allSkyPathsVisible.onChange).element,
      createCheckbox("Show Planet Labels", planets.labelsVisible.checked, planets.labelsVisible.onChange).element,
      createCheckbox("Show Path Labels", planets.pathLabelsVisible.checked, planets.pathLabelsVisible.onChange).element,
      createSlider({ ...planets.visibilityBoost, label: "Visibility Boost (Size & Brightness)" }).element,
      createSubsectionHeading("Per-Planet"),
      ...rows,
    ]);
  }

  private buildPlanetToggleRow(entry: PlanetEntryPanelConfig): HTMLElement {
    return createSection(entry.label, false, [
      this.registerLayerCheckbox(`${entry.id}Marker`, createCheckbox("Show Marker", entry.marker.checked, entry.marker.onChange)).element,
      this.registerLayerCheckbox(`${entry.id}OrbitLine`, createCheckbox("Show Tychonic Path", entry.orbitLine.checked, entry.orbitLine.onChange))
        .element,
      this.registerLayerCheckbox(
        `${entry.id}Ptolemaic`,
        createCheckbox("Show Ptolemaic Path", entry.ptolemaic.checked, entry.ptolemaic.onChange),
      ).element,
      this.registerLayerCheckbox(`${entry.id}TruePath`, createCheckbox("Show True Path", entry.truePath.checked, entry.truePath.onChange))
        .element,
      this.registerLayerCheckbox(`${entry.id}SkyPath`, createCheckbox("Show Sky Path", entry.skyPath.checked, entry.skyPath.onChange)).element,
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

  /** The ONE sky tier - see SkyPanelConfig's doc comment. Radius spans
   *  "small comprehensible diagram" to "immersive infinite backdrop"; stars
   *  and constellations share it, no separate sub-tiers. */
  private buildSkySection(config: ControlPanelConfig): HTMLElement {
    const sky = config.sky;

    const atmosphereVisible = this.registerLayerCheckbox(
      "atmosphere",
      createCheckbox("Show Atmosphere", sky.atmosphereVisible.checked, sky.atmosphereVisible.onChange),
    );

    const shellVisible = this.registerLayerCheckbox(
      "celestialSphereShell",
      createCheckbox("Show Celestial Sphere Shell", sky.shellVisible.checked, sky.shellVisible.onChange),
    );

    // Obscures the NEAR hemisphere (facing the external camera) rather than
    // the far one: the near side sits visually between the camera and
    // Earth, cluttering the view.
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
      sky.onHemisphereModeChange(mode);
    };

    const starVisible = this.registerLayerCheckbox("stars", createCheckbox("Stars visible", sky.stars.visible.checked, sky.stars.visible.onChange));
    const magnitudeSlider = createSlider({
      ...sky.stars.limitingMagnitude,
      label: "Limiting Magnitude",
      format: sky.stars.limitingMagnitude.format ?? ((v) => v.toFixed(1)),
    });
    const showAllButton = document.createElement("button");
    showAllButton.type = "button";
    showAllButton.className = "control-button";
    showAllButton.textContent = "Show All Stars";
    showAllButton.addEventListener("click", () => {
      magnitudeSlider.input.value = String(sky.stars.limitingMagnitude.max);
      magnitudeSlider.input.dispatchEvent(new Event("input"));
    });

    const content = [
      createSubsectionHeading("Atmosphere"),
      atmosphereVisible.element,

      this.registerSlider("skyRadius", createSlider({ ...sky.radius, label: "Sky Radius" })).element,
      shellVisible.element,
      createSlider({ ...sky.wireframeOpacity, label: "Shell Wireframe Opacity", format: sky.wireframeOpacity.format ?? percentFormat }).element,
      hide.element,
      fade.element,

      createSubsectionHeading("Stars"),
      starVisible.element,
      magnitudeSlider.element,
      createSlider({ ...sky.stars.brightness, label: "Brightness", format: sky.stars.brightness.format ?? percentFormat }).element,
      createSlider({ ...sky.stars.size, label: "Size" }).element,
      createSlider({ ...sky.stars.opacity, label: "Opacity", format: sky.stars.opacity.format ?? percentFormat }).element,
      showAllButton,

      createSubsectionHeading("Constellations"),
      this.registerLayerCheckbox(
        "constellationLines",
        createCheckbox("Constellation Lines", sky.constellationLines.checked, sky.constellationLines.onChange),
      ).element,
      this.registerLayerCheckbox(
        "constellationNames",
        createCheckbox("Constellation Names", sky.constellationNames.checked, sky.constellationNames.onChange),
      ).element,
    ];
    return createSection("Sky", true, content);
  }

  private buildSelectedStarSection(): HTMLElement {
    this.setSelectedStarInfo(undefined);
    const section = createSection("Selected Star", true, [this.selectedStarBody]);
    this.selectedStarSection = section;
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

    this.targetedBodyLabel = document.createElement("div");
    this.targetedBodyLabel.className = "control-selected-star-line";
    this.lookAtBodyLabel = document.createElement("div");
    this.lookAtBodyLabel.className = "control-selected-star-line";
    const clearTargetButton = createButton("Clear Target", config.camera.onClearTarget);
    const reticlesCheckbox = this.registerLayerCheckbox(
      "targetReticles",
      createCheckbox("Show Target Reticles", config.camera.reticles.checked, config.camera.reticles.onChange),
    );

    return createSection("Camera", true, [
      element,
      createSubsectionHeading("Up (Space View)"),
      upModeElement,
      createSubsectionHeading("Target Lock (Space View)"),
      createPlaceholder("Click a body to follow it; long-press a body to look at it instead."),
      this.targetedBodyLabel,
      this.lookAtBodyLabel,
      clearTargetButton,
      reticlesCheckbox.element,
      createSubsectionHeading("Minimap (Ground View)"),
      createCheckbox("Show Minimap", config.camera.minimapVisible.checked, config.camera.minimapVisible.onChange)
        .element,
      createSlider({
        ...config.camera.minimapOpacity,
        label: "Opacity",
        format: config.camera.minimapOpacity.format ?? percentFormat,
      }).element,
    ]);
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

    const dateInput = createDateInput({
      label: "Jump to Date",
      value: config.time.currentDate,
      onChange: config.time.onSelectDate,
    });

    const content = [
      playPauseButton,
      createSlider({ ...config.time.timeScale, label: "Time Scale", format: config.time.timeScale.format ?? ((v) => `${v}x`) }).element,
      stepButtons,
      dateInput.element,
      resetButton,
    ];
    return createSection("Time", true, content);
  }
}
