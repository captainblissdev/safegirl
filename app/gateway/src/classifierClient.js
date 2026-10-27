/**
 * SafeGirl Classifier Client
 *
 * Connects the gateway to ml_service (the DistilBERT classifier and
 * semantic retrieval service) with the keyword pipeline as a fallback:
 *
 * classify(text)
 *   POST /classify -> { label, confidence, scores, source: "distilbert" }
 *   On any failure (network error, timeout, non-2xx, malformed body) the
 *   KeywordBaselineClassifier is used instead:
 *   -> { label, confidence: null, source: "keyword_fallback" }
 *
 * retrieve(text, classification)
 *   keyword_fallback: local keyword-overlap retrieve(label, text); ml_service
 *   is not contacted.
 *   distilbert: confidence < abstain threshold returns no entry (the
 *   no-answer fallback) without contacting ml_service. Otherwise POST
 *   /retrieve, scoped to the predicted label when confidence >= confidence
 *   threshold and unscoped in between. The top result's id is
 *   resolved against the gateway's own knowledge base, so callers receive
 *   the same entry shape as local retrieval. On any failure, an empty result
 *   or an unknown id, local retrieve(label, text) is used instead.
 *
 *   Returns { entry, retrievalScope }: "scoped", "unscoped", "abstained" or
 *   "local".
 *
 * The Safety Net is deliberately not involved: it stays independent of
 * classification.
 *
 * V4 triage (docs/decision-log.md, "V4 integration behind a flag"), only
 * when V4_TRIAGE_ENABLED is exactly "true" (off by default):
 *   classify(text) first POSTs /triage -> { label, confidence, source: "v4" }
 *   over six classes. Any failure (network, timeout, non-2xx, malformed
 *   body, unknown label, confidence not a number in 0..1) falls back to
 *   /classify as above, logging the reason only, never the query.
 *   retrieve() abstains without retrieval for out_of_scope or a
 *   confidence below 0.45 (t_act); a topic class goes through the usual
 *   scoping (0.5) and the relevance gate. vague is answered with the
 *   clarifying question in backend.js and never reaches retrieve; only
 *   topic classes are ever sent to /retrieve as an intent.
 */

const { KeywordBaselineClassifier } = require("./fallback/keywordClassifier");
const {
  retrieve: localRetrieve,
  getEntryById: localGetEntryById,
} = require("./retrievalModule");

// Both thresholds are provisional, pending calibration in the retrieval
// evaluation.
const DEFAULT_CONFIG = Object.freeze({
  serviceUrl: "http://127.0.0.1:8001",
  confidenceThreshold: 0.5,
  abstainThreshold: 0.35,
  timeoutMs: 3000,
});

const RETRIEVE_TOP_K = 3;

// V4 triage: the frozen top-probability threshold below which V4 abstains
// (t_act), its six labels, and the four that may be retrieved.
const V4_T_ACT = 0.45;
const V4_LABELS = Object.freeze([
  "contraception",
  "sti",
  "pregnancy",
  "general",
  "out_of_scope",
  "vague",
]);
const TOPIC_LABELS = new Set(["contraception", "sti", "pregnancy", "general"]);

const isProbability = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

/**
 * Ensure abstainThreshold < confidenceThreshold, so no confidence is
 * both "abstain" and "scoped". An invalid abstain threshold is replaced
 * by the default; if the default is not below the confidence threshold
 * either, abstaining is disabled (0).
 */
function enforceThresholdOrder(config, logger) {
  const { abstainThreshold, confidenceThreshold } = config;

  if (abstainThreshold < confidenceThreshold) {
    return config;
  }

  const fallback =
    DEFAULT_CONFIG.abstainThreshold < confidenceThreshold
      ? DEFAULT_CONFIG.abstainThreshold
      : 0;

  logger.warn(
    `[classifierClient] abstain threshold ${abstainThreshold} must be below ` +
      `the confidence threshold ${confidenceThreshold}; using ${fallback}` +
      (fallback === 0 ? " (abstaining disabled)" : ""),
  );

  return { ...config, abstainThreshold: fallback };
}

/**
 * Read client configuration from environment variables.
 *
 * Invalid values fall back to the defaults, with a logged warning, rather
 * than, for example, turning a typo into a threshold that scopes every
 * query or none. CLASSIFIER_ABSTAIN_THRESHOLD must also be strictly below
 * CLASSIFIER_CONFIDENCE_THRESHOLD.
 *
 * @param {object} [env] - Environment variables (defaults to process.env).
 * @param {object} [logger] - Logger with a warn() method.
 * @returns {{serviceUrl: string, confidenceThreshold: number,
 *            abstainThreshold: number, timeoutMs: number}}
 */
