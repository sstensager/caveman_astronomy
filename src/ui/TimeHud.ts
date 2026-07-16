// A tiny, always-visible overlay (independent of ControlPanel's collapsible
// sections/scroll) showing the current simulated date and time-speed - the
// two things worth glancing at mid-demo without opening the panel. Follows
// the same "external push once per frame" pattern as
// ControlPanel.setObserverLatLon/setAnchorBody: state originates from
// SimulationClock, not from an input on the HUD itself.

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export class TimeHud {
  readonly element: HTMLElement;
  private readonly dateLabel: HTMLElement;
  private readonly speedLabel: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "time-hud";

    this.dateLabel = document.createElement("div");
    this.dateLabel.className = "time-hud-date";

    this.speedLabel = document.createElement("div");
    this.speedLabel.className = "time-hud-speed";

    this.element.appendChild(this.dateLabel);
    this.element.appendChild(this.speedLabel);
    container.appendChild(this.element);
  }

  /** Pushed once per frame from main.ts's render loop. */
  update(date: Date, timeSpeed: number, paused: boolean): void {
    this.dateLabel.textContent = DATE_FORMAT.format(date);
    this.speedLabel.textContent = paused ? "Paused" : `${timeSpeed}x`;
  }
}
