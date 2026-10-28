#!/usr/bin/env node
/**
 * Blind relabelling kit for the 62-entry KB (docs/decision-log.md, "KB 62
 * relabelling").
 *
 * Writes, outside the repository:
 *   <kit>/relabel_items.csv    the 35 labelled dev questions and every
 *                              gate-set item, in a fixed shuffled order
 *                              (seed 20261027), with opaque ids R01...
 *                              and empty label columns
 *   <kit>/kb62_reference.csv   the 62 served entries (id, class, question,
 *                              answer); pending entries are not served
 *   <kit>/README.txt           instructions for the labeller
 *   <key>/item_map.csv         opaque id -> source and original id, for
 *                              relabel_check.js only; keep it away from
 *                              the labeller
 *
 * The kit holds no system output, score, previous label or original id.
 *
 * Usage: node research/eval/relabel_kit.js [--kit DIR] [--key DIR]
 * Defaults: --kit C:\Users\cindy\relabel  --key C:\Users\cindy\relabel_key
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readCsv } = require("./k5_measure");

const ROOT = path.join(__dirname, "..", "..");
const { loadKnowledgeBase } = require(path.join(ROOT, "app", "gateway", "src", "retrievalModule"));

const SEED = 20261027;
const SHEET_COLUMNS = ["item_id", "question_text", "best_entry_id", "acceptable_entry_ids", "none_fits", "notes"];
const FILES = {
  evalSet: path.join(ROOT, "resources", "eval", "retrieval_eval_set.csv"),
  labels: path.join(ROOT, "resources", "eval", "retrieval_eval_set_labels_2026-10-15.csv"),
  gateSet: path.join(ROOT, "resources", "eval", "relevance_validation.csv"),
};

/** mulberry32: a small seeded generator, so the order is reproducible. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, seed) {
  const random = seededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const csvField = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const toCsv = (columns, rows) =>
  [columns.join(","), ...rows.map((row) => columns.map((c) => csvField(row[c])).join(","))].join("\n") + "\n";

/** The items to relabel, in the source order: 35 dev questions, then the gate set. */
function sourceItems() {
  const evalRows = Object.fromEntries(readCsv(FILES.evalSet).map((r) => [r.id, r]));
  const dev = readCsv(FILES.labels)
    .filter((r) => r.expected_class !== "none")
    .map((r) => ({ source: "dev", original_id: r.id, text: evalRows[r.id].query }));
  const gate = readCsv(FILES.gateSet).map((r) => ({ source: "gate", original_id: r.id, text: r.query }));
  return [...dev, ...gate];
}

/** The 62 served entries, as the reference sheet lists them. */
function servedEntries() {
  return Object.values(loadKnowledgeBase())
    .flat()
    .map((e) => ({ entry_id: e.kbId, class: e.category, question: e.question, answer: e.answer }));
}

/**
 * Build the kit in memory: the sheet rows, the key rows and the reference
 * rows. Items are { source, original_id, text }; ids are prefix + number.
 */
function buildKit(items = sourceItems(), seed = SEED, { prefix = "R" } = {}) {
  const width = String(items.length).length;
  const shuffled = shuffle(items, seed).map((item, i) => ({
    ...item,
    item_id: `${prefix}${String(i + 1).padStart(Math.max(2, width), "0")}`,
  }));
  return {
    sheet: shuffled.map((item) => ({ item_id: item.item_id, question_text: item.text })),
    key: shuffled.map((item) => ({ item_id: item.item_id, source: item.source, original_id: item.original_id })),
    reference: servedEntries(),
  };
}

const readme = (count) => `SafeGirl: blind relabelling of ${count} questions against the 62-entry KB

Files
  relabel_items.csv   the questions to label (one row each)
  kb62_reference.csv  the 62 knowledge-base entries you choose from

For each row of relabel_items.csv, judge only the question text against
the entries in kb62_reference.csv:
  best_entry_id         the one entry that best answers the question
                        (an entry_id from kb62_reference.csv)
  acceptable_entry_ids  any OTHER entries that would also be an
                        acceptable answer, separated by semicolons
                        (leave blank if none)
  none_fits             Y if no entry answers the question, so the
                        system should not give an answer; then leave
                        best_entry_id and acceptable_entry_ids blank
  notes                 optional

Every row needs either best_entry_id or none_fits = Y. Do not change
item_id or question_text, and do not add or remove rows. Save as
"CSV UTF-8". The questions are in random order; there are no system
answers, scores or earlier labels in this kit, on purpose.
`;

function parseArgs(argv) {
  const args = { kit: "C:\\Users\\cindy\\relabel", key: "C:\\Users\\cindy\\relabel_key" };
  for (let i = 2; i < argv.length; i += 2) {
    const name = argv[i].replace(/^--/, "");
    if (!(name in args) || argv[i + 1] === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    }
    args[name] = argv[i + 1];
  }
  return args;
}

const insideRepo = (dir) => !path.relative(ROOT, path.resolve(dir)).startsWith("..");

function main() {
  const args = parseArgs(process.argv);
  for (const dir of [args.kit, args.key]) {
    if (insideRepo(dir)) throw new Error(`${dir} is inside the repository; the kit stays out of git`);
  }
  if (path.resolve(args.kit) === path.resolve(args.key)) throw new Error("--kit and --key must differ");
  const kit = buildKit();
  for (const dir of [args.kit, args.key]) fs.mkdirSync(dir, { recursive: true });
  const sheetPath = path.join(args.kit, "relabel_items.csv");
  if (fs.existsSync(sheetPath)) throw new Error(`${sheetPath} exists; refusing to overwrite a sheet`);
  // A byte-order mark so spreadsheet programs read the file as UTF-8.
  const bom = "\uFEFF";
  fs.writeFileSync(sheetPath, bom + toCsv(SHEET_COLUMNS, kit.sheet));
  fs.writeFileSync(
    path.join(args.kit, "kb62_reference.csv"),
    bom + toCsv(["entry_id", "class", "question", "answer"], kit.reference),
  );
  fs.writeFileSync(path.join(args.kit, "README.txt"), readme(kit.sheet.length));
  fs.writeFileSync(path.join(args.key, "item_map.csv"), toCsv(["item_id", "source", "original_id"], kit.key));
  const bySource = kit.key.reduce((n, k) => ({ ...n, [k.source]: (n[k.source] || 0) + 1 }), {});
  console.log(
    `Kit: ${kit.sheet.length} items (${bySource.dev} dev, ${bySource.gate} gate set), ` +
      `${kit.reference.length} reference entries -> ${args.kit}; key -> ${args.key}`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  SEED, SHEET_COLUMNS, buildKit, insideRepo, readme, servedEntries, shuffle, sourceItems, toCsv,
};
