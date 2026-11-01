/**
 * Frozen relevance gate (g), behind GATE_G_ENABLED (off by default).
 *
 * Gate (g) is a logistic gate fitted under V4 triage routing (see
 * docs/decision-log.md, "Gate (g) frozen" and "Gate (g) wired behind a
 * flag"). It is used only when GATE_G_ENABLED is exactly "true" AND
 * V4_TRIAGE_ENABLED is exactly "true"; in every other case the gateway
 * keeps the current gate (relevanceGate.js, 0.8439) and behaves exactly as
 * before. The frozen file is research/v4/gate_refit/frozen/gate_g.json;
 * its SHA-256 is checked when the gateway starts and a mismatch stops the
 * start.
 *
 * Features, as in research/v4/gate_refit/gate_g.py:
 *   s1      unscoped top-1 retrieval score
 *   margin  unscoped top-1 score minus unscoped top-2 score
 *   agree   1 if V4's class equals the class of the unscoped top-1 entry
 *   v4_p    V4's top class probability (the /triage confidence)
 * Serve when p >= the frozen threshold; otherwise abstain.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const GATE_G_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "research",
  "v4",
  "gate_refit",
  "frozen",
  "gate_g.json",
);
const GATE_G_SHA256 =
  "f63142ced7ccd2d8b83966a4260debe56deb87eab5f6f987334429f91947023b";
const GATE_G_FEATURES = Object.freeze(["s1", "margin", "agree", "v4_p"]);

/** True when gate (g) should be used: both flags exactly "true". */
function isGateGEnabled(env = process.env) {
  return env.GATE_G_ENABLED === "true" && env.V4_TRIAGE_ENABLED === "true";
}

/**
 * Load the frozen gate, refusing a file whose SHA-256 is not the frozen
 * one or whose features are not (g)'s.
 *
 * @param {string} [filePath]
 * @param {string} [expectedSha256]
 * @returns {{features: string[], mean: number[], scale: number[],
 *            coef: number[], intercept: number, threshold: number,
 *            routing: string}}
 */
function loadGateG(filePath = GATE_G_PATH, expectedSha256 = GATE_G_SHA256) {
  let bytes;
  try {
    bytes = fs.readFileSync(filePath);
  } catch (error) {
    throw new Error(
      `gate (g) file not readable: ${filePath} (${error.code || error.message})`,
      {
        cause: error,
      },
    );
  }
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== expectedSha256) {
    throw new Error(
      `gate (g) file SHA-256 ${actual} is not the frozen ${expectedSha256}`,
    );
  }
  const spec = JSON.parse(bytes.toString("utf8"));
  const features = spec.features;
  if (JSON.stringify(features) !== JSON.stringify(GATE_G_FEATURES)) {
    throw new Error(
      `gate (g) features ${JSON.stringify(features)} are not ${JSON.stringify(GATE_G_FEATURES)}`,
    );
  }
  const { mean, scale, coef, intercept } = spec.model;
  return Object.freeze({
    features,
    mean,
    scale,
    coef,
    intercept,
    threshold: spec.decision.threshold,
    routing: spec.routing.id,
  });
}

/**
 * The gate for this process from environment variables: the loaded gate
 * when both flags are on, otherwise null (the current gate is used).
 * Throws when the flags are on and the file fails its check, so the
 * gateway refuses to start.
 */
function gateGFromEnv(
  env = process.env,
  { logger = console, load = loadGateG } = {},
) {
  if (env.GATE_G_ENABLED === "true" && env.V4_TRIAGE_ENABLED !== "true") {
    logger.warn(
      "[gateG] GATE_G_ENABLED is true but V4_TRIAGE_ENABLED is not; using the current gate (0.8439)",
    );
    return null;
  }
  if (!isGateGEnabled(env)) {
    return null;
  }
  let gate;
  try {
    gate = load();
  } catch (error) {
    throw new Error(`Refusing to start: ${error.message}`, { cause: error });
  }
  logger.warn(
    "[gateG] gate (g) is ON: the relevance gate uses research/v4/gate_refit/frozen/gate_g.json",
  );
  return gate;
}

/** The gate's features from retrieval and V4 results, or null if any is missing. */
function gateGFeatures({ s1, s2, top1Class, v4Label, v4Confidence }) {
  const numbers = [s1, s2, v4Confidence];
  if (
    !numbers.every((n) => typeof n === "number" && Number.isFinite(n)) ||
    typeof top1Class !== "string"
  ) {
    return null;
  }
  return {
    s1,
    margin: s1 - s2,
    agree: v4Label === top1Class ? 1 : 0,
    v4_p: v4Confidence,
  };
}

/** The gate's probability of "serving the live entry would be correct". */
function gateGProbability(gate, features) {
  // Same order as gate_g.py: the dot product first, then the intercept.
  let dot = 0;
  gate.features.forEach((name, i) => {
    dot += ((features[name] - gate.mean[i]) / gate.scale[i]) * gate.coef[i];
  });
  return 1 / (1 + Math.exp(-(dot + gate.intercept)));
}

/**
 * The gate's decision, in relevanceGateDecision's terms.
 *
 * @returns {"passed"|"abstained"|"not_applied"}
 */
function gateGDecision(gate, inputs) {
  const features = gateGFeatures(inputs);
  if (!features) {
    return "not_applied";
  }
  return gateGProbability(gate, features) >= gate.threshold
    ? "passed"
    : "abstained";
}

module.exports = {
  GATE_G_FEATURES,
  GATE_G_PATH,
  GATE_G_SHA256,
  gateGDecision,
  gateGFeatures,
  gateGFromEnv,
  gateGProbability,
  isGateGEnabled,
  loadGateG,
};
