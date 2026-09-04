/**
 * SafeGirl Classifier Hierarchy
 *
 * Defines the common Classifier interface and provides two interchangeable
 * implementations:
 *
 * 1. KeywordBaselineClassifier — the frozen rule-based baseline.
 * 2. DistilBERTClassifier — placeholder for the future fine-tuned model.
 *
 * Keeping both implementations behind the same interface allows the
 * backend pipeline to use either classifier without changing its overall
 * orchestration logic.
 */

/**
 * Abstract classifier interface.
 *
 * Concrete classifier implementations must provide a classify() method.
 */
class Classifier {
  // eslint-disable-next-line no-unused-vars
  classify(text) {
    throw new Error("classify() must be implemented by a subclass");
  }
}

/**
 * KeywordBaselineClassifier
 *
 * JavaScript implementation of the frozen keyword baseline defined in
 * notebooks/classifier/baseline_classifier.py.
 *
 * The keyword set and priority order are intentionally preserved so that
 * the JavaScript baseline remains comparable with the frozen Python
 * implementation used during evaluation.
 *
 * The "gbv" category is retained because it is part of the frozen
 * baseline. SafetyNet independently handles safety detection and
 * determines whether the normal retrieval/generation pipeline continues.
 */
const KEYWORDS = {
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

/**
 * Priority order used when two or more categories receive the same
 * number of keyword matches.
 *
 * This ordering is part of the frozen baseline behaviour.
 */
const PRIORITY = [
  "gbv",
  "sti",
  "contraception",
  "pregnancy",
  "general",
];

/**
 * Escape characters that have special meaning inside a regular expression.
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Classify a query using the frozen keyword baseline.
 *
 * @param {string} text - User's query.
 * @returns {{
 *   label: string,
 *   matchedKeywords: Object<string, string[]>
 * }} Classification result.
 */
class KeywordBaselineClassifier extends Classifier {
  classify(text) {
    if (typeof text !== "string") {
      throw new TypeError("text must be a string");
    }

    const normalizedText = text.toLowerCase();
    const hits = {};

    /**
     * Check the query against every category and record all
     * matching keywords for traceability.
     */
    for (const [category, keywords] of Object.entries(KEYWORDS)) {
      const matched = keywords.filter((keyword) =>
        new RegExp(`\\b${escapeRegex(keyword)}\\b`).test(normalizedText)
      );

      if (matched.length > 0) {
        hits[category] = matched;
      }
    }

    /**
     * Queries with no keyword matches default to the general category.
     */
    if (Object.keys(hits).length === 0) {
      return {
        label: "general",
        matchedKeywords: {},
      };
    }

    /**
     * Select the category with the highest number of keyword matches.
     */
    const maxScore = Math.max(
      ...Object.values(hits).map((matches) => matches.length)
    );

    const tied = Object.keys(hits).filter(
      (category) => hits[category].length === maxScore
    );

    if (tied.length === 1) {
      return {
        label: tied[0],
        matchedKeywords: hits,
      };
    }

    /**
     * If multiple categories have the same score, use the frozen
     * priority order to produce a deterministic classification.
     */
    for (const category of PRIORITY) {
      if (tied.includes(category)) {
        return {
          label: category,
          matchedKeywords: hits,
        };
      }
    }

    return {
      label: tied[0],
      matchedKeywords: hits,
    };
  }
}

/**
 * DistilBERTClassifier
 *
 * Placeholder for the future fine-tuned DistilBERT implementation.
 *
 * The model has not yet been fine-tuned. This stub allows the classifier
 * hierarchy and backend architecture to be developed and tested before
 * the trained model is integrated.
 */
class DistilBERTClassifier extends Classifier {
  classify() {
    throw new Error(
      "DistilBERTClassifier is not yet implemented — model has not been " +
        "fine-tuned. Use KeywordBaselineClassifier until training is complete."
    );
  }
}

module.exports = {
  Classifier,
  KeywordBaselineClassifier,
  DistilBERTClassifier,
};