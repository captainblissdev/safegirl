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
