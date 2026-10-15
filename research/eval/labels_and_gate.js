#!/usr/bin/env node
/**
 * Labels by rule, retrieval conditions and a one-time relevance gate check
 * (analysis only, 15 October 2026).
 *
 * Steps, each run separately:
 *   labels   Apply the labelling rule to resources/eval/retrieval_eval_set.csv
 *            and write resources/eval/retrieval_eval_set_labels_<date>.csv.
 *            Needs no services.
 *   collect  For the 58 development-set queries, record the gateway's
 *            answer, the V3 class and probabilities, the keyword baseline's
 *            class, and the top-1 entry and score for unscoped retrieval,
 *            retrieval scoped to the V3 class and retrieval scoped to the
 *            rule label (oracle). Writes labels_and_gate_queries_<date>.csv.
 *   gate     Run the fixed relevance gate ONCE on
 *            resources/eval/relevance_validation.csv. Writes
 *            relevance_gate_validation_<date>.csv. Refuses to overwrite.
 *   gap      Run the documented coverage-gap queries. Writes
 *            coverage_gap_examples_<date>.csv.
 *   report   Write labels_and_gate_<date>.md from the files above
 *            (--upto N includes sections 1 to N; default 4).
 *
 * Usage (collect, gate and gap need ml_service and a gateway started with
 * AUTH_DISABLED=true, local development only):
 *   node research/eval/labels_and_gate.js <step> [--ml URL] [--gateway URL]
 * Defaults: --ml http://127.0.0.1:8002  --gateway http://127.0.0.1:3021
 *
 * It changes no threshold, model, knowledge-base entry or Safety Net rule,
 * never edits an existing results file and only reads the validation set.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const GW = path.join(ROOT, "app", "gateway", "src");
const RESULTS = path.join(ROOT, "research", "eval", "results");
const DATE = "2026-10-15";

const { KeywordBaselineClassifier } = require(path.join(GW, "fallback", "keywordClassifier"));
const { loadKnowledgeBase } = require(path.join(GW, "retrievalModule"));
const { checkSafety } = require(path.join(GW, "safetyNet"));
const { isGenericHelpRequest } = require(path.join(GW, "helpSignposting"));
const { NO_ANSWER_MESSAGE } = require(path.join(GW, "content", "helpContent"));

const FILES = {
  evalSet: path.join(ROOT, "resources", "eval", "retrieval_eval_set.csv"),
  provisional: path.join(ROOT, "resources", "eval", "retrieval_eval_set_expected_class_PROVISIONAL.csv"),
  validation: path.join(ROOT, "resources", "eval", "relevance_validation.csv"),
  labels: path.join(ROOT, "resources", "eval", `retrieval_eval_set_labels_${DATE}.csv`),
  queries: path.join(RESULTS, `labels_and_gate_queries_${DATE}.csv`),
  gate: path.join(RESULTS, `relevance_gate_validation_${DATE}.csv`),
  gap: path.join(RESULTS, `coverage_gap_examples_${DATE}.csv`),
  report: path.join(RESULTS, `labels_and_gate_${DATE}.md`),
};

const CLASS_BY_PREFIX = { C: "contraception", S: "sti", P: "pregnancy", G: "general" };
const CLASSES = ["contraception", "sti", "pregnancy", "general"];
const classOfEntry = (id) => CLASS_BY_PREFIX[id.replace(/^KB-/, "")[0]];

// Live gateway thresholds (classifierClient defaults; not changed here).
const LIVE_ABSTAIN = 0.35;
const LIVE_SCOPED = 0.5;

// ------------------------------------------------------------- fixed gate
// Fixed before the validation set was run (research/eval/results/
// classifier_analysis.md, 14 Oct 2026): answer only when the unscoped
// top-1 retrieval score is at or above this value. Not to be re-tuned.
const GATE_THRESHOLD = 0.8439;
// Pass criterion, also fixed before the run: the threshold was chosen to
// keep at least 90% of should-answer queries, and on the development set
// it rejected 15/20 (75%) of should-not-answer queries. The gate "holds"
// on the validation set only if it does at least as well on both.
const GATE_MIN_ANSWERED = 0.9;
const GATE_MIN_REJECTED = 0.75;

// ------------------------------------------------------------- label rule
// Rule: the expected class is the class of the entry that best answers the
// query (its acceptable entries). Where a second entry plausibly answers
// it, both classes are accepted. A second entry counts as "plausibly
// answers" only when its own question covers the query's question.
// Rows with no answering entry are "none" and are not scored.
const SECOND_ENTRIES = {
  Q18: {
    entry: "KB-G1",
    reason:
      'KB-G1 "Will the clinic tell my parents what I talked to them about?" answers the "without my parents knowing" part; KB-C1/KB-C2 answer the contraception part',
  },
};
// Candidates considered and not accepted, recorded so the choice is visible.
const REJECTED_CANDIDATES = {
  Q16: 'KB-C1/KB-C2 open with "Health services for young people are meant to be confidential", but their question is contraception access and consent, not clinic confidentiality; not accepted (accepting them would favour V3, which predicts contraception)',
  Q17: "KB-G1 is about the clinic telling parents, not about needing their permission; not accepted",
  Q28: "KB-P6 (pregnancy danger signs) is listed as partial: on-topic but does not answer a fear of pregnancy; not accepted. By intent the query is pregnancy, but the rule labels the class of the answering entry (KB-G7)",
  Q30: "No pregnancy entry covers where to get a pregnancy test; KB-G7 does. By intent the query is pregnancy, but the rule labels the class of the answering entry",
  Q43: "No entry answers antenatal timing; KB-P6 is partial only, so the label stays none",
  Q53: "As Q43",
};

// ------------------------------------------------------------- CSV

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
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const csvCell = (value) => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function writeCsv(file, columns, records, { overwrite = true } = {}) {
  if (!overwrite && fs.existsSync(file)) {
    throw new Error(`Refusing to overwrite ${path.relative(ROOT, file)}`);
  }
  const lines = [columns.join(",")];
  for (const r of records) lines.push(columns.map((c) => csvCell(r[c])).join(","));
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
  console.log(`Wrote ${path.relative(ROOT, file)} (${records.length} rows)`);
}

const readCsv = (file) => parseCsv(fs.readFileSync(file, "utf8"));
const splitIds = (s) => (s || "").split(";").map((x) => x.trim()).filter(Boolean);

// ------------------------------------------------------------- services

function parseArgs(argv) {
  const args = { step: argv[2], ml: "http://127.0.0.1:8002", gateway: "http://127.0.0.1:3021", upto: "4" };
  for (let i = 3; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    if (!["ml", "gateway", "upto"].includes(key) || argv[i + 1] === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    }
    args[key] = argv[i + 1];
  }
  return args;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${url} responded with HTTP ${response.status}`);
  return response.json();
}

async function checkServices(args) {
  const ml = await (await fetch(`${args.ml}/health`)).json();
  if (ml.status !== "ok" || ml.model_version !== "v3" || ml.kb_entries !== 21) {
    throw new Error(`ml_service is not the frozen V3 service: ${JSON.stringify(ml)}`);
  }
  const probe = await fetch(`${args.gateway}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "health check" }),
  });
  if (probe.status === 401) throw new Error("Start the gateway with AUTH_DISABLED=true.");
}

function entryIndex() {
  const live = Object.values(loadKnowledgeBase()).flat();
  const byAnswer = new Map(live.map((e) => [e.answer, e.kbId]));
  return byAnswer;
}

/** Map a gateway response to a behaviour and entry, as run_eval.js does. */
function observeGateway(response, byAnswer) {
  if (response.outcome === "referral") return { kind: "REFERRAL", entry: "" };
  if (response.outcome === "signposting") return { kind: "SIGNPOST", entry: "" };
  if (response.answerFound === false || response.message === NO_ANSWER_MESSAGE) {
    return { kind: "ABSTAIN", entry: "" };
  }
  return { kind: "ANSWER", entry: byAnswer.get(response.message) || "?" };
}

