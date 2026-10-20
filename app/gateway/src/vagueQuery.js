/**
 * SafeGirl vague-query rule
 *
 * Recognises short queries that name no health topic ("Am I okay?",
 * "I'm worried", "What should I do?") so they get a clarifying question
 * instead of going through classification and retrieval, which would
 * otherwise pick an unrelated entry and state it as an answer.
 *
 * A query is vague when it has at most MAX_CONTENT_WORDS content words
 * and none of them is a health term. Content words are the words left
 * after normalising the query as the help rule does
 * (helpSignposting.normalize) and setting aside FUNCTION_WORDS, the
 * common English pronouns, articles, auxiliaries, prepositions,
 * conjunctions and question words. Counting content words rather than
 * all words keeps "What should I do?" (no content words) and "Can I ask
 * you something?" (two: "ask", "something") short.
 *
 * Health terms come from two lists: src/content/healthTerms.json,
 * generated from the knowledge base by scripts/build-health-terms.js,
 * and src/content/extraHealthTerms.json, written by hand by category of
 * general vocabulary (decision log, 20 October 2026). A word matches a
 * term as written, or with a plural "s" or "es" added or taken away; an
 * extra term with a space is a phrase ("pulled out"), matched against
 * the whole normalised query, function words included.
 *
 * Deterministic and deliberately narrow: any health term, or more than
 * three content words, means no match, and the query goes through the
 * normal pipeline. It runs after the Safety Net and the help rule, so
 * it never overrides a referral or signposting.
 */

const { normalize } = require("./helpSignposting");

/** Above this many content words a query is never vague. */
const MAX_CONTENT_WORDS = 3;

/**
 * Common English function words, written as normalize() leaves them
 * (lowercase, apostrophes removed: "I'm" becomes "im").
 */
const FUNCTION_WORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "arent",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "cannot",
  "cant",
  "could",
  "couldnt",
  "did",
  "didnt",
  "do",
  "does",
  "doesnt",
  "doing",
  "dont",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "hadnt",
  "has",
  "hasnt",
  "have",
  "havent",
  "having",
  "he",
  "hed",
  "hes",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "hows",
  "i",
  "id",
  "if",
  "ill",
  "im",
  "in",
  "into",
  "is",
  "isnt",
  "it",
  "its",
  "itself",
  "ive",
  "just",
  "lets",
  "may",
  "me",
  "might",
  "more",
  "most",
  "must",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "ought",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "r",
  "same",
  "shall",
  "she",
  "shes",
  "should",
  "shouldnt",
  "so",
  "some",
  "such",
  "than",
  "that",
  "thats",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "theres",
  "these",
  "they",
  "theyre",
  "this",
  "those",
  "through",
  "to",
  "too",
  "u",
  "under",
  "until",
  "up",
  "ur",
  "very",
  "was",
  "wasnt",
  "we",
  "were",
  "werent",
  "what",
  "whats",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "wont",
  "would",
  "wouldnt",
  "you",
  "youd",
  "youll",
  "your",
  "youre",
  "yours",
  "yourself",
  "yourselves",
  "youve",
]);

/** Lowercase words of a text, apostrophes dropped, punctuation removed. */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/['‘’ʼ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** The query's words after normalize(), without function words. */
function contentWords(text) {
  return tokenize(normalize(text)).filter((word) => !FUNCTION_WORDS.has(word));
}

let healthTerms = null;
let extraHealthTerms = null;
let allHealthTermWords = null;

/** The knowledge-base health terms, read once from src/content/healthTerms.json. */
function getHealthTerms() {
  if (!healthTerms) {
    healthTerms = new Set(require("./content/healthTerms.json").terms);
  }
  return healthTerms;
}

/**
 * The health terms from outside the knowledge base, read once from
 * src/content/extraHealthTerms.json: single words, and phrases (terms
 * with a space) matched against the whole normalised query.
 */
function getExtraHealthTerms() {
  if (!extraHealthTerms) {
    const terms = require("./content/extraHealthTerms.json").categories.flatMap(
      (category) => category.terms,
    );
    extraHealthTerms = {
      words: new Set(terms.filter((term) => !term.includes(" "))),
      phrases: terms.filter((term) => term.includes(" ")),
    };
  }
  return extraHealthTerms;
}

/** Every single-word health term: the knowledge-base list and the extra list. */
function getAllHealthTermWords() {
  if (!allHealthTermWords) {
    allHealthTermWords = new Set([
      ...getHealthTerms(),
      ...getExtraHealthTerms().words,
    ]);
  }
  return allHealthTermWords;
}

/** True when word is a health term, allowing a plural "s" or "es". */
function isHealthTerm(word, terms = getAllHealthTermWords()) {
  return (
    terms.has(word) ||
    terms.has(`${word}s`) ||
    (word.endsWith("s") && terms.has(word.slice(0, -1))) ||
    (word.endsWith("es") && terms.has(word.slice(0, -2)))
  );
}

/** True when the normalised query contains one of the extra phrases. */
function hasHealthPhrase(text) {
  const padded = ` ${tokenize(normalize(text)).join(" ")} `;
  return getExtraHealthTerms().phrases.some((phrase) =>
    padded.includes(` ${phrase} `),
  );
}

/**
 * True when the query is short (at most MAX_CONTENT_WORDS content words)
 * and names no health term: no knowledge-base or extra term among its
 * words, and no extra phrase in it.
 *
 * @param {string} text - User's query.
 * @returns {boolean}
 */
function isVagueQuery(text) {
  if (typeof text !== "string") {
    return false;
  }

  const words = contentWords(text);
  return (
    words.length <= MAX_CONTENT_WORDS &&
    !words.some((word) => isHealthTerm(word)) &&
    !hasHealthPhrase(text)
  );
}

module.exports = {
  FUNCTION_WORDS,
  MAX_CONTENT_WORDS,
  contentWords,
  getExtraHealthTerms,
  getHealthTerms,
  hasHealthPhrase,
  isHealthTerm,
  isVagueQuery,
  tokenize,
};
