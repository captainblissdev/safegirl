#!/usr/bin/env node
/**
 * K5 measurements on the merged 62-entry KB (analysis only, 27 October
 * 2026). See docs/decision-log.md, "KB 62 merge rule (written before
 * measurement)".
 *
 * For one embed mode (the one ml_service is running with) it records:
 *   1. self-retrieval: runs app/gateway/scripts/self-retrieval-check.js
 *      and counts the KB questions whose own entry is top-1 unscoped and
 *      with live V3 scoping, the failures and the near-misses (< 0.03);
 *   2. the 35 labelled development-set questions (labels from
 *      retrieval_eval_set_labels_2026-10-15.csv, expected class not
 *      "none") through the gateway, scored with run_eval.js's verdict
 *      rule, and compared with the 21-entry result in
 *      docs/kb-integration-eval-2026-10-22.md ("Before" column);
 *   3. gate separation: the unscoped top-1 score of correct answers
 *      against wrong or off-topic ones, on the dev questions and on
 *      resources/eval/relevance_validation.csv (the gate set), with the
 *      fixed 0.8439 gate.
 *
 * It writes ids and numbers only (no query text) to
 * research/v4/results/k5_<mode>.json and k5_<mode>_self_retrieval.txt.
 * It changes no threshold, model, KB entry or rule. DR-04, the sealed
 * set and the demo-risk set are not used.
 *
 * Usage (ml_service and a gateway with AUTH_DISABLED=true must be running):
 *   node research/eval/k5_measure.js --mode question|full
 *        [--ml http://127.0.0.1:8001] [--gateway http://127.0.0.1:3001]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..", "..");
const GW = path.join(ROOT, "app", "gateway");
const OUT = path.join(ROOT, "research", "v4", "results");

const { loadKnowledgeBase } = require(path.join(GW, "src", "retrievalModule"));
const { NO_ANSWER_MESSAGE } = require(path.join(GW, "src", "content", "helpContent"));
const { RELEVANCE_GATE_THRESHOLD } = require(path.join(GW, "src", "relevanceGate"));

const FILES = {
  evalSet: path.join(ROOT, "resources", "eval", "retrieval_eval_set.csv"),
  labels: path.join(ROOT, "resources", "eval", "retrieval_eval_set_labels_2026-10-15.csv"),
  gateSet: path.join(ROOT, "resources", "eval", "relevance_validation.csv"),
  baseline: path.join(ROOT, "docs", "kb-integration-eval-2026-10-22.md"),
};

function parseArgs(argv) {
  const args = { mode: null, ml: "http://127.0.0.1:8001", gateway: "http://127.0.0.1:3001" };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    if (!(key in args) || argv[i + 1] === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    }
    args[key] = argv[i + 1];
  }
  if (!["question", "full"].includes(args.mode)) {
    throw new Error("--mode must be question or full");
  }
  return args;
}

/** Minimal CSV reader (quoted fields, commas and newlines inside quotes). */
function readCsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const splitIds = (value) => (value || "").split(/[;|]/).map((s) => s.trim()).filter(Boolean);

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`${url} responded with HTTP ${response.status}`);
  }
  return response.json();
}

/** run_eval.js's verdict rule. */
function verdict(row, observed) {
  const allowed = row.expected_behavior.split("|").map((b) => b.trim());
  const acceptable = splitIds(row.acceptable_entry_ids);
  const partial = splitIds(row.partial_entry_ids);
  if (allowed.includes("NOT_REFERRAL")) {
    return observed.kind === "REFERRAL" ? "wrong" : "correct";
  }
  if (observed.kind === "ANSWER") {
    if (allowed.includes("ANSWER") && acceptable.includes(observed.entry)) {
      return "correct";
    }
    return partial.includes(observed.entry) ? "partial" : "wrong";
  }
  return allowed.includes(observed.kind) ? "correct" : "wrong";
}

/** run_eval.js's mapping of a gateway reply to a behaviour. */
function observeGateway(response, entryByAnswer) {
  if (response.outcome === "referral") return { kind: "REFERRAL", entry: null };
  if (response.outcome === "signposting") return { kind: "SIGNPOST", entry: null };
  if (response.answerFound === false || response.message === NO_ANSWER_MESSAGE) {
    return { kind: "ABSTAIN", entry: null };
  }
  return { kind: "ANSWER", entry: entryByAnswer.get(response.message) || "?" };
}

