#!/usr/bin/env node
/**
 * Blind labelling kit for the fresh test set (docs/decision-log.md, "KB
 * scale validation: gate and ranking (PRE-REGISTRATION)" and "KB scale
 * validation: fresh set exclusions"), built and checked the same way as
 * the relabelling kit (relabel_kit.js, relabel_check.js).
 *
 *   build  Writes, outside the repository:
 *            <kit>/relabel_items.csv   the fresh questions in a fixed
 *                                      shuffled order (seed 20261028)
 *                                      under ids F01..., with empty label
 *                                      columns; no group, source row,
 *                                      score or system output
 *            <kit>/kb62_reference.csv  the 62 served entries
 *            <kit>/README.txt          instructions for the labeller
 *            <key>/item_map.csv        F id -> source_row and group; keep
 *                                      it away from the labeller
 *          It refuses a fresh file whose SHA-256 is not the logged one.
 *   check  Checks a filled sheet with relabel_check.js's rules and, with
 *          --out (outside the repository), writes fresh_test_v1_labels.csv:
 *          source_row, group, acceptable_entry_ids (best first),
 *          expected (ANSWER or NONE_FITS), expected_class, notes.
 *
 * Usage:
 *   node research/eval/fresh_kit.js build [--fresh FILE] [--kit DIR] [--key DIR]
 *   node research/eval/fresh_kit.js check --sheet FILE [--fresh FILE]
 *        [--key FILE] [--out DIR]
 * Defaults: --fresh C:\Users\cindy\fresh\fresh_test_v1.csv
 *           --kit C:\Users\cindy\fresh_kit  --key C:\Users\cindy\fresh_key
 * check exits 0 if the sheet passes, 1 if it does not, 2 on a usage error.
 */

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { readCsv } = require("./k5_measure");
const { SHEET_COLUMNS, buildKit, insideRepo, readme, servedEntries, toCsv } = require("./relabel_kit");
const { checkSheet } = require("./relabel_check");

const SEED = 20261028;
const PREFIX = "F";
const FRESH_SHA256 = "667A547C06CDF6B097061D6F096A1585339B3193F439240D98BC202036157C54";
const KEY_COLUMNS = ["item_id", "source_row", "group"];
const LABEL_COLUMNS = ["source_row", "group", "acceptable_entry_ids", "expected", "expected_class", "notes"];
const DEFAULTS = {
  fresh: "C:\\Users\\cindy\\fresh\\fresh_test_v1.csv",
  kit: "C:\\Users\\cindy\\fresh_kit",
  key: "C:\\Users\\cindy\\fresh_key",
};

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
const splitIds = (value) => (value || "").split(";").map((s) => s.trim()).filter(Boolean);

/** The fresh rows as kit items, checking the file's logged hash. */
function freshItems(file, expectedSha = FRESH_SHA256) {
  if (expectedSha && sha256(file) !== expectedSha) {
    throw new Error("the fresh file's SHA-256 is not the logged one; refusing to use it");
  }
  return readCsv(file).map((row) => ({
    source: "fresh",
    original_id: row.source_row,
    text: row.question_text,
    group: row.group,
  }));
}

/** The kit in memory: the sheet, the key (F id -> source_row, group) and the reference. */
function buildFreshKit(items, seed = SEED) {
  const kit = buildKit(items, seed, { prefix: PREFIX });
  const groupOf = new Map(items.map((i) => [i.original_id, i.group]));
  return {
    sheet: kit.sheet,
    key: kit.key.map((k) => ({ item_id: k.item_id, source_row: k.original_id, group: groupOf.get(k.original_id) })),
    reference: kit.reference,
  };
}

/** relabel_check.js's rules, with the fresh key and texts. */
function checkFreshSheet(rows, { columns, key, items, served }) {
  return checkSheet(rows, {
    columns,
    key: key.map((k) => ({ item_id: k.item_id, source: "fresh", original_id: k.source_row })),
    texts: new Map(items.map((i) => [`fresh:${i.original_id}`, i.text])),
    served,
  });
}