function configFromEnv(env = process.env, logger = console) {
  // Unset, empty and whitespace-only values all mean "use the default"
  // (Number("") is 0, which would otherwise be a valid threshold).
  const read = (name) => {
    const value = env[name];
    return typeof value === "string" && value.trim() !== ""
      ? value.trim()
      : undefined;
  };

  const parse = (name, isValid, fallback) => {
    const raw = read(name);
    if (raw === undefined) {
      return fallback;
    }

    const value = Number(raw);
    if (isValid(value)) {
      return value;
    }

    logger.warn(
      `[classifierClient] ignoring invalid ${name}=${JSON.stringify(raw)}; using ${fallback}`,
    );
    return fallback;
  };

  const config = {
    serviceUrl: (
      read("CLASSIFIER_SERVICE_URL") || DEFAULT_CONFIG.serviceUrl
    ).replace(/\/+$/, ""),
    confidenceThreshold: parse(
      "CLASSIFIER_CONFIDENCE_THRESHOLD",
      isProbability,
      DEFAULT_CONFIG.confidenceThreshold,
    ),
    abstainThreshold: parse(
      "CLASSIFIER_ABSTAIN_THRESHOLD",
      isProbability,
      DEFAULT_CONFIG.abstainThreshold,
    ),
    timeoutMs: parse(
      "CLASSIFIER_TIMEOUT_MS",
      (value) => Number.isInteger(value) && value > 0,
      DEFAULT_CONFIG.timeoutMs,
    ),
  };

  // V4 triage is on only when the variable is exactly "true". The key is
  // added only then, so the flag-off configuration is unchanged.
  if (env.V4_TRIAGE_ENABLED === "true") {
    config.v4TriageEnabled = true;
  }

  return enforceThresholdOrder(config, logger);
}

/** The reason a /triage call failed, for the log; never the query. */
function triageFailureReason(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return "timeout";
  }
  if (error instanceof SyntaxError) {
    return "malformed JSON";
  }
  if (error instanceof TypeError) {
    return "network error";
  }
  return error?.message ?? "unknown error";
}

/**
 * Create a classifier client.
 *
 * All collaborators are injectable so tests can mock ml_service and
 * observe which path was taken.
 *
 * @param {object} [options]
 * @param {Function} [options.fetch] - fetch implementation (global fetch).
 * @param {object} [options.config] - Overrides for configFromEnv().
 * @param {object} [options.keywordClassifier] - Fallback classifier.
 * @param {Function} [options.retrieve] - Local retrieve(label, text).
 * @param {Function} [options.getEntryById] - Local entry lookup by id.
 * @param {object} [options.logger] - Logger with a warn() method.
 */
