#!/usr/bin/env node
/**
 * Live side of the gate (g) parity check (gate_g_parity.py): runs each
 * item through the gateway's real pipeline (backend.js createHandleQuery,
 * the real classifier client against a running ml_service) with
 * GATE_G_ENABLED and V4_TRIAGE_ENABLED on, and reports which entry was
 * served.
 *
 * The knowledge base is the one ml_service was started with (the 62-entry
 * file the parity script writes from git); the gateway looks entries up in
 * that same file through createClassifierClient's getEntryById option, so
 * the gateway's own default base is not changed.
 *
 * With kb null (gate_g_parity.py --demo-config) the gateway's own lookup
 * is used, so KB_SET=kb62 selects the 62-entry set as in the demo.
 *
 * Reads JSON {kb: path or null, items: [{id, text}]} on stdin; writes JSON
 * {id: {served: entry id or null, kind, source}} to stdout (ids only).
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const GW = path.join(__dirname, "..", "..", "..", "app", "gateway", "src");
const { createHandleQuery } = require(path.join(GW, "backend"));
const { createClassifierClient } = require(path.join(GW, "classifierClient"));
const { gateGFromEnv } = require(path.join(GW, "gateG"));
const { extractive } = require(path.join(GW, "generationModule"));

async function main(input) {
  const { kb, items } = JSON.parse(input);
  const entries = kb === null ? null : new Map(
    JSON.parse(fs.readFileSync(kb, "utf8")).map((e) => [
      e.id,
      { kbId: e.id, question: e.title, answer: e.content, source: e.source, category: e.class },
    ]),
  );
  const quiet = { warn() {}, error() {} };
  const gateG = gateGFromEnv(process.env, { logger: quiet });
  if (!gateG) {
    throw new Error("gate (g) is not on: set GATE_G_ENABLED=true and V4_TRIAGE_ENABLED=true");
  }
  let served;
  const handleQuery = createHandleQuery({
    classifierClient: createClassifierClient({
      ...(entries ? { getEntryById: (id) => entries.get(id) || null } : {}),
      logger: quiet,
    }),
    gateG,
    generate: (entry) => {
      served = entry ? entry.kbId : null;
      return extractive(entry);
    },
  });
  const out = {};
  for (const item of items) {
    served = null;
    const res = await handleQuery(item.text);
    const answered = typeof res.kind === "string" && res.kind.startsWith("answer");
    out[item.id] = { served: answered ? served : null, kind: res.kind, source: res.classifierSource ?? null };
  }
  return out;
}

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  main(input).then(
    (out) => process.stdout.write(JSON.stringify(out)),
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    },
  );
});
