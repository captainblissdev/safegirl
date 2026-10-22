/**
 * Referral and help content for the offline pipeline.
 *
 * A copy of the messages and numbers in
 * app/gateway/src/content/helpContent.js, which is the source of truth,
 * so a query gets the same message online and offline. The parity test
 * (app/gateway/test/offlineSafetyParity.test.js) compares the messages,
 * the numbers and the verified flag, and fails until they agree. The
 * wording is interim and has not been clinically reviewed.
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

/** Where to get help, shared by the signposting and no-answer messages. */
export const HELP_GUIDANCE =
  "A nurse or counsellor at a health facility can help, and you do not " +
  "have to give a reason for asking. If you are in danger or someone has " +
  `hurt you, call the GBV helpline ${GBV_HELPLINE}. Childline Kenya, ` +
  `${CHILDLINE_KENYA}, is a free 24-hour helpline for children.`;

/** Reply to a generic help request that names no topic. */
export const SIGNPOSTING_MESSAGE = `You're not alone. These people can help right now. ${HELP_GUIDANCE}`;

/**
 * Replies to a held topic (queryRules.ts), by group. Provisional wording,
 * pending clinician sign-off.
 */
export const HELD_TOPIC_MESSAGES: Readonly<Record<"A" | "B" | "C", string>> = {
  // A: after sex or contraception failure.
  A:
    "This is an important question, and I can't answer it safely here yet. " +
    "A nurse, a pharmacist or a clinic can help, and you do not have to " +
    "give a reason. If something happened recently, do not wait: some " +
    "options work best soon after sex. If you are in danger or someone " +
    `has hurt you, call the GBV helpline ${GBV_HELPLINE}. Childline Kenya, ` +
    `${CHILDLINE_KENYA}, is a free 24-hour helpline for children.`,
  // B: pregnancy decisions.
  B:
    "This is an important question, and I can't answer it safely here yet. " +
    "A nurse or counsellor can talk it through with you privately and " +
    "without judgement, and you do not have to give a reason. If you are " +
    "in danger or someone has hurt you, call the GBV helpline " +
    `${GBV_HELPLINE}. Childline Kenya, ${CHILDLINE_KENYA}, is a free ` +
    "24-hour helpline for children.",
  // C: possible pregnancy and testing.
  C:
    "A late period can have many causes, including pregnancy, so it is " +
    "worth checking. A pharmacist or clinic can help you do a pregnancy " +
    "test, and a nurse can talk it through with you privately and without " +
    "judgement. You do not have to give a reason. If you have heavy " +
    "bleeding or severe pain, go to a health facility straight away.",
};

/** Reply to a short query that names no health topic (queryRules.ts). */
export const VAGUE_QUERY_MESSAGE =
  "I'm not sure what you mean. Is your question about periods, pregnancy, contraception or STIs?";

/** Reply when no answer is available. */
export const NO_ANSWER_MESSAGE = `I couldn't find a good answer to that. ${HELP_GUIDANCE}`;

/** One way to get help, shown in the "Need help now?" panel. */
export interface SupportContact {
  label: string;
  /** Numbers to call; empty for advice with no number. */
  numbers: readonly string[];
  note: string;
}

export interface SupportSection {
  title: string;
  contacts: readonly SupportContact[];
}

/**
 * The standing help panel's content, in the wireframe's order. Built from
 * the same numbers as the referral messages above, so the panel and the
 * referrals can never disagree. Nothing here says the numbers are
 * verified (see HELP_CONTACTS_VERIFIED).
 */
export const SUPPORT_SECTIONS: readonly SupportSection[] = [
  {
    title: "Local health services",
    contacts: [
      {
        label: "Go to a health facility",
        numbers: [],
        note: "A clinic or hospital can give you care and support.",
      },
    ],
  },
  {
    title: "Confidential helplines",
    contacts: [
      {
        label: "GBV helpline",
        numbers: [GBV_HELPLINE],
        note: "For violence or abuse.",
      },
      {
        label: "Childline Kenya",
        numbers: [CHILDLINE_KENYA],
        note: "Free, 24 hours, for children.",
      },
    ],
  },
  {
    title: "Emergency guidance",
    contacts: [
      {
        label: "Emergency",
        numbers: EMERGENCY_NUMBERS,
        note: "If you are in danger now.",
      },
    ],
  },
];

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
