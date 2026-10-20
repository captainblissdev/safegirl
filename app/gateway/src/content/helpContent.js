/**
 * Help and signposting content returned by the gateway.
 *
 * All help text and contact numbers live in this one file. The wording is
 * interim and has not been clinically reviewed.
 */

/**
 * Set to true only after every number below has been confirmed with the
 * services themselves. While false, the gateway logs a warning at startup.
 */
const HELP_CONTACTS_VERIFIED = false;

// UNVERIFIED: confirm before real users.
const GBV_HELPLINE = "1195";

// UNVERIFIED: confirm before real users.
const CHILDLINE_KENYA = "116";

// UNVERIFIED: confirm before real users. Emergency numbers, used in the
// self-harm and abuse referrals.
const EMERGENCY_NUMBERS = ["999", "112"];

/** Where to get help, shared by the signposting and no-answer messages. */
const HELP_GUIDANCE =
  "A nurse or counsellor at a health facility can help, and you do not " +
  "have to give a reason for asking. If you are in danger or someone has " +
  `hurt you, call the GBV helpline ${GBV_HELPLINE}. Childline Kenya, ` +
  `${CHILDLINE_KENYA}, is free for anyone under 18.`;

/** Reply to a generic help request that names no topic. */
const SIGNPOSTING_MESSAGE = `You're not alone. These people can help right now. ${HELP_GUIDANCE}`;

/** Reply when no knowledge-base answer is available (including abstained). */
const NO_ANSWER_MESSAGE = `I couldn't find a good answer to that. ${HELP_GUIDANCE}`;

/**
 * Replies to a held topic (heldTopics.js), by group. Provisional wording,
 * pending clinician sign-off.
 */
const HELD_TOPIC_MESSAGES = Object.freeze({
  // A: after sex or contraception failure.
  A:
    "This is an important question, and I can't answer it safely here yet. " +
    "A nurse, a pharmacist or a clinic can help, and you do not have to " +
    "give a reason. If something happened recently, do not wait: some " +
    "options work best soon after sex. If you are in danger or someone " +
    `has hurt you, call the GBV helpline ${GBV_HELPLINE}. Childline Kenya, ` +
    `${CHILDLINE_KENYA}, is free for anyone under 18.`,
  // B: pregnancy decisions.
  B:
    "This is an important question, and I can't answer it safely here yet. " +
    "A nurse or counsellor can talk it through with you privately and " +
    "without judgement, and you do not have to give a reason. If you are " +
    "in danger or someone has hurt you, call the GBV helpline " +
    `${GBV_HELPLINE}. Childline Kenya, ${CHILDLINE_KENYA}, is free for ` +
    "anyone under 18.",
  // C: possible pregnancy and testing.
  C:
    "A late period can have many causes, including pregnancy, so it is " +
    "worth checking. A pharmacist or clinic can help you do a pregnancy " +
    "test, and a nurse can talk it through with you privately and without " +
    "judgement. You do not have to give a reason. If you have heavy " +
    "bleeding or severe pain, go to a health facility straight away.",
});

/** Reply to a short query that names no health topic (vagueQuery.js). */
const VAGUE_QUERY_MESSAGE =
  "I'm not sure what you mean. Is your question about periods, pregnancy, contraception or STIs?";

/**
 * Referral for self-harm or suicidal statements (Safety Net category
 * "self_harm"). Interim wording, not clinically reviewed.
 */
const SELF_HARM_REFERRAL_MESSAGE =
  "I'm really sorry you are feeling this way, and I'm glad you said " +
  "something. You deserve support right now. Please tell someone you " +
  "trust, or go to a health facility today. If you are in immediate " +
  `danger, call ${EMERGENCY_NUMBERS[0]} or ${EMERGENCY_NUMBERS[1]}.`;

/**
 * Referral for violence, abuse, blackmail and threats (Safety Net
 * category "abuse"). Interim wording, not clinically reviewed.
 */
const ABUSE_REFERRAL_MESSAGE =
  "I'm sorry this is happening, and it is not your fault. You deserve to " +
  "be safe. Please tell someone you trust, or go to a health facility, " +
  "where you can get care and support. If you are in danger now, call " +
  `${EMERGENCY_NUMBERS[0]} or ${EMERGENCY_NUMBERS[1]}. The GBV helpline ` +
  `${GBV_HELPLINE} and Childline Kenya ${CHILDLINE_KENYA} (for anyone ` +
  "under 18) can also help.";

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
  EMERGENCY_NUMBERS,
  HELP_GUIDANCE,
  SIGNPOSTING_MESSAGE,
  SELF_HARM_REFERRAL_MESSAGE,
  ABUSE_REFERRAL_MESSAGE,
  NO_ANSWER_MESSAGE,
  HELD_TOPIC_MESSAGES,
  VAGUE_QUERY_MESSAGE,
  UNVERIFIED_CONTACTS_WARNING,
  warnIfContactsUnverified,
};
