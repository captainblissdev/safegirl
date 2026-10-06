#!/usr/bin/env node
/**
 * SafeGirl retrieval evaluation harness (DEVELOPMENT set).
 *
 * Runs every query in resources/eval/retrieval_eval_set.csv through:
 *   1. the gateway (POST /api/query)        - end-to-end behaviour
 *   2. ml_service /classify                  - DistilBERT class + confidence
 *   3. ml_service /retrieve scoped           - top 3 within the predicted class
 *   4. ml_service /retrieve unscoped         - top 3 across all classes
 *   5. the frozen KeywordBaselineClassifier  - baseline class
 *   6. the gateway's local keyword retrieval - fallback entry id
 *
 * It writes one raw CSV row per query to research/eval/results/ and prints a
 * summary (end-to-end, safety, classifier, retrieval, an offline threshold
 * sweep and the failure list), also saved next to the CSV as Markdown.
 *
 * This is NOT the independent DR-04 test set and must not be mixed with it.
 * The harness changes nothing: it only calls the running services and
 * imports gateway modules read-only.
 *
 * Usage (ml_service and a gateway with AUTH_DISABLED=true must be running):
 *   node research/eval/run_eval.js [--gateway URL] [--ml URL] [--set FILE] [--out DIR]
 * Defaults: --gateway http://127.0.0.1:3016  --ml http://127.0.0.1:8002
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const GW = path.join(ROOT, "app", "gateway", "src");

const { KeywordBaselineClassifier } = require(
  path.join(GW, "fallback", "keywordClassifier"),
);
const { retrieve: localRetrieve, loadKnowledgeBase } = require(
  path.join(GW, "retrievalModule"),
);
const { checkSafety } = require(path.join(GW, "safetyNet"));
const { isGenericHelpRequest } = require(path.join(GW, "helpSignposting"));
const { NO_ANSWER_MESSAGE } = require(path.join(GW, "content", "helpContent"));

// Live gateway defaults, used to self-check the offline sweep.
const LIVE_ABSTAIN = 0.35;
const LIVE_SCOPED = 0.5;

const CLASS_BY_PREFIX = { C: "contraception", S: "sti", P: "pregnancy", G: "general" };

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const args = {
    gateway: "http://127.0.0.1:3016",
    ml: "http://127.0.0.1:8002",
    set: path.join(ROOT, "resources", "eval", "retrieval_eval_set.csv"),
    out: path.join(__dirname, "results"),
  };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    if (!(key in args) || argv[i + 1] === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    }
    args[key] = argv[i + 1];
  }
  args.gateway = args.gateway.replace(/\/+$/, "");
  args.ml = args.ml.replace(/\/+$/, "");
  return args;
}

// ---------------------------------------------------------------- CSV

/** Minimal RFC 4180 parser: quoted fields, "" escapes, commas, newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((values) =>
    Object.fromEntries(header.map((name, i) => [name, values[i] ?? ""])),
  );
}

function toCsv(records, columns) {
  const cell = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return (
    [columns.join(","), ...records.map((r) => columns.map((c) => cell(r[c])).join(","))].join(
      "\n",
    ) + "\n"
  );
}

const splitIds = (value) =>
  value
    .split(";")
    .map((id) => id.trim())
    .filter(Boolean);

// ---------------------------------------------------------------- services

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

async function checkServices(args) {
  const ml = await (await fetch(`${args.ml}/health`)).json();
  if (ml.status !== "ok") {
    throw new Error(`ml_service at ${args.ml} is not ready: ${JSON.stringify(ml)}`);
  }
  // The gateway must accept a query without a token (AUTH_DISABLED=true).
  const probe = await fetch(`${args.gateway}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "health check" }),
  });
  if (probe.status === 401) {
    throw new Error("The gateway requires a token; start it with AUTH_DISABLED=true.");
  }
  return ml;
}

const firstSentence = (text) =>
  ((text || "").match(/^.*?[.!?](\s|$)/) || [text || ""])[0].trim();

const formatTop = (results) =>
  results.map((r) => `${r.id}:${r.score.toFixed(4)}`).join(";");

// ---------------------------------------------------------------- scoring

/**
 * Classify one observed behaviour against the expected label.
 * observed: { kind: "ANSWER"|"ABSTAIN"|"SIGNPOST"|"REFERRAL", entry }
 * Returns "correct", "partial" or "wrong".
 */
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

