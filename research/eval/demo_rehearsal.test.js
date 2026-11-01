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

// The 62-entry configuration (--kb 62) and demo.ps1 -Kb, with synthetic
// queries, a fake ml_service and gate (g)'s own in-sample rows.
describe("demo rehearsal, 62-entry configuration (synthetic)", () => {
  const { loadGateG, GATE_G_PATH } = require(path.join(__dirname, "..", "..", "app", "gateway", "src", "gateG"));
  const gateG = loadGateG();
  const [header, ...lines] = fs
    .readFileSync(path.join(path.dirname(GATE_G_PATH), "gate_g_insample.csv"), "utf8")
    .trim()
    .split("\n");
  const cols = header.split(",");
  const insample = lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
  const KB62_ONLY = "KB-S10"; // in the 62-entry base, not in the 21

  /** A fake ml_service whose scores reproduce one in-sample row of gate (g). */
  function fake62(serve) {
    const row = insample.find((r) => r.serve === (serve ? "1" : "0") && r.agree === "1.0");
    const s1 = Number(row.s1);
    const s2 = s1 - Number(row.margin);
    const calls = [];
    const fetch = async (url, options) => {
      const endpoint = new URL(url).pathname;
      const body = JSON.parse(options.body);
      calls.push({ endpoint, body });
      let out;
      if (endpoint === "/triage") out = { label: "sti", confidence: Number(row.v4_p), scores: {} };
      else if (body.intent) out = { results: [{ id: KB62_ONLY, class: "sti", score: s1 }] };
      else out = { results: [{ id: KB62_ONLY, class: "sti", score: s1 }, { id: "KB-C1", class: "contraception", score: s2 }] };
      return { ok: true, status: 200, json: async () => out };
    };
    return { fetch, calls };
  }

  const run = (ml) => rehearsal.rehearse(["a synthetic sti question"], { ml: "http://fake", fetchImpl: ml.fetch, kb: "62", gateG });

  it("serves an entry of the 62-entry base when gate (g) serves", async () => {
    const ml = fake62(true);
    const [row] = await run(ml);
    assert.deepEqual([row.mode, row.kind, row.entry_id], ["kb62-gate-g", "answer-scoped", KB62_ONLY]);
    const unscoped = ml.calls.find((c) => c.endpoint === "/retrieve" && !c.body.intent);
    assert.equal(unscoped.body.top_k, 2);
  });

  it("names gate (g) when it abstains", async () => {
    const [row] = await run(fake62(false));
    assert.equal(row.kind, "abstain");
    assert.equal(row.reason, "gate (g) abstained");
  });

  it("selects the configuration and its ml_service URL", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rehearsal-args-"));
    const base = ["node", "x", "--queries", path.join(dir, "q.csv"), "--out", dir];
    assert.deepEqual([rehearsal.parseArgs(base).kb, rehearsal.parseArgs(base).ml], ["21", "http://127.0.0.1:8001"]);
    const kb62 = rehearsal.parseArgs([...base, "--kb", "62"]);
    assert.deepEqual([kb62.kb, kb62.ml], ["62", "http://127.0.0.1:8012"]);
    assert.throws(() => rehearsal.parseArgs([...base, "--kb", "60"]), /--kb/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("keeps --kb 21 as before: modes off and on", async () => {
    const ml = fakeMl({
      classify: { intent: "contraception", confidence: 0.9, scores: {} },
      triage: { label: "contraception", confidence: 0.9, scores: {} },
    });
    const rows = await rehearsal.rehearse(["which contraceptive method lasts longest for a teenager"], {
      ml: "http://fake",
      fetchImpl: ml.fetch,
      kb: "21",
    });
    assert.deepEqual(rows.map((r) => r.mode), ["off", "on"]);
  });

  it("demo.ps1 -Kb selects the settings; the default is unchanged", { skip: process.platform !== "win32" }, () => {
    const { spawnSync } = require("node:child_process");
    const script = path.join(__dirname, "..", "..", "scripts", "demo.ps1");
    const config = (...args) => {
      const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, ...args, "-ShowConfig"], {
        encoding: "utf8",
      });
      return { status: r.status, line: (r.stdout.match(/^CONFIG .*$/m) || [""])[0], out: r.stdout };
    };
    assert.equal(config("-Part", "ml").line, "CONFIG ml V4_TRIAGE_ENABLED=false KB_PATH=./knowledge_base.json RETRIEVAL_EMBED_MODE=full");
    assert.equal(config("-Part", "gateway", "-Mode", "on").line, "CONFIG gateway V4_TRIAGE_ENABLED=true KB_SET=kb21 GATE_G_ENABLED=false");
    assert.equal(
      config("-Part", "ml", "-Kb", "62").line,
      "CONFIG ml V4_TRIAGE_ENABLED=true KB_PATH=./knowledge_base_kb62.json RETRIEVAL_EMBED_MODE=question",
    );
    assert.equal(config("-Part", "gateway", "-Kb", "62").line, "CONFIG gateway V4_TRIAGE_ENABLED=true KB_SET=kb62 GATE_G_ENABLED=true");
    const refused = config("-Part", "ml", "-Kb", "62", "-Mode", "off");
    assert.equal(refused.status, 2);
    assert.match(refused.out, /needs V4 triage on/);
  });
});
