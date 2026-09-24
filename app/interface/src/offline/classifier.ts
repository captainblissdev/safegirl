/**
 * Client-side port of the KeywordBaselineClassifier from
 * app/gateway/src/fallback/keywordClassifier.js.
 *
 * This classifier is used by the offline pipeline when the backend
 * cannot be reached. The keyword rules are intentionally duplicated
 * for now and must be kept synchronized with the backend until the
 * classifier is moved into a shared package.
 */

const KEYWORDS: Record<string, string[]> = {
  gbv: [
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
    "consent",
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
  ],

  sti: [
    "sti",
    "stis",
    "std",
    "stds",
    "sexually transmitted infection",
    "sexually transmitted infections",
    "sexually transmitted disease",
    "sexual infection",
    "hiv",
    "hiv test",
    "hiv testing",
    "hiv positive",
    "hiv negative",
    "hiv status",
    "hiv exposure",
    "exposed to hiv",
    "possible hiv",
    "risk of hiv",
    "living with hiv",
    "pep",
    "prep",
    "post exposure prophylaxis",
    "pre exposure prophylaxis",
    "post-exposure prophylaxis",
    "pre-exposure prophylaxis",
    "sti test",
    "std test",
    "sti testing",
    "std testing",
    "test for",
    "tested",
    "discharge",
    "unusual discharge",
    "vaginal discharge",
    "penile discharge",
    "burn when i pee",
    "burning when i pee",
    "pain when i pee",
    "painful urination",
    "burning",
    "genital sores",
    "genital sore",
    "genital itching",
    "genital pain",
    "infection",
    "no symptoms",
    "syphilis",
    "gonorrhea",
    "gonorrhoea",
    "chlamydia",
    "herpes",
    "hpv",
    "trichomoniasis",
    "vaccine",
  ],

  pregnancy: [
    "pregnant",
    "pregnancy",
    "think i'm pregnant",
    "think i am pregnant",
    "might be pregnant",
    "could i be pregnant",
    "could be pregnant",
    "am i pregnant",
    "signs of pregnancy",
    "early pregnancy",
    "pregnancy symptoms",
    "pregnancy risk",
    "pregnancy risks",
    "period late",
    "period is late",
    "late period",
    "missed period",
    "missed my period",
    "period hasn't come",
    "period has not come",
    "period did not come",
    "period didn't come",
    "period isn't here",
    "period is not here",
    "pregnancy test",
    "test for pregnancy",
    "home pregnancy test",
    "positive pregnancy test",
    "negative pregnancy test",
    "antenatal",
    "antenatal care",
    "antenatal clinic",
    "first visit",
    "first antenatal visit",
    "give birth",
    "pregnancy care",
    "prenatal care",
    "health risk",
    "health risks",
    "teenage mother",
    "teenage mothers",
    "risks of having a baby",
    "unplanned pregnancy",
    "unexpected pregnancy",
    "pregnancy scare",
    "pelvic exam",
  ],

  contraception: [
    "birth control",
    "birth control method",
    "contraceptive method",
    "contraceptive methods",
    "contraceptive",
    "contraception",
    "pill",
    "missed pill",
    "forgot my pill",
    "iud",
    "copper iud",
    "implant",
    "birth control implant",
    "injection",
    "birth control injection",
    "condom",
    "condoms",
    "condom broke",
    "condom slipped",
    "morning after pill",
    "morning-after",
    "emergency contraception",
    "emergency contraceptive",
    "family planning",
    "family planning method",
    "pulled out",
    "precum",
    "withdrawal",
    "protected",
    "avoid pregnancy",
    "prevent pregnancy",
    "preventing pregnancy",
    "not get pregnant",
    "avoid getting pregnant",
    "fertility",
    "fertile",
    "fertile window",
    "ovulation",
    "safe days",
    "calendar method",
    "side effects",
  ],

  general: [
    "youth-friendly",
    "youth friendly",
    "youth-friendly services",
    "youth friendly services",
    "youth-friendly clinic",
    "youth friendly clinic",
    "youth-friendly service",
    "youth friendly service",
    "confidential",
    "confidentiality",
    "privacy",
    "private",
    "keep it private",
    "keep this private",
    "tell my parents",
    "without my parents",
    "parental consent",
    "parental permission",
    "guardian",
    "guardian permission",
    "guardian consent",
    "clinic",
    "clinic visit",
    "health service",
    "health services",
    "healthcare",
    "health care",
    "health worker",
    "health provider",
    "doctor",
    "nurse",
    "free",
    "appointment",
    "embarrassed",
    "judge",
    "judge me",
    "youth centre",
    "youth center",
    "youth",
    "young people",
    "young person",
    "adolescent",
    "adolescents",
    "teenager",
    "teenagers",
    "school hours",
  ],
};

const PRIORITY = [
  "gbv",
  "sti",
  "contraception",
  "pregnancy",
  "general",
];

export interface ClassificationResult {
  label: string;
  matchedKeywords: Record<string, string[]>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Classifies a query using keyword overlap.
 *
 * The category with the highest number of matched keywords is selected.
 * If multiple categories have the same score, PRIORITY determines the
 * winning category.
 */
export function classify(text: string): ClassificationResult {
  const normalized = text.toLowerCase();
  const hits: Record<string, string[]> = {};

  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    const matched = keywords.filter((keyword) => {
      const pattern = new RegExp(
        `\\b${escapeRegex(keyword)}\\b`
      );

      return pattern.test(normalized);
    });

    if (matched.length > 0) {
      hits[category] = matched;
    }
  }

  // No keyword match defaults to the general category.
  if (Object.keys(hits).length === 0) {
    return {
      label: "general",
      matchedKeywords: {},
    };
  }

  const maxScore = Math.max(
    ...Object.values(hits).map((matches) => matches.length)
  );

  const tiedCategories = Object.keys(hits).filter(
    (category) => hits[category].length === maxScore
  );

  // A unique highest-scoring category wins directly.
  if (tiedCategories.length === 1) {
    return {
      label: tiedCategories[0],
      matchedKeywords: hits,
    };
  }

  // Resolve equal scores using the defined category priority.
  for (const category of PRIORITY) {
    if (tiedCategories.includes(category)) {
      return {
        label: category,
        matchedKeywords: hits,
      };
    }
  }

  // Defensive fallback; normally unreachable because all categories
  // in KEYWORDS are represented in PRIORITY.
  return {
    label: tiedCategories[0],
    matchedKeywords: hits,
  };
}