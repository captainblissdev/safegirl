/**
 * Gemini smoke test (step 7b): four author-written synthetic queries, one
 * per category, through the gateway's real classification and retrieval
 * path and the real generate(), one call each, no retries.
 *
 * Run from the repository root with GENERATION_ENABLED=true and
 * GEMINI_API_KEY set in the environment:
 *   node research/experiments/gemini_smoke.js
 *
 * For each query it prints only: HTTP status, finish reason, prompt /
 * candidates / thinking token counts (if returned), latency, whether the
 * answer was generated or fell back to extractive and why, whether the
 * guard passed, the answer text, and the matched KB entry's question and
 * answer for comparison. It never prints request headers or
 * the key. Synthetic queries only: no real user query is sent.
 */

const path = require("path");

const gateway = path.join(__dirname, "..", "..", "app", "gateway", "src");
const { createGenerator } = require(path.join(gateway, "generationModule"));
const { createClassifierClient } = require(
  path.join(gateway, "classifierClient"),
);

// Author-written synthetic queries, one per category.
const QUERIES = [
  ["contraception", "How soon after sex should I take the emergency pill?"],
  ["sti", "Can you get an STI the first time you have sex?"],
  ["pregnancy", "What are the first signs that I might be pregnant?"],
  ["general", "Is it normal for my period to come at different times?"],
];

// Gemini enum values are printed only when they look like one.
const enumValue = (value) =>
  typeof value === "string" && /^[A-Z_]{1,40}$/.test(value)
    ? value
    : String(value ?? "none");

async function smoke(expected, queryText) {
  // The real global fetch, recording the status and a clone of the
  // response so the usage metadata can be read after generate() returns.
  let call = null;
  const recordingFetch = async (url, options) => {
    const response = await globalThis.fetch(url, options);
    call = { status: response.status, clone: response.clone() };
    return response;
  };

  // generate() logs its fallback reason through warn(); keep it.
  const warnings = [];
  const generator = createGenerator({
    fetch: recordingFetch,
    logger: { warn: (message) => warnings.push(String(message)) },
  });

  const classifierWarnings = [];
  const classifierClient = createClassifierClient({
    logger: { warn: (message) => classifierWarnings.push(String(message)) },
  });

  const classification = await classifierClient.classify(queryText);
  const { entry, retrievalScope } = await classifierClient.retrieve(
    queryText,
    classification,
  );

  const started = performance.now();
  const result = await generator.generate(entry, queryText);
  const latencyMs = Math.round(performance.now() - started);

  let body = null;
  if (call) {
    try {
      body = await call.clone.json();
    } catch {
      body = null;
    }
  }
  const usage = body?.usageMetadata ?? {};
  const candidate = Array.isArray(body?.candidates) ? body.candidates[0] : null;

  const reason = warnings.find((w) => w.startsWith("[generationModule]"));
  let guard;
  if (result.generated) {
    guard = "passed";
  } else if (reason?.includes("rejected")) {
    guard = "failed";
  } else {
    guard = "not reached";
  }

  console.log(`=== ${expected}`);
  console.log(`query: ${queryText}`);
  console.log(
    `classified: ${classification.label} (${classification.source}), ` +
      `retrieval: ${retrievalScope}, entry: ${entry?.kbId ?? "none"}`,
  );
  console.log(`HTTP status: ${call ? call.status : "no call made"}`);
  console.log(`finish reason: ${enumValue(candidate?.finishReason)}`);
  console.log(
    `tokens: prompt ${usage.promptTokenCount ?? "n/a"}, ` +
      `candidates ${usage.candidatesTokenCount ?? "n/a"}, ` +
      `thinking ${usage.thoughtsTokenCount ?? "n/a"}, ` +
      `total ${usage.totalTokenCount ?? "n/a"}`,
  );
  console.log(`latency: ${latencyMs} ms`);
  console.log(
    `answer: ${result.generated ? "generated" : "extractive"}` +
      (result.generated ? "" : ` (${reason ?? "no reason logged"})`),
  );
  console.log(`guard: ${guard}`);
  console.log(`text: ${result.text}`);
  console.log(`KB question: ${entry?.question ?? "none"}`);
  console.log(`KB answer: ${entry?.answer ?? "none"}`);
  console.log();
}

async function main() {
  if (process.env.GENERATION_ENABLED !== "true") {
    console.log("GENERATION_ENABLED is not true; nothing sent.");
    process.exitCode = 1;
    return;
  }
  for (const [expected, queryText] of QUERIES) {
    await smoke(expected, queryText);
  }
}

main();
