/**
 * SafeGirl help-seeking rule
 *
 * Recognises GENERIC help requests that name no topic ("Where can I get
 * help?", "I need help") so they get signposting instead of going through
 * classification and retrieval, which would otherwise pick an unrelated
 * entry (for example a contraception answer).
 *
 * Deterministic and deliberately narrow: the whole message must match one
 * pattern below. Any extra words, such as a topic ("where can I get birth
 * control", "help me understand the HIV window period"), mean no match,
 * and the query goes through the normal pipeline.
 */

/**
 * Whole-message patterns, applied after normalize(). Each must match the
 * entire normalised message.
 */
const GENERIC_HELP_PATTERNS = Object.freeze([
  // where / how can I get help
  /^(where|how) (can|do|could|should) i (get|find) (some )?help$/,
  // where can I go / turn for help
  /^where (can|do|could|should) i (go|turn) (for|to get) (some )?help$/,
  // who can I talk to
  /^who (can|do|could|should) i (talk|speak) to$/,
  // is there someone I can talk to
  /^is there (someone|somebody|anyone|anybody) i can (talk|speak) to$/,
  // I want / need to talk to someone
  /^i (want|need|would like) to (talk|speak) to (someone|somebody)$/,
  // I need someone to talk to
  /^i need (someone|somebody) to (talk|speak) to$/,
  // I need help
  /^i need (some )?help$/,
  // can someone help me
  /^(can|could|will|would) (someone|somebody|anyone|anybody|you) help( me)?$/,
  // help / help me
  /^help( me)?$/,
]);

/**
 * Lowercase, drop apostrophes (straight or curly; no pattern needs them),
 * replace other punctuation with spaces, collapse whitespace, and remove
 * a leading greeting and the word "please".
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/['‘’ʼ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\bplease\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(hi|hello|hey)( there)? /, "");
}

/**
 * True when the whole message is a generic help request naming no topic.
 *
 * @param {string} text - User's query.
 * @returns {boolean}
 */
function isGenericHelpRequest(text) {
  if (typeof text !== "string") {
    return false;
  }

  const normalized = normalize(text);
  return GENERIC_HELP_PATTERNS.some((pattern) => pattern.test(normalized));
}

module.exports = { isGenericHelpRequest, GENERIC_HELP_PATTERNS, normalize };
