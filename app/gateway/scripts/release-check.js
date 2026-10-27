#!/usr/bin/env node
/**
 * Release check for the defence demo (needs a running ml_service; not part
 * of npm test).
 *
 * Entries marked "- **Status:** pending" are awaiting clinician sign-off
 * and must stay out of the demo (docs/decision-log.md, 22 October 2026).
 * This check fails if any entry the demo can show is pending:
 *
 * - the entry each demo-risk query (docs/testing/demo-risk-set.csv) is
 *   answered with, through the full pipeline (handleQuery(), as the
 *   gateway runs it, with the live classifier and the gateway's gate
 *   setting);
 * - for each of Home's placeholder examples (PLACEHOLDER_EXAMPLES in
 *   app/interface/src/content/uiText.ts), the entry it is the question of
 *   and the entry it is answered with.
 *
 * Usage (from app/gateway):
 *   npm run release:check
 *
 * Exit status: 0 if no demo or placeholder entry is pending, 1 if any is,
 * 2 if the check cannot run (ml_service unreachable, or a query fell back
 * to the keyword classifier, so the result would not be the demo's).
 */

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { handleQuery } = require("../src/backend");
const { configFromEnv } = require("../src/classifierClient");
const { loadKnowledgeBase } = require("../src/retrievalModule");

const REPO = path.join(__dirname, "..", "..", "..");
const DEMO_SET = path.join(REPO, "docs", "testing", "demo-risk-set.csv");
const UI_TEXT = path.join(
  REPO,
  "app",
  "interface",
  "src",
  "content",
  "uiText.ts",
);

/** Rows of a simple CSV (quoted fields may contain commas). */
function readCsv(file) {
  const [header, ...lines] = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  const names = header.split(",");
  return lines.map((line) => {
    const cells = line
      .match(/("([^"]|"")*"|[^,]*)(,|$)/g)
      .map((cell) =>
        cell.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'),
      );
    return Object.fromEntries(names.map((name, i) => [name, cells[i] ?? ""]));
  });
}

async function main() {
  const { serviceUrl } = configFromEnv();
  try {
    await fetch(`${serviceUrl}/health`);
  } catch {
    console.error(`ml_service is not reachable at ${serviceUrl}`);
    return 2;
  }

  const byQuestion = new Map(
    Object.values(loadKnowledgeBase())
      .flat()
      .map((entry) => [entry.question, entry]),
  );
  const { PLACEHOLDER_EXAMPLES } = await import(pathToFileURL(UI_TEXT).href);

  const pending = [];
  const label = (entry) => (entry ? `${entry.kbId} (${entry.status})` : "-");

  /** The entry a query is answered with, or null for any other reply. */
  async function servedEntry(text) {
    const response = await handleQuery(text);
    if (response.classifierSource === "keyword_fallback") {
      throw new Error(`keyword fallback for "${text}": not the demo path`);
    }
    return {
      kind: response.kind,
      entry: response.matchedQuestion
        ? byQuestion.get(response.matchedQuestion)
        : null,
    };
  }

  console.log("Demo-risk set: the entry each query is answered with");
  for (const { id, query } of readCsv(DEMO_SET)) {
    const { kind, entry } = await servedEntry(query);
    console.log(
      `  #${id.padEnd(3)} ${kind.padEnd(16)} ${label(entry)}  ${query}`,
    );
    if (entry && entry.status !== "approved") {
      pending.push(`demo #${id} "${query}" is answered with ${entry.kbId}`);
    }
  }

  console.log("\nHome placeholder examples: own entry and answered entry");
  for (const example of PLACEHOLDER_EXAMPLES) {
    const own = byQuestion.get(example);
    const { kind, entry } = await servedEntry(example);
    console.log(
      `  own ${label(own).padEnd(18)} answered ${kind} ${label(entry)}  ${example}`,
    );
    if (!own) {
      pending.push(`placeholder "${example}" is not a knowledge-base question`);
    } else if (own.status !== "approved") {
      pending.push(`placeholder "${example}" is the question of ${own.kbId}`);
    }
    if (entry && entry !== own && entry.status !== "approved") {
      pending.push(`placeholder "${example}" is answered with ${entry.kbId}`);
    }
  }

  if (pending.length === 0) {
    console.log(
      "\nrelease:check passed: no demo or placeholder entry is pending.",
    );
    return 0;
  }
  console.log(`\nrelease:check FAILED: ${pending.length} pending use(s):`);
  pending.forEach((line) => console.log(`  ${line}`));
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.message);
    process.exit(2);
  },
);
