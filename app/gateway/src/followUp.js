/**
 * Follow-up context (FOLLOWUP_CONTEXT_ENABLED, off by default).
 *
 * After an answer, a short message such as "how long does it last?" or
 * "what about the injection?" leans on that answer. With the flag on,
 * the client sends the previous answer's knowledge-base question (never
 * the user's earlier words) and this module turns the follow-up into one
 * self-contained question, which then goes through the whole pipeline:
 *
 *   - pronoun:  the last "it", "them", "one"... becomes the previous
 *               entry's subject ("can it make me gain weight?" after the
 *               implant: "can the contraceptive implant make me gain
 *               weight?");
 *   - swap:     "what about X?" / "and X?" asks "What is X?" ("what about
 *               the injection?": "What is the injection?"), with any
 *               pronoun in X resolved first ("the female one": "the
 *               female condoms"); "what about if ...?" asks "<subject>
 *               if ...?" ("birth control methods if I'm breastfeeding?");
 *   - ellipsis: a vague message with no pronoun ("what should I eat?")
 *               gets ", about <subject>?" added.
 *
 * Only short messages (MAX_WORDS) are candidates, and only when at least
 * one of her own content words is a health term or a word of a served
 * knowledge-base question ("weight", "last", "sports"): "is it going to
 * rain today?" is never read as a follow-up. backend.js runs the Safety
 * Net, the help rule
 * and the held-topic rules on her own words first and again on the
 * resolved question, so a follow-up can only be held or referred more
 * often, never less. The previous question must be a served
 * knowledge-base question, so the client cannot inject other text.
 *
 * Nothing is stored: the context is one field of one request.
 */

const SUBJECTS = require("./content/followUpSubjects.json").subjects;
const { contentWords, isHealthTerm, isVagueQuery } = require("./vagueQuery");

const MAX_WORDS = 10;
const MAX_PREVIOUS_LENGTH = 300;

// The last of these in the message is the one that refers back.
const PRONOUN = /\b(it's|its|it|them|they|one|ones)\b/gi;
const SWAP = /^\s*(?:what|how)\s+about\s+(.+?)\s*[?.!]*\s*$/i;
const AND_SWAP = /^\s*and\s+(.+?)\s*[?.!]*\s*$/i;
const CLAUSE = /^(if|when|while|during|after|before)\b/i;

// Words too general to tie a message to the knowledge base.
const GENERIC_WORDS = new Set(
  (
    "make get use need know go going do does have take see tell want can " +
    "could would should will still also normal okay ok thing things way " +
    "really much many lot yet one ones"
  ).split(" "),
);

/** Only with V4 triage on: the rule was built and checked under V4. */
function followUpEnabledFromEnv(env = process.env) {
  return (
    env.FOLLOWUP_CONTEXT_ENABLED === "true" && env.V4_TRIAGE_ENABLED === "true"
  );
}

/** A plain stem, so "missed" meets "miss" and "periods" meets "period". */
function stem(word) {
  const w = word.toLowerCase().replace(/'s$/, "");
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss"))
    return w.slice(0, -1);
  return w;
}

// Keyed by the questions themselves: the entry list is rebuilt per call.
const vocabularyCache = new Map();
function questionVocabulary(entries) {
  const key = entries.map((entry) => entry.question).join("|");
  if (!vocabularyCache.has(key)) {
    const words = entries
      .flatMap((entry) => contentWords(entry.question))
      .filter(
        (word) => word.length > 2 && !GENERIC_WORDS.has(word.toLowerCase()),
      )
      .map(stem);
    vocabularyCache.set(key, new Set(words));
  }
  return vocabularyCache.get(key);
}

/**
 * True when one of her content words is a health term or a word of a
 * served knowledge-base question.
 */
function sharesKnowledgeBaseWords(text, entries) {
  const vocabulary = questionVocabulary(entries);
  return contentWords(text)
    .filter((word) => !GENERIC_WORDS.has(word.toLowerCase()))
    .some((word) => isHealthTerm(word) || vocabulary.has(stem(word)));
}

const words = (text) => text.trim().split(/\s+/).filter(Boolean);
const stripEnd = (text) => text.trim().replace(/[\s?.!]+$/, "");

/** The id of a served entry with exactly this question, or null. */
function entryIdForQuestion(question, entries) {
  if (typeof question !== "string" || question.length > MAX_PREVIOUS_LENGTH) {
    return null;
  }
  const match = entries.find((entry) => entry.question === question.trim());
  return match && SUBJECTS[match.kbId] ? match.kbId : null;
}

function replaceLastPronoun(text, subject) {
  const matches = [...text.matchAll(PRONOUN)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const word = last[1].toLowerCase();
  const replacement =
    word === "it's"
      ? `${subject} is`
      : word === "its"
        ? `${subject}'s`
        : subject;
  return (
    text.slice(0, last.index) +
    replacement +
    text.slice(last.index + last[0].length)
  );
}

/**
 * The self-contained question for a follow-up, or null when the message
 * is not one.
 *
 * @param {string} text - Her message, trimmed.
 * @param {{ question: string, kbId: string }} previous - The previous
 *        answer's served entry.
 * @param {Array<{ question: string }>} entries - The served entries.
 * @returns {{ resolved: string, mode: "pronoun"|"swap"|"ellipsis" }|null}
 */
function resolveFollowUp(text, previous, entries) {
  if (typeof text !== "string" || !previous || !Array.isArray(entries)) {
    return null;
  }
  const subject = SUBJECTS[previous.kbId];
  if (!subject || words(text).length > MAX_WORDS) return null;
  if (!sharesKnowledgeBaseWords(text, entries)) return null;

  const swap = text.match(SWAP) || text.match(AND_SWAP);
  if (swap) {
    const target = swap[1];
    if (CLAUSE.test(target)) {
      return { resolved: `${subject} ${stripEnd(target)}?`, mode: "swap" };
    }
    // "what about it?" is a pronoun, not a new subject.
    if (!/^(it|that|this|them|those)$/i.test(stripEnd(target))) {
      const named =
        replaceLastPronoun(stripEnd(target), subject) ?? stripEnd(target);
      return { resolved: `What is ${named}?`, mode: "swap" };
    }
  }

  const withSubject = replaceLastPronoun(text, subject);
  if (withSubject !== null) {
    return { resolved: withSubject, mode: "pronoun" };
  }

  if (isVagueQuery(text)) {
    return {
      resolved: `${stripEnd(text)}, about ${subject}?`,
      mode: "ellipsis",
    };
  }

  return null;
}

module.exports = {
  GENERIC_WORDS,
  MAX_WORDS,
  MAX_PREVIOUS_LENGTH,
  SUBJECTS,
  entryIdForQuestion,
  followUpEnabledFromEnv,
  resolveFollowUp,
  sharesKnowledgeBaseWords,
};
