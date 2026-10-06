/**
 * Help and signposting content returned by the gateway.
 *
 * All help text and contact numbers live in this one file. The wording is
 * interim and has not been clinically reviewed.
 */

/**
 * Set to true only after both numbers below have been confirmed with the
 * services themselves. While false, the gateway logs a warning at startup.
 */
const HELP_CONTACTS_VERIFIED = false;

// UNVERIFIED: confirm before real users.
const GBV_HELPLINE = "1195";

// UNVERIFIED: confirm before real users.
const CHILDLINE_KENYA = "116";

/** Where to get help, shared by the signposting and no-answer messages. */
const HELP_GUIDANCE =
  "A nurse or counsellor at a health facility can help, and you do not " +
  "have to give a reason for asking. If you are in danger or someone has " +
  `hurt you, call the GBV helpline ${GBV_HELPLINE}. Childline Kenya, ` +
  `${CHILDLINE_KENYA}, is free for anyone under 18.`;

/** Reply to a generic help request that names no topic. */
const SIGNPOSTING_MESSAGE = `I don't have information on that yet. ${HELP_GUIDANCE}`;

/** Reply when no knowledge-base answer is available (including abstained). */
const NO_ANSWER_MESSAGE = HELP_GUIDANCE;

const UNVERIFIED_CONTACTS_WARNING =
  "[content] Help contact numbers are UNVERIFIED: confirm before real users " +
  "(app/gateway/src/content/helpContent.js)";

/**
 * Log UNVERIFIED_CONTACTS_WARNING if the numbers have not been verified.
 * Called once at startup.
 */
function warnIfContactsUnverified(logger = console) {
  if (!HELP_CONTACTS_VERIFIED) {
    logger.warn(UNVERIFIED_CONTACTS_WARNING);
  }
}

module.exports = {
  HELP_CONTACTS_VERIFIED,
  GBV_HELPLINE,
  CHILDLINE_KENYA,
  SIGNPOSTING_MESSAGE,
  NO_ANSWER_MESSAGE,
  UNVERIFIED_CONTACTS_WARNING,
  warnIfContactsUnverified,
};
