/**
 * Topic-list taps.
 *
 * When a user taps a question in the Topic list, the interface sends the
 * id of the knowledge-base entry the question belongs to, and the gateway
 * returns that entry as it is. No Safety Net, classifier, retrieval or
 * relevance gate runs: the question is the entry's own, so there is
 * nothing to classify or match (docs/decision-log.md, "Topic taps by
 * entry id").
 *
 * Only served (approved) entries can be returned. getEntryById() sees the
 * served knowledge base only, so a pending, held or unknown id gets
 * nothing. Free-text questions are unchanged: they go through
 * handleQuery() and the full pipeline.
 */

const { getEntryById } = require("./retrievalModule");
const { generate } = require("./generationModule");
const { direct } = require("./responseOrchestrator");

/** The shape of a knowledge-base entry id (KB-C3, KB-S16, ...). */
const ENTRY_ID = /^KB-[A-Z]\d+$/;

/** True when value looks like a knowledge-base entry id. */
function isEntryId(value) {
  return typeof value === "string" && ENTRY_ID.test(value);
}

/**
 * The response for a tapped Topic-list entry.
 *
 * @param {string} id - Knowledge-base entry id.
 * @returns {object|null} The answer response, or null when the id is not
 *          a served entry.
 */
function answerEntry(id) {
  if (!isEntryId(id)) {
    return null;
  }
  const entry = getEntryById(id);
  return entry ? direct(entry, generate(entry)) : null;
}

module.exports = { answerEntry, isEntryId };
