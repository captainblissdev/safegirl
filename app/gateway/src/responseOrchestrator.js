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
 *
 * Every response carries a reply kind (one of REPLY_KINDS) and
 * matchedQuestion: the "User question" of the knowledge-base entry the
 * answer came from, or null when no entry was served.
 */

const {
  NO_ANSWER_MESSAGE,
  SIGNPOSTING_MESSAGE,
  SELF_HARM_REFERRAL_MESSAGE,
  ABUSE_REFERRAL_MESSAGE,
  HELD_TOPIC_MESSAGES,
  VAGUE_QUERY_MESSAGE,
} = require("./content/helpContent");

/**
 * What kind of reply a response is, so the interface can present each
 * one differently:
 * - "answer-scoped": a knowledge-base answer, retrieved within the
 *   classifier's predicted category (confidence at or above 0.5).
 * - "answer-unscoped": a knowledge-base answer found less surely:
 *   retrieval across all categories (confidence from 0.35 to 0.5), or
 *   local keyword retrieval after the keyword fallback, where the
 *   classifier's confidence is unknown.
 * - "abstain": no answer; the standard no-answer message.
 * - "help": a generic help request; the signposting message.
 * - "held-topic": a topic the knowledge base does not cover safely yet
 *   (heldTopics.js); a neutral signpost (outcome "held").
 * - "vague": a short query with no health term; a clarifying question
 *   (outcome "clarification").
 * - "referral": the Safety Net flagged the query.
 */
const REPLY_KINDS = Object.freeze([
  "answer-scoped",
  "answer-unscoped",
  "abstain",
  "help",
  "held-topic",
  "vague",
  "referral",
]);

/**
 * Combine Safety Net, classification, and generation results.
 *
 * category is the category of the knowledge-base entry actually served
 * (null when no entry was found). It can differ from predictedCategory,
 * the classifier's label, when low-confidence retrieval runs unscoped.
 *
 * @param {object} params
 * @param {object} params.safety - Result from the Safety Net.
 * @param {object|null} params.classification - Result from the
 *        classifier: { label, confidence, source }; null for flagged
 *        queries, which are not classified.
 * @param {object|null} params.generation - Generation result, or null
 *        when the normal generation pipeline was skipped.
 * @param {object|null} [params.retrievedEntry] - The KB entry the answer
 *        came from, or null/undefined when none was found.
 * @param {string|null} [params.retrievalScope] - How retrieval ran:
 *        "scoped", "unscoped", "abstained" or "local"; null when retrieval
 *        did not run (flagged queries).
 * @param {string} [params.relevanceGate] - The relevance gate's decision
 *        ("passed", "abstained" or "not_applied") when the gate is on;
 *        undefined, and left out of the response, when it is off.
 * @returns {object} Final response payload.
 */
function orchestrate({
  safety,
  classification,
  generation,
  retrievedEntry,
  retrievalScope,
  relevanceGate,
}) {
  // Which classifier ran, what it predicted and how retrieval ran,
  // reported on every path (all null for flagged queries).
  const classifierInfo = {
    predictedCategory: classification?.label ?? null,
    classifierSource: classification?.source ?? null,
    confidence: classification?.confidence ?? null,
    retrievalScope: retrievalScope ?? null,
    // Only when the relevance gate is on, so responses are unchanged
    // when it is off. Never set on referrals.
    ...(relevanceGate === undefined ? {} : { relevanceGate }),
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
      kind: "referral",
      matchedQuestion: null,
      // Self-harm gets its own message; everything else flagged gets the
      // violence/abuse referral.
      message:
        safety.category === "self_harm"
          ? SELF_HARM_REFERRAL_MESSAGE
          : ABUSE_REFERRAL_MESSAGE,

      // The classifier is not run on flagged queries: the Safety Net
      // never reads its result. predictedCategory, classifierSource and
      // confidence are therefore null here.
      classificationSkipped: true,

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
      kind: "abstain",
      matchedQuestion: null,
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
    kind: retrievalScope === "scoped" ? "answer-scoped" : "answer-unscoped",
    // The knowledge-base question this answer was written for, so the
    // user can see what was matched. Shown verbatim; never edited.
    matchedQuestion: retrievedEntry?.question ?? null,
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
    kind: "help",
    matchedQuestion: null,
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

/**
 * Response to a held topic (src/heldTopics.js): a neutral signpost for
 * the matched group, without classification or retrieval.
 *
 * @param {string} group - The held-topic group, "A", "B" or "C".
 * @returns {object} Final response payload.
 */
function hold(group) {
  return {
    outcome: "held",
    kind: "held-topic",
    heldTopicGroup: group,
    matchedQuestion: null,
    message: HELD_TOPIC_MESSAGES[group],
    category: null,
    answerFound: false,
    generated: false,
    note: "Held topic: a signpost returned without classification or retrieval, pending clinician-approved content.",
    source: null,
    safetyNotes: null,
    generationInvoked: false,
    predictedCategory: null,
    classifierSource: null,
    confidence: null,
    retrievalScope: "none",
  };
}

/**
 * Response to a vague query: a short query that names no health topic
 * (src/vagueQuery.js). A clarifying question, without classification or
 * retrieval, so there is no category or classifier output.
 *
 * @returns {object} Final response payload.
 */
function clarify() {
  return {
    outcome: "clarification",
    kind: "vague",
    matchedQuestion: null,
    message: VAGUE_QUERY_MESSAGE,
    category: null,
    answerFound: false,
    generated: false,
    note: "Vague query: a clarifying question returned without classification or retrieval.",
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
  ABUSE_REFERRAL_MESSAGE,
  REPLY_KINDS,
  clarify,
  hold,
  orchestrate,
  signpost,
  NO_ANSWER_MESSAGE,
  SIGNPOSTING_MESSAGE,
  HELD_TOPIC_MESSAGES,
  VAGUE_QUERY_MESSAGE,
};
