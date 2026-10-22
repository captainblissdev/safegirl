#!/usr/bin/env node
/**
 * Self-retrieval check (needs a running ml_service; not part of npm test).
 *
 * Every active knowledge-base question should retrieve its own entry, both
 * unscoped and with the live classifier's scoping (scoped to the predicted
 * class at or above the confidence threshold, unscoped between the
 * abstain and confidence thresholds, no retrieval below the abstain
 * threshold), exactly as classifierClient.js decides.
 *
 * Reports every failure and every near-miss: own entry on top, but less
 * than NEAR_MISS ahead of the next entry.
 *
 * Usage (from app/gateway):
 *   npm run kb:self-retrieval
 *   CLASSIFIER_SERVICE_URL=http://127.0.0.1:8001 npm run kb:self-retrieval
 *
 * Exit status: 0 if every question gets its own entry both ways, 1 if any
 * does not, 2 if ml_service cannot be reached.
 */

const { loadKnowledgeBase } = require("../src/retrievalModule");
const { configFromEnv } = require("../src/classifierClient");

const NEAR_MISS = 0.03;
const { serviceUrl, confidenceThreshold, abstainThreshold } = configFromEnv();

async function post(endpoint, body) {
  const response = await fetch(`${serviceUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}`);
  }
  return response.json();
}

/** Own entry's rank and the margin over the best other entry. */
function rank(results, kbId) {
  const ownIndex = results.findIndex((result) => result.id === kbId);
  const top = results[0];
  const other = results.find((result) => result.id !== kbId);
  return {
    top: top ? top.id : null,
    own: ownIndex === -1 ? null : ownIndex + 1,
    margin:
      ownIndex === 0 && other ? results[0].score - other.score : undefined,
    rival: other ? `${other.id} ${other.score.toFixed(3)}` : "",
    score: ownIndex === -1 ? null : results[ownIndex].score,
  };
}

async function main() {
  try {
    await fetch(`${serviceUrl}/health`);
  } catch {
    console.error(`ml_service is not reachable at ${serviceUrl}`);
    return 2;
  }

  const entries = Object.values(loadKnowledgeBase()).flat();
  const failures = [];
  const nearMisses = [];

  console.log(
    `${entries.length} questions; scoped at >= ${confidenceThreshold}, ` +
      `abstain below ${abstainThreshold}; near-miss margin < ${NEAR_MISS}\n`,
  );

  for (const entry of entries) {
    const { kbId, category, question } = entry;
    const { intent, confidence } = await post("/classify", { text: question });

    const unscoped = rank(
      (await post("/retrieve", { query: question, top_k: 5 })).results,
      kbId,
    );

    let live;
    let mode;
    if (confidence < abstainThreshold) {
      mode = "abstained";
      live = { top: null, own: null };
    } else if (confidence >= confidenceThreshold) {
      mode = `scoped ${intent}`;
      live = rank(
        (await post("/retrieve", { query: question, top_k: 5, intent }))
          .results,
        kbId,
      );
    } else {
      mode = "unscoped";
      live = unscoped;
    }

    const line =
      `${kbId.padEnd(6)} [${category}] classed ${intent} ` +
      `${confidence.toFixed(2)} (${mode}) | unscoped: ${unscoped.top}` +
      `${unscoped.margin !== undefined ? ` +${unscoped.margin.toFixed(3)}` : ""}` +
      ` | live: ${live.top}` +
      `${live.margin !== undefined ? ` +${live.margin.toFixed(3)}` : ""}`;
    console.log(line);

    for (const [how, result] of [
      ["unscoped", unscoped],
      [`live (${mode})`, live],
    ]) {
      if (result.own !== 1) {
        failures.push(
          `${kbId} ${how}: got ${result.top ?? "nothing"}` +
            (result.own ? `; own entry rank ${result.own}` : "") +
            (result.score !== null && result.score !== undefined
              ? ` (own ${result.score.toFixed(3)})`
              : ""),
        );
      } else if (result.margin !== undefined && result.margin < NEAR_MISS) {
        nearMisses.push(
          `${kbId} ${how}: margin ${result.margin.toFixed(3)} over ${result.rival}`,
        );
      }
    }
  }

  console.log(`\nFailures (${failures.length}):`);
  failures.forEach((failure) => console.log(`  ${failure}`));
  console.log(`Near-misses (${nearMisses.length}):`);
  nearMisses.forEach((nearMiss) => console.log(`  ${nearMiss}`));

  return failures.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.message);
    process.exit(2);
  },
);