/** Map a gateway response to an observed behaviour. */
function observeGateway(response, entryByAnswer) {
  if (response.outcome === "referral") return { kind: "REFERRAL", entry: null };
  if (response.outcome === "signposting") return { kind: "SIGNPOST", entry: null };
  if (response.answerFound === false || response.message === NO_ANSWER_MESSAGE) {
    return { kind: "ABSTAIN", entry: null };
  }
  return { kind: "ANSWER", entry: entryByAnswer.get(response.message) || "?" };
}

/**
 * Replay the gateway's decision offline for one pair of thresholds, from
 * the recorded safety/help results, confidence and top-1 ids. Mirrors
 * classifierClient: abstain below `abstain`, scoped at or above `scoped`,
 * unscoped in between.
 */
function simulate(record, abstain, scoped) {
  if (record.safety_flagged) return { kind: "REFERRAL", entry: null };
  if (record.help_rule) return { kind: "SIGNPOST", entry: null };
  if (record.ml_conf < abstain) return { kind: "ABSTAIN", entry: null };
  const entry = record.ml_conf >= scoped ? record.scoped_top1 : record.unscoped_top1;
  return entry ? { kind: "ANSWER", entry } : { kind: "ABSTAIN", entry: null };
}

const expectsAnswer = (row) => row.expected_behavior.split("|").includes("ANSWER");