/** Every signal for one query: gateway, V3, baseline and retrieval. */
async function signals(args, text, keyword, byAnswer, oracleClass) {
  const gateway = await postJson(`${args.gateway}/api/query`, { text });
  const classified = await postJson(`${args.ml}/classify`, { text });
  const top1 = async (intent) => {
    const body = { query: text, top_k: 1 };
    if (intent) body.intent = intent;
    const [first] = (await postJson(`${args.ml}/retrieve`, body)).results;
    return { id: first?.id ?? "", score: first?.score ?? "" };
  };
  const unscoped = await top1(null);
  const scoped = await top1(classified.intent);
  const oracle = oracleClass ? await top1(oracleClass) : { id: "", score: "" };
  const observed = observeGateway(gateway, byAnswer);
  const safety = checkSafety(text);
  const record = {
    gw_outcome: gateway.outcome,
    gw_behavior: observed.kind,
    gw_entry: observed.entry,
    gw_scope: gateway.retrievalScope ?? "",
    gw_classifier_source: gateway.classifierSource ?? "",
    gw_message: gateway.message ?? "",
    v3_class: classified.intent,
    v3_conf: classified.confidence,
    kw_class: keyword.classify(text).label,
    unscoped_top1: unscoped.id,
    unscoped_score: unscoped.score,
    scoped_top1: scoped.id,
    scoped_score: scoped.score,
    oracle_top1: oracle.id,
    oracle_score: oracle.score,
    safety_flagged: safety.flagged,
    help_rule: !safety.flagged && isGenericHelpRequest(text),
  };
  for (const c of CLASSES) record[`p_${c}`] = classified.scores?.[c] ?? "";
  return record;
}

