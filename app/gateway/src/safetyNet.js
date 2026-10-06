/**
 * SafeGirl Safety Net
 *
 * Provides independent, rule-based detection of distress, gender-based
 * violence (GBV), and crisis-related language.
 *
 * SafetyNet operates independently from the Intent Classifier and runs
 * before it (and before the help-seeking rule; see backend.js). Its
 * result can short-circuit the normal retrieval and generation pipeline
 * when safety-related language is detected.
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
  // Consent-violation phrasing. The bare word "consent" is deliberately
  // excluded: it also appears in legitimate questions (parental consent
  // for contraception, consenting to an HIV test, age of consent).
  "without consent",
  "couldn't consent",
  "could not consent",
  "wouldn't consent",
  "would not consent",
  "didn't want to but",
  "did not want to but",
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
  // Bare "threatened" is deliberately excluded: it also matches ordinary
  // sentences such as "my teacher threatened to fail me". Threats of
  // violence are covered by THREAT_PATTERNS below.
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

/*
 * Pattern rules. Each runs against the normalized text (lowercase,
 * straight apostrophes, single spaces). Word forms, cheap typos and SMS
 * spellings are written into the patterns; idioms that must not trigger
 * are excluded with lookaheads.
 */

// "myself" and common spellings: my self, mysef, myslf, myselfe.
const MYSELF = "my ?s(?:el|e|l)fe?";
// "himself", "herself", "themselves", "yourself".
const THEMSELF = "(?:him|her|them|your) ?(?:self|selves)";
// "don't" / "dont" / "do not" / "dnt", and "doesn't" forms.
const DONT = "(?:don'?t|do not|dnt|doesn'?t|does not)";
// "want to" / "wanna" / "want 2", and third-person "wants to".
const WANT_TO = "(?:wants? (?:to|2)|wanna)";

/** Self-harm and suicidal statements, first and third person. */
const SELF_HARM_PATTERNS = [
  [
    "kill myself",
    // "kil" covers a common one-letter typo.
    new RegExp(`\\bkill?(?:s|ing|ed)? ?(?:${MYSELF}|${THEMSELF})\\b`),
  ],
  ["want to die", new RegExp(`\\b${WANT_TO} die\\b(?! (?:my|her|their) hair)`)],
  ["wish I was dead", /\bwish (?:i|she|he) (?:was|were) dead\b/],
  [
    "don't want to be alive / live",
    new RegExp(
      `\\b${DONT} (?:${WANT_TO}|want) (?:be alive|live|exist|wake up)\\b`,
    ),
  ],
  [
    "end my life",
    /\b(?:end(?:s|ing|ed)?|take|taking|took) (?:my|his|her|their) (?:own )?life\b/,
  ],
  ["end it all", /\bend(?:ing)? it all\b/],
  [
    "hurt myself",
    new RegExp(
      `\\b(?:hurt(?:s|ing)?|harm(?:s|ed|ing)?|cut(?:s|ting)?|burn(?:s|t|ed|ing)?) (?:${MYSELF}|${THEMSELF})\\b`,
    ),
  ],
  ["self-harm", /\bself[- ]?harm(?:ing)?\b/],
  [
    "no reason to live",
    /\b(?:no reason|nothing) (?:to|2) live for\b|\bno reason (?:to|2) live\b/,
  ],
  ["better off dead", /\b(?:better off dead|better off without me)\b/],
  ["suicide", /\bsuicid(?:e|al)\b/],
];

/**
 * Ongoing or past physical or sexual violence, in common verb forms.
 * Idioms such as "beat me at chess", "beat me to it" and "beats me why"
 * are excluded.
 */
