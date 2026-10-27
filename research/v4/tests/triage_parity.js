#!/usr/bin/env node
/**
 * Parity of triage_sim.js with the live gateway order in backend.js.
 *
 * Reads a JSON array of {id, text} on stdin. For each item it runs the
 * real createHandleQuery with a stub classifier client (no ml_service,
 * relevance gate off) and maps the response to the upstream result:
 * referral -> "referral", signposting -> "help", held -> "held_<group>",
 * clarification -> "vague_rule", anything that reached the classifier
 * -> "". It compares that with triage_sim.upstream(text) and checks the
 * classifier ran exactly when no upstream rule fired.
 *
 * Writes {compared, mismatches, classifierMismatches} with ids only,
 * never text.
 */

"use strict";

const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..", "..");
const { createHandleQuery } = require(path.join(ROOT, "app", "gateway", "src", "backend"));
const { upstream } = require(path.join(__dirname, "..", "triage_sim"));

function liveUpstream(response) {
  switch (response.outcome) {
    case "referral":
      return "referral";
    case "signposting":
      return "help";
    case "held":
      return `held_${response.heldTopicGroup}`;
    case "clarification":
      return "vague_rule";
    default:
      return "";
  }
}

async function main(items) {
  let classified = false;
  const stub = {
    classify: () => {
      classified = true;
      return { label: "general", confidence: 0.9, source: "stub" };
    },
    retrieve: async () => ({ entry: null, retrievalScope: "abstained" }),
  };
  const handleQuery = createHandleQuery({ classifierClient: stub, relevanceGate: false });
  const mismatches = [];
  const classifierMismatches = [];
  for (const { id, text } of items) {
    classified = false;
    const live = liveUpstream(await handleQuery(text));
    const sim = upstream(text);
    if (live !== sim) mismatches.push(id);
    if (classified !== (sim === "")) classifierMismatches.push(id);
  }
  return { compared: items.length, mismatches, classifierMismatches };
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", async () => {
  process.stdout.write(JSON.stringify(await main(JSON.parse(input))));
});