// ------------------------------------------------------------- statistics

/** 95% Wilson score interval for k successes out of n. */
function wilson(k, n, z = 1.959964) {
  if (n === 0) return [NaN, NaN];
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Exact two-sided McNemar p-value from the two discordant counts. */
function mcnemarExact(b, c) {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let tail = 0;
  for (let i = 0; i <= k; i += 1) tail += binom(n, i) * 0.5 ** n;
  return Math.min(1, 2 * tail);
}

function binom(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
  return r;
}

const pct = (k, n) => (n ? `${((100 * k) / n).toFixed(1)}%` : "-");
const ci = (k, n) => {
  const [lo, hi] = wilson(k, n);
  return `${(100 * lo).toFixed(1)}% to ${(100 * hi).toFixed(1)}%`;
};
const fmt = (x, d = 3) => (x === "" || x === null || x === undefined ? "-" : Number(x).toFixed(d));

// ------------------------------------------------------------- step: labels

function stepLabels() {
  const rows = readCsv(FILES.evalSet);
  const provisional = new Map(readCsv(FILES.provisional).map((r) => [r.id, r]));
  const out = rows.map((row) => {
    const acceptable = splitIds(row.acceptable_entry_ids);
    const second = SECOND_ENTRIES[row.id];
    const strict = acceptable.length ? classOfEntry(acceptable[0]) : "none";
    const accepted = new Set(acceptable.map(classOfEntry));
    if (second) accepted.add(classOfEntry(second.entry));
    if (!acceptable.length) accepted.clear();
    const prev = provisional.get(row.id);
    const acceptedList = accepted.size ? [...accepted].join(";") : "none";
    const changed = prev.expected_class !== strict || acceptedList !== strict;
    const statusChanged = /ambiguous/.test(prev.label_status);
    let reason = "";
    if (prev.expected_class !== strict) {
      reason = `Has acceptable entries (${acceptable.join(", ")}), so the rule gives the class of the entry that answers it`;
    } else if (second) {
      reason = second.reason;
    } else if (statusChanged) {
      reason = "Label unchanged; the rule gives one class, so the row is no longer excluded as ambiguous";
    }
    return {
      id: row.id,
      query: row.query,
      group: row.group,
      acceptable_entry_ids: row.acceptable_entry_ids,
      expected_class: strict,
      accepted_classes: acceptedList,
      previous_class: prev.expected_class,
      previous_status: prev.label_status,
      label_changed: changed ? "yes" : "no",
      reason,
      considered_not_accepted: REJECTED_CANDIDATES[row.id] || "",
    };
  });
  writeCsv(FILES.labels, [
    "id", "query", "group", "acceptable_entry_ids", "expected_class", "accepted_classes",
    "previous_class", "previous_status", "label_changed", "reason", "considered_not_accepted",
  ], out);
}

// ------------------------------------------------------------- step: collect

async function stepCollect(args) {
  await checkServices(args);
  const labels = new Map(readCsv(FILES.labels).map((r) => [r.id, r]));
  const keyword = new KeywordBaselineClassifier();
  const byAnswer = entryIndex();
  const out = [];
  for (const row of readCsv(FILES.evalSet)) {
    const label = labels.get(row.id);
    const oracleClass = label.expected_class === "none" ? null : label.expected_class;
    out.push({
      id: row.id,
      query: row.query,
      group: row.group,
      expected_behavior: row.expected_behavior,
      acceptable_entry_ids: row.acceptable_entry_ids,
      expected_class: label.expected_class,
      accepted_classes: label.accepted_classes,
      ...(await signals(args, row.query, keyword, byAnswer, oracleClass)),
    });
  }
  writeCsv(FILES.queries, QUERY_COLUMNS, out);
}

const QUERY_COLUMNS = [
  "id", "query", "group", "expected_behavior", "acceptable_entry_ids", "expected_class",
  "accepted_classes", "v3_class", "v3_conf", ...CLASSES.map((c) => `p_${c}`), "kw_class",
  "unscoped_top1", "unscoped_score", "scoped_top1", "scoped_score", "oracle_top1",
  "oracle_score", "safety_flagged", "help_rule", "gw_outcome", "gw_behavior", "gw_entry",
  "gw_scope", "gw_classifier_source", "gw_message",
];

// ------------------------------------------------------------- step: gate

/** The fixed pipeline decision: Safety Net, help rule, then the gate. */
function gateDecision(r) {
  if (r.gw_outcome === "referral") return "referred";
  if (r.gw_outcome === "signposting") return "signposted";
  return Number(r.unscoped_score) >= GATE_THRESHOLD ? "answered" : "rejected";
}

async function stepGate(args) {
  if (fs.existsSync(FILES.gate)) {
    throw new Error("The gate validation has already been run once; refusing to re-run.");
  }
  await checkServices(args);
  const keyword = new KeywordBaselineClassifier();
  const byAnswer = entryIndex();
  const out = [];
  for (const row of readCsv(FILES.validation)) {
    const record = {
      id: row.id,
      query: row.query,
      group: row.group,
      expected: row.expected,
      likely_entry: row.likely_entry,
      ...(await signals(args, row.query, keyword, byAnswer, null)),
    };
    record.gate_threshold = GATE_THRESHOLD;
    record.gate_decision = gateDecision(record);
    out.push(record);
  }
  writeCsv(FILES.gate, [
    "id", "query", "group", "expected", "likely_entry", "gate_threshold", "gate_decision",
    ...QUERY_COLUMNS.slice(7),
  ], out, { overwrite: false });
}

// ------------------------------------------------------------- step: gap

const GAP_QUERIES = [{ id: "GAP01", query: "Can I get pregnant from precum?" }];

async function stepGap(args) {
  await checkServices(args);
  const keyword = new KeywordBaselineClassifier();
  const byAnswer = entryIndex();
  const out = [];
  for (const row of GAP_QUERIES) {
    const record = { ...row, ...(await signals(args, row.query, keyword, byAnswer, null)) };
    record.gate_threshold = GATE_THRESHOLD;
    record.gate_decision = gateDecision(record);
    out.push(record);
  }
  writeCsv(FILES.gap, [
    "id", "query", "gate_threshold", "gate_decision", ...QUERY_COLUMNS.slice(7),
  ], out);
}

// ------------------------------------------------------------- step: report

const table = (header, rows) =>
  [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

const src = (file) => `\`${path.relative(ROOT, file).replace(/\\/g, "/")}\``;

function sectionLabels(lines) {
  const labels = readCsv(FILES.labels);
  lines.push("## 1. Labels by rule\n");
  lines.push(
    "**Rule.** The expected class is the class of the knowledge-base entry that " +
      "best answers the query (its acceptable entries). Where a second entry " +
      "plausibly answers it, both classes are accepted; a second entry counts " +
      "only when its own question covers the query's question. Rows with no " +
      "answering entry are labelled none and not scored. The labels were fixed " +
      "from the entry text before any prediction was collected for this " +
      "analysis. The labeller had seen the 14 October predictions for some rows " +
      "(`label_review.md`); every decision touching those rows is listed below " +
      "with its reason.\n",
  );
  lines.push(`Source: ${src(FILES.labels)} (applied labels; the provisional file is unchanged).\n`);
  const changed = labels.filter((r) => r.label_changed === "yes" || r.reason);
  lines.push("### Rows whose label or status changes\n");
  lines.push(table(["ID", "Query", "Old label (status)", "New label", "Accepted", "Reason"],
    changed.map((r) => [r.id, r.query, `${r.previous_class} (${r.previous_status})`,
      r.expected_class, r.accepted_classes, r.reason])));
  lines.push("");
  const rejected = labels.filter((r) => r.considered_not_accepted);
  lines.push("### Candidates considered and not accepted\n");
  lines.push(table(["ID", "Query", "Label kept", "Why not"],
    rejected.map((r) => [r.id, r.query, r.expected_class, r.considered_not_accepted])));
  lines.push("");
  const counts = {};
  for (const r of labels) counts[r.expected_class] = (counts[r.expected_class] || 0) + 1;
  lines.push(`Labelled rows: ${labels.filter((r) => r.expected_class !== "none").length} ` +
    `(${CLASSES.map((c) => `${c} ${counts[c] || 0}`).join(", ")}); none: ${counts.none || 0}.\n`);
}

function sectionAccuracy(lines) {
  const q = readCsv(FILES.queries).filter((r) => r.expected_class !== "none");
  const n = q.length;
  const strict = (cls, r) => cls === r.expected_class;
  const lenient = (cls, r) => r.accepted_classes.split(";").includes(cls);
  const rows = [];
  const pairs = {};
  for (const [name, test] of [["strict", strict], ["lenient", lenient]]) {
    const v3 = q.map((r) => test(r.v3_class, r));
    const kw = q.map((r) => test(r.kw_class, r));
    const kv = v3.filter(Boolean).length;
    const kk = kw.filter(Boolean).length;
    const b = q.filter((_, i) => v3[i] && !kw[i]).length;
    const c = q.filter((_, i) => !v3[i] && kw[i]).length;
    pairs[name] = { both: q.filter((_, i) => v3[i] && kw[i]).length, b, c, p: mcnemarExact(b, c) };
    rows.push([name, `${kv}/${n} (${pct(kv, n)}; ${ci(kv, n)})`, `${kk}/${n} (${pct(kk, n)}; ${ci(kk, n)})`,
      `both ${pairs[name].both}, only V3 ${b}, only baseline ${c}`, pairs[name].p.toFixed(4)]);
  }
  lines.push("### Classifier accuracy on the rule labels (development set, not independent)\n");
  lines.push(`On the ${n} labelled queries. Strict: the prediction equals the single label. ` +
    "Lenient: the prediction is any accepted label. Intervals are 95% Wilson; " +
    "p is the exact McNemar test on the discordant pairs.\n");
  lines.push(table(["Scoring", "DistilBERT V3", "Keyword baseline", "Paired", "McNemar p"], rows));
  lines.push(`\nSource: ${src(FILES.queries)}. For comparison, the 14 October analysis on its 29 ` +
    "non-ambiguous provisional labels gave V3 20/29 and the baseline 28/29, p = 0.021 " +
    "(`research/eval/results/classifier_analysis.md`).\n");
  const perClass = CLASSES.map((c) => {
    const inC = q.filter((r) => r.expected_class === c);
    const v = inC.filter((r) => r.v3_class === c).length;
    const k = inC.filter((r) => r.kw_class === c).length;
    return [c, inC.length, `${v}/${inC.length}`, `${k}/${inC.length}`];
  });
  lines.push("Recall by class (strict):\n");
  lines.push(table(["Class", "n", "V3", "Baseline"], perClass));
  lines.push("");
  const wrong = q.filter((r) => !lenient(r.v3_class, r));
  lines.push("V3 errors (lenient), with confidence:\n");
  lines.push(table(["ID", "Query", "Label", "V3 (conf.)", "Baseline"],
    wrong.map((r) => [r.id, r.query, r.accepted_classes, `${r.v3_class} (${fmt(r.v3_conf)})`, r.kw_class])));
  lines.push("");
}

function sectionConditions(lines) {
  const q = readCsv(FILES.queries).filter((r) => r.expected_class !== "none");
  const n = q.length;
  const ok = (id, r) => splitIds(r.acceptable_entry_ids).includes(id);
  // Hybrid from the recorded signals, mirroring classifierClient, checked
  // against what the live gateway actually returned.
  const hybridEntry = (r) => {
    if (r.safety_flagged === "true" || r.help_rule === "true") return "";
    const conf = Number(r.v3_conf);
    if (conf < LIVE_ABSTAIN) return "";
    return conf >= LIVE_SCOPED ? r.scoped_top1 : r.unscoped_top1;
  };
  const mismatches = q.filter((r) => (r.gw_behavior === "ANSWER" ? r.gw_entry : "") !== hybridEntry(r));
  const conds = [
    ["Always unscoped", (r) => r.unscoped_top1],
    ["Always scoped (V3 class)", (r) => r.scoped_top1],
    ["Hybrid (live gateway)", (r) => (r.gw_behavior === "ANSWER" ? r.gw_entry : "")],
    ["Oracle scoped (rule label)", (r) => r.oracle_top1],
  ];
  lines.push("## 2. Retrieval under four conditions (development set, not independent)\n");
  lines.push(`Top-1 entry correct (one of the query's acceptable entries) on the same ${n} ` +
    "labelled queries. Hybrid is what the live gateway returned (scoped at V3 confidence " +
    "0.5 or above, unscoped from 0.35, no answer below 0.35); a referral or no answer " +
    "counts as not correct. Oracle scopes retrieval to the strict rule label. " +
    "Intervals are 95% Wilson.\n");
  lines.push(table(["Condition", "Correct", "Rate", "95% CI"],
    conds.map(([name, f]) => {
      const k = q.filter((r) => ok(f(r), r)).length;
      return [name, `${k}/${n}`, pct(k, n), ci(k, n)];
    })));
  lines.push(`\nSelf-check: the hybrid replayed from the recorded V3 confidence and top-1 ids ` +
    `matches the live gateway on ${n - mismatches.length}/${n} queries` +
    (mismatches.length ? ` (differs on ${mismatches.map((r) => r.id).join(", ")}).` : ".") +
    ` Source: ${src(FILES.queries)}.\n`);
  const differ = q.filter((r) => new Set(conds.map(([, f]) => ok(f(r), r))).size > 1);
  lines.push(`Queries whose result differs between conditions (${differ.length}); ✓ correct, ✗ not:\n`);
  lines.push(table(["ID", "Query", "Acceptable", "V3 (conf.)", ...conds.map(([name]) => name)],
    differ.map((r) => [r.id, r.query, r.acceptable_entry_ids, `${r.v3_class} (${fmt(r.v3_conf)})`,
      ...conds.map(([, f]) => `${ok(f(r), r) ? "✓" : "✗"} ${f(r) || "no answer"}`)])));
  lines.push("");
  const unscopedWrong = q.filter((r) => !ok(r.unscoped_top1, r));
  lines.push(`Queries that even unscoped retrieval gets wrong: ${unscopedWrong.length ? unscopedWrong.map((r) => `${r.id} (${r.unscoped_top1})`).join(", ") : "none"}.\n`);
}

function sectionGate(lines) {
  lines.push("## 3. Relevance gate validation (run once)\n");
  if (!fs.existsSync(FILES.gate)) {
    lines.push("Not run yet.\n");
    return;
  }
  const g = readCsv(FILES.gate);
  const by = (group) => g.filter((r) => r.group === group);
  const count = (rows, d) => rows.filter((r) => r.gate_decision === d).length;
  const inScope = by("in_scope");
  const off = by("off_topic");
  const oos = by("out_of_scope_health");
  const distress = by("distress");
  const notAnswer = [...off, ...oos];
  const answered = count(inScope, "answered");
  const answeredRight = inScope.filter((r) => r.gate_decision === "answered" &&
    r.unscoped_top1 === r.likely_entry).length;
  const rejected = notAnswer.filter((r) => r.gate_decision !== "answered").length;
  lines.push(`Gate: answer only when the unscoped top-1 retrieval score is at least ${GATE_THRESHOLD}, ` +
    "after the Safety Net and the help rule (live pipeline order). The threshold and the " +
    `pass criterion were fixed in ${src(path.join(__dirname, "labels_and_gate.js"))} before the run: ` +
    `the gate holds only if it answers at least ${100 * GATE_MIN_ANSWERED}% of in-scope queries ` +
    `and rejects at least ${100 * GATE_MIN_REJECTED}% of off-topic and out-of-scope-health queries, ` +
    "as it did on the development set. Run once; nothing was changed afterwards. " +
    `Source: ${src(FILES.gate)}; input \`resources/eval/relevance_validation.csv\` (read only).\n`);
  lines.push(table(["Group", "n", "Result"], [
    ["in_scope", inScope.length, `answered ${answered}/${inScope.length} (${pct(answered, inScope.length)}; ${ci(answered, inScope.length)}); ` +
      `of those, top-1 is the likely entry ${answeredRight}; referred ${count(inScope, "referred")}, signposted ${count(inScope, "signposted")}`],
    ["off_topic", off.length, `rejected ${count(off, "rejected")}/${off.length}; answered ${count(off, "answered")}; referred ${count(off, "referred")}; signposted ${count(off, "signposted")}`],
    ["out_of_scope_health", oos.length, `rejected ${count(oos, "rejected")}/${oos.length}; answered ${count(oos, "answered")}; referred ${count(oos, "referred")}; signposted ${count(oos, "signposted")}`],
    ["distress", distress.length, `referred ${count(distress, "referred")}; signposted ${count(distress, "signposted")}; ` +
      `otherwise gate rejected ${count(distress, "rejected")}, gate answered ${count(distress, "answered")}`],
  ]));
  lines.push("");
  lines.push("Comparison with the development set (`research/eval/results/classifier_analysis.md`, " +
    "thresholds found on the same data, not independent):\n");
  lines.push(table(["Measure", "Development set (14 Oct)", "Validation set (this run)"], [
    ["Should-answer queries answered", "31/34 (91.2%)", `${answered}/${inScope.length} (${pct(answered, inScope.length)})`],
    ["Should-not-answer queries rejected", "15/20 (75.0%)", `${rejected}/${notAnswer.length} (${pct(rejected, notAnswer.length)})`],
    ["Off-topic rejected", "5/5", `${count(off, "rejected")}/${off.length}`],
    ["Out-of-scope health rejected", "not in the set", `${count(oos, "rejected")}/${oos.length}`],
  ]));
  const holds = answered / inScope.length >= GATE_MIN_ANSWERED && rejected / notAnswer.length >= GATE_MIN_REJECTED;
  lines.push(`\n**Verdict: the gate ${holds ? "holds" : "FAILS"} on this set** by the pre-set criterion ` +
    `(answered ${pct(answered, inScope.length)} against ${100 * GATE_MIN_ANSWERED}%; rejected ` +
    `${pct(rejected, notAnswer.length)} against ${100 * GATE_MIN_REJECTED}%).\n`);
  const wrong = g.filter((r) =>
    (r.group === "in_scope" && r.gate_decision !== "answered") ||
    (["off_topic", "out_of_scope_health"].includes(r.group) && r.gate_decision === "answered"));
  lines.push(`Rows the gate got wrong (${wrong.length}):\n`);
  lines.push(table(["ID", "Query", "Group", "Decision", "Unscoped top-1 (score)", "V3 (conf.)"],
    wrong.map((r) => [r.id, r.query, r.group, r.gate_decision, `${r.unscoped_top1} (${fmt(r.unscoped_score, 4)})`,
      `${r.v3_class} (${fmt(r.v3_conf)})`])));
  lines.push("");
  lines.push("Distress rows:\n");
  lines.push(table(["ID", "Query", "Decision", "Live gateway", "Unscoped top-1 (score)"],
    distress.map((r) => [r.id, r.query, r.gate_decision,
      r.gw_behavior === "ANSWER" ? `answer ${r.gw_entry}` : r.gw_behavior.toLowerCase(),
      `${r.unscoped_top1} (${fmt(r.unscoped_score, 4)})`])));
  lines.push("");
  const misrouted = inScope.filter((r) => r.gate_decision === "answered" && r.unscoped_top1 !== r.likely_entry);
  if (misrouted.length) {
    lines.push("In-scope rows answered, but not with the likely entry:\n");
    lines.push(table(["ID", "Query", "Likely entry", "Unscoped top-1 (score)"],
      misrouted.map((r) => [r.id, r.query, r.likely_entry, `${r.unscoped_top1} (${fmt(r.unscoped_score, 4)})`])));
    lines.push("");
  }
}

function sectionGap(lines) {
  lines.push("## 4. Documented coverage gap\n");
  if (!fs.existsSync(FILES.gap)) {
    lines.push("Not run yet.\n");
    return;
  }
  for (const r of readCsv(FILES.gap)) {
    lines.push(`**"${r.query}"** is an in-domain question with no knowledge-base entry ` +
      "(pregnancy risk from pre-ejaculate). Run through the live local pipeline, with no " +
      `external calls (source: ${src(FILES.gap)}):\n`);
    lines.push(table(["Field", "Value"], [
      ["Outcome", `${r.gw_outcome}${r.gw_behavior === "ANSWER" ? ` (entry ${r.gw_entry})` : ""}`],
      ["Retrieval scope", r.gw_scope],
      ["V3 class (confidence)", `${r.v3_class} (${fmt(r.v3_conf)})`],
      ["Keyword baseline class", r.kw_class],
      ["Unscoped top-1 (score)", `${r.unscoped_top1} (${fmt(r.unscoped_score, 4)})`],
      ["Scoped top-1 (score)", `${r.scoped_top1} (${fmt(r.scoped_score, 4)})`],
      [`Gate at ${GATE_THRESHOLD}`, r.gate_decision],
    ]));
    lines.push(`\nAnswer text shown to the user:\n\n> ${r.gw_message.replace(/\n/g, "\n> ")}\n`);
  }
}

function stepReport(args) {
  const upto = Number(args.upto);
  const lines = [`# Labels by rule, retrieval conditions and relevance gate (${DATE})\n`];
  lines.push("Analysis only. No threshold, model, knowledge-base entry or Safety Net rule was " +
    "changed, and no existing results file was edited. Development-set figures are " +
    "**not independent**: the queries and labels were written by the project owner, " +
    "who also built the system. Produced by `research/eval/labels_and_gate.js`.\n");
  // A hand-written "## Summary" section, if present, is kept on regeneration.
  if (fs.existsSync(FILES.report)) {
    const kept = fs.readFileSync(FILES.report, "utf8").match(/^## Summary\n[\s\S]*?(?=^## 1\. )/m);
    if (kept) lines.push(kept[0].trim(), "");
  }
  sectionLabels(lines);
  if (fs.existsSync(FILES.queries)) sectionAccuracy(lines);
  if (upto >= 2 && fs.existsSync(FILES.queries)) sectionConditions(lines);
  if (upto >= 3) sectionGate(lines);
  if (upto >= 4) sectionGap(lines);
  fs.writeFileSync(FILES.report, `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`);
  console.log(`Wrote ${path.relative(ROOT, FILES.report)}`);
}

// ------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv);
  const steps = { labels: stepLabels, collect: stepCollect, gate: stepGate, gap: stepGap, report: stepReport };
  if (!steps[args.step]) throw new Error(`Usage: labels_and_gate.js <${Object.keys(steps).join("|")}>`);
  await steps[args.step](args);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