// ---------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv);
  const rows = parseCsv(fs.readFileSync(args.set, "utf8"));
  const mlHealth = await checkServices(args);

  // Map answer text -> entry id, so the gateway's answer can be identified.
  const liveEntries = Object.values(loadKnowledgeBase()).flat();
  const entryByAnswer = new Map();
  for (const entry of liveEntries) {
    if (entryByAnswer.has(entry.answer)) {
      throw new Error(`Two live entries share an answer: ${entry.kbId}`);
    }
    entryByAnswer.set(entry.answer, entry.kbId);
  }
  const classOf = new Map(liveEntries.map((e) => [e.kbId, e.category]));

  const keyword = new KeywordBaselineClassifier();
  const records = [];

  for (const row of rows) {
    const text = row.query;
    const gateway = await postJson(`${args.gateway}/api/query`, { text });
    const classified = await postJson(`${args.ml}/classify`, { text });
    const scoped = await postJson(`${args.ml}/retrieve`, {
      query: text,
      top_k: 3,
      intent: classified.intent,
    });
    const unscoped = await postJson(`${args.ml}/retrieve`, { query: text, top_k: 3 });
    const kwClass = keyword.classify(text).label;
    const kwEntry = localRetrieve(kwClass, text);
    const observed = observeGateway(gateway, entryByAnswer);

    records.push({
      ...row,
      gw_outcome: gateway.outcome,
      gw_classifier_source: gateway.classifierSource,
      gw_predicted_category: gateway.predictedCategory,
      gw_confidence: gateway.confidence,
      gw_retrieval_scope: gateway.retrievalScope,
      gw_behavior: observed.kind,
      gw_entry: observed.entry,
      gw_first_sentence: firstSentence(gateway.message),
      ml_class: classified.intent,
      ml_conf: classified.confidence,
      scoped_top3: formatTop(scoped.results),
      unscoped_top3: formatTop(unscoped.results),
      scoped_top1: scoped.results[0]?.id ?? null,
      unscoped_top1: unscoped.results[0]?.id ?? null,
      scoped_ids: scoped.results.map((r) => r.id),
      unscoped_ids: unscoped.results.map((r) => r.id),
      kw_class: kwClass,
      kw_fallback_entry: kwEntry ? kwEntry.kbId : null,
      safety_flagged: checkSafety(text).flagged,
      help_rule: !checkSafety(text).flagged && isGenericHelpRequest(text),
      verdict: verdict(row, observed),
    });
  }

  // ------------------------------------------------------------ raw CSV
  fs.mkdirSync(args.out, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:]/g, "").replace("T", "-");
  const base = path.join(args.out, `retrieval_eval_${stamp}`);
  const columns = [
    "id", "query", "group", "expected_behavior", "acceptable_entry_ids", "partial_entry_ids",
    "verdict", "gw_behavior", "gw_entry", "gw_outcome", "gw_classifier_source",
    "gw_predicted_category", "gw_confidence", "gw_retrieval_scope", "gw_first_sentence",
    "ml_class", "ml_conf", "scoped_top3", "unscoped_top3", "kw_class", "kw_fallback_entry",
    "safety_flagged", "help_rule", "notes",
  ];
  fs.writeFileSync(`${base}.csv`, toCsv(records, columns));

  // ------------------------------------------------------------ summary
  const out = [];
  const say = (line = "") => out.push(line);
  const table = (header, lines) => {
    say(`| ${header.join(" | ")} |`);
    say(`|${header.map(() => "---").join("|")}|`);
    for (const line of lines) say(`| ${line.join(" | ")} |`);
    say();
  };

  say(`# Retrieval evaluation (development set): ${stamp}`);
  say();
  say(`Set: ${path.relative(ROOT, args.set).replace(/\\/g, "/")} (${records.length} queries). ` +
    `Not the independent DR-04 test set.`);
  say(`ml_service: model ${mlHealth.model_version}, ${mlHealth.kb_entries} KB entries. ` +
    `Live thresholds: abstain ${LIVE_ABSTAIN}, scoped ${LIVE_SCOPED}.`);
  say();

  // End-to-end by group
  say("## End-to-end (gateway) by group");
  say();
  const groups = [...new Set(records.map((r) => r.group))];
  const count = (list, v) => list.filter((r) => r.verdict === v).length;
  table(
    ["group", "n", "correct", "partial", "wrong"],
    [
      ...groups.map((g) => {
        const list = records.filter((r) => r.group === g);
        return [g, list.length, count(list, "correct"), count(list, "partial"), count(list, "wrong")];
      }),
      ["**all**", records.length, count(records, "correct"), count(records, "partial"), count(records, "wrong")],
    ],
  );

  // Safety
  say("## Safety net");
  say();
  const positives = records.filter((r) => r.group === "safety_positive");
  const negatives = records.filter((r) => r.group === "safety_negative");
  const referred = (r) => r.gw_behavior === "REFERRAL";
  table(
    ["metric", "value"],
    [
      ["recall on safety_positive", `${positives.filter(referred).length}/${positives.length}`],
      ["false-referral rate on safety_negative", `${negatives.filter(referred).length}/${negatives.length}`],
    ],
  );

  // Classifier
  say("## Classifier accuracy (expected class from the acceptable entry)");
  say();
  const withClass = records
    .map((r) => ({ r, expected: classOf.get(splitIds(r.acceptable_entry_ids)[0]) }))
    .filter((x) => x.expected);
  const acc = (key) => withClass.filter((x) => x.r[key] === x.expected).length;
  table(
    ["classifier", "correct", "n", "accuracy"],
    [
      ["DistilBERT (ml_service)", acc("ml_class"), withClass.length, (acc("ml_class") / withClass.length).toFixed(3)],
      ["keyword baseline", acc("kw_class"), withClass.length, (acc("kw_class") / withClass.length).toFixed(3)],
    ],
  );

  // Retrieval
  say("## Retrieval hit rate (ANSWER queries with an acceptable entry)");
  say();
  const answerRows = records.filter((r) => expectsAnswer(r) && splitIds(r.acceptable_entry_ids).length);
  const hit = (ids, k, r) => ids.slice(0, k).some((id) => splitIds(r.acceptable_entry_ids).includes(id));
  table(
    ["retrieval", "hit@1", "hit@3", "n"],
    [
      ["scoped to predicted class", answerRows.filter((r) => hit(r.scoped_ids, 1, r)).length,
        answerRows.filter((r) => hit(r.scoped_ids, 3, r)).length, answerRows.length],
      ["unscoped", answerRows.filter((r) => hit(r.unscoped_ids, 1, r)).length,
        answerRows.filter((r) => hit(r.unscoped_ids, 3, r)).length, answerRows.length],
      ["keyword fallback (top 1 only)", answerRows.filter((r) => splitIds(r.acceptable_entry_ids).includes(r.kw_fallback_entry)).length,
        "-", answerRows.length],
    ],
  );

  // Threshold sweep
  say("## Threshold sweep (offline replay of recorded confidences; live thresholds unchanged)");
  say();
  say("Each cell: correct / wrong-answer / false-abstain (partial in brackets). " +
    "wrong-answer = an entry that is neither acceptable nor partial; false-abstain = no answer " +
    "where an answer was expected. Pairs with abstain >= scoped are invalid (n/a).");
  say();
  const abstains = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
  const scopes = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7];
  const sweepCell = (a, s) => {
    let correct = 0, partialCount = 0, wrongAnswer = 0, falseAbstain = 0;
    for (const r of records) {
      const sim = simulate(r, a, s);
      const v = verdict(r, sim);
      if (v === "correct") correct += 1;
      if (v === "partial") partialCount += 1;
      if (sim.kind === "ANSWER" && v === "wrong") wrongAnswer += 1;
      if (sim.kind === "ABSTAIN" && expectsAnswer(r) && v !== "correct") falseAbstain += 1;
    }
    return { correct, partialCount, wrongAnswer, falseAbstain };
  };
  table(
    ["abstain \\ scoped", ...scopes.map((s) => s.toFixed(2))],
    abstains.map((a) => [
      a.toFixed(2),
      ...scopes.map((s) => {
        if (a >= s - 1e-9) return "n/a";
        const c = sweepCell(a, s);
        const live = Math.abs(a - LIVE_ABSTAIN) < 1e-9 && Math.abs(s - LIVE_SCOPED) < 1e-9;
        const cellText = `${c.correct} / ${c.wrongAnswer} / ${c.falseAbstain} (${c.partialCount})`;
        return live ? `**${cellText}**` : cellText;
      }),
    ]),
  );
  say(`Bold = live thresholds (${LIVE_ABSTAIN} / ${LIVE_SCOPED}).`);
  say();

  // Self-check: the replay at the live thresholds must reproduce the gateway.
  const mismatches = records.filter((r) => {
    const sim = simulate(r, LIVE_ABSTAIN, LIVE_SCOPED);
    return sim.kind !== r.gw_behavior || (sim.kind === "ANSWER" && sim.entry !== r.gw_entry);
  });
  say(`Self-check: offline replay at the live thresholds reproduces the gateway for ` +
    `${records.length - mismatches.length}/${records.length} queries` +
    (mismatches.length ? ` (mismatches: ${mismatches.map((r) => r.id).join(", ")})` : "") + ".");
  say();

  // Failures
  say("## Failures (verdict wrong or partial), by group");
  say();
  for (const g of groups) {
    const failed = records.filter((r) => r.group === g && r.verdict !== "correct");
    if (!failed.length) continue;
    say(`### ${g}`);
    say();
    table(
      ["id", "query", "expected", "got", "verdict", "class (conf)"],
      failed.map((r) => [
        r.id, r.query, `${r.expected_behavior}${r.acceptable_entry_ids ? ` ${r.acceptable_entry_ids}` : ""}`,
        `${r.gw_behavior}${r.gw_entry ? ` ${r.gw_entry}` : ""}`, r.verdict,
        r.ml_conf === null ? "-" : `${r.ml_class} (${Number(r.ml_conf).toFixed(3)})`,
      ]),
    );
  }

  const summary = out.join("\n");
  fs.writeFileSync(`${base}.summary.md`, summary + "\n");
  console.log(summary);
  console.log(`Raw results: ${path.relative(ROOT, `${base}.csv`)}`);
  console.log(`Summary:     ${path.relative(ROOT, `${base}.summary.md`)}`);
}

main().catch((error) => {
  console.error(`run_eval failed: ${error.message}`);
  process.exit(1);
});
