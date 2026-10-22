/**
 * Interface text that tests check or that more than one component uses.
 */

/**
 * Where the answers come from: the one place this line is written. Used
 * on the splash, in the Help sheet and on Home. "Most", because four of
 * the 21 knowledge-base entries cite other sources (KB-P5, KB-G6, KB-G3,
 * KB-G4; docs/decision-log.md, "Splash and Help sheet").
 */
export const SOURCES_LINE =
  "Most answers come from Kenyan Ministry of Health and WHO guidance.";

/**
 * Home's ask pill placeholder: examples shown one at a time, the first
 * one always, the rest in turn every PLACEHOLDER_ROTATE_MS unless the
 * device asks for reduced motion. Each is the exact text of a
 * knowledge-base question that the system answers with its own entry
 * (checked against the knowledge base and keyword retrieval by
 * app/gateway/test/homeExamples.test.js, and live on 20 October 2026).
 * None comes from the DR-04 or demo-risk sets. KB-P1 is left out: the
 * live pipeline answers it with another entry.
 */
export const PLACEHOLDER_EXAMPLES: readonly string[] = [
  "Can STIs be cured, and can they harm me if I leave them?",
  "What can I do about period pain?",
  "Which birth control methods can a teenager use?",
  "Can I take PrEP to prevent HIV? I'm a teenager.",
  "How do I manage my period hygienically?",
  "What warning signs in pregnancy mean I should go to hospital right away?",
];

export const PLACEHOLDER_ROTATE_MS = 6000;

/** Shown above an answer that came from the offline pipeline. */
export const LIMITED_MODE_NOTICE =
  "Limited mode: I can't reach the full service right now, so this answer is general.";

/**
 * Under every knowledge-base answer, after its source: the one place this
 * line is written.
 */
export const ANSWER_DISCLAIMER =
  "General information, not a diagnosis. A nurse or clinic can test and treat you.";

/**
 * The label in each reply's pill. The held-topic and support labels are
 * interface wording (the gateway sends no label); the reply text itself
 * always comes from the gateway or the offline copy, unchanged.
 */
export const REPLY_PILLS = {
  clarify: "Tell me a bit more",
  held: "Talk to a nurse",
  help: "Support",
  referral: "We hear you",
  noAnswer: "No answer yet",
  person: "Let's find a person",
} as const;

/**
 * The Talk to a person screen's message (loopLimit.ts), shown instead of
 * a vague or abstain reply once the loop limit is reached.
 */
export const PERSON_MESSAGE =
  "I'm having trouble finding what you need. A nurse or counsellor at a health facility can help, and you do not have to give a reason.";

/** Under the clarifying question, for anything outside the four topics. */
export const CLARIFY_FALLBACK =
  "Something else? A nurse or counsellor at a health facility can help, and you do not have to give a reason.";

/** Under the no-answer reply's topic pills. */
export const NO_ANSWER_RETRY =
  "You can also try the question again in different words.";

/**
 * The footer line on a reply that already shows the GBV call button
 * (held topic, help, referral): it points to the button instead of
 * repeating the number beside it.
 */
export const DANGER_LINE_CALL_ABOVE =
  "In danger? Use the GBV helpline call button above. It is free and open 24 hours.";

/** Home's hero pill (step 4b). */
export const HERO_PILL = "Private and anonymous";

/** The visible label of Home's question field (step 4b). */
export const ASK_LABEL = "Type your question";

/** The accessible name of Home's send button (step 4b). */
export const ASK_SEND_NAME = "Get an answer";

/** Under the Topic list's title (step 6b). */
export const TOPIC_LIST_HINT = "Tap a question to read the answer.";

/** Under the Topic list's questions (step 6b). */
export const TOPIC_LIST_FOOTNOTE =
  "More questions are being reviewed with doctors and nurses before they are added.";

/** The Topic list's ask bar placeholder (step 6b). */
export const TOPIC_LIST_PLACEHOLDER = "Or type your own question";
