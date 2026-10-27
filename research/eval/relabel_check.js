#!/usr/bin/env node
/**
 * Check a filled relabelling sheet (docs/decision-log.md, "KB 62
 * relabelling") and, if it passes, convert it into labels files.
 *
 * The sheet is relabel_items.csv from relabel_kit.js, filled in by the
 * labeller. Every row must have a best_entry_id or none_fits = Y (not
 * both); every id must be one of the 62 served entries; acceptable ids
 * only with a best entry; no id twice in a row; item ids and question
 * text exactly as in the kit (checked against the key and the source
 * files); no blank, missing or extra rows.
 *
 * With --out, a sheet that passes is written as two files in the schemas
 * of the existing files, outside the repository:
 *   retrieval_eval_set_labels_kb62.csv  (schema of
 *     resources/eval/retrieval_eval_set_labels_2026-10-15.csv; the 23
 *     rows not relabelled are copied unchanged)
 *   relevance_validation_kb62.csv       (schema of
 *     resources/eval/relevance_validation.csv)
 * Nothing is scored here.
 *
 * Usage:
 *   node research/eval/relabel_check.js --sheet FILE
 *        [--key C:\Users\cindy\relabel_key\item_map.csv] [--out DIR]
 * Exit status: 0 if the sheet passes, 1 if it does not, 2 on a usage error.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readCsv } = require("./k5_measure");
const { SHEET_COLUMNS, servedEntries, sourceItems, toCsv } = require("./relabel_kit");

const ROOT = path.join(__dirname, "..", "..");
const FILES = {
  labels: path.join(ROOT, "resources", "eval", "retrieval_eval_set_labels_2026-10-15.csv"),
  gateSet: path.join(ROOT, "resources", "eval", "relevance_validation.csv"),
};
const LABEL_COLUMNS = [
  "id", "query", "group", "acceptable_entry_ids", "expected_class", "accepted_classes",
  "previous_class", "previous_status", "label_changed", "reason", "considered_not_accepted",
];
const GATE_COLUMNS = ["id", "query", "group", "expected", "likely_entry", "notes"];
const ENTRY_ID = /^KB-[CSPG]\d+$/;

const normalizeText = (text) => (text || "").replace(/\s+/g, " ").trim();
const splitIds = (value) => (value || "").split(";").map((s) => s.trim()).filter(Boolean);

/**
 * Check the sheet. Returns a list of problems (empty when it passes).
 *
 * @param {object[]} rows - Sheet rows (readCsv of relabel_items.csv).
 * @param {object} context
 * @param {string[]} context.columns - The sheet's header.
 * @param {object[]} context.key - item_map.csv rows.
 * @param {Map<string,string>} context.texts - "source:original_id" -> text.
 * @param {Set<string>} context.served - The served entry ids.
 */
function checkSheet(rows, { columns, key, texts, served }) {
  const problems = [];
  if (columns.join(",") !== SHEET_COLUMNS.join(",")) {
    problems.push(`header must be exactly: ${SHEET_COLUMNS.join(",")}`);
    return problems;
  }
  const keyById = new Map(key.map((k) => [k.item_id, k]));
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    const where = `row ${index + 2} (${row.item_id || "no item_id"})`;
    if (Object.values(row).every((v) => (v || "").trim() === "")) {
      problems.push(`row ${index + 2}: blank row`);
      continue;
    }
    const k = keyById.get(row.item_id);
    if (!k) {
      problems.push(`${where}: item_id is not in the kit`);
      continue;
    }
    if (seen.has(row.item_id)) problems.push(`${where}: item_id appears twice`);
    seen.add(row.item_id);
    if (normalizeText(row.question_text) !== normalizeText(texts.get(`${k.source}:${k.original_id}`))) {
      problems.push(`${where}: question_text was changed`);
    }

    const best = (row.best_entry_id || "").trim();
    const acceptable = splitIds(row.acceptable_entry_ids);
    const noneFits = (row.none_fits || "").trim();
    if (noneFits !== "" && noneFits.toUpperCase() !== "Y") {
      problems.push(`${where}: none_fits must be Y or blank, not "${noneFits}"`);
    }
    const none = noneFits.toUpperCase() === "Y";
    if (!best && !none) problems.push(`${where}: needs best_entry_id or none_fits = Y`);
    if (best && none) problems.push(`${where}: has both best_entry_id and none_fits = Y`);
    if (none && acceptable.length) problems.push(`${where}: acceptable_entry_ids with none_fits = Y`);
    if (!best && acceptable.length && !none) problems.push(`${where}: acceptable_entry_ids without best_entry_id`);
    const ids = [...(best ? [best] : []), ...acceptable];
    for (const id of ids) {
      if (!ENTRY_ID.test(id)) problems.push(`${where}: "${id}" is not an entry id`);
      else if (!served.has(id)) problems.push(`${where}: ${id} is not one of the served entries`);
    }
    const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (repeated.length) problems.push(`${where}: ${[...new Set(repeated)].join(", ")} listed twice`);
  }
  const missing = key.filter((k) => !seen.has(k.item_id)).map((k) => k.item_id);
  if (missing.length) problems.push(`missing items: ${missing.join(", ")}`);
  return problems;
}

