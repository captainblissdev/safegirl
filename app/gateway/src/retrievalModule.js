/**
 * SafeGirl Retrieval Module — Interim Implementation
 *
 * Provides a simple category-scoped keyword-overlap retrieval mechanism
 * over the active knowledge-base Markdown files.
 *
 * This is NOT the final LlamaIndex + sentence-transformers semantic
 * retrieval pipeline described in Chapter 3, Section 3.7.4. It is an
 * interim implementation that allows the backend to be tested end-to-end
 * using real knowledge-base content.
 *
 * Design properties preserved from the intended architecture:
 * 1. Retrieval is restricted to the predicted SRH category.
 * 2. Only active knowledge-base content is loaded.
 * 3. Content below the "---" / HELD boundary is excluded structurally.
 * 4. GBV is not treated as a retrievable category.
 *
 * Future work:
 * - Replace keyword overlap with LlamaIndex retrieval.
 * - Add sentence-transformers embeddings.
 * - Connect retrieval to the final knowledge-base storage design.
 * - Evaluate retrieval quality independently.
 */

const fs = require("fs");
const path = require("path");

/**
 * Knowledge-base directory.
 *
 * From this module:
 * app/gateway/src/retrievalModule.js
 *          ↓
 * resources/knowledge_base/
 */
const KB_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "resources",
  "knowledge_base",
);

/**
 * The four active SRH categories supported by SafeGirl.
 *
 * GBV is deliberately excluded because safety-related queries should be
 * handled by the independent Safety Net rather than retrieved as normal
 * health information.
 */
const ACTIVE_CATEGORIES = ["contraception", "sti", "pregnancy", "general"];

/**
 * Parse active knowledge-base entries from a Markdown file.
 *
 * Content after the first "\n---\n" boundary is treated as held content
 * and is therefore never loaded into the retrievable knowledge base.
 *
 * @param {string} filePath - Path to the knowledge-base Markdown file.
 * @returns {Array<object>} Parsed active knowledge-base entries.
 */
function parseKbFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");

  // Exclude all content after the first HELD/--- boundary.
  const activeSection = raw.split(/\n---\n/)[0];

  const entries = [];

  // Each KB entry begins with a level-two Markdown heading.
  // The first block is the file title, so it is skipped.
  const blocks = activeSection.split(/\n## /).slice(1);

  for (const block of blocks) {
    const idMatch = block.match(/^(KB-\S+)/);

    if (!idMatch) {
      continue;
    }

    /**
     * Extract a labelled field from the KB entry.
     *
     * @param {string} field - Field name without Markdown formatting.
     * @returns {string|null} Extracted value or null if unavailable.
     */
    const get = (field) => {
      const match = block.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`));

      return match ? match[1].trim() : null;
    };

    entries.push({
      kbId: idMatch[1],
      intent: get("Intent"),
      question: get("User question"),
      answer: get("Answer"),
      evidenceClaim: get("Evidence/claim"),
      source: get("Source"),
      conditions: get("Conditions/limitations"),
      safetyNotes: get("Safety/referral notes"),
    });
  }

  return entries;
}

/**
 * Load the active knowledge base.
 *
 * Each active category is loaded from its corresponding Markdown file.
 * Missing files are handled by returning an empty category rather than
 * causing the entire backend to fail.
 *
 * @returns {object} Knowledge base grouped by category.
 */
function loadKnowledgeBase() {
  const kb = {};

  for (const category of ACTIVE_CATEGORIES) {
    const filePath = path.join(KB_DIR, `${category}.md`);

    kb[category] = fs.existsSync(filePath) ? parseKbFile(filePath) : [];
  }

  return kb;
}

/**
 * Tokenize text for simple keyword-overlap comparison.
 *
 * @param {string} text - Text to tokenize.
 * @returns {string[]} Lowercase word tokens.
 */
function tokenize(text) {
  return (text || "").toLowerCase().match(/[a-z']+/g) || [];
}

/**
 * Calculate the number of query tokens appearing in an entry.
 *
 * Repeated words within the KB entry are counted only once because the
 * entry tokens are stored in a Set.
 *
 * @param {string[]} queryTokens - Tokens from the user's query.
 * @param {string} entryText - Text from the KB entry.
 * @returns {number} Number of overlapping tokens.
 */
function scoreOverlap(queryTokens, entryText) {
  const entryTokens = new Set(tokenize(entryText));

  return queryTokens.filter((token) => entryTokens.has(token)).length;
}

/**
 * Retrieve the best-matching knowledge-base entry.
 *
 * Retrieval is restricted to the supplied category. If the category has
 * no active entries, null is returned.
 *
 * @param {string} category - Predicted SafeGirl SRH category.
 * @param {string} queryText - User's query.
 * @returns {object|null} Best matching KB entry or null.
 */
function retrieve(category, queryText) {
  const kb = loadKnowledgeBase();
  const entries = kb[category] || [];

  // Defensive handling for unsupported or empty categories.
  if (entries.length === 0) {
    return null;
  }

  const queryTokens = tokenize(queryText);

  let best = null;
  let bestScore = -1;

  for (const entry of entries) {
    const entryText = `${entry.question || ""} ${entry.answer || ""}`;
    const score = scoreOverlap(queryTokens, entryText);

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best;
}

module.exports = {
  loadKnowledgeBase,
  retrieve,
};
