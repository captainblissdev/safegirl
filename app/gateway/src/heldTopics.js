/**
 * SafeGirl held-topic rule
 *
 * Recognises questions on topics the knowledge base does not cover
 * safely yet (emergency contraception and other situations after sex or
 * a contraception failure; pregnancy decisions), so they get a neutral
 * signpost instead of a retrieved entry that would be a confident guess.
 * The topics are held until a clinician approves content.
 *
 * The patterns are in src/content/heldTopics.json, in two groups (A and
 * B), checked in order. Queries are tokenised as the vague-query rule
 * does (helpSignposting.normalize, then vagueQuery.tokenize). A pattern
 * is a single word (matching as written or with a plural "s" or "es"
 * added or removed), a phrase "a b" (consecutive words), or a word set
 * "a+b" (every word present, in any order).
 *
 * It runs after the Safety Net and the help rule, and before the
 * vague-query rule, so it never overrides a referral or signposting.
 */

const { normalize } = require("./helpSignposting");
const { tokenize } = require("./vagueQuery");

let groups = null;

/** The pattern groups, read once from src/content/heldTopics.json. */
function getHeldTopicGroups() {
  if (!groups) {
    groups = require("./content/heldTopics.json").groups;
  }
  return groups;
}

/** True when a query word and a pattern word match, allowing a plural. */
function sameWord(word, pattern) {
  return (
    word === pattern ||
    word === `${pattern}s` ||
    word === `${pattern}es` ||
    pattern === `${word}s` ||
    pattern === `${word}es`
  );
}

/** True when the tokenised query matches one pattern. */
function matchesPattern(tokens, pattern) {
  if (pattern.includes("+")) {
    return pattern
      .split("+")
      .every((part) => tokens.some((word) => sameWord(word, part)));
  }
  if (pattern.includes(" ")) {
    return ` ${tokens.join(" ")} `.includes(` ${pattern} `);
  }
  return tokens.some((word) => sameWord(word, pattern));
}

/**
 * The id of the first held-topic group the query matches ("A" or "B"),
 * or null.
 *
 * @param {string} text - User's query.
 * @returns {string|null}
 */
function matchHeldTopic(text) {
  if (typeof text !== "string") {
    return null;
  }

  const tokens = tokenize(normalize(text));
  const group = getHeldTopicGroups().find((candidate) =>
    candidate.patterns.some((pattern) => matchesPattern(tokens, pattern)),
  );
  return group ? group.id : null;
}

module.exports = {
  getHeldTopicGroups,
  matchHeldTopic,
  matchesPattern,
  sameWord,
};
