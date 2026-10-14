/**
 * Referral content for the offline pipeline.
 *
 * A copy of the referral messages and numbers in
 * app/gateway/src/content/helpContent.js, which is the source of truth,
 * so a flagged query gets the same message online and offline. The
 * parity test (app/gateway/test/offlineSafetyParity.test.js) compares
 * both messages, the numbers and the verified flag, and fails until they
 * agree. The wording is interim and has not been clinically reviewed.
 */

import type { SafetyCategory } from "./safetyNet";

/**
 * Set to true only after every number below has been confirmed with the
 * services themselves. While false, the app logs a warning at startup.
 */
export const HELP_CONTACTS_VERIFIED = false;

// UNVERIFIED: confirm before real users.
export const GBV_HELPLINE = "1195";

// UNVERIFIED: confirm before real users.
export const CHILDLINE_KENYA = "116";

// UNVERIFIED: confirm before real users. Emergency numbers, used in the
// self-harm and abuse referrals.
export const EMERGENCY_NUMBERS: readonly [string, string] = ["999", "112"];

/** Referral for self-harm or suicidal statements. */
export const SELF_HARM_REFERRAL_MESSAGE =
  "I'm really sorry you are feeling this way, and I'm glad you said " +
  "something. You deserve support right now. Please tell someone you " +
  "trust, or go to a health facility today. If you are in immediate " +
  `danger, call ${EMERGENCY_NUMBERS[0]} or ${EMERGENCY_NUMBERS[1]}.`;

/** Referral for violence, abuse, blackmail and threats. */
export const ABUSE_REFERRAL_MESSAGE =
  "I'm sorry this is happening, and it is not your fault. You deserve to " +
  "be safe. Please tell someone you trust, or go to a health facility, " +
  "where you can get care and support. If you are in danger now, call " +
  `${EMERGENCY_NUMBERS[0]} or ${EMERGENCY_NUMBERS[1]}. The GBV helpline ` +
  `${GBV_HELPLINE} and Childline Kenya ${CHILDLINE_KENYA} (for anyone ` +
  "under 18) can also help.";

/** The referral message for a Safety Net category. */
export function referralMessage(category: SafetyCategory | null): string {
  return category === "self_harm"
    ? SELF_HARM_REFERRAL_MESSAGE
    : ABUSE_REFERRAL_MESSAGE;
}

export const UNVERIFIED_CONTACTS_WARNING =
  "[content] Help contact numbers are UNVERIFIED: confirm before real users " +
  "(app/interface/src/offline/helpContent.ts)";

/**
 * Log UNVERIFIED_CONTACTS_WARNING if the numbers have not been verified.
 * Called once at app startup.
 */
export function warnIfContactsUnverified(
  logger: Pick<Console, "warn"> = console,
): void {
  if (!HELP_CONTACTS_VERIFIED) {
    logger.warn(UNVERIFIED_CONTACTS_WARNING);
  }
}