/** The 21-entry result per question, from the K3 evaluation's table. */
function readBaseline() {
  const text = fs.readFileSync(FILES.baseline, "utf8");
  const section = text.slice(text.indexOf("## Every question"));
  const baseline = {};
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (!/^Q\d+$/.test(cells[1] || "")) continue;
    const [reply, verdictText, score] = cells[3].split("·").map((c) => c.trim());
    const [kind, entry = null] = reply.split(/\s+/);
    baseline[cells[1]] = { kind, entry, verdict: verdictText, gate_score: Number(score) };
  }
  return baseline;
}

/** Self-retrieval: run the check and parse its per-entry lines. */
function selfRetrieval(args) {
  const run = spawnSync(process.execPath, [path.join(GW, "scripts", "self-retrieval-check.js")], {
    cwd: GW,
    env: { ...process.env, CLASSIFIER_SERVICE_URL: args.ml },
    encoding: "utf8",
  });
  if (run.status === 2) {
    throw new Error(`self-retrieval check could not reach ml_service: ${run.stderr}`);
  }
  const lines = run.stdout.split(/\r?\n/);
  const perEntry = [];
  for (const line of lines) {
    const m = line.match(
      /^(KB-[A-Z]\d+)\s+\[(\w+)\] classed (\w+) ([\d.]+) \(([^)]+)\) \| unscoped: (\S+)(?: \+([\d.]+))? \| live: (\S+)(?: \+([\d.]+))?$/,
    );
    if (m) {
      perEntry.push({
        id: m[1], class: m[2], classed: m[3], confidence: Number(m[4]), live_mode: m[5],
        unscoped_top: m[6], unscoped_margin: m[7] ? Number(m[7]) : null,
        live_top: m[8], live_margin: m[9] ? Number(m[9]) : null,
      });
    }
  }
  const section = (title) => {
    const start = lines.findIndex((l) => l.startsWith(title));
    const out = [];
    for (let i = start + 1; i < lines.length && lines[i].startsWith("  "); i++) out.push(lines[i].trim());
    return out;
  };
  return {
    raw: run.stdout,
    exit: run.status,
    entries: perEntry.length,
    unscoped_own: perEntry.filter((e) => e.unscoped_top === e.id).length,
    scoped_own: perEntry.filter((e) => e.live_top === e.id).length,
    unscoped_failures: perEntry.filter((e) => e.unscoped_top !== e.id).map((e) => `${e.id}->${e.unscoped_top}`),
    scoped_failures: perEntry.filter((e) => e.live_top !== e.id).map((e) => `${e.id}->${e.live_top} (${e.live_mode})`),
    failures: section("Failures ("),
    near_misses: section("Near-misses ("),
  };
}

const unscopedTop1 = async (ml, text) => {
  const body = await postJson(`${ml}/retrieve`, { query: text, top_k: 1 });
  const top = body.results[0];
  return { id: top.id, score: Number(top.score.toFixed(4)) };
};

const range = (values) =>
  values.length ? { min: Math.min(...values), max: Math.max(...values), n: values.length } : { n: 0 };

