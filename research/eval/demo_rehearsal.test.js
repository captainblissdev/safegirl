/**
 * Tests for demo_rehearsal.js with SYNTHETIC queries and a fake ml_service
 * (no real demo query, no service).
 *
 * Run: node --test research/eval/demo_rehearsal.test.js
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rehearsal = require("./demo_rehearsal");
const { loadKnowledgeBase } = require(path.join(__dirname, "..", "..", "app", "gateway", "src", "retrievalModule"));

const KB = Object.values(loadKnowledgeBase()).flat();
const ENTRY = KB.find((e) => e.category === "contraception");

/** A fake ml_service: fixed answers per endpoint, recorded calls. */
function fakeMl({ classify, triage, retrieveScore = 0.9 }) {
  const calls = [];
  const fetch = async (url, options) => {
    const endpoint = new URL(url).pathname;
    const body = JSON.parse(options.body);
    calls.push(endpoint);
    let out;
    if (endpoint === "/classify") out = classify;
    else if (endpoint === "/triage") out = triage;
    else out = { results: [{ id: ENTRY.kbId, score: retrieveScore }], query: body.query };
    return { ok: true, status: 200, json: async () => out };
  };
  return { fetch, calls };
}

const rehearse = (queries, ml) => rehearsal.rehearse(queries, { ml: "http://fake", fetchImpl: ml.fetch });

describe("demo rehearsal (synthetic)", () => {
  it("answers in both modes and names the matched entry", async () => {
    const ml = fakeMl({
      classify: { intent: "contraception", confidence: 0.9, scores: {} },
      triage: { label: "contraception", confidence: 0.9, scores: {} },
    });
    const rows = await rehearse(["which contraceptive method lasts longest for a teenager"], ml);
    assert.deepEqual(rows.map((r) => [r.mode, r.kind, r.entry_id]), [
      ["off", "answer-scoped", ENTRY.kbId],
      ["on", "answer-scoped", ENTRY.kbId],
    ]);
    assert.equal(rows[0].matched_question, ENTRY.question);
    assert.ok(ml.calls.includes("/classify") && ml.calls.includes("/triage"));
    assert.equal(rows[0].reason, "");
  });

  it("reports why it abstained: classifier, V4 and the relevance gate", async () => {
    const low = fakeMl({
      classify: { intent: "sti", confidence: 0.2, scores: {} },
      triage: { label: "out_of_scope", confidence: 0.95, scores: {} },
    });
    const [off, on] = await rehearse(["tell me about the weather in town today please"], low);
    assert.equal(off.kind, "abstain");
    assert.match(off.reason, /classifier confidence below 0.35/);
    assert.equal(on.kind, "abstain");
    assert.match(on.reason, /V4 label not a topic/);

    const gated = fakeMl({
      classify: { intent: "contraception", confidence: 0.9, scores: {} },
      triage: { label: "contraception", confidence: 0.9, scores: {} },
      retrieveScore: 0.5,
    });
    const rows = await rehearse(["which contraceptive method lasts longest for a teenager"], gated);
    for (const r of rows) assert.match(r.reason, /relevance gate/);
  });

  it("names the rules before classification", () => {
    assert.match(rehearsal.reason({ kind: "referral" }), /Safety Net/);
    assert.match(rehearsal.reason({ kind: "help" }), /help/);
    assert.match(rehearsal.reason({ kind: "held-topic", heldTopicGroup: "B" }), /held topic \(group B\)/);
    assert.match(rehearsal.reason({ kind: "vague", classifierSource: null }), /vague rule/);
    assert.match(rehearsal.reason({ kind: "vague", classifierSource: "v4" }), /V4 predicted vague/);
    assert.equal(rehearsal.reason({ kind: "answer-unscoped" }), null);
  });

  it("reads the query column and refuses paths inside the repository", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rehearsal-test-"));
    const file = path.join(dir, "q.csv");
    fs.writeFileSync(file, '﻿id,query\r\n1,"synthetic one, with a comma"\r\n2,synthetic two\r\n3,\r\n');
    assert.deepEqual(rehearsal.readQueries(file), ["synthetic one, with a comma", "synthetic two"]);
    fs.writeFileSync(file, "text\nsynthetic\n");
    assert.throws(() => rehearsal.readQueries(file), /query/);
    fs.rmSync(dir, { recursive: true, force: true });
    assert.throws(() => rehearsal.parseArgs(["node", "x", "--queries", __filename, "--out", dir]), /outside/);
    assert.throws(() => rehearsal.parseArgs(["node", "x", "--queries", file]), /required/);
  });
});
