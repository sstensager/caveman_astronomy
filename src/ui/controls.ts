/**
 * Small, reusable DOM factories the control panel composes into sections.
 * Centralizing "what a checkbox/slider/button row looks like" here is what
 * lets new layers/controls get added later as composition instead of each
 * one hand-rolling its own row - see ControlPanel.ts.
 */

export interface CheckboxControl {
  element: HTMLLabelElement;
  input: HTMLInputElement;
}

export function createCheckbox(
  labelText: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): CheckboxControl {
  const element = document.createElement("label");
  element.className = "control-checkbox";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));

  element.appendChild(input);
  element.appendChild(document.createTextNode(labelText));
  return { element, input };
}

export interface SliderOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export interface SliderControl {
  element: HTMLElement;
  input: HTMLInputElement;
}

export function createSlider(options: SliderOptions): SliderControl {
  const format = options.format ?? ((v: number) => String(v));

  const element = document.createElement("div");
  element.className = "control-slider";

  const label = document.createElement("label");
  label.className = "control-label";
  label.textContent = options.label;

  const valueLabel = document.createElement("span");
  valueLabel.className = "control-value";
  valueLabel.textContent = format(options.value);

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);
  input.addEventListener("input", () => {
    const value = Number(input.value);
    valueLabel.textContent = format(value);
    options.onChange(value);
  });

  label.appendChild(valueLabel);
  element.appendChild(label);
  element.appendChild(input);
  return { element, input };
}

export interface ButtonGroupItem {
  key: string;
  label: string;
  onClick: () => void;
}

export interface ButtonGroupControl {
  element: HTMLElement;
  buttons: Record<string, HTMLButtonElement>;
}

export function createButtonGroup(items: ButtonGroupItem[]): ButtonGroupControl {
  const element = document.createElement("div");
  element.className = "control-section--row";

  const buttons: Record<string, HTMLButtonElement> = {};
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-button";
    button.textContent = item.label;
    button.addEventListener("click", item.onClick);
    buttons[item.key] = button;
    element.appendChild(button);
  }
  return { element, buttons };
}

/** A collapsible section using native <details>/<summary> - accessible,
 *  discoverable, and needs no custom expand/collapse JS. */
export function createSection(title: string, defaultOpen: boolean, content: HTMLElement[]): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "control-panel-section";
  details.open = defaultOpen;

  const summary = document.createElement("summary");
  summary.textContent = title;
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "control-panel-section-body";
  for (const child of content) body.appendChild(child);
  details.appendChild(body);

  return details;
}

export function createSubsectionHeading(text: string): HTMLElement {
  const heading = document.createElement("div");
  heading.className = "control-subsection-heading";
  heading.textContent = text;
  return heading;
}

export function createPlaceholder(text: string): HTMLElement {
  const placeholder = document.createElement("div");
  placeholder.className = "control-placeholder";
  placeholder.textContent = text;
  return placeholder;
}
