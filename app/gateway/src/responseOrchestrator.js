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

const {
  NO_ANSWER_MESSAGE,
  SIGNPOSTING_MESSAGE,
} = require("./content/helpContent");

/**
 * Combine Safety Net, classification, and generation results.
 *
 * category is the category of the knowledge-base entry actually served
 * (null when no entry was found). It can differ from predictedCategory,
 * the classifier's label, when low-confidence retrieval runs unscoped.
 *
 * @param {object} params
 * @param {object} params.safety - Result from the Safety Net.
 * @param {object} params.classification - Result from the classifier:
 *        { label, confidence, source }.
 * @param {object|null} params.generation - Generation result, or null
 *        when the normal generation pipeline was skipped.
 * @param {object|null} [params.retrievedEntry] - The KB entry the answer
 *        came from, or null/undefined when none was found.
 * @param {string|null} [params.retrievalScope] - How retrieval ran:
 *        "scoped", "unscoped", "abstained" or "local"; null when retrieval
 *        did not run (flagged queries).
 * @returns {object} Final response payload.
 */
function orchestrate({
  safety,
  classification,
  generation,
  retrievedEntry,
  retrievalScope,
}) {
  // Which classifier ran, what it predicted and how retrieval ran,
  // reported on every path.
  const classifierInfo = {
    predictedCategory: classification?.label ?? null,
    classifierSource: classification?.source ?? null,
    confidence: classification?.confidence ?? null,
    retrievalScope: retrievalScope ?? null,
  };

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
      ...classifierInfo,
    };
  }

  const category = retrievedEntry?.category ?? null;

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
      ...classifierInfo,
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
    ...classifierInfo,
  };
}

/**
 * Response to a generic help request that names no topic. Classification
 * and retrieval did not run, so there is no category or classifier output.
 *
 * @returns {object} Final response payload.
 */
function signpost() {
  return {
    outcome: "signposting",
    message: SIGNPOSTING_MESSAGE,
    category: null,
    answerFound: false,
    generated: false,
    note: "Generic help request: help information returned without classification or retrieval.",
    source: null,
    safetyNotes: null,
    generationInvoked: false,
    predictedCategory: null,
    classifierSource: null,
    confidence: null,
    retrievalScope: "none",
  };
}

module.exports = {
  orchestrate,
  signpost,
  NO_ANSWER_MESSAGE,
  SIGNPOSTING_MESSAGE,
};
