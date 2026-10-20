import { SUPPORT_SECTIONS } from "../offline/helpContent";

/**
 * Tap-to-call links. Always pass a constant from offline/helpContent.ts
 * (GBV_HELPLINE, CHILDLINE_KENYA, EMERGENCY_NUMBERS); never type a
 * number here or in a component.
 */
export function telHref(number: string): string {
  return `tel:${number}`;
}

/**
 * The accessible name of a phone link whose visible text is only the
 * number (or "Call" and the number): the visible text first, then the
 * service's label from SUPPORT_SECTIONS, so a screen reader says who the
 * number calls ("1195, GBV helpline"). No new wording: the label is the
 * constant's own.
 */
export function telName(number: string, visible: string = number): string {
  const contact = SUPPORT_SECTIONS.flatMap((section) => section.contacts).find(
    (item) => item.numbers.includes(number),
  );
  return contact ? `${visible}, ${contact.label}` : visible;
}
