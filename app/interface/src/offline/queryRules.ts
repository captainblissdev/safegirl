/**
 * The help rule and the vague-query rule for the offline pipeline.
 *
 * Ports of app/gateway/src/helpSignposting.js and
 * app/gateway/src/vagueQuery.js, which are the source of truth, so
 * "Help" and vague queries get the same reply online and offline. The
 * parity test (app/gateway/test/offlineSafetyParity.test.js) compares
 * the pattern sources, the function words and the health terms, and
 * runs the shared cases through both. This file has no imports, so Node
 * can load it directly in that test.
 */

/**
 * Whole-message patterns, applied after normalize(). Each must match the
 * entire normalised message.
 */
export const GENERIC_HELP_PATTERNS: readonly RegExp[] = [
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
];

/**
 * Lowercase, drop apostrophes (straight or curly), replace other
 * punctuation with spaces, collapse whitespace, and remove a leading
 * greeting and the word "please".
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['‘’ʼ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\bplease\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(hi|hello|hey)( there)? /, "");
}

/** True when the whole message is a generic help request naming no topic. */
export function isGenericHelpRequest(text: unknown): boolean {
  if (typeof text !== "string") {
    return false;
  }

  const normalized = normalize(text);
  return GENERIC_HELP_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Above this many content words a query is never vague. */
export const MAX_CONTENT_WORDS = 3;

/** Common English function words, as normalize() leaves them. */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set([
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

// BEGIN GENERATED HEALTH TERMS: written by
// app/gateway/scripts/build-health-terms.js; do not edit by hand.
export const HEALTH_TERMS: readonly string[] = [
  "abdominal",
  "abortion",
  "anaemia",
  "antibiotics",
  "arv",
  "asthma",
  "babies",
  "baby",
  "belly",
  "birth",
  "bleeding",
  "blood",
  "body",
  "breast",
  "breathless",
  "breathlessness",
  "burning",
  "chlamydia",
  "clinic",
  "clinical",
  "clinicians",
  "clinics",
  "condom",
  "condoms",
  "consent",
  "contraception",
  "contraceptive",
  "counselling",
  "curable",
  "cured",
  "cycle",
  "dapivirine",
  "delivery",
  "diagnosed",
  "discharge",
  "disease",
  "dose",
  "doses",
  "drug",
  "exposed",
  "exposure",
  "facilities",
  "facility",
  "fertility",
  "fever",
  "folic",
  "genital",
  "gonorrhoea",
  "gp",
  "headache",
  "health",
  "herpes",
  "hiv",
  "hospital",
  "hpv",
  "hygienically",
  "implant",
  "infection",
  "infections",
  "infertile",
  "infertility",
  "inflammatory",
  "injectables",
  "iron",
  "itching",
  "medical",
  "medication",
  "medicine",
  "menstrual",
  "menstruation",
  "mhm",
  "nurse",
  "pad",
  "pain",
  "painful",
  "painkiller",
  "painkillers",
  "pale",
  "pelvic",
  "pep",
  "period",
  "periods",
  "pharmacies",
  "pharmacist",
  "pill",
  "pregnancy",
  "pregnant",
  "prep",
  "prophylaxis",
  "puberty",
  "regimen",
  "sex",
  "sexual",
  "sexuality",
  "sexually",
  "sores",
  "srh",
  "sti",
  "stis",
  "stomach",
  "supplements",
  "swelling",
  "symptoms",
  "syphilis",
  "tablets",
  "test",
  "tested",
  "testing",
  "tests",
  "tiredness",
  "treat",
  "treated",
  "treating",
  "treatment",
  "trichomoniasis",
  "tummy",
  "ulcers",
  "unprotected",
  "vaccine",
  "vaginal",
  "violence",
  "yfs",
];
// END GENERATED HEALTH TERMS

const HEALTH_TERM_SET: ReadonlySet<string> = new Set(HEALTH_TERMS);

/** Lowercase words of a text, apostrophes dropped, punctuation removed. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['‘’ʼ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** The query's words after normalize(), without function words. */
export function contentWords(text: string): string[] {
  return tokenize(normalize(text)).filter((word) => !FUNCTION_WORDS.has(word));
}

/** True when word is a health term, allowing a plural "s" or "es". */
export function isHealthTerm(word: string): boolean {
  return (
    HEALTH_TERM_SET.has(word) ||
    HEALTH_TERM_SET.has(`${word}s`) ||
    (word.endsWith("s") && HEALTH_TERM_SET.has(word.slice(0, -1))) ||
    (word.endsWith("es") && HEALTH_TERM_SET.has(word.slice(0, -2)))
  );
}

/**
 * True when the query is short (at most MAX_CONTENT_WORDS content words)
 * and names no health term.
 */
export function isVagueQuery(text: unknown): boolean {
  if (typeof text !== "string") {
    return false;
  }

  const words = contentWords(text);
  return (
    words.length <= MAX_CONTENT_WORDS &&
    !words.some((word) => isHealthTerm(word))
  );
}
