/**
 * SafeGirl Backend — Query Processing Orchestrator
 *
 * Coordinates the main SafeGirl query-processing pipeline.
 *
 * The Safety Net and Intent Classifier are dispatched concurrently,
 * reflecting the parallel processing defined in the UML sequence
 * and activity diagrams. If the Safety Net flags the query, the
 * retrieval and generation stages are skipped and referral guidance
 * is returned instead.
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

const { checkSafety } = require("./safetyNet");
const { createClassifierClient } = require("./classifierClient");
const { generate } = require("./generationModule");
const { orchestrate } = require("./responseOrchestrator");

/**
 * Build a query handler around a classifier client.
 *
 * The client is injectable so tests can replace ml_service.
 *
 * @param {object} deps
 * @param {object} deps.classifierClient - Object with classify(text) and
 *        retrieve(text, classification), as createClassifierClient returns.
 * @returns {(queryText: string) => Promise<object>} Query handler.
 */
function createHandleQuery({ classifierClient }) {
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

    /**
     * Parallel dispatch:
     * SafetyNet and the classifier run independently and concurrently.
     *
     * Promise.resolve() allows the current synchronous scaffold
     * implementations to work alongside future asynchronous versions.
     */
    const [safety, classification] = await Promise.all([
      Promise.resolve(checkSafety(queryText)),
      Promise.resolve(classifierClient.classify(queryText)),
    ]);

    let generation = null;
    let retrievedEntry = null;

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
      retrievedEntry = await classifierClient.retrieve(
        queryText,
        classification,
      );
      generation = generate(retrievedEntry);
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
    });
  };
}

// Created once at module load, as the keyword classifier was before.
const handleQuery = createHandleQuery({
  classifierClient: createClassifierClient(),
});

module.exports = { handleQuery, createHandleQuery };
