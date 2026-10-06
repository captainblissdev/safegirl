/**
 * Client-side Safety Net used by the offline pipeline.
 *
 * A port of app/gateway/src/safetyNet.js, which is the source of truth:
 * the same keyword list, the same pattern rules (regex text copied
 * exactly), the same normalisation and the same category priority, so
 * a query flagged online is flagged the same way offline.
 *
 * When the gateway rules change, update this file to match. The parity
 * test (app/gateway/test/offlineSafetyParity.test.js) compares the
 * keyword lists, every rule's name, category and regex source, and the
 * results for a shared case list, and fails until both agree.
 */

export type SafetyCategory = "self_harm" | "abuse";

export interface SafetyResult {
  flagged: boolean;
  category: SafetyCategory | null;
  matchedKeywords: string[];
}

interface SafetyRule {
  category: SafetyCategory;
  name: string;
  pattern: RegExp;
}

/** Keyword phrases, matched as whole words (category "abuse"). */
export const DISTRESS_KEYWORDS: readonly string[] = [
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
  "didn't consent",
  "did not consent",
  "without my consent",
  "no consent",
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

/** Pattern rules, in the gateway's order. */
export const RULES: readonly SafetyRule[] = [
  {
    category: "self_harm",
    name: "kill myself",
    pattern:
      /\bkill?(?:s|ing|ed)? ?(?:my ?s(?:el|e|l)fe?|(?:him|her|them|your) ?(?:self|selves))\b/,
  },
  {
    category: "self_harm",
    name: "want to die",
    pattern:
      /\b(?:wants? (?:to|2)|wanna) die\b(?! (?:my|her|their) hair| laughing\b| of laughter\b| from laughing\b)/,
  },
  {
    category: "self_harm",
    name: "wish I was dead",
    pattern: /\bwish (?:i|she|he) (?:was|were) dead\b/,
  },
  {
    category: "self_harm",
    name: "don't want to be alive / live",
    pattern:
      /\b(?:don'?t|do not|dnt|doesn'?t|does not) (?:(?:wants? (?:to|2)|wanna)|want) (?:be alive|live|exist|wake up)\b/,
  },
  {
    category: "self_harm",
    name: "end my life",
    pattern:
      /\b(?:end(?:s|ing|ed)?|take|taking|took) (?:my|his|her|their) (?:own )?life\b/,
  },
  {
    category: "self_harm",
    name: "end it all",
    pattern: /\bend(?:ing)? it all\b/,
  },
  {
    category: "self_harm",
    name: "hurt myself",
    pattern:
      /\b(?:hurt(?:s|ing)?|harm(?:s|ed|ing)?|cut(?:s|ting)?|burn(?:s|t|ed|ing)?) (?:my ?s(?:el|e|l)fe?|(?:him|her|them|your) ?(?:self|selves))\b/,
  },
  {
    category: "self_harm",
    name: "self-harm",
    pattern: /\bself[- ]?harm(?:ing)?\b/,
  },
  {
    category: "self_harm",
    name: "no point / no reason in living",
    pattern:
      /\b(?:no|not any|not a) (?:point|reason)s? (?:in|to|2) (?:living|live|going on|go on|carrying on|carry on|keep going|keeping going)\b|\b(?:no reason|nothing) (?:to|2) live for\b/,
  },
  {
    category: "self_harm",
    name: "don't see a reason to keep going",
    pattern:
      /\b(?:(?:don'?t|do not|dnt|doesn'?t|does not)|can'?t|cannot|can not) see (?:a|any|the) (?:reason|point) (?:to|in|2) (?:keep going|keeping going|go on|going on|carry on|carrying on|live|living)\b/,
  },
  {
    category: "self_harm",
    name: "want it to end",
    pattern:
      /\bwants? (?:it|this|everything|it all|all this|all of this|my life) (?:to|2) end\b|\bwish (?:it|everything|my life) would end\b/,
  },
  {
    category: "self_harm",
    name: "hate my life",
    pattern: /\bhate (?:my life|being alive|living)\b/,
  },
  {
    category: "self_harm",
    name: "tired of being alive",
    pattern: /\b(?:tired|sick) of (?:being alive|living|life)\b/,
  },
  {
    category: "self_harm",
    name: "better off dead",
    pattern: /\b(?:better off dead|better off without me)\b/,
  },
  {
    category: "self_harm",
    name: "better off if I wasn't here",
    pattern:
      /\bbetter off if i (?:wasn'?t|was not|weren'?t|were not) (?:here|around|alive)\b/,
  },
  {
    category: "self_harm",
    name: "others happier without me",
    pattern:
      /\b(?:would|will|'d) be (?:happier|better(?: off)?) (?:if i (?:wasn'?t|was not|weren'?t|were not) (?:here|around|alive)|if i (?:was|were) (?:gone|dead|not here|not around)|if i (?:didn'?t|did not|never) exist(?:ed)?|if i (?:died|disappeared)|without me)\b/,
  },
  {
    category: "self_harm",
    name: "thinking about how to end it",
    pattern:
      /\b(?:think|thinks|thinking|thought) (?:about|of) (?:how to |ways to )?end(?:ing)? (?:it|things|my life)\b(?! with)/,
  },
  {
    category: "self_harm",
    name: "suicide",
    pattern: /\bsuicid(?:e|al)\b/,
  },
  {
    category: "abuse",
    name: "hits / beats / slaps me or others",
    pattern:
      /\b(?:hits?|hitting|beats?|beating|beaten|slaps?|slapped|slapping|kicks?|kicked|kicking|punch(?:es|ed|ing)?|chok(?:es|ed|ing)|strangl(?:es|ed|ing)) (?:me|us|him|her|them|my (?:mum|mom|mother|mama|sister|brother|siblings|dad|father|wife|girlfriend|baby|child|children|kids|family|little (?:sister|brother)))\b(?! (?:at|in|to it|why|during|with the ball)\b)/,
  },
  {
    category: "abuse",
    name: "beaten (up)",
    pattern:
      /\b(?:was|got|get|gets|been|being) beaten\b|\bbeat(?:s|ing)? me up\b/,
  },
  {
    category: "abuse",
    name: "touches me",
    pattern:
      /\b(?:touches|touched|touching) me\b|\b(?:touches|touched|touching) my (?:private|body|breasts?|chest|bum|thighs?)/,
  },
  {
    category: "abuse",
    name: "forces me",
    pattern: /\b(?:forces|forcing|force|forced) me\b/,
  },
  {
    category: "abuse",
    name: "makes me have sex",
    pattern: /\b(?:makes?|making) me (?:have sex|sleep with)\b/,
  },
  {
    category: "abuse",
    name: "pressures me into sex",
    pattern: /\bpressur(?:es|ed|ing|e) me (?:into|to have|to) sex\b/,
  },
  {
    category: "abuse",
    name: "secrecy + touch or sex",
    pattern:
      /^(?=.*(?:\b(?:told|tells|tell|said|says|asked|asks|made) (?:me )?(?:not (?:to|2) tell|to keep (?:it|this|quiet))|\bkeep (?:it|this) (?:a |our )?secret\b|\bour (?:little )?secret\b|\bnot (?:to|2) tell (?:anyone|anybody|my)\b))(?=.*\b(?:touch\w*|sex\w*|private parts?|kiss\w*|naked|nudes?|undress\w*|my body|bedroom)\b)/,
  },
  {
    category: "abuse",
    name: "secret about what we do",
    pattern:
      /\b(?:don'?t|do not|dont|not (?:to|2)) tell (?:anyone|anybody|my \w+) (?:about )?what we do\b|\bwhat we do (?:at night|together|in (?:the|my|his|her) (?:room|bed|bedroom))\b|\bour (?:little )?secret\b/,
  },
  {
    category: "abuse",
    name: "not safe at home",
    pattern:
      /\b(?:don'?t|do not|dont|doesn'?t|does not) feel safe (?:at|in) (?:home|my house|our house|my home)\b|\b(?:scared|afraid|frightened|terrified) (?:to|of) (?:go|going|come|coming|be|being) (?:back )?home\b/,
  },
  {
    category: "abuse",
    name: "<person> will kill me",
    pattern:
      /\b(?:dad|daddy|father|mother|mum|mom|mama|uncle|aunt|auntie|brother|sister|boyfriend|husband|parents|stepfather|stepmother|step ?dad|step ?mum|step ?mom|he|she|they|him|her)(?:'ll| (?:will|would|is going to|are going to|is gonna|are gonna|gonna)) kill me\b/,
  },
  {
    category: "abuse",
    name: "taken to be cut (FGM)",
    pattern:
      /\b(?:take|takes|taking|taken|took|send|sends|sent|sending|bring|brought) (?:me|her|us) (?:to be|to get|for) (?:cut|circumcised|circumcision|cutting)\b|\b(?:taken|going|want|wants|plan|plans|planning) (?:me |her )?to be (?:cut|circumcised)\b|\b(?:i|she) (?:will|is going to|am going to) be (?:cut|circumcised)\b/,
  },
  {
    category: "abuse",
    name: "asks me to send nudes",
    pattern:
      /\b(?:ask|asks|asked|asking|want|wants|wanted|keeps asking|begs|begged|pressur\w*|forc\w*|tells|told) me (?:to |for )?(?:send |sending )?(?:him |her |them )?(?:nudes?|naked (?:pictures|photos|pics|selfies)|nude (?:pictures|photos|pics|selfies)|pictures of my body)\b/,
  },
  {
    category: "abuse",
    name: "molested",
    pattern: /\bmolest(?:s|ed|ing|er)?\b/,
  },
  {
    category: "abuse",
    name: "abused (verb forms)",
    pattern: /\babus(?:ed|es|ing)\b/,
  },
  {
    category: "abuse",
    name: "defiled",
    pattern: /\bdefiled\b/,
  },
  {
    category: "abuse",
    name: "say no + violence or sex",
    pattern:
      /\b(?:say|says|saying|said) no\b(?=.*\b(?:sex|hits?|beats?|slaps?|forc\w*|touch\w*|hurts?|rap(?:e|ed|es)|threat\w*|angry|kill\w*)\b)|\b(?:sex|hits?|beats?|slaps?|forc\w*|touch\w*|hurts?|rap(?:e|ed|es)|threat\w*|angry|kill\w*)\b.*\b(?:say|says|saying|said) no\b/,
  },
  {
    category: "abuse",
    name: "blackmail",
    pattern: /\bblack ?mail(?:s|ed|ing)?\b|\bsextortion\b/,
  },
  {
    category: "abuse",
    name: "threat to share photos",
    pattern:
      /\b(?:post|share|leak|send|show|spread|release|expose)(?:s|ed|ing)? (?:my|our|the) (?:nudes?|naked|private|intimate|sexy)\b/,
  },
  {
    category: "abuse",
    name: "threat to show photos",
    pattern:
      /\b(?:will|would|going to|gonna|threaten(?:s|ed|ing)? to|wants? to|'ll) (?:show|post|share|send|leak|spread|upload|forward|put up) (?:(?:everyone|everybody|people|them|it to everyone|the whole school|online) )?(?:my|our|her|his|their) (?:\w+ )?(?:photos?|pictures?|pics?|videos?|images?)\b/,
  },
  {
    category: "abuse",
    name: "sex or photos under threat",
    pattern:
      /\b(?:unless|or else) i (?:have sex|sleep with|send)\b|\bif i (?:don'?t|do not|dont) (?:have sex|sleep with|send (?:him|her|them) (?:nudes|photos|pics|pictures))/,
  },
  {
    category: "abuse",
    name: "threatens me / threatened to hurt",
    pattern:
      /\bthreat(?:en|ens|ened|ening) (?:me|my life)\b|\bthreat(?:en|ens|ened|ening) to (?:kill|hurt|beat|harm|rape|stab|attack|shoot|burn|cut)\b/,
  },
];

/**
 * Lowercase, straighten curly apostrophes, read "@" between letters as
 * "a" and collapse whitespace.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/(?<=[a-z])@(?=[a-z])/g, "a")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check whether a query contains safety-related language. Self-harm
 * takes priority when both categories match.
 */
export function checkSafety(text: string): SafetyResult {
  const normalizedText = normalize(text);

  const keywordMatches = DISTRESS_KEYWORDS.filter((keyword) => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escapedKeyword}\\b`).test(normalizedText);
  });

  const ruleMatches = RULES.filter((rule) => rule.pattern.test(normalizedText));

  const matchedKeywords = [
    ...keywordMatches,
    ...ruleMatches.map((rule) => rule.name),
  ];

  let category: SafetyCategory | null = null;
  if (ruleMatches.some((rule) => rule.category === "self_harm")) {
    category = "self_harm";
  } else if (matchedKeywords.length > 0) {
    category = "abuse";
  }

  return { flagged: category !== null, category, matchedKeywords };
}