async function main() {
  const args = parseArgs(process.argv);
  const health = await (await fetch(`${args.ml}/health`)).json();
  if (health.status !== "ok" || health.embed_mode !== args.mode || health.kb_entries !== 62) {
    throw new Error(`ml_service is not ready for mode ${args.mode}: ${JSON.stringify(health)}`);
  }
  const probe = await fetch(`${args.gateway}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "health check" }),
  });
  if (probe.status === 401) {
    throw new Error("The gateway requires a token; start it with AUTH_DISABLED=true.");
  }

  const entries = Object.values(loadKnowledgeBase()).flat();
  const entryByAnswer = new Map(entries.map((e) => [e.answer, e.kbId]));

  // 1. Self-retrieval.
  const self = selfRetrieval(args);

  // 2. The 35 labelled dev questions through the gateway.
  const evalRows = Object.fromEntries(readCsv(FILES.evalSet).map((r) => [r.id, r]));
  const labelled = readCsv(FILES.labels).filter((r) => r.expected_class !== "none").map((r) => r.id);
  const baseline = readBaseline();
  const dev = [];
  for (const id of labelled) {
    const row = evalRows[id];
    const response = await postJson(`${args.gateway}/api/query`, { text: row.query });
    const observed = observeGateway(response, entryByAnswer);
    const top = await unscopedTop1(args.ml, row.query);
    const before = baseline[id];
    const record = {
      id,
      reply_kind: response.kind,
      entry: observed.entry,
      verdict: verdict(row, observed),
      gate_score: top.score,
      unscoped_top1: top.id,
      before_kind: before.kind,
      before_entry: before.entry,
      before_verdict: before.verdict,
    };
    record.changed = record.reply_kind !== before.kind || (record.entry || null) !== before.entry;
    dev.push(record);
  }
  const correct = dev.filter((r) => r.verdict === "correct").length;
  const answers = dev.filter((r) => r.entry);
  const devGate = {
    correct_answers: range(answers.filter((r) => r.verdict === "correct").map((r) => r.gate_score)),
    wrong_or_partial_answers: range(answers.filter((r) => r.verdict !== "correct").map((r) => r.gate_score)),
    abstentions: range(dev.filter((r) => r.reply_kind === "abstain").map((r) => r.gate_score)),
    wrong_or_partial_answers_passing_gate: answers.filter(
      (r) => r.verdict !== "correct" && r.gate_score >= RELEVANCE_GATE_THRESHOLD,
    ).map((r) => r.id),
  };

  // 3. Gate set: unscoped top-1 against the likely entry or off-topic.
  const gateRows = [];
  for (const row of readCsv(FILES.gateSet)) {
    if (row.expected === "REFERRAL_OR_SIGNPOST") {
      gateRows.push({ id: row.id, group: row.group, kind: "referral_or_signpost" });
      continue;
    }
    const top = await unscopedTop1(args.ml, row.query);
    let kind;
    if (row.expected === "NOT_KB_ANSWER") kind = "off_topic";
    else kind = top.id === row.likely_entry ? "correct" : "wrong";
    gateRows.push({
      id: row.id, group: row.group, kind, likely_entry: row.likely_entry || null,
      top1: top.id, score: top.score, passes_gate: top.score >= RELEVANCE_GATE_THRESHOLD,
    });
  }
  const scored = gateRows.filter((r) => r.score !== undefined);
  const gateSet = {
    correct: range(scored.filter((r) => r.kind === "correct").map((r) => r.score)),
    wrong: range(scored.filter((r) => r.kind === "wrong").map((r) => r.score)),
    off_topic: range(scored.filter((r) => r.kind === "off_topic").map((r) => r.score)),
    correct_below_gate: scored.filter((r) => r.kind === "correct" && !r.passes_gate).map((r) => r.id),
    wrong_passing_gate: scored.filter((r) => r.kind === "wrong" && r.passes_gate).map((r) => r.id),
    off_topic_passing_gate: scored.filter((r) => r.kind === "off_topic" && r.passes_gate).map((r) => r.id),
    referral_or_signpost_not_scored: gateRows.filter((r) => r.kind === "referral_or_signpost").length,
  };

  const result = {
    measured: new Date().toISOString(),
    mode: args.mode,
    health,
    gate_threshold: RELEVANCE_GATE_THRESHOLD,
    self_retrieval: { ...self, raw: undefined },
    dev: {
      labels: path.relative(ROOT, FILES.labels).replace(/\\/g, "/"),
      provisional: true,
      questions: dev.length,
      correct,
      baseline_21_correct: Object.values(baseline).filter((b) => b.verdict === "correct").length,
      changed_vs_21: dev.filter((r) => r.changed).map((r) => r.id),
      gate: devGate,
      per_question: dev,
    },
    gate_set: { ...gateSet, per_query: gateRows },
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `k5_${args.mode}.json`), JSON.stringify(result, null, 2) + "\n");
  fs.writeFileSync(path.join(OUT, `k5_${args.mode}_self_retrieval.txt`), self.raw);
  console.log(JSON.stringify({
    mode: args.mode,
    self_retrieval: {
      entries: self.entries, unscoped_own: self.unscoped_own, scoped_own: self.scoped_own,
      unscoped_failures: self.unscoped_failures, scoped_failures: self.scoped_failures,
      near_misses: self.near_misses,
    },
    dev: { correct, of: dev.length, changed_vs_21: result.dev.changed_vs_21, gate: devGate },
    gate_set: gateSet,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { readCsv };
