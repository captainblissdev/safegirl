/**
 * SafeGirl Response Orchestrator
 *
 * Combines the independent Safety Net result with the classification
 * and generation results into a single response returned to the client.
 *
 * The Safety Net takes precedence over the normal response pipeline:
 *
 * 1. Safety flagged:
 *    Return referral/escalation guidance and do not use generated content.
 *
 * 2. Safety clear:
 *    Return the retrieved/generated answer together with its category
 *    and supporting metadata.
 *
 * This behaviour corresponds to the normal-query and safety/GBV
 * sequence diagrams in Chapter 4, Sections 4.3.3–4.3.4.
 *
 * The referral content is currently a placeholder pending authoritative
 * sourcing and review.
 *
 * A clear query never returns a null message: when no knowledge-base
 * answer is available for any reason (unknown or empty category, missing
 * KB file, blank answer), NO_ANSWER_MESSAGE is returned instead.
 */

/**
 * Returned when the Safety Net is clear but no knowledge-base answer is
 * available. It makes no health claims of its own.
 */
const NO_ANSWER_MESSAGE =
  "I don't have a specific answer for that yet. A health worker at a " +
  "youth-friendly clinic, or another adult you trust, can help you with " +
  "this question.";

/**
 * Combine Safety Net, classification, and generation results.
 *
 * @param {object} params
 * @param {object} params.safety - Result from the Safety Net.
 * @param {object} params.classification - Result from the classifier.
 * @param {object|null} params.generation - Generation result, or null
 *        when the normal generation pipeline was skipped.
 * @returns {object} Final response payload.
 */
function orchestrate({ safety, classification, generation }) {
  /**
   * Safety takes precedence over the normal answer-generation path.
   *
   * A flagged query receives referral/escalation guidance rather than
   * a generated health response.
   */
  if (safety.flagged) {
    return {
      outcome: "referral",
      message:
        "We hear you. We want to help. Please reach out to a trusted " +
        "adult, health worker, or local support service as soon as you " +
        "can. [Referral/escalation content pending authoritative " +
        "sourcing — R1/R2/R8, not yet finalized.]",

      // The classifier is still dispatched independently.
      classificationSkipped: false,

      // The generation pipeline is not continued after a safety flag.
      generationInvoked: false,
    };
  }

  const category = classification ? classification.label : null;

  /**
   * No-answer path:
   * The Safety Net is clear but there is no knowledge-base answer to
   * return. The outcome stays "grounded_answer" because that is the only
   * non-referral outcome the interface handles; answerFound tells the
   * two cases apart.
   */
  if (!generation || !generation.text) {
    return {
      outcome: "grounded_answer",
      message: NO_ANSWER_MESSAGE,
      category,
      answerFound: false,
      generated: false,
      note:
        (generation && generation.note) ||
        "No knowledge-base answer was available for this query.",
      source: null,
      safetyNotes: null,
      generationInvoked: true,
    };
  }

  /**
   * Normal path:
   * The Safety Net is clear, so the retrieved/generation result can
   * be returned to the user.
   */
  return {
    outcome: "grounded_answer",
    message: generation.text,
    category,
    answerFound: true,
    generated: generation.generated,
    note: generation.note,
    source: generation.source,
    safetyNotes: generation.safetyNotes,
    generationInvoked: true,
  };
}

module.exports = { orchestrate, NO_ANSWER_MESSAGE };