function createClassifierClient({
  fetch: fetchImpl = globalThis.fetch,
  config = {},
  keywordClassifier = new KeywordBaselineClassifier(),
  retrieve = localRetrieve,
  getEntryById = localGetEntryById,
  logger = console,
} = {}) {
  // Overrides could break the threshold order, so it is enforced again.
  const {
    serviceUrl,
    confidenceThreshold,
    abstainThreshold,
    timeoutMs,
    v4TriageEnabled,
  } = enforceThresholdOrder(
    { ...configFromEnv(process.env, logger), ...config },
    logger,
  );
  const triageOn = v4TriageEnabled === true;

  /**
   * POST a JSON body to ml_service and return the parsed response body.
   * Throws on network error, timeout, non-2xx status or invalid JSON.
   */
  async function postJson(endpoint, body) {
    const response = await fetchImpl(`${serviceUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`${endpoint} responded with HTTP ${response.status}`);
    }

    return response.json();
  }

  /** V4 triage; throws on any failure or invalid body. */
  async function triage(text) {
    const body = await postJson("/triage", { text });

    if (!body || !V4_LABELS.includes(body.label)) {
      throw new Error("/triage returned a missing or unknown label");
    }
    if (
      typeof body.confidence !== "number" ||
      !Number.isFinite(body.confidence) ||
      body.confidence < 0 ||
      body.confidence > 1
    ) {
      throw new Error(
        "/triage returned a confidence that is not a number in 0..1",
      );
    }

    return {
      label: body.label,
      confidence: body.confidence,
      scores: body.scores,
      source: "v4",
    };
  }

  async function classify(text) {
    if (triageOn) {
      try {
        return await triage(text);
      } catch (error) {
        logger.warn(
          `[classifierClient] /triage unavailable, using V3 /classify: ${triageFailureReason(error)}`,
        );
      }
    }

    try {
      const body = await postJson("/classify", { text });

      if (
        !body ||
        typeof body.intent !== "string" ||
        typeof body.confidence !== "number"
      ) {
        throw new Error("/classify returned an unexpected response body");
      }

      return {
        label: body.intent,
        confidence: body.confidence,
        scores: body.scores,
        source: "distilbert",
      };
    } catch (error) {
      logger.warn(
        `[classifierClient] /classify unavailable, using keyword fallback: ${error.message}`,
      );

      const { label } = keywordClassifier.classify(text);

      return { label, confidence: null, source: "keyword_fallback" };
    }
  }

  /**
   * Find the knowledge-base entry for a classified query.
   *
   * @param {string} text - The query.
   * @param {object} classification - Result of classify().
   * @param {object} [options]
   * @param {boolean} [options.withUnscopedScore] - Also return
   *        unscopedScore, the top-1 unscoped retrieval score, for the
   *        relevance gate. When retrieval was scoped this costs one extra
   *        unscoped /retrieve call. Without this option nothing changes.
   * @returns {Promise<{entry: object|null, retrievalScope: string,
   *            unscopedScore?: number|null}>}
   *   retrievalScope is "scoped" or "unscoped" (ml_service /retrieve),
   *   "abstained" (no retrieval attempted) or "local" (keyword retrieval,
   *   after a keyword fallback or an unusable /retrieve). unscopedScore is
   *   null when no ml_service score was obtained.
   */
  async function retrieveEntry(text, classification, options = {}) {
    const { label, confidence, source } = classification;
    const { withUnscopedScore = false } = options;
    const withScore = (result, unscopedScore = null) =>
      withUnscopedScore ? { ...result, unscopedScore } : result;

    if (source === "keyword_fallback") {
      return withScore({
        entry: retrieve(label, text),
        retrievalScope: "local",
      });
    }

    // V4: out_of_scope, any non-topic label, or a confidence below t_act
    // abstains without retrieval, so only topic classes reach /retrieve.
    if (
      source === "v4" &&
      (!TOPIC_LABELS.has(label) || confidence < V4_T_ACT)
    ) {
      logger.warn(
        `[classifierClient] V4 abstaining from retrieval: ${label}, ` +
          `confidence ${confidence.toFixed(3)} (t_act ${V4_T_ACT})`,
      );
      return withScore({ entry: null, retrievalScope: "abstained" });
    }

    // Abstain zone: the prediction is too uncertain to trust any entry,
    // even unscoped. Returning no entry produces the no-answer fallback.
    // A confidence exactly at the threshold is not abstained.
    if (typeof confidence === "number" && confidence < abstainThreshold) {
      logger.warn(
        `[classifierClient] abstaining from retrieval: confidence ` +
          `${confidence.toFixed(3)} is below the abstain threshold ${abstainThreshold}`,
      );
      return withScore({ entry: null, retrievalScope: "abstained" });
    }

    const scoped =
      typeof confidence === "number" && confidence >= confidenceThreshold;

    try {
      const body = await postJson("/retrieve", {
        query: text,
        top_k: RETRIEVE_TOP_K,
        ...(scoped ? { intent: label } : {}),
      });

      const topResult = body && Array.isArray(body.results) && body.results[0];

      if (!topResult) {
        throw new Error("/retrieve returned no results");
      }

      const entry = getEntryById(topResult.id);

      if (!entry) {
        throw new Error(
          `/retrieve returned id ${topResult.id}, which is not an active local entry`,
        );
      }

      const result = { entry, retrievalScope: scoped ? "scoped" : "unscoped" };

      if (!withUnscopedScore) {
        return result;
      }

      return withScore(
        result,
        scoped ? await unscopedTopScore(text) : scoreOf(topResult),
      );
    } catch (error) {
      logger.warn(
        `[classifierClient] /retrieve unusable, using local retrieval: ${error.message}`,
      );

      return withScore({
        entry: retrieve(label, text),
        retrievalScope: "local",
      });
    }
  }

  const scoreOf = (result) =>
    result && typeof result.score === "number" ? result.score : null;

  /** Top-1 unscoped retrieval score, or null if it cannot be obtained. */
  async function unscopedTopScore(text) {
    try {
      const body = await postJson("/retrieve", { query: text, top_k: 1 });
      return scoreOf(body && Array.isArray(body.results) && body.results[0]);
    } catch (error) {
      logger.warn(
        `[classifierClient] unscoped score unavailable for the relevance gate: ${error.message}`,
      );
      return null;
    }
  }

  return { classify, retrieve: retrieveEntry };
}

module.exports = { createClassifierClient, configFromEnv, DEFAULT_CONFIG };
