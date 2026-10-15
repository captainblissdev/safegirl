/**
 * SafeGirl Backend — Query Processing Orchestrator
 *
 * Coordinates the main SafeGirl query-processing pipeline.
 *
 * Order:
 * 1. Safety Net. It is synchronous, so it always completed before the
 *    classifier started, even when both were dispatched together.
 * 2. Help-seeking rule: a generic help request that names no topic
 *    ("Where can I get help?") gets signposting, without classification
 *    or retrieval, so ml_service is not called. It never overrides the
 *    Safety Net: a flagged query always gets the referral.
 * 3. Intent Classifier, then (for clear queries) retrieval and
 *    generation. If the Safety Net flags the query, the retrieval and
 *    generation stages are skipped and referral guidance is returned.
 * 4. Relevance gate (only when RELEVANCE_GATE is "true"; see
 *    relevanceGate.js): after retrieval, a clear query whose top-1
 *    unscoped retrieval score is below the threshold gets the standard
 *    no-answer message instead of the retrieved entry. Flagged queries
 *    and help signposting never reach it.
 *
 * The classifier still runs when a query is flagged. This preserves
 * the independence of the safety and classification components while
 * preventing the flagged query from continuing through the normal
 * response-generation pipeline.
 *
 * Classification and retrieval go through the classifier client: the
 * DistilBERT classifier and semantic retrieval in ml_service, with the
 * keyword classifier and local keyword retrieval as fallbacks.
 */

const { checkSafety: defaultCheckSafety } = require("./safetyNet");
const { isGenericHelpRequest } = require("./helpSignposting");
const { createClassifierClient } = require("./classifierClient");
const { generate } = require("./generationModule");
const { orchestrate, signpost } = require("./responseOrchestrator");
const {
  isRelevanceGateEnabled,
  relevanceGateDecision,
} = require("./relevanceGate");

// Note returned when the relevance gate abstains. The user sees the
// standard no-answer help message, not this note.
const RELEVANCE_GATE_NOTE =
  "No knowledge-base entry was relevant enough to answer this query.";

/**
 * Build a query handler around a classifier client.
 *
 * Dependencies are injectable so tests can replace ml_service and check
 * the order of the Safety Net and the help rule.
 *
 * @param {object} deps
 * @param {object} deps.classifierClient - Object with classify(text) and
 *        retrieve(text, classification), as createClassifierClient returns.
 * @param {Function} [deps.checkSafety] - Safety Net check.
 * @param {Function} [deps.isHelpRequest] - Generic help-request rule.
 * @param {boolean} [deps.relevanceGate] - Whether the relevance gate is
 *        on; defaults to the RELEVANCE_GATE environment variable.
 * @returns {(queryText: string) => Promise<object>} Query handler.
 */
function createHandleQuery({
  classifierClient,
  checkSafety = defaultCheckSafety,
  isHelpRequest = isGenericHelpRequest,
  relevanceGate = isRelevanceGateEnabled(),
}) {
  /**
   * Process a SafeGirl user query.
   *
   * @param {string} queryText - User's SRH question.
   * @returns {Promise<object>} Final response produced by the orchestrator.
   */
  return async function handleQuery(queryText) {
    // Validate the query before entering the processing pipeline.
    if (typeof queryText !== "string" || queryText.trim().length === 0) {
      throw new TypeError("queryText must be a non-empty string");
    }

    // 1. Safety Net first.
    const safety = await Promise.resolve(checkSafety(queryText));

    // 2. Generic help request: signpost without classifying or retrieving.
    if (!safety.flagged && isHelpRequest(queryText)) {
      return signpost();
    }

    // 3. Classification (also for flagged queries, as before).
    const classification = await Promise.resolve(
      classifierClient.classify(queryText),
    );

    let generation = null;
    let retrievedEntry = null;
    let retrievalScope = null;
    let gateResult;

    /**
     * Clear-query path:
     * Only queries that pass the Safety Net proceed to retrieval
     * and response generation.
     *
     * Flagged queries therefore short-circuit the normal pipeline,
     * preventing their content from being sent to the generation
     * stage.
     */
    if (!safety.flagged) {
      if (!relevanceGate) {
        ({ entry: retrievedEntry, retrievalScope } =
          await classifierClient.retrieve(queryText, classification));
        generation = generate(retrievedEntry);
      } else {
        // 4. Relevance gate, after retrieval: abstain with the standard
        // no-answer message when the top-1 unscoped score is too low.
        let unscopedScore;
        ({
          entry: retrievedEntry,
          retrievalScope,
          unscopedScore,
        } = await classifierClient.retrieve(queryText, classification, {
          withUnscopedScore: true,
        }));
        gateResult = retrievedEntry
          ? relevanceGateDecision(unscopedScore)
          : "not_applied";

        if (gateResult === "abstained") {
          retrievedEntry = null;
          generation = { text: null, note: RELEVANCE_GATE_NOTE };
        } else {
          generation = generate(retrievedEntry);
        }
      }
    }

    /**
     * Response orchestration combines the safety result,
     * classification result, and generation result.
     *
     * When safety.flagged is true, generation remains null and
     * the orchestrator is responsible for returning the appropriate
     * referral or escalation guidance.
     */
    return orchestrate({
      safety,
      classification,
      generation,
      retrievedEntry,
      retrievalScope,
      relevanceGate: gateResult,
    });
  };
}

// Created once at module load, as the keyword classifier was before.
const handleQuery = createHandleQuery({
  classifierClient: createClassifierClient(),
});

module.exports = { handleQuery, createHandleQuery };
