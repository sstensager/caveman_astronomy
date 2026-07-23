import { SIMULATED_DAY_DURATION_SECONDS, TIME_SPEED_CEIL, TIME_SPEED_FLOOR, TIME_SPEED_REALTIME } from "../config/constants";
import { createButton, createButtonGroup, createDateInput, createSlider } from "./controls";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

// Above this rate the hour:minute readout ticks over faster than a human
// can actually track (a minute of sim time passes multiple times per
// real second), so it stops being informative and starts just being visual
// noise - faded rather than removed outright, since it's still accurate and
// still worth having if you pause to look.
const MINUTE_READOUT_FADE_HOURS_PER_SEC = 10;

// The speed slider's own DOM range is this many discrete integer positions,
// mapped onto [TIME_SPEED_FLOOR, TIME_SPEED_CEIL] on a LOG scale (see
// speedFromPosition/positionFromSpeed below) - equal slider travel per
// decade of speed, so fine control near 1x and big jumps near
// TIME_SPEED_CEIL both fit on the same control.
const SPEED_SLIDER_STEPS = 1000;
// Last preset always tracks TIME_SPEED_CEIL (rather than a hardcoded number)
// so it can never end up ABOVE the slider's actual max - positionFromSpeed
// clamps to TIME_SPEED_CEIL, so a preset exceeding it would silently snap
// to a lower speed than its own label claimed.
//
// Realtime sits below TIME_SPEED_FLOOR by design (see its doc comment in
// constants.ts) - clicking it therefore bypasses the slider's clamped
// speed<->position round-trip entirely (see the button wiring below), the
// same way every other preset here does now too.
const SPEED_PRESETS: Array<{ value: number; label: string }> = [
  { value: TIME_SPEED_REALTIME, label: "Realtime" },
  { value: 10, label: "10x" },
  { value: 100, label: "100x" },
  { value: TIME_SPEED_CEIL, label: `${TIME_SPEED_CEIL}x` },
];

function speedFromPosition(position: number): number {
  const ratio = position / SPEED_SLIDER_STEPS;
  return TIME_SPEED_FLOOR * (TIME_SPEED_CEIL / TIME_SPEED_FLOOR) ** ratio;
}

function positionFromSpeed(speed: number): number {
  const clamped = Math.min(Math.max(speed, TIME_SPEED_FLOOR), TIME_SPEED_CEIL);
  const ratio = Math.log(clamped / TIME_SPEED_FLOOR) / Math.log(TIME_SPEED_CEIL / TIME_SPEED_FLOOR);
  return Math.round(ratio * SPEED_SLIDER_STEPS);
}

function formatMultiplier(speed: number): string {
  if (speed >= 100) return `${Math.round(speed)}x`;
  if (speed >= 10) return `${speed.toFixed(1)}x`;
  return `${speed.toFixed(2)}x`;
}

/** A bare "Nx" multiplier doesn't say whether that's crawling or flying
 *  through days, so this converts to whichever of hours/days/years per
 *  real second reads best at that speed, alongside the multiplier. */
function formatRate(speed: number): string {
  const daysPerSecond = speed / SIMULATED_DAY_DURATION_SECONDS;
  if (daysPerSecond < 1) return `${(daysPerSecond * 24).toFixed(1)} hours/sec (${formatMultiplier(speed)})`;
  if (daysPerSecond < 365) return `${daysPerSecond.toFixed(1)} days/sec (${formatMultiplier(speed)})`;
  return `${(daysPerSecond / 365).toFixed(1)} years/sec (${formatMultiplier(speed)})`;
}

export interface TimePanelConfig {
  onPlayPauseChange: (paused: boolean) => void;
  timeSpeed: number;
  onTimeSpeedChange: (value: number) => void;
  onStepHour: () => void;
  onStepDay: () => void;
  onStepMonth: () => void;
  onStepYear: () => void;
  onReset: () => void;
  /** Seeds the date picker's initial value only, like every other control's
   *  construction-time `value` - it does NOT stay live-synced while time
   *  passes (play/step buttons/speed all move the clock too); the
   *  always-visible date line is what shows the live current date. */
  currentDate: Date;
  onSelectDate: (date: Date) => void;
}

