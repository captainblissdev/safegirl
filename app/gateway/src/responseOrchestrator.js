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
 */

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

  /**
   * Normal path:
   * The Safety Net is clear, so the retrieved/generation result can
   * be returned to the user.
   */
  return {
    outcome: "grounded_answer",
    message: generation ? generation.text : null,
    category: classification ? classification.label : null,
    generated: generation ? generation.generated : false,
    note: generation ? generation.note : null,
    source: generation ? generation.source : null,
    safetyNotes: generation ? generation.safetyNotes : null,
    generationInvoked: true,
  };
}

module.exports = { orchestrate };