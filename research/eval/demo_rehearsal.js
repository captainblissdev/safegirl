#!/usr/bin/env node
/**
 * Demo rehearsal: run each demo query through the real gateway pipeline
 * (createHandleQuery, with the Safety Net, help, held-topic and vague
 * rules, the classifier, retrieval and the relevance gate), first with V4
 * triage off and then on, and report what each reply would be.
 *
 * The queries are observed, never tuned against: nothing here changes a
 * rule, threshold or entry.
 *
 * It needs ml_service with V4 loaded (it serves /classify and /retrieve
 * for the flag-off run and /triage for the flag-on run). If none answers
 * at --ml, it starts one (V4_TRIAGE_ENABLED=true, with HF_HUB_OFFLINE=1
 * when --offline is given) and stops it at the end. Generation stays off
 * (extractive answers) and the relevance gate on, as in the demo.
 *
 * Input: a CSV with a "query" column, outside the repository. Output: one
 * row per query and mode (reply kind, matched KB entry id and question,
 * the reason for an abstain or a question back) printed and written to
 * --out, also outside the repository.
 *
 * Usage:
 *   node research/eval/demo_rehearsal.js --queries C:/.../demo.csv
 *        --out C:/.../rehearsal [--ml http://127.0.0.1:8001] [--offline]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.join(__dirname, "..", "..");
const GW = path.join(ROOT, "app", "gateway", "src");
const { createHandleQuery } = require(path.join(GW, "backend"));
const { createClassifierClient } = require(path.join(GW, "classifierClient"));
const { createGenerator } = require(path.join(GW, "generationModule"));
const { loadKnowledgeBase } = require(path.join(GW, "retrievalModule"));

const MODES = [
  ["off", false],
  ["on", true],
];

/** Minimal CSV reader (quoted fields, commas and newlines inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const t = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])));
}

/** The queries of a CSV with a "query" column. */
function readQueries(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  if (!rows.length || !("query" in rows[0])) throw new Error(`${file} has no "query" column`);
  return rows.map((r) => r.query.trim()).filter(Boolean);
}

const insideRepo = (p) => !path.relative(ROOT, path.resolve(p)).startsWith("..");

/** Why a reply was not an answer, in plain words (null for an answer). */
function reason(response) {
  switch (response.kind) {
    case "referral":
      return "Safety Net referral";
    case "help":
      return "generic help request: signpost";
    case "held-topic":
      return `held topic (group ${response.heldTopicGroup}): signpost`;
    case "vague":
      return response.classifierSource === "v4"
        ? "V4 predicted vague: clarifying question"
        : "vague rule (short query without a health term): clarifying question";
    case "abstain":
      if (response.relevanceGate === "abstained") return "relevance gate: top-1 unscoped score below 0.8439";
      if (response.retrievalScope === "abstained") {
        return response.classifierSource === "v4"
          ? "V4 label not a topic, or its confidence below 0.45"
          : "classifier confidence below 0.35";
      }
      return "no entry retrieved";
    default:
      return null;
  }
}

/** One output row from a gateway response. */
function describe(query, mode, response, entryIdOf) {
  return {
    query,
    mode,
    kind: response.kind,
    entry_id: response.matchedQuestion ? entryIdOf.get(response.matchedQuestion) ?? "?" : "",
    matched_question: response.matchedQuestion ?? "",
    classifier: [response.classifierSource, response.predictedCategory, response.confidence]
      .filter((v) => v !== null && v !== undefined)
      .join(" "),
    reason: reason(response) ?? "",
  };
}

const COLUMNS = ["query", "mode", "kind", "entry_id", "matched_question", "classifier", "reason"];
const csvCell = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const toCsv = (rows) => [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";

async function health(ml) {
  try {
    const r = await fetch(`${ml}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Start ml_service with V4 loaded and wait until /health reports it. */
async function startMl(ml, offline) {
  const port = new URL(ml).port || "8001";
  const env = { ...process.env, MODEL_DIR: "./final", KB_PATH: "./knowledge_base.json", V4_TRIAGE_ENABLED: "true" };
  if (offline) env.HF_HUB_OFFLINE = "1";
  const child = spawn(path.join(ROOT, ".venv", "Scripts", "python.exe"),
    ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", port],
    { cwd: path.join(ROOT, "ml_service"), env, stdio: "ignore" });
  for (let i = 0; i < 150; i++) {
    const h = await health(ml);
    if (h && h.v4 === "ok") return child;
    await new Promise((r) => setTimeout(r, 2000));
  }
  child.kill();
  throw new Error("ml_service did not start with V4 loaded within 300 s");
}

/** Run the queries in both modes with the given ml_service URL. */
async function rehearse(queries, { ml, fetchImpl = globalThis.fetch, logger = { warn() {} } }) {
  const entryIdOf = new Map(Object.values(loadKnowledgeBase()).flat().map((e) => [e.question, e.kbId]));
  const generate = createGenerator({ env: {} }).generate;
  const rows = [];
  for (const [mode, v4] of MODES) {
    const classifierClient = createClassifierClient({
      fetch: fetchImpl,
      config: { serviceUrl: ml, v4TriageEnabled: v4 },
      logger,
    });
    const handle = createHandleQuery({ classifierClient, relevanceGate: true, generate });
    for (const q of queries) rows.push(describe(q, mode, await handle(q), entryIdOf));
  }
  return rows;
}

function parseArgs(argv) {
  const args = { queries: null, out: null, ml: "http://127.0.0.1:8001", offline: false };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    if (key === "offline") args.offline = true;
    else if (key in args && argv[i + 1] !== undefined) args[key] = argv[++i];
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  if (!args.queries || !args.out) throw new Error("--queries and --out are required");
  if (insideRepo(args.queries) || insideRepo(args.out)) {
    throw new Error("--queries and --out must be outside the repository");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const queries = readQueries(args.queries);
  let child = null;
  const h = await health(args.ml);
  if (!h) {
    console.log("ml_service not reachable: starting it with V4 loaded...");
    child = await startMl(args.ml, args.offline);
  } else if (h.v4 !== "ok") {
    throw new Error("ml_service is running without V4 loaded; stop it or start it with V4_TRIAGE_ENABLED=true");
  }
  try {
    const rows = await rehearse(queries, { ml: args.ml });
    fs.mkdirSync(args.out, { recursive: true });
    const file = path.join(args.out, `rehearsal_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
    fs.writeFileSync(file, toCsv(rows));
    for (const r of rows) {
      console.log(`[${r.mode}] ${r.kind}${r.entry_id ? ` ${r.entry_id}` : ""}${r.reason ? ` (${r.reason})` : ""} | ${r.query}`);
    }
    console.log(`Saved ${rows.length} rows to ${file}`);
  } finally {
    if (child) child.kill();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { describe, parseArgs, parseCsv, readQueries, reason, rehearse };