const ABUSE_PATTERNS = [
  [
    "hits / beats / slaps me",
    /\b(?:hits?|hitting|beats?|beating|beaten|slaps?|slapped|slapping|kicks?|kicked|kicking|punch(?:es|ed|ing)?|chok(?:es|ed|ing)|strangl(?:es|ed|ing)) me\b(?! (?:at|in|to it|why)\b)/,
  ],
  [
    "beaten (up)",
    /\b(?:was|got|get|gets|been|being) beaten\b|\bbeat(?:s|ing)? me up\b/,
  ],
  [
    "touches me",
    /\b(?:touches|touched|touching) me\b|\b(?:touches|touched|touching) my (?:private|body|breasts?|chest|bum|thighs?)/,
  ],
  ["forces me", /\b(?:forces|forcing|force|forced) me\b/],
  ["makes me have sex", /\b(?:makes?|making) me (?:have sex|sleep with)\b/],
  [
    "pressures me into sex",
    /\bpressur(?:es|ed|ing|e) me (?:into|to have|to) sex\b/,
  ],
  ["molested", /\bmolest(?:s|ed|ing|er)?\b/],
  ["abused (verb forms)", /\babus(?:ed|es|ing)\b/],
  ["defiled", /\bdefiled\b/],
  [
    "say no + violence or sex",
    /\b(?:say|says|saying|said) no\b(?=.*\b(?:sex|hits?|beats?|slaps?|forc\w*|touch\w*|hurts?|rap(?:e|ed|es)|threat\w*|angry|kill\w*)\b)|\b(?:sex|hits?|beats?|slaps?|forc\w*|touch\w*|hurts?|rap(?:e|ed|es)|threat\w*|angry|kill\w*)\b.*\b(?:say|says|saying|said) no\b/,
  ],
];

/** Blackmail and threats involving photos or sex. */
const BLACKMAIL_PATTERNS = [
  ["blackmail", /\bblack ?mail(?:s|ed|ing)?\b|\bsextortion\b/],
  [
    "threat to share photos",
    /\b(?:post|share|leak|send|show|spread|release|expose)(?:s|ed|ing)? (?:my|our|the) (?:nudes?|naked|private|intimate|sexy)\b/,
  ],
  [
    "sex or photos under threat",
    /\b(?:unless|or else) i (?:have sex|sleep with|send)\b|\bif i (?:don'?t|do not|dont) (?:have sex|sleep with|send (?:him|her|them) (?:nudes|photos|pics|pictures))/,
  ],
];

/** Threats of violence ("threatened me", "threatened to kill"). */
const THREAT_PATTERNS = [
  [
    "threatens me / threatened to hurt",
    /\bthreat(?:en|ens|ened|ening) (?:me|my life)\b|\bthreat(?:en|ens|ened|ening) to (?:kill|hurt|beat|harm|rape|stab|attack|shoot|burn|cut)\b/,
  ],
];

const RULES = [
  ...SELF_HARM_PATTERNS.map(([name, pattern]) => ({
    category: "self_harm",
    name,
    pattern,
  })),
  ...[...ABUSE_PATTERNS, ...BLACKMAIL_PATTERNS, ...THREAT_PATTERNS].map(
    ([name, pattern]) => ({ category: "abuse", name, pattern }),
  ),
];

/**
 * Lowercase, straighten curly apostrophes and collapse whitespace, so
 * patterns see one spelling of "don't" whatever keyboard was used.
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check whether a query contains safety-related language.
 *
 * category is "self_harm" when any self-harm rule matches (it takes
 * priority, because that referral includes emergency numbers),
 * otherwise "abuse" when any other rule matches, otherwise null.
 *
 * @param {string} text - User's query.
 * @returns {{
 *   flagged: boolean,
 *   category: "self_harm" | "abuse" | null,
 *   matchedKeywords: string[]
 * }} Safety detection result.
 */
function checkSafety(text) {
  // Safety checks require textual input.
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }

  const normalizedText = normalize(text);

  /**
   * Keyword phrases match as whole words, so a keyword never matches
   * as part of an unrelated word.
   */
  const keywordMatches = DISTRESS_KEYWORDS.filter((keyword) => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escapedKeyword}\\b`).test(normalizedText);
  });

  const ruleMatches = RULES.filter((rule) => rule.pattern.test(normalizedText));

  const matchedKeywords = [
    ...keywordMatches,
    ...ruleMatches.map((rule) => rule.name),
  ];

  let category = null;
  if (ruleMatches.some((rule) => rule.category === "self_harm")) {
    category = "self_harm";
  } else if (matchedKeywords.length > 0) {
    category = "abuse";
  }

  return {
    flagged: category !== null,
    category,
    matchedKeywords,
  };
}

module.exports = {
  checkSafety,
  normalize,
  DISTRESS_KEYWORDS,
  RULES,
};