/**
 * Convert a sheet that passed into the two labels files' rows.
 *
 * @param {object[]} rows - Sheet rows.
 * @param {object[]} key - item_map.csv rows.
 * @param {object} sources - { labels: rows of the 2026-10-15 labels file,
 *        gateSet: rows of relevance_validation.csv, classOf: Map id -> class }.
 */
function convert(rows, key, { labels, gateSet, classOf }) {
  const keyById = new Map(key.map((k) => [k.item_id, k]));
  const label = new Map();
  for (const row of rows) {
    const k = keyById.get(row.item_id);
    const best = (row.best_entry_id || "").trim();
    const ids = best ? [best, ...splitIds(row.acceptable_entry_ids)] : [];
    label.set(`${k.source}:${k.original_id}`, { ids, notes: (row.notes || "").trim() });
  }

  const devRows = labels.map((old) => {
    const fresh = label.get(`dev:${old.id}`);
    if (!fresh) return old;
    const classes = [...new Set(fresh.ids.map((id) => classOf.get(id)))];
    const acceptable = fresh.ids.join(";");
    const expectedClass = fresh.ids.length ? classOf.get(fresh.ids[0]) : "none";
    return {
      id: old.id,
      query: old.query,
      group: old.group,
      acceptable_entry_ids: acceptable,
      expected_class: expectedClass,
      accepted_classes: classes.length ? classes.join(";") : "none",
      previous_class: old.expected_class,
      previous_status: "2026-10-15 label (21-entry KB)",
      label_changed:
        acceptable !== old.acceptable_entry_ids || expectedClass !== old.expected_class ? "yes" : "no",
      reason: fresh.notes || "blind relabel against the 62 served entries",
      considered_not_accepted: "",
    };
  });

  const gateRows = gateSet.map((old) => {
    const fresh = label.get(`gate:${old.id}`);
    const also = fresh.ids.slice(1);
    const notes = [also.length ? `also acceptable: ${also.join(";")}` : "", fresh.notes].filter(Boolean);
    return {
      id: old.id,
      query: old.query,
      group: old.group,
      // Referral and signpost rows test the Safety Net and help rules,
      // not an entry, so their expected behaviour is kept.
      expected:
        old.expected === "REFERRAL_OR_SIGNPOST" ? old.expected : fresh.ids.length ? "ANSWER" : "NOT_KB_ANSWER",
      likely_entry: fresh.ids[0] || "",
      notes: notes.join("; "),
    };
  });

  return { devRows, gateRows };
}

function parseArgs(argv) {
  const args = { sheet: null, key: "C:\\Users\\cindy\\relabel_key\\item_map.csv", out: null };
  for (let i = 2; i < argv.length; i += 2) {
    const name = argv[i].replace(/^--/, "");
    if (!(name in args) || argv[i + 1] === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    }
    args[name] = argv[i + 1];
  }
  if (!args.sheet) throw new Error("--sheet is required");
  return args;
}

const insideRepo = (dir) => !path.relative(ROOT, path.resolve(dir)).startsWith("..");

/** The header of a CSV file, as readCsv sees it. */
const headerOf = (file) =>
  fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)[0].split(",").map((c) => c.trim());

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
    if (args.out && insideRepo(args.out)) throw new Error(`${args.out} is inside the repository`);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  const rows = readCsv(args.sheet);
  const key = readCsv(args.key);
  const texts = new Map(sourceItems().map((i) => [`${i.source}:${i.original_id}`, i.text]));
  const entries = servedEntries();
  const problems = checkSheet(rows, {
    columns: headerOf(args.sheet),
    key,
    texts,
    served: new Set(entries.map((e) => e.entry_id)),
  });
  if (problems.length) {
    console.log(`The sheet does not pass (${problems.length} problems):`);
    problems.forEach((p) => console.log(`  ${p}`));
    return 1;
  }
  console.log(`The sheet passes: ${rows.length} items.`);
  if (!args.out) return 0;

  const { devRows, gateRows } = convert(rows, key, {
    labels: readCsv(FILES.labels),
    gateSet: readCsv(FILES.gateSet),
    classOf: new Map(entries.map((e) => [e.entry_id, e.class])),
  });
  fs.mkdirSync(args.out, { recursive: true });
  const outputs = [
    [path.join(args.out, "retrieval_eval_set_labels_kb62.csv"), LABEL_COLUMNS, devRows],
    [path.join(args.out, "relevance_validation_kb62.csv"), GATE_COLUMNS, gateRows],
  ];
  for (const [file] of outputs) {
    if (fs.existsSync(file)) {
      console.error(`${file} exists; refusing to overwrite`);
      return 2;
    }
  }
  for (const [file, columns, data] of outputs) {
    fs.writeFileSync(file, toCsv(columns, data));
    console.log(`Wrote ${file} (${data.length} rows)`);
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { GATE_COLUMNS, LABEL_COLUMNS, checkSheet, convert };
