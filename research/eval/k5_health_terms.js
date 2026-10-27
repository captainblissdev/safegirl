#!/usr/bin/env node
/**
 * Health-term drift on the 62-entry KB (read-only analysis, 27 October
 * 2026). No services needed.
 *
 * scripts/build-health-terms.js refuses to rebuild the list because four
 * selected terms (abortion, nurse, pharmacies, sexuality) are no longer
 * words of the active KB. A rebuild would drop them from
 * src/content/healthTerms.json, a V4 feature source. For each term this
 * records which lists hold it, how many texts contain it (as the vague
 * rule matches words, with its plural rule), and which texts' vague-rule
 * result would change if it were removed from healthTerms.json (and if
 * all four were), on the 62 KB questions, the 35 labelled dev questions,
 * the 380 V4 training seeds and their 1,239 paraphrases.
 *
 * Writes ids and counts only to research/v4/results/k5_health_terms.json.
 *
 * Usage: node research/eval/k5_health_terms.js
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readCsv } = require("./k5_measure");

const ROOT = path.join(__dirname, "..", "..");
const GW = path.join(ROOT, "app", "gateway", "src");
const { loadKnowledgeBase } = require(path.join(GW, "retrievalModule"));
const vague = require(path.join(GW, "vagueQuery"));

const TERMS = ["abortion", "nurse", "pharmacies", "sexuality"];
const OUT = path.join(ROOT, "research", "v4", "results", "k5_health_terms.json");

/** The V4 training texts, as research/v4/cv_common.py load_data() builds them. */
function trainingTexts() {
  const v4 = path.join(ROOT, "research", "v4");
  const excluded = new Set([
    ...readCsv(path.join(v4, "v3_pool_exclusions.csv")).map((r) => r.item_id),
    ...readCsv(path.join(v4, "dr05_exclusions.csv")).map((r) => r.item_id),
  ]);
  const csvs = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith(".csv")).sort().map((f) => path.join(dir, f));
  const seedFiles = csvs(v4).filter((f) => /seeds_v4_batch\d+\.csv$/.test(f));
  seedFiles.push(path.join(ROOT, "resources", "seeds", "seeds.csv"));
  const seeds = seedFiles
    .flatMap((f) => readCsv(f))
    .filter((r) => !excluded.has(r.seed_id))
    .map((r) => ({ id: r.seed_id, text: r.text }));
  const reviewed = path.join(ROOT, "resources", "reviewed");
  const paraphrases = [...csvs(reviewed), ...csvs(path.join(reviewed, "v4"))]
    .flatMap((f) => readCsv(f))
    .filter((r) => !excluded.has(r.paraphrase_id))
    .map((r) => ({ id: r.paraphrase_id, text: r.text }));
  if (seeds.length !== 380 || paraphrases.length !== 1239) {
    throw new Error(`expected 380 seeds and 1,239 paraphrases, got ${seeds.length} and ${paraphrases.length}`);
  }
  return { seeds, paraphrases };
}

/** isVagueQuery with a given single-word term set (same steps as vagueQuery.js). */
function isVagueWith(text, words) {
  const content = vague.contentWords(text);
  return (
    content.length <= vague.MAX_CONTENT_WORDS &&
    !content.some((word) => vague.isHealthTerm(word, words)) &&
    !vague.hasHealthPhrase(text)
  );
}

function main() {
  const kbList = vague.getHealthTerms();
  const extra = vague.getExtraHealthTerms();
  const current = new Set([...kbList, ...extra.words]);
  const without = (removed) =>
    new Set([...[...kbList].filter((t) => !removed.includes(t)), ...extra.words]);

  const evalRows = Object.fromEntries(
    readCsv(path.join(ROOT, "resources", "eval", "retrieval_eval_set.csv")).map((r) => [r.id, r]),
  );
  const devIds = readCsv(path.join(ROOT, "resources", "eval", "retrieval_eval_set_labels_2026-10-15.csv"))
    .filter((r) => r.expected_class !== "none")
    .map((r) => r.id);
  const { seeds, paraphrases } = trainingTexts();
  const sets = {
    kb_questions: Object.values(loadKnowledgeBase()).flat().map((e) => ({ id: e.kbId, text: e.question })),
    dev_questions: devIds.map((id) => ({ id, text: evalRows[id].query })),
    seeds,
    paraphrases,
  };

  // Sanity check: the copy of the rule agrees with isVagueQuery on every text.
  for (const items of Object.values(sets)) {
    for (const item of items) {
      if (isVagueWith(item.text, current) !== vague.isVagueQuery(item.text)) {
        throw new Error(`rule copy disagrees with isVagueQuery on ${item.id}`);
      }
    }
  }

  const changes = (removed) => {
    const words = without(removed);
    return Object.fromEntries(
      Object.entries(sets).map(([name, items]) => [
        name,
        items.filter((i) => isVagueWith(i.text, current) !== isVagueWith(i.text, words)).map((i) => i.id),
      ]),
    );
  };

  const terms = TERMS.map((term) => ({
    term,
    in_healthTerms_json: kbList.has(term),
    in_extraHealthTerms_json: extra.words.has(term),
    texts_containing: Object.fromEntries(
      Object.entries(sets).map(([name, items]) => [
        name,
        items.filter((i) => vague.contentWords(i.text).some((w) => vague.isHealthTerm(w, new Set([term])))).length,
      ]),
    ),
    vague_result_changes_if_removed: changes([term]),
  }));

  const result = {
    measured: new Date().toISOString(),
    set_sizes: Object.fromEntries(Object.entries(sets).map(([name, items]) => [name, items.length])),
    vague_now: Object.fromEntries(
      Object.entries(sets).map(([name, items]) => [name, items.filter((i) => vague.isVagueQuery(i.text)).length]),
    ),
    terms,
    vague_result_changes_if_all_four_removed: changes(TERMS),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}

main();
