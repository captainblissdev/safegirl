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
  // Bare "said no" is deliberately excluded: it also matches ordinary
  // sentences such as "my parents said no to the party". A refusal is
  // flagged by the "say no + violence or sex" rule below.
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
  [
    "want to die",
    // Excludes "die my hair" (a misspelling of dye) and laughter idioms.
    new RegExp(
      `\\b${WANT_TO} die\\b(?! (?:my|her|their) hair| laughing\\b| of laughter\\b| from laughing\\b)`,
    ),
  ],
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
    "no point / no reason in living",
    /\b(?:no|not any|not a) (?:point|reason)s? (?:in|to|2) (?:living|live|going on|go on|carrying on|carry on|keep going|keeping going)\b|\b(?:no reason|nothing) (?:to|2) live for\b/,
  ],
  [
    "don't see a reason to keep going",
    new RegExp(
      `\\b(?:${DONT}|can'?t|cannot|can not) see (?:a|any|the) (?:reason|point) (?:to|in|2) (?:keep going|keeping going|go on|going on|carry on|carrying on|live|living)\\b`,
    ),
  ],
  [
    "want it to end",
    /\bwants? (?:it|this|everything|it all|all this|all of this|my life) (?:to|2) end\b|\bwish (?:it|everything|my life) would end\b/,
  ],
  ["hate my life", /\bhate (?:my life|being alive|living)\b/],
  ["tired of being alive", /\b(?:tired|sick) of (?:being alive|living|life)\b/],
  ["better off dead", /\b(?:better off dead|better off without me)\b/],
  [
    "better off if I wasn't here",
    /\bbetter off if i (?:wasn'?t|was not|weren'?t|were not) (?:here|around|alive)\b/,
  ],
  [
    "others happier without me",
    /\b(?:would|will|'d) be (?:happier|better(?: off)?) (?:if i (?:wasn'?t|was not|weren'?t|were not) (?:here|around|alive)|if i (?:was|were) (?:gone|dead|not here|not around)|if i (?:didn'?t|did not|never) exist(?:ed)?|if i (?:died|disappeared)|without me)\b/,
  ],
  [
    "thinking about how to end it",
    /\b(?:think|thinks|thinking|thought) (?:about|of) (?:how to |ways to )?end(?:ing)? (?:it|things|my life)\b(?! with)/,
  ],
  ["suicide", /\bsuicid(?:e|al)\b/],
];

// Secrecy demands ("he told me not to tell", "keep it a secret").
const SECRECY =
  "\\b(?:told|tells|tell|said|says|asked|asks|made) (?:me )?(?:not (?:to|2) tell|to keep (?:it|this|quiet))|\\bkeep (?:it|this) (?:a |our )?secret\\b|\\bour (?:little )?secret\\b|\\bnot (?:to|2) tell (?:anyone|anybody|my)\\b";
// Touch or sexual words, for secrecy demands that accompany them.
const TOUCH_OR_SEX =
  "\\b(?:touch\\w*|sex\\w*|private parts?|kiss\\w*|naked|nudes?|undress\\w*|my body|bedroom)\\b";
// Objects of violence other than "me": us, him, her, them, family members.
const VICTIM =
  "(?:me|us|him|her|them|my (?:mum|mom|mother|mama|sister|brother|siblings|dad|father|wife|girlfriend|baby|child|children|kids|family|little (?:sister|brother)))";
// People who may threaten to kill.
const PERSON =
  "(?:dad|daddy|father|mother|mum|mom|mama|uncle|aunt|auntie|brother|sister|boyfriend|husband|parents|stepfather|stepmother|step ?dad|step ?mum|step ?mom|he|she|they|him|her)";

/**
 * Ongoing or past physical or sexual violence, in common verb forms.
 * Idioms such as "beat me at chess", "beat me to it" and "beats me why"
 * are excluded.
 */
const ABUSE_PATTERNS = [
  [
    "hits / beats / slaps me or others",
    // Excludes games and idioms: "beat me at chess", "... in the match",
    // "beat me to it", "beats me why", "... during the game".
    new RegExp(
      `\\b(?:hits?|hitting|beats?|beating|beaten|slaps?|slapped|slapping|kicks?|kicked|kicking|punch(?:es|ed|ing)?|chok(?:es|ed|ing)|strangl(?:es|ed|ing)) ${VICTIM}\\b(?! (?:at|in|to it|why|during|with the ball)\\b)`,
    ),
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
  [
    "secrecy + touch or sex",
    new RegExp(`^(?=.*(?:${SECRECY}))(?=.*${TOUCH_OR_SEX})`),
  ],
  [
    "secret about what we do",
    /\b(?:don'?t|do not|dont|not (?:to|2)) tell (?:anyone|anybody|my \w+) (?:about )?what we do\b|\bwhat we do (?:at night|together|in (?:the|my|his|her) (?:room|bed|bedroom))\b|\bour (?:little )?secret\b/,
  ],
  [
    "not safe at home",
    /\b(?:don'?t|do not|dont|doesn'?t|does not) feel safe (?:at|in) (?:home|my house|our house|my home)\b|\b(?:scared|afraid|frightened|terrified) (?:to|of) (?:go|going|come|coming|be|being) (?:back )?home\b/,
  ],
  [
    "<person> will kill me",
    new RegExp(
      `\\b${PERSON}(?:'ll| (?:will|would|is going to|are going to|is gonna|are gonna|gonna)) kill me\\b`,
    ),
  ],
  [
    "taken to be cut (FGM)",
    /\b(?:take|takes|taking|taken|took|send|sends|sent|sending|bring|brought) (?:me|her|us) (?:to be|to get|for) (?:cut|circumcised|circumcision|cutting)\b|\b(?:taken|going|want|wants|plan|plans|planning) (?:me |her )?to be (?:cut|circumcised)\b|\b(?:i|she) (?:will|is going to|am going to) be (?:cut|circumcised)\b/,
  ],
  [
    "asks me to send nudes",
    /\b(?:ask|asks|asked|asking|want|wants|wanted|keeps asking|begs|begged|pressur\w*|forc\w*|tells|told) me (?:to |for )?(?:send |sending )?(?:him |her |them )?(?:nudes?|naked (?:pictures|photos|pics|selfies)|nude (?:pictures|photos|pics|selfies)|pictures of my body)\b/,
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
    "threat to show photos",
    /\b(?:will|would|going to|gonna|threaten(?:s|ed|ing)? to|wants? to|'ll) (?:show|post|share|send|leak|spread|upload|forward|put up) (?:(?:everyone|everybody|people|them|it to everyone|the whole school|online) )?(?:my|our|her|his|their) (?:\w+ )?(?:photos?|pictures?|pics?|videos?|images?)\b/,
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
 * Lowercase, straighten curly apostrophes, read "@" between letters as
 * "a" (r@ped) and collapse whitespace, so patterns see one spelling
 * whatever keyboard was used.
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/(?<=[a-z])@(?=[a-z])/g, "a")
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
