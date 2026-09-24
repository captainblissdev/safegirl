/**
 * SafeGirl Generation Module — Interim Stub
 *
 * Provides the interface for the response-generation stage of the
 * SafeGirl pipeline.
 *
 * The final implementation will construct a grounded prompt from
 * retrieved knowledge-base evidence and send it to the Gemini API.
 * That integration has not yet been implemented.
 *
 * For the current scaffold, the retrieved KB answer is returned
 * directly. This allows the ResponseOrchestrator and the rest of
 * the backend pipeline to be tested without pretending that an
 * LLM-generated response already exists.
 *
 * Future work:
 * - Construct a grounded generation prompt.
 * - Integrate the approved generation API.
 * - Pass retrieved evidence and relevant limitations to the model.
 * - Implement generation error handling and response validation.
 */

function generate(retrievedEntry) {
  /**
   * No retrieval result means there is no evidence from which to
   * construct a grounded response.
   */
  if (!retrievedEntry) {
    return {
      generated: false,
      text: null,
      note: "No matching knowledge-base entry found for this category.",
    };
  }

  /**
   * Interim behaviour:
   * Return the KB answer directly rather than calling a generative
   * model. The generated flag remains false so downstream components
   * can distinguish this from a real generated response.
   */
  return {
    generated: false,
    text: retrievedEntry.answer || null,
    note:
      "STUB: this is the retrieved KB entry's answer verbatim, " +
      "not a Gemini-generated response. Real generation not yet implemented.",
    source: retrievedEntry.source || null,
    safetyNotes: retrievedEntry.safetyNotes || null,
  };
}

module.exports = { generate };
