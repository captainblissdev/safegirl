/**
 * Focus trap for modal sheets: Tab and Shift+Tab cycle through the
 * sheet's own controls and never reach the page behind it.
 */

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where focus goes on Tab (or Shift+Tab, backwards) from the control at
 * `current` among `count` controls. A position of -1 (focus outside the
 * controls, for example on the sheet itself) goes to the first control,
 * or to the last on Shift+Tab. Returns -1 when there is nothing to focus.
 */
export function nextFocusIndex(
  current: number,
  count: number,
  backwards: boolean,
): number {
  if (count === 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}

/**
 * Keydown handler for a sheet: keeps Tab inside `container`. Returns true
 * when it moved focus itself.
 */
export function trapTab(event: KeyboardEvent, container: HTMLElement): boolean {
  if (event.key !== "Tab") return false;
  const controls = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  const active = container.ownerDocument.activeElement;
  const index = controls.findIndex((control) => control === active);
  const next = nextFocusIndex(index, controls.length, event.shiftKey);
  event.preventDefault();
  if (next >= 0) controls[next].focus();
  return true;
}
