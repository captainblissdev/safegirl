/**
 * Tests for fresh_kit.js. Every fresh file and filled sheet here is
 * SYNTHETIC; the real fresh set and sheet are never read.
 *
 * Run: node --test research/eval/fresh_kit.test.js
 */

"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const fresh = require("./fresh_kit");
const { SHEET_COLUMNS } = require("./relabel_kit");

const ROWS = [
  [3, "synthetic fresh question three", "Contraception"],
  [7, "synthetic fresh question seven", "Pregnancy"],
  [8, "synthetic fresh question eight", "Too vague to answer"],
  [12, "synthetic fresh question twelve", "STIs and HIV"],
];
const CSV = ["source_row,question_text,group", ...ROWS.map((r) => r.join(","))].join("\r\n") + "\r\n";
const SERVED = new Set(["KB-C1", "KB-C2", "KB-P1", "KB-S1"]);
const CLASS_OF = new Map([["KB-C1", "contraception"], ["KB-C2", "contraception"], ["KB-P1", "pregnancy"], ["KB-S1", "sti"]]);

let dir;
let file;
let items;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fresh-kit-test-"));
  file = path.join(dir, "fresh.csv");
  fs.writeFileSync(file, "﻿" + CSV);
  const sha = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
  items = fresh.freshItems(file, sha);
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

function filled() {
  const kit = fresh.buildFreshKit(items, 5);
  const fills = {
    3: { best_entry_id: "KB-C1", acceptable_entry_ids: "KB-C2" },
    7: { best_entry_id: "KB-P1" },
    8: { none_fits: "Y" },
    12: { best_entry_id: "KB-S1", notes: "unsure" },
  };
  const rows = kit.sheet.map((row, i) => ({
    best_entry_id: "", acceptable_entry_ids: "", none_fits: "", notes: "",
    ...row,
    ...fills[kit.key[i].source_row],
  }));
  return { kit, rows };
}

const check = (rows, key, columns = SHEET_COLUMNS) =>
  fresh.checkFreshSheet(rows, { columns, key, items, served: SERVED });

describe("fresh kit", () => {
  it("refuses a fresh file whose SHA-256 is not the logged one", () => {
    assert.throws(() => fresh.freshItems(file), /SHA-256/);
    assert.equal(fresh.FRESH_SHA256.length, 64);
  });

  it("gives F ids in sheet order, with no group, source row or output", () => {
    const { sheet, key } = fresh.buildFreshKit(items, 5);
    assert.deepEqual(sheet.map((r) => r.item_id), ["F01", "F02", "F03", "F04"]);
    for (const row of sheet) assert.deepEqual(Object.keys(row), ["item_id", "question_text"]);
    assert.deepEqual(Object.keys(key[0]), fresh.KEY_COLUMNS);
    assert.deepEqual(new Set(key.map((k) => k.source_row)), new Set(["3", "7", "8", "12"]));
    for (const k of key) assert.equal(k.group, ROWS.find((r) => String(r[0]) === k.source_row)[2]);
  });

  it("uses a fixed shuffled order", () => {
    assert.deepEqual(fresh.buildFreshKit(items, 5).key, fresh.buildFreshKit(items, 5).key);
    assert.equal(fresh.SEED, 20261028);
  });

  it("refuses an output folder inside the repository", () => {
    const inside = path.join(__dirname, "out");
    assert.throws(() => fresh.parseArgs(["node", "fresh_kit.js", "check", "--sheet", "s.csv", "--out", inside]));
    assert.throws(() => fresh.parseArgs(["node", "fresh_kit.js", "label"]));
  });
});

describe("fresh sheet check (synthetic)", () => {
  it("passes a complete sheet", () => {
    const { kit, rows } = filled();
    assert.deepEqual(check(rows, kit.key), []);
  });

  it("rejects a missing label, an unserved id, a repeat and edited text", () => {
    const { kit, rows } = filled();
    const at = (sourceRow) => kit.key.findIndex((k) => k.source_row === sourceRow);
    rows[at("3")] = { ...rows[at("3")], best_entry_id: "", acceptable_entry_ids: "" };
    rows[at("7")] = { ...rows[at("7")], best_entry_id: "KB-C6" };
    rows[at("12")] = { ...rows[at("12")], acceptable_entry_ids: "KB-S1" };
    rows[at("8")] = { ...rows[at("8")], question_text: "edited" };
    const problems = check(rows, kit.key).join(" | ");
    for (const pattern of [/needs best_entry_id/, /not one of the served/, /listed twice/, /question_text was changed/]) {
      assert.match(problems, pattern);
    }
  });

  it("rejects missing rows and a wrong header", () => {
    const { kit, rows } = filled();
    assert.match(check(rows.slice(1), kit.key).join(" | "), /missing items/);
    assert.match(check(rows, kit.key, ["item_id", "question_text"])[0], /header/);
  });
});

describe("fresh labels file (synthetic)", () => {
  const { kit, rows } = filled();
  const labels = fresh.convertFresh(rows, kit.key, CLASS_OF);

  it("writes one row per item in source-row order", () => {
    assert.deepEqual(labels.map((r) => r.source_row), ["3", "7", "8", "12"]);
    for (const row of labels) assert.deepEqual(Object.keys(row), fresh.LABEL_COLUMNS);
  });

  it("puts the best entry first and marks none fits", () => {
    const by = Object.fromEntries(labels.map((r) => [r.source_row, r]));
    assert.deepEqual([by[3].acceptable_entry_ids, by[3].expected, by[3].expected_class],
      ["KB-C1;KB-C2", "ANSWER", "contraception"]);
    assert.deepEqual([by[8].acceptable_entry_ids, by[8].expected, by[8].expected_class], ["", "NONE_FITS", "none"]);
    assert.equal(by[12].notes, "unsure");
    assert.equal(by[7].group, "Pregnancy");
  });
});
