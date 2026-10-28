#!/usr/bin/env node
/**
 * The 21-entry KB's replies on the dev questions, rescored against a
 * labels file (context for K5 on relabelled labels; not part of the merge
 * rule). No services needed.
 *
 * The replies are the "Before" column of
 * docs/kb-integration-eval-2026-10-22.md (the 21-entry tree, recorded in
 * K3). They can be rescored against labels written for the 62 entries
 * because a candidate that replaced a live entry kept its ID
 * (docs/kb/id-mapping-2026-10-22.md): every id in those replies names
 * the same question in both KBs, though some answers were reworded.
 *
 * Writes ids and numbers only to research/v4/results/<--out name>.
 *
 * Usage: node research/eval/k5_baseline21.js --labels FILE --out NAME.json
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadDev, readBaseline, verdict } = require("./k5_measure");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "research", "v4", "results");

/** The K3 reply kinds as run_eval.js's observed behaviours. */
function observed(before) {
  if (before.entry) return { kind: "ANSWER", entry: before.entry };
  if (before.kind === "abstain") return { kind: "ABSTAIN", entry: null };
  if (before.kind === "held-topic" || before.kind === "help" || before.kind === "vague") {
    return { kind: "SIGNPOST", entry: null };
  }
  if (before.kind === "referral") return { kind: "REFERRAL", entry: null };
  throw new Error(`unknown reply kind ${before.kind}`);
}

function main() {
  const args = { labels: null, out: null };
  for (let i = 2; i < process.argv.length; i += 2) {
    const name = process.argv[i].replace(/^--/, "");
    if (!(name in args) || process.argv[i + 1] === undefined) {
      throw new Error(`Unknown or incomplete argument: ${process.argv[i]}`);
    }
    args[name] = process.argv[i + 1];
  }
  if (!args.labels || !/^[a-z0-9_]+\.json$/.test(args.out || "")) {
    throw new Error("--labels FILE and --out NAME.json are required");
  }
  const { ids, rows } = loadDev(args.labels);
  const baseline = readBaseline();
  const perQuestion = ids.map((id) => {
    const before = baseline[id];
    if (!before) throw new Error(`no 21-entry reply for ${id}`);
    return {
      id,
      reply_kind: before.kind,
      entry: before.entry,
      verdict: verdict(rows[id], observed(before)),
      k3_verdict: before.verdict,
    };
  });
  const result = {
    measured: new Date().toISOString(),
    replies: "docs/kb-integration-eval-2026-10-22.md, Before (21 entries)",
    labels: path.basename(args.labels),
    questions: perQuestion.length,
    correct: perQuestion.filter((q) => q.verdict === "correct").length,
    k3_correct: perQuestion.filter((q) => q.k3_verdict === "correct").length,
    verdict_changed_vs_k3: perQuestion.filter((q) => q.verdict !== q.k3_verdict).map((q) => q.id),
    per_question: perQuestion,
  };
  fs.writeFileSync(path.join(OUT, args.out), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ ...result, per_question: undefined }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
