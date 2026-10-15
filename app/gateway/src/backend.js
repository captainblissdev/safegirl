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
 * 3. For clear queries only: Intent Classifier, then retrieval and
 *    generation.
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
const { createClassifierClient } = require("./classifierClient");
const { generate } = require("./generationModule");
const { orchestrate, signpost } = require("./responseOrchestrator");

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
 * @returns {(queryText: string) => Promise<object>} Query handler.
 */
function createHandleQuery({
  classifierClient,
  checkSafety = defaultCheckSafety,
  isHelpRequest = isGenericHelpRequest,
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

    let classification = null;
    let generation = null;
    let retrievedEntry = null;
    let retrievalScope = null;

    /**
     * 3. Clear-query path:
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
      ({ entry: retrievedEntry, retrievalScope } =
        await classifierClient.retrieve(queryText, classification));
      generation = generate(retrievedEntry);
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
    });
  };
}

// Created once at module load, as the keyword classifier was before.
const handleQuery = createHandleQuery({
  classifierClient: createClassifierClient(),
});

module.exports = { handleQuery, createHandleQuery };
