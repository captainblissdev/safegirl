/**
 * Tap-to-call links. Always pass a constant from offline/helpContent.ts
 * (GBV_HELPLINE, CHILDLINE_KENYA, EMERGENCY_NUMBERS); never type a
 * number here or in a component.
 */
export function telHref(number: string): string {
  return `tel:${number}`;
}
