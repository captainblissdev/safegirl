/**
 * SafeGirl Safety Net
 *
 * Provides independent, rule-based detection of distress, gender-based
 * violence (GBV), and crisis-related language.
 *
 * SafetyNet operates independently from the Intent Classifier and is
 * dispatched in parallel with it. Its result can short-circuit the
 * normal retrieval and generation pipeline when safety-related language
 * is detected.
 *
 * The rule-based approach is intentionally deterministic and
 * interpretable: a flagged query can be traced to the keyword(s)
 * that triggered the safety check.
 */

/**
 * Keywords and phrases associated with distress, GBV, or crisis
 * language.
 *
 * These rules are deliberately kept separate from the intent
 * classification logic. Keyword overlap with the classifier is
 * acceptable because the two components serve different purposes.
 */
const DISTRESS_KEYWORDS = [
  "rape",
  "raped",
  "forced",
  "forced sex",
  "forced sexual activity",
  "forced sexual intercourse",
  "i was forced",
  "forced me",
  "made me have sex",
  "made me do it",
  "didn't stop",
  "did not stop",
  "said no",
  "i said no",
  "didn't consent",
  "did not consent",
  "without my consent",
  "no consent",
  "assault",
  "sexual assault",
  "sexually assaulted",
  "sexual violence",
  "sexual abuse",
  "sexually abused",
  "unwanted sexual contact",
  "unwanted touching",
  "touched me",
  "someone touched me",
  "afraid to say no",
  "threatened",
  "threatened me",
  "coerced",
  "coerced into sex",
  "coercion",
  "against my will",
  "fgm",
  "circumcision",
  "abuse",
  "defilement",
];

/**
 * Check whether a query contains safety-related language.
 *
 * @param {string} text - User's query.
 * @returns {{
 *   flagged: boolean,
 *   matchedKeywords: string[]
 * }} Safety detection result.
 */
function checkSafety(text) {
  // Safety checks require textual input.
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }

  // Normalize the query for case-insensitive keyword matching.
  const normalizedText = text.toLowerCase();

  /**
   * Identify every configured keyword or phrase that occurs
   * in the query.
   *
   * Word boundaries reduce false matches where a keyword appears
   * as part of an unrelated word.
   */
  const matched = DISTRESS_KEYWORDS.filter((keyword) => {
    const escapedKeyword = keyword.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const pattern = new RegExp(`\\b${escapedKeyword}\\b`);

    return pattern.test(normalizedText);
  });

  /**
   * A query is flagged whenever one or more safety keywords
   * or phrases are detected.
   */
  return {
    flagged: matched.length > 0,
    matchedKeywords: matched,
  };
}

module.exports = {
  checkSafety,
  DISTRESS_KEYWORDS,
};