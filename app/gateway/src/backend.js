/**
 * SafeGirl Backend — Query Processing Orchestrator
 *
 * Coordinates the main SafeGirl query-processing pipeline.
 *
 * Order:
 * 1. Safety Net. It runs first and synchronously; the parallel safety
 *    and classification design in the proposal was replaced by this
 *    Safety-Net-first order.
 * 2. Help-seeking rule: a generic help request that names no topic
 *    ("Where can I get help?") gets signposting, without classification
 *    or retrieval, so ml_service is not called. It never overrides the
 *    Safety Net: a flagged query always gets the referral.
 * 3. Held-topic rule: a query on a topic the knowledge base does not
 *    cover safely yet (emergency contraception and other situations
 *    after sex or a contraception failure; pregnancy decisions) gets a
 *    neutral signpost, without classification or retrieval (see
 *    heldTopics.js). It never overrides the Safety Net or the help rule.
 * 4. Vague-query rule: a short query (at most three content words) that
 *    names no health term ("Am I okay?", "I'm worried") gets a
 *    clarifying question, without classification or retrieval (see
 *    vagueQuery.js). Like the help rule, it never overrides the Safety
 *    Net, and a help request is signposted before it is consulted.
 * 5. For other clear queries: Intent Classifier, then retrieval and
 *    generation.
 * 6. Relevance gate (on unless RELEVANCE_GATE is "false"; see
 *    relevanceGate.js): after retrieval, a clear query whose top-1
 *    unscoped retrieval score is below the threshold gets the standard
 *    no-answer message instead of the retrieved entry. Flagged queries
 *    and help signposting never reach it.
 *
 * A flagged query gets referral guidance without classification,
 * retrieval or generation. The classifier is skipped because the Safety
 * Net never reads its result, so running it would only make the
 * referral wait on ml_service.
 *
 * Classification and retrieval go through the classifier client: the
 * DistilBERT classifier and semantic retrieval in ml_service, with the
 * keyword classifier and local keyword retrieval as fallbacks.
 */

const { checkSafety: defaultCheckSafety } = require("./safetyNet");
const { isGenericHelpRequest } = require("./helpSignposting");
const { isVagueQuery } = require("./vagueQuery");
const { matchHeldTopic } = require("./heldTopics");
const { createClassifierClient } = require("./classifierClient");
const { generate } = require("./generationModule");
const {
  clarify,
  hold,
  orchestrate,
  signpost,
} = require("./responseOrchestrator");
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
 * @param {Function} [deps.matchHeld] - Held-topic rule: returns a group or null.
 * @param {Function} [deps.isVague] - Vague-query rule.
 * @param {boolean} [deps.relevanceGate] - Whether the relevance gate is
 *        on; defaults to the RELEVANCE_GATE environment variable.
 * @returns {(queryText: string) => Promise<object>} Query handler.
 */
function createHandleQuery({
  classifierClient,
  checkSafety = defaultCheckSafety,
  isHelpRequest = isGenericHelpRequest,
  matchHeld = matchHeldTopic,
  isVague = isVagueQuery,
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

    // 3. Held topic: a neutral signpost, without classifying.
    const heldGroup = safety.flagged ? null : matchHeld(queryText);
    if (heldGroup) {
      return hold(heldGroup);
    }

    // 4. Vague query: ask what the user means, without classifying.
    if (!safety.flagged && isVague(queryText)) {
      return clarify();
    }

    let classification = null;
    let generation = null;
    let retrievedEntry = null;
    let retrievalScope = null;
    let gateResult;

    /**
     * 5. Clear-query path:
     * Only queries that pass the Safety Net are classified, then go on
     * to retrieval and response generation.
     *
     * Flagged queries therefore skip the classifier and the rest of the
     * pipeline: their text is not sent to ml_service, and the referral
     * never waits on it.
     */
    if (!safety.flagged) {
      classification = await Promise.resolve(
        classifierClient.classify(queryText),
      );

      if (!relevanceGate) {
        ({ entry: retrievedEntry, retrievalScope } =
          await classifierClient.retrieve(queryText, classification));
        generation = generate(retrievedEntry);
      } else {
        // 6. Relevance gate, after retrieval: abstain with the standard
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
     * When safety.flagged is true, classification and generation remain
     * null and the orchestrator is responsible for returning the
     * appropriate referral or escalation guidance.
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