/** A sheet that passed, as labels rows in source-row order. */
function convertFresh(rows, key, classOf) {
  const keyById = new Map(key.map((k) => [k.item_id, k]));
  return rows
    .map((row) => {
      const k = keyById.get(row.item_id);
      const best = (row.best_entry_id || "").trim();
      const ids = best ? [best, ...splitIds(row.acceptable_entry_ids)] : [];
      return {
        source_row: k.source_row,
        group: k.group,
        acceptable_entry_ids: ids.join(";"),
        expected: ids.length ? "ANSWER" : "NONE_FITS",
        expected_class: ids.length ? classOf.get(ids[0]) : "none",
        notes: (row.notes || "").trim(),
      };
    })
    .sort((a, b) => Number(a.source_row) - Number(b.source_row));
}

function parseArgs(argv) {
  const step = argv[2];
  const args = { step, ...DEFAULTS, sheet: null, out: null };
  for (let i = 3; i < argv.length; i += 2) {
    const name = argv[i].replace(/^--/, "");
    if (!(name in args) || name === "step" || argv[i + 1] === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    }
    args[name] = argv[i + 1];
  }
  if (!["build", "check"].includes(step)) throw new Error("the first argument must be build or check");
  if (step === "check") {
    if (!args.sheet) throw new Error("--sheet is required");
    if (args.key === DEFAULTS.key) args.key = path.join(DEFAULTS.key, "item_map.csv");
    if (args.out && insideRepo(args.out)) throw new Error(`${args.out} is inside the repository`);
  }
  return args;
}

const headerOf = (file) =>
  fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)[0].split(",").map((c) => c.trim());

function build(args) {
  for (const dir of [args.kit, args.key]) {
    if (insideRepo(dir)) throw new Error(`${dir} is inside the repository; the kit stays out of git`);
  }
  if (path.resolve(args.kit) === path.resolve(args.key)) throw new Error("--kit and --key must differ");
  const kit = buildFreshKit(freshItems(args.fresh));
  const sheetPath = path.join(args.kit, "relabel_items.csv");
  if (fs.existsSync(sheetPath)) throw new Error(`${sheetPath} exists; refusing to overwrite a sheet`);
  for (const dir of [args.kit, args.key]) fs.mkdirSync(dir, { recursive: true });
  const bom = "\uFEFF";
  fs.writeFileSync(sheetPath, bom + toCsv(SHEET_COLUMNS, kit.sheet));
  fs.writeFileSync(
    path.join(args.kit, "kb62_reference.csv"),
    bom + toCsv(["entry_id", "class", "question", "answer"], kit.reference),
  );
  fs.writeFileSync(path.join(args.kit, "README.txt"), readme(kit.sheet.length));
  fs.writeFileSync(path.join(args.key, "item_map.csv"), toCsv(KEY_COLUMNS, kit.key));
  console.log(
    `Kit: ${kit.sheet.length} items, ${kit.reference.length} reference entries -> ${args.kit}; key -> ${args.key}`,
  );
  return 0;
}

function check(args) {
  const rows = readCsv(args.sheet);
  const key = readCsv(args.key);
  const entries = servedEntries();
  const problems = checkFreshSheet(rows, {
    columns: headerOf(args.sheet),
    key,
    items: freshItems(args.fresh),
    served: new Set(entries.map((e) => e.entry_id)),
  });
  if (problems.length) {
    console.log(`The sheet does not pass (${problems.length} problems):`);
    problems.forEach((p) => console.log(`  ${p}`));
    return 1;
  }
  console.log(`The sheet passes: ${rows.length} items.`);
  if (!args.out) return 0;
  const file = path.join(args.out, "fresh_test_v1_labels.csv");
  if (fs.existsSync(file)) {
    console.error(`${file} exists; refusing to overwrite`);
    return 2;
  }
  const labels = convertFresh(rows, key, new Map(entries.map((e) => [e.entry_id, e.class])));
  fs.mkdirSync(args.out, { recursive: true });
  fs.writeFileSync(file, toCsv(LABEL_COLUMNS, labels));
  console.log(`Wrote ${file} (${labels.length} rows)`);
  return 0;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  try {
    return args.step === "build" ? build(args) : check(args);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  FRESH_SHA256, KEY_COLUMNS, LABEL_COLUMNS, SEED, buildFreshKit, checkFreshSheet, convertFresh, freshItems,
  parseArgs,
};
