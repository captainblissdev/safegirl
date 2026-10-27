#!/usr/bin/env node
/**
 * V4 triage simulator, upstream part: runs the gateway's real rules on a
 * string, in backend.js order, without any running service.
 *
 *   1. checkSafety         flagged       -> "referral"
 *   2. isGenericHelpRequest               -> "help"
 *   3. matchHeldTopic      group A/B/C    -> "held_A" / "held_B" / "held_C"
 *   4. isVagueQuery                       -> "vague_rule"
 *   otherwise                             -> "" (the classifier decides)
 *
 * As in backend.js, a flagged query skips the help, held-topic and vague
 * rules and gets the referral.
 *
 * Used by research/v4/triage_sim.py: reads a JSON array of {id, text} on
 * stdin and writes a JSON array of {id, upstream} on stdout. It never
 * writes any text. The rule functions are imported from the gateway
 * unchanged; nothing is read from environment variables.
 *
 * Decision-log entry: "V4 pre-registration: deviation 4 (2026-10-27),
 * system-level measure".
 */

"use strict";

const path = require("node:path");

const GW = path.join(__dirname, "..", "..", "app", "gateway", "src");
const { checkSafety } = require(path.join(GW, "safetyNet"));
const { isGenericHelpRequest } = require(path.join(GW, "helpSignposting"));
const { matchHeldTopic } = require(path.join(GW, "heldTopics"));
const { isVagueQuery } = require(path.join(GW, "vagueQuery"));

/**
 * The upstream rule that fires for a text, in backend.js order.
 *
 * @param {string} text - The query.
 * @returns {string} "referral", "help", "held_A|B|C", "vague_rule" or "".
 */
function upstream(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new TypeError("text must be a non-empty string");
  }
  const safety = checkSafety(text);
  if (safety.flagged) return "referral";
  if (isGenericHelpRequest(text)) return "help";
  const group = matchHeldTopic(text);
  if (group) return `held_${group}`;
  if (isVagueQuery(text)) return "vague_rule";
  return "";
}

function main() {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    const items = JSON.parse(input);
    const out = items.map(({ id, text }) => ({ id, upstream: upstream(text) }));
    process.stdout.write(JSON.stringify(out));
  });
}

if (require.main === module) {
  main();
}

module.exports = { upstream };
