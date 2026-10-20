/**
 * SafeGirl -- health-term list for the vague-query rule
 *
 * Writes src/content/healthTerms.json, the list of health terms the
 * vague-query rule (src/vagueQuery.js) looks for, and the same list into
 * the generated block of the offline copy of the rule
 * (app/interface/src/offline/queryRules.ts). Every term is a word of
 * the active knowledge base: the script reads the entries the gateway
 * serves (retrievalModule.loadKnowledgeBase(), so HELD content is never
 * read), collects every word of their user question, answer,
 * evidence/claim, conditions and safety notes, and refuses to write a
 * term that is not among them.
 *
 * Which knowledge-base words count as health terms is chosen by hand,
 * below, by one criterion: the word names a body part, a symptom, a
 * condition or infection, pregnancy, periods, puberty or sex, a
 * contraceptive method, a medicine, a test or treatment, or a health
 * service or health worker. Words that also have an everyday meaning
 * are left out ("exam" and "exams", which also mean school exams;
 * "irregular", "tired", "emergency", "ring", "fits", "growth", "care",
 * "normal", "worried", "feel"), as are words about privacy rather than
 * health ("confidential", "privacy").
 *
 *     node scripts/build-health-terms.js           # write both lists
 *     node scripts/build-health-terms.js --check   # exit 1 if either is stale
 *     node scripts/build-health-terms.js --vocab   # print every KB word
 */

const fs = require("node:fs");
const path = require("node:path");

const { loadKnowledgeBase } = require("../src/retrievalModule");
const { tokenize } = require("../src/vagueQuery");

const OUTPUT_FILE = path.join(
  __dirname,
  "..",
  "src",
  "content",
  "healthTerms.json",
);

const OFFLINE_FILE = path.join(
  __dirname,
  "..",
  "..",
  "interface",
  "src",
  "offline",
  "queryRules.ts",
);

const BLOCK_START = "// BEGIN GENERATED HEALTH TERMS";
const BLOCK_END = "// END GENERATED HEALTH TERMS";

const KB_FIELDS = [
  "question",
  "answer",
  "evidenceClaim",
  "conditions",
  "safetyNotes",
];

/** The selected health terms, by group. Each must occur in the KB. */
const SELECTED = {
  body: [
    "abdominal",
    "belly",
    "blood",
    "body",
    "breast",
    "genital",
    "pelvic",
    "stomach",
    "tummy",
    "vaginal",
  ],
  symptoms: [
    "bleeding",
    "breathless",
    "breathlessness",
    "burning",
    "discharge",
    "fever",
    "headache",
    "itching",
    "pain",
    "painful",
    "pale",
    "sores",
    "swelling",
    "symptoms",
    "tiredness",
    "ulcers",
  ],
  conditions: [
    "abortion",
    "anaemia",
    "asthma",
    "chlamydia",
    "disease",
    "fertility",
    "gonorrhoea",
    "herpes",
    "hiv",
    "hpv",
    "infection",
    "infections",
    "infertile",
    "infertility",
    "inflammatory",
    "sti",
    "stis",
    "syphilis",
    "trichomoniasis",
  ],
  pregnancyPeriodsAndSex: [
    "babies",
    "baby",
    "birth",
    "consent",
    "cycle",
    "delivery",
    "menstrual",
    "menstruation",
    "pad",
    "period",
    "periods",
    "pregnancy",
    "pregnant",
    "puberty",
    "sex",
    "sexual",
    "sexuality",
    "sexually",
    "unprotected",
    "violence",
  ],
  contraception: [
    "condom",
    "condoms",
    "contraception",
    "contraceptive",
    "dapivirine",
    "implant",
    "injectables",
    "pep",
    "pill",
    "prep",
    "prophylaxis",
  ],
  medicinesTestsAndTreatment: [
    "antibiotics",
    "arv",
    "curable",
    "cured",
    "diagnosed",
    "dose",
    "doses",
    "drug",
    "exposed",
    "exposure",
    "folic",
    "iron",
    "medical",
    "medication",
    "medicine",
    "painkiller",
    "painkillers",
    "regimen",
    "supplements",
    "tablets",
    "test",
    "tested",
    "testing",
    "tests",
    "treat",
    "treated",
    "treating",
    "treatment",
    "vaccine",
  ],
  servicesAndWorkers: [
    "clinic",
    "clinical",
    "clinicians",
    "clinics",
    "counselling",
    "facilities",
    "facility",
    "gp",
    "health",
    "hospital",
    "hygienically",
    "mhm",
    "nurse",
    "pharmacies",
    "pharmacist",
    "srh",
    "yfs",
  ],
};

/** Every word of the active knowledge base, normalised like a query. */
function kbVocabulary() {
  const words = new Set();
  for (const entries of Object.values(loadKnowledgeBase())) {
    for (const entry of entries) {
      for (const field of KB_FIELDS) {
        for (const word of tokenize(entry[field] || "")) {
          if (!/^\d+$/.test(word)) words.add(word);
        }
      }
    }
  }
  return words;
}

/** The list to write; throws if a selected term is not in the KB. */
function buildHealthTerms() {
  const vocabulary = kbVocabulary();
  const terms = [...new Set(Object.values(SELECTED).flat())].sort();
  const missing = terms.filter((term) => !vocabulary.has(term));
  if (missing.length > 0) {
    throw new Error(
      `Not words of the active knowledge base: ${missing.join(", ")}`,
    );
  }
  return {
    description:
      "Health terms for the vague-query rule. Generated by " +
      "app/gateway/scripts/build-health-terms.js from the active " +
      "knowledge base; do not edit by hand.",
    kbWords: vocabulary.size,
    terms,
  };
}

const serialize = (list) => `${JSON.stringify(list, null, 2)}\n`;

/** queryRules.ts source with its generated block holding these terms. */
function renderOffline(source, terms) {
  const start = source.indexOf(BLOCK_START);
  const end = source.indexOf(BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No generated block in ${OFFLINE_FILE}`);
  }
  const block = [
    `${BLOCK_START}: written by`,
    "// app/gateway/scripts/build-health-terms.js; do not edit by hand.",
    "export const HEALTH_TERMS: readonly string[] = [",
    ...terms.map((term) => `  "${term}",`),
    "];",
    "",
  ].join("\n");
  return source.slice(0, start) + block + source.slice(end);
}

function main(argv) {
  if (argv.includes("--vocab")) {
    console.log([...kbVocabulary()].sort().join("\n"));
    return 0;
  }

  const list = buildHealthTerms();
  const text = serialize(list);
  const offlineSource = fs.readFileSync(OFFLINE_FILE, "utf8");
  const offlineText = renderOffline(offlineSource, list.terms);

  if (argv.includes("--check")) {
    const current = fs.existsSync(OUTPUT_FILE)
      ? fs.readFileSync(OUTPUT_FILE, "utf8")
      : null;
    if (current !== text || offlineSource !== offlineText) {
      console.error(
        "The health-term lists are out of date. Run: node scripts/build-health-terms.js",
      );
      return 1;
    }
    console.log(
      "src/content/healthTerms.json and the offline queryRules.ts are up to date.",
    );
    return 0;
  }

  fs.writeFileSync(OUTPUT_FILE, text);
  fs.writeFileSync(OFFLINE_FILE, offlineText);
  console.log(
    `Wrote ${list.terms.length} health terms (of ${list.kbWords} knowledge-base words) to src/content/healthTerms.json and the offline queryRules.ts`,
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  buildHealthTerms,
  renderOffline,
  serialize,
  OFFLINE_FILE,
  OUTPUT_FILE,
  SELECTED,
};
