#!/usr/bin/env node
/**
 * Pre-retrieval routes for the gate and ranking candidates
 * (gate_candidates.py): for each development item, which gateway rule
 * answers it before classification, in the gateway's order (backend.js):
 * Safety Net (referral), generic help (help), held topic (held), vague
 * rule (vague), or none (retrieve). Uses the gateway's own modules.
 *
 * Reads JSON [{id, text}] on stdin and writes JSON {id: route} to stdout
 * (ids and routes only).
 *
 * Usage: node research/eval/gate_candidates_routes.js < items.json
 */

"use strict";

const path = require("node:path");

const GW = path.join(__dirname, "..", "..", "app", "gateway", "src");
const { checkSafety } = require(path.join(GW, "safetyNet"));
const { isGenericHelpRequest } = require(path.join(GW, "helpSignposting"));
const { matchHeldTopic } = require(path.join(GW, "heldTopics"));
const { isVagueQuery } = require(path.join(GW, "vagueQuery"));

/** The route of one query, in backend.js's order. */
function route(text) {
  const safety = checkSafety(text);
  if (safety.flagged) return "referral";
  if (isGenericHelpRequest(text)) return "help";
  if (matchHeldTopic(text)) return "held";
  if (isVagueQuery(text)) return "vague";
  return "retrieve";
}

if (require.main === module) {
  let input = "";
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    const items = JSON.parse(input);
    process.stdout.write(JSON.stringify(Object.fromEntries(items.map((i) => [i.id, route(i.text)]))));
  });
}

module.exports = { route };
