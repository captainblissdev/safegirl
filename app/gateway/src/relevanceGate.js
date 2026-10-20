/**
 * Relevance gate.
 *
 * After retrieval, the gateway abstains (returns the standard no-answer
 * help message) when the top-1 unscoped retrieval score is below
 * RELEVANCE_GATE_THRESHOLD, instead of returning a likely irrelevant
 * entry. It never runs for a flagged query or a help-signposting
 * response, which are answered before retrieval.
 *
 * It is on by default (since 2026-10-20) and off only when
 * RELEVANCE_GATE is exactly "false"; any other value, or none, leaves it
 * on, so a typo cannot switch it off. It needs a score from ml_service:
 * after a keyword fallback, local retrieval or an abstained
 * classification there is no score, and the gate is not applied.
 */

/**
 * Fixed by one validation run on resources/eval/relevance_validation.csv
 * on 2026-10-15 and not to be tuned. See docs/decision-log.md, "Relevance
 * gate behind a flag (2026-10-15)", and
 * research/eval/results/labels_and_gate_2026-10-15.md. A score exactly at
 * the threshold passes.
 */
const RELEVANCE_GATE_THRESHOLD = 0.8439;

/** True unless RELEVANCE_GATE is exactly "false". */
function isRelevanceGateEnabled(env = process.env) {
  return env.RELEVANCE_GATE !== "false";
}

/**
 * The gate's decision for one retrieval.
 *
 * @param {number|null|undefined} unscopedScore - Top-1 unscoped
 *        retrieval score from ml_service, if one was obtained.
 * @returns {"passed"|"abstained"|"not_applied"}
 */
function relevanceGateDecision(unscopedScore) {
  if (typeof unscopedScore !== "number" || !Number.isFinite(unscopedScore)) {
    return "not_applied";
  }
  return unscopedScore >= RELEVANCE_GATE_THRESHOLD ? "passed" : "abstained";
}

module.exports = {
  RELEVANCE_GATE_THRESHOLD,
  isRelevanceGateEnabled,
  relevanceGateDecision,
};