/**
 * Floating date/time readout AND every time control in one draggable,
 * minimizable panel - previously split between a read-only, fixed-position
 * TimeHud overlay and ControlPanel's buried "Time" section. Follows the
 * same "external push once per frame" pattern as TimeHud for the date/rate
 * readout (state originates from SimulationClock in main.ts's render
 * loop), but now owns interactive controls directly, wired via
 * TimePanelConfig's callbacks exactly like ControlPanel's other sections.
 *
 * Dragging and minimizing use the same idioms already established
 * elsewhere: minimize is a CSS class toggle (see MinimapHud.setMinimized),
 * and the drag listeners are permanently registered on `window` and gated
 * by an internal flag rather than added/removed per-drag (see
 * ObserverDragHandler).
 */
export class TimePanel {
  readonly element: HTMLElement;
  private readonly header: HTMLElement;
  private readonly dateLabel: HTMLElement;
  private readonly dateTextSpan: HTMLElement;
  private readonly timeLabel: HTMLElement;
  private readonly rateLabel: HTMLElement;
  private readonly minimizeButton: HTMLButtonElement;
  private readonly playPauseButton: HTMLButtonElement;
  private readonly speedSlider: HTMLInputElement;
  private readonly setSpeedSliderLabel: (text: string) => void;
  private minimized = false;
  private paused = false;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(container: HTMLElement, config: TimePanelConfig) {
    this.element = document.createElement("div");
    this.element.className = "time-panel";

    this.header = document.createElement("div");
    this.header.className = "time-panel-header";
    this.header.style.touchAction = "none";
    this.header.addEventListener("pointerdown", this.onHeaderPointerDown);

    const dragHandle = document.createElement("span");
    dragHandle.className = "time-panel-drag-handle";
    dragHandle.textContent = "≡";
    dragHandle.setAttribute("aria-hidden", "true");

    const title = document.createElement("span");
    title.className = "time-panel-title";
    title.textContent = "Time";

    this.minimizeButton = document.createElement("button");
    this.minimizeButton.type = "button";
    this.minimizeButton.className = "time-panel-minimize";
    this.minimizeButton.textContent = "–"; // en dash, reads as a minimize glyph
    this.minimizeButton.setAttribute("aria-label", "Minimize time panel");
    this.minimizeButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.minimizeButton.addEventListener("click", () => this.setMinimized(!this.minimized));

    this.header.append(dragHandle, title, this.minimizeButton);

    this.dateLabel = document.createElement("div");
    this.dateLabel.className = "time-panel-date";

    this.dateTextSpan = document.createElement("span");
    this.timeLabel = document.createElement("span");
    this.timeLabel.className = "time-panel-date-time";
    this.dateLabel.append(this.dateTextSpan, " at ", this.timeLabel);

    this.rateLabel = document.createElement("div");
    this.rateLabel.className = "time-panel-rate";

    this.playPauseButton = document.createElement("button");
    this.playPauseButton.type = "button";
    this.playPauseButton.className = "control-button";
    this.playPauseButton.textContent = "Pause";
    this.playPauseButton.addEventListener("click", () => config.onPlayPauseChange(!this.paused));

    const {
      element: speedSliderElement,
      input: speedSliderInput,
      setValueLabel: setSpeedSliderLabel,
    } = createSlider({
      label: "Time Scale",
      min: 0,
      max: SPEED_SLIDER_STEPS,
      step: 1,
      value: positionFromSpeed(config.timeSpeed),
      format: (position) => formatRate(speedFromPosition(position)),
      onChange: (position) => config.onTimeSpeedChange(speedFromPosition(position)),
    });
    this.speedSlider = speedSliderInput;
    this.setSpeedSliderLabel = setSpeedSliderLabel;

    const { element: presetButtons } = createButtonGroup(
      SPEED_PRESETS.map(({ value, label }) => ({
        key: label,
        label,
        onClick: () => {
          // Sets the exact preset value directly rather than dispatching the
          // slider's own 'input' event - that round-trips through
          // speedFromPosition(positionFromSpeed(value)), which clamps to
          // [TIME_SPEED_FLOOR, TIME_SPEED_CEIL] and would silently bump
          // Realtime (well below FLOOR) up to FLOOR instead. The thumb still
          // moves (clamped, for visual feedback) and the label still updates
          // (to the exact unclamped rate), just without re-firing onChange.
          this.speedSlider.value = String(positionFromSpeed(value));
          this.setSpeedSliderLabel(formatRate(value));
          config.onTimeSpeedChange(value);
        },
      })),
    );

    const { element: stepButtons } = createButtonGroup([
      { key: "hour", label: "+1 Hour", onClick: config.onStepHour },
      { key: "day", label: "+1 Day", onClick: config.onStepDay },
      { key: "month", label: "+1 Month", onClick: config.onStepMonth },
      { key: "year", label: "+1 Year", onClick: config.onStepYear },
    ]);

    const dateInput = createDateInput({
      label: "Jump to Date",
      value: config.currentDate,
      onChange: config.onSelectDate,
    });

    const resetButton = createButton("Reset Time", config.onReset);

    const controls = document.createElement("div");
    controls.className = "time-panel-controls";
    controls.append(this.playPauseButton, speedSliderElement, presetButtons, stepButtons, dateInput.element, resetButton);

    this.element.append(this.header, this.dateLabel, this.rateLabel, controls);
    container.appendChild(this.element);

    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  private setMinimized(minimized: boolean): void {
    this.minimized = minimized;
    this.element.classList.toggle("time-panel-minimized", minimized);
    this.minimizeButton.textContent = minimized ? "□" : "–"; // small square (restore) / en dash (minimize)
    this.minimizeButton.setAttribute("aria-label", minimized ? "Restore time panel" : "Minimize time panel");
  }

  private readonly onHeaderPointerDown = (event: PointerEvent): void => {
    // Switch off the CSS top/right anchor onto explicit left/top before
    // dragging - a fixed-position box with auto width computes its width
    // from left AND right when both are set, so leaving `right` in place
    // once `left` is also set inline would stretch the panel across the
    // gap between them instead of moving it.
    const rect = this.element.getBoundingClientRect();
    this.element.style.left = `${rect.left}px`;
    this.element.style.top = `${rect.top}px`;
    this.element.style.right = "auto";
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;
    this.dragging = true;
    this.header.classList.add("time-panel-header-dragging");
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const maxLeft = Math.max(0, window.innerWidth - this.element.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - this.element.offsetHeight);
    this.element.style.left = `${Math.min(Math.max(0, event.clientX - this.dragOffsetX), maxLeft)}px`;
    this.element.style.top = `${Math.min(Math.max(0, event.clientY - this.dragOffsetY), maxTop)}px`;
  };

  private readonly onPointerUp = (): void => {
    this.dragging = false;
    this.header.classList.remove("time-panel-header-dragging");
  };

  /** Pushed once per frame from main.ts's render loop. */
  update(date: Date, timeSpeed: number, paused: boolean): void {
    this.dateTextSpan.textContent = DATE_FORMAT.format(date);
    this.timeLabel.textContent = TIME_FORMAT.format(date);
    const hoursPerSecond = (timeSpeed / SIMULATED_DAY_DURATION_SECONDS) * 24;
    this.timeLabel.classList.toggle("time-panel-date-time-faded", !paused && hoursPerSecond >= MINUTE_READOUT_FADE_HOURS_PER_SEC);
    this.rateLabel.textContent = paused ? "Paused" : formatRate(timeSpeed);
    if (paused !== this.paused) {
      this.paused = paused;
      this.playPauseButton.textContent = paused ? "Play" : "Pause";
    }
  }

  /** Reflects a Scene JSON load's timeSpeed onto the slider's displayed
   *  position and label - unlike update() above, NOT called every frame,
   *  since re-deriving and reassigning the slider's value every frame would
   *  fight the user's own input mid-drag. Play/Pause needs no equivalent
   *  here: update() already refreshes it from the live simClock.paused
   *  every frame regardless of who last changed it.
   *
   *  Sets position/label directly rather than dispatching the slider's own
   *  'input' event, for the same reason the preset buttons do above: a
   *  dispatch re-fires onChange with the CLAMPED speedFromPosition(...)
   *  value, which would silently overwrite an already-correctly-applied
   *  sub-FLOOR value (e.g. a saved Realtime scene) the moment it loads. */
  syncSpeed(timeSpeed: number): void {
    this.speedSlider.value = String(positionFromSpeed(timeSpeed));
    this.setSpeedSliderLabel(formatRate(timeSpeed));
  }
}
