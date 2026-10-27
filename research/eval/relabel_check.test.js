/**
 * Tests for relabel_kit.js and relabel_check.js. Every filled sheet here
 * is SYNTHETIC; the real sheet is never read.
 *
 * Run: node --test research/eval/relabel_check.test.js
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { SHEET_COLUMNS, buildKit, shuffle, sourceItems } = require("./relabel_kit");
const { GATE_COLUMNS, LABEL_COLUMNS, checkSheet, convert } = require("./relabel_check");

const ROOT = path.join(__dirname, "..", "..");
const header = (file) => fs.readFileSync(path.join(ROOT, file), "utf8").split(/\r?\n/)[0];

// Synthetic items, entries and labels.
const ITEMS = [
  { source: "dev", original_id: "Q01", text: "synthetic dev question one" },
  { source: "dev", original_id: "Q02", text: "synthetic dev question two" },
  { source: "dev", original_id: "Q03", text: "synthetic dev question three" },
  { source: "gate", original_id: "V01", text: "synthetic gate question one" },
  { source: "gate", original_id: "V02", text: "synthetic gate question two" },
  { source: "gate", original_id: "V03", text: "synthetic gate question three" },
];
const SERVED = new Set(["KB-C1", "KB-C2", "KB-S1", "KB-G1"]);
const CLASS_OF = new Map([
  ["KB-C1", "contraception"], ["KB-C2", "contraception"], ["KB-S1", "sti"], ["KB-G1", "general"],
]);
const TEXTS = new Map(ITEMS.map((i) => [`${i.source}:${i.original_id}`, i.text]));

function synthetic() {
  const kit = buildKit(ITEMS, 7);
  const fills = {
    "dev:Q01": { best_entry_id: "KB-C1", acceptable_entry_ids: "KB-C2" },
    "dev:Q02": { best_entry_id: "KB-S1" },
    "dev:Q03": { none_fits: "Y", notes: "no entry fits" },
    "gate:V01": { best_entry_id: "KB-G1" },
    "gate:V02": { none_fits: "y" },
    "gate:V03": { none_fits: "Y" },
  };
  const rows = kit.sheet.map((row, i) => {
    const k = kit.key[i];
    return {
      best_entry_id: "", acceptable_entry_ids: "", none_fits: "", notes: "",
      ...row,
      ...fills[`${k.source}:${k.original_id}`],
    };
  });
  return { kit, rows };
}

const check = (rows, key, columns = SHEET_COLUMNS) =>
  checkSheet(rows, { columns, key, texts: TEXTS, served: SERVED });

describe("relabelling kit", () => {
  const items = sourceItems();
  const kit = buildKit();

  it("holds the 35 dev questions and the 40 gate-set items", () => {
    assert.equal(items.filter((i) => i.source === "dev").length, 35);
    assert.equal(items.filter((i) => i.source === "gate").length, 40);
    assert.equal(kit.sheet.length, 75);
  });

  it("gives opaque ids in sheet order and no label, output or original id", () => {
    assert.deepEqual(kit.sheet.map((r) => r.item_id), items.map((_, i) => `R${String(i + 1).padStart(2, "0")}`));
    for (const row of kit.sheet) {
      assert.deepEqual(Object.keys(row), ["item_id", "question_text"]);
      assert.doesNotMatch(row.question_text, /KB-[CSPG]\d/);
    }
    assert.deepEqual(SHEET_COLUMNS, [
      "item_id", "question_text", "best_entry_id", "acceptable_entry_ids", "none_fits", "notes",
    ]);
  });

  it("uses a fixed shuffled order (seed 20261027)", () => {
    assert.deepEqual(buildKit().key, kit.key);
    assert.notDeepEqual(kit.key.map((k) => k.original_id), items.map((i) => i.original_id));
    const ids = (list) => list.map((i) => `${i.source}:${i.original_id}`).sort();
    assert.deepEqual(ids(shuffle(items, 1)), ids(items));
  });

  it("lists the 62 served entries and no pending one", () => {
    const ids = kit.reference.map((e) => e.entry_id);
    assert.equal(ids.length, 62);
    for (const pending of ["KB-C6", "KB-C14", "KB-S19", "KB-C22"]) {
      assert.ok(!ids.includes(pending), pending);
    }
  });
});

describe("relabel_check on a synthetic sheet", () => {
  it("passes a complete sheet", () => {
    const { kit, rows } = synthetic();
    assert.deepEqual(check(rows, kit.key), []);
  });

  it("rejects a wrong header", () => {
    const { kit, rows } = synthetic();
    assert.match(check(rows, kit.key, ["item_id", "question_text"])[0], /header/);
  });

  const broken = [
    ["neither best_entry_id nor none_fits", { best_entry_id: "", none_fits: "" }, /needs best_entry_id/],
    ["both best_entry_id and none_fits", { best_entry_id: "KB-C1", none_fits: "Y" }, /both/],
    ["a bad none_fits value", { best_entry_id: "", none_fits: "yes" }, /Y or blank/],
    ["an id that is not an entry id", { best_entry_id: "C1" }, /not an entry id/],
    ["an entry that is not served", { best_entry_id: "KB-C6" }, /not one of the served/],
    ["an unknown acceptable id", { best_entry_id: "KB-C1", acceptable_entry_ids: "KB-S9" }, /not one of the served/],
    ["an id twice in a row", { best_entry_id: "KB-C1", acceptable_entry_ids: "KB-C2;KB-C1" }, /listed twice/],
    ["acceptable ids with none_fits", { best_entry_id: "", none_fits: "Y", acceptable_entry_ids: "KB-C1" }, /with none_fits/],
    ["acceptable ids without a best entry", { best_entry_id: "", acceptable_entry_ids: "KB-C1" }, /without best_entry_id/],
    ["changed question text", { question_text: "edited" }, /question_text was changed/],
  ];
  for (const [name, change, pattern] of broken) {
    it(`rejects ${name}`, () => {
      const { kit, rows } = synthetic();
      // The row for dev Q02: a best entry, no acceptable ids, no none_fits.
      const i = kit.key.findIndex((k) => k.original_id === "Q02");
      rows[i] = { ...rows[i], ...change };
      const problems = check(rows, kit.key);
      assert.ok(problems.some((p) => pattern.test(p)), problems.join(" | "));
    });
  }

  it("rejects blank, repeated, unknown and missing rows", () => {
    const { kit, rows } = synthetic();
    const blank = Object.fromEntries(SHEET_COLUMNS.map((c) => [c, ""]));
    const problems = check([rows[0], rows[0], { ...rows[1], item_id: "R99" }, blank], kit.key);
    for (const pattern of [/appears twice/, /not in the kit/, /blank row/, /missing items/]) {
      assert.ok(problems.some((p) => pattern.test(p)), `${pattern} in ${problems.join(" | ")}`);
    }
  });

  it("ignores spacing differences in the question text", () => {
    const { kit, rows } = synthetic();
    rows[0] = { ...rows[0], question_text: `  ${rows[0].question_text.replace(/ /g, "  ")} ` };
    assert.deepEqual(check(rows, kit.key), []);
  });
});

describe("conversion to labels files (synthetic)", () => {
  const labels = [
    ...ITEMS.filter((i) => i.source === "dev").map((i) => ({
      id: i.original_id, query: i.text, group: "clear", acceptable_entry_ids: "KB-C1",
      expected_class: "contraception", accepted_classes: "contraception", previous_class: "contraception",
      previous_status: "provisional", label_changed: "no", reason: "", considered_not_accepted: "",
    })),
    {
      id: "Q09", query: "synthetic unlabelled", group: "off_topic", acceptable_entry_ids: "",
      expected_class: "none", accepted_classes: "none", previous_class: "none",
      previous_status: "provisional", label_changed: "no", reason: "", considered_not_accepted: "",
    },
  ];
  const gateSet = ITEMS.filter((i) => i.source === "gate").map((i, n) => ({
    id: i.original_id, query: i.text, group: ["in_scope", "off_topic", "distress"][n],
    expected: ["ANSWER", "NOT_KB_ANSWER", "REFERRAL_OR_SIGNPOST"][n], likely_entry: "", notes: "",
  }));
  const { kit, rows } = synthetic();
  const { devRows, gateRows } = convert(rows, kit.key, { labels, gateSet, classOf: CLASS_OF });
  const dev = Object.fromEntries(devRows.map((r) => [r.id, r]));
  const gate = Object.fromEntries(gateRows.map((r) => [r.id, r]));

  it("uses the schemas of the existing files", () => {
    assert.equal(LABEL_COLUMNS.join(","), header("resources/eval/retrieval_eval_set_labels_2026-10-15.csv"));
    assert.equal(GATE_COLUMNS.join(","), header("resources/eval/relevance_validation.csv"));
    for (const row of devRows) assert.deepEqual(Object.keys(row), LABEL_COLUMNS);
    for (const row of gateRows) assert.deepEqual(Object.keys(row), GATE_COLUMNS);
  });

  it("writes the best entry first, then the other acceptable ones", () => {
    assert.equal(dev.Q01.acceptable_entry_ids, "KB-C1;KB-C2");
    assert.equal(dev.Q01.expected_class, "contraception");
    assert.equal(dev.Q01.label_changed, "yes");
    assert.equal(dev.Q02.accepted_classes, "sti");
    assert.equal(dev.Q02.previous_class, "contraception");
  });

  it("labels a none-fits question as class none", () => {
    assert.equal(dev.Q03.acceptable_entry_ids, "");
    assert.equal(dev.Q03.expected_class, "none");
    assert.equal(dev.Q03.reason, "no entry fits");
  });

  it("copies rows that were not relabelled unchanged", () => {
    assert.deepEqual(dev.Q09, labels[3]);
    assert.equal(devRows.length, labels.length);
  });

  it("sets the gate-set expectation from the label, keeping referral rows", () => {
    assert.deepEqual([gate.V01.expected, gate.V01.likely_entry], ["ANSWER", "KB-G1"]);
    assert.deepEqual([gate.V02.expected, gate.V02.likely_entry], ["NOT_KB_ANSWER", ""]);
    assert.deepEqual([gate.V03.expected, gate.V03.likely_entry], ["REFERRAL_OR_SIGNPOST", ""]);
  });
});
