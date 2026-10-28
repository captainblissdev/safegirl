/**
 * Tests that run_eval.js and k5_measure.js read the acceptable entries
 * from a labels file when one is given (synthetic files only), and keep
 * the eval set's entries otherwise.
 *
 * Run: node --test research/eval/labels.test.js
 */

"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { applyDevLabels, gateAcceptable } = require("./labels");
const runEval = require("./run_eval");
const k5 = require("./k5_measure");

// Synthetic eval set and labels in the schemas of the real files.
const SET = [
  "id,query,group,expected_behavior,acceptable_entry_ids,partial_entry_ids,notes",
  "Q01,synthetic one,clear,ANSWER,KB-C1,KB-C2,",
  "Q02,synthetic two,clear,NOT_REFERRAL,KB-G1,,",
  "Q03,synthetic three,off_topic,ABSTAIN,,,",
].join("\n");
const LABELS = [
  "id,query,group,acceptable_entry_ids,expected_class,accepted_classes,previous_class,previous_status,label_changed,reason,considered_not_accepted",
  "Q01,synthetic one,clear,KB-C9;KB-C1,contraception,contraception,contraception,2026-10-15 label (21-entry KB),yes,,",
  "Q02,synthetic two,clear,KB-G2,general,general,general,2026-10-15 label (21-entry KB),yes,,",
  "Q03,synthetic three,off_topic,,none,none,none,provisional,no,,",
].join("\n");

let dir;
const file = (name) => path.join(dir, name);

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "labels-test-"));
  fs.writeFileSync(file("set.csv"), SET + "\n");
  fs.writeFileSync(file("labels.csv"), LABELS + "\n");
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("applyDevLabels", () => {
  const rows = [
    { id: "Q01", expected_behavior: "ANSWER", acceptable_entry_ids: "KB-C1", partial_entry_ids: "KB-C2" },
    { id: "Q03", expected_behavior: "ABSTAIN", acceptable_entry_ids: "", partial_entry_ids: "" },
  ];

  it("takes acceptable entries from labelled rows and drops partial ones", () => {
    const [q01, q03] = applyDevLabels(rows, [
      { id: "Q01", acceptable_entry_ids: "KB-C9;KB-C1", expected_class: "contraception" },
      { id: "Q03", acceptable_entry_ids: "", expected_class: "none" },
    ]);
    assert.equal(q01.acceptable_entry_ids, "KB-C9;KB-C1");
    assert.equal(q01.partial_entry_ids, "");
    assert.equal(q01.expected_behavior, "ANSWER");
    assert.deepEqual(q03, rows[1]);
  });

  it("keeps the eval set's entries without a labels file", () => {
    assert.deepEqual(applyDevLabels(rows, null), rows);
  });
});

describe("gateAcceptable", () => {
  it("reads the likely entry and the also-acceptable ids from notes", () => {
    assert.deepEqual(
      gateAcceptable({ likely_entry: "KB-S1", notes: "also acceptable: KB-S2;KB-S3; labeller note" }),
      ["KB-S1", "KB-S2", "KB-S3"],
    );
    assert.deepEqual(gateAcceptable({ likely_entry: "KB-S1", notes: "" }), ["KB-S1"]);
    assert.deepEqual(gateAcceptable({ likely_entry: "", notes: "" }), []);
  });
});

describe("run_eval.js reads the labels file", () => {
  it("uses --labels for acceptable entries", () => {
    const args = runEval.parseArgs(["node", "run_eval.js", "--set", file("set.csv"), "--labels", file("labels.csv")]);
    const rows = Object.fromEntries(runEval.loadRows(args).map((r) => [r.id, r]));
    assert.equal(rows.Q01.acceptable_entry_ids, "KB-C9;KB-C1");
    assert.equal(rows.Q01.partial_entry_ids, "");
    assert.equal(rows.Q02.acceptable_entry_ids, "KB-G2");
    assert.equal(rows.Q02.expected_behavior, "NOT_REFERRAL");
    assert.equal(rows.Q03.acceptable_entry_ids, "");
  });

  it("uses the eval set without --labels", () => {
    const args = runEval.parseArgs(["node", "run_eval.js", "--set", file("set.csv")]);
    const rows = Object.fromEntries(runEval.loadRows(args).map((r) => [r.id, r]));
    assert.equal(rows.Q01.acceptable_entry_ids, "KB-C1");
    assert.equal(rows.Q01.partial_entry_ids, "KB-C2");
  });
});

describe("k5_measure.js reads the labels file", () => {
  it("takes the labelled ids and acceptable entries from --labels", () => {
    const { ids, rows } = k5.loadDev(file("labels.csv"), file("set.csv"));
    assert.deepEqual(ids, ["Q01", "Q02"]);
    assert.equal(rows.Q01.acceptable_entry_ids, "KB-C9;KB-C1");
    assert.equal(rows.Q02.acceptable_entry_ids, "KB-G2");
  });

  it("accepts --labels, --gate and --tag, with the old files by default", () => {
    const args = k5.parseArgs([
      "node", "k5_measure.js", "--mode", "full", "--labels", "a.csv", "--gate", "b.csv", "--tag", "relabelled",
    ]);
    assert.deepEqual([args.labels, args.gate, args.tag], ["a.csv", "b.csv", "relabelled"]);
    const defaults = k5.parseArgs(["node", "k5_measure.js", "--mode", "full"]);
    assert.match(defaults.labels, /retrieval_eval_set_labels_2026-10-15\.csv$/);
    assert.match(defaults.gate, /relevance_validation\.csv$/);
    assert.equal(defaults.tag, "");
    assert.throws(() => k5.parseArgs(["node", "k5_measure.js", "--mode", "full", "--tag", "../x"]));
  });
});
