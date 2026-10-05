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

  return enforceThresholdOrder(config, logger);
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
  const { serviceUrl, confidenceThreshold, abstainThreshold, timeoutMs } =
    enforceThresholdOrder(
      { ...configFromEnv(process.env, logger), ...config },
      logger,
    );

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

  async function classify(text) {
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
   * @returns {Promise<{entry: object|null, retrievalScope: string}>}
   *   retrievalScope is "scoped" or "unscoped" (ml_service /retrieve),
   *   "abstained" (no retrieval attempted) or "local" (keyword retrieval,
   *   after a keyword fallback or an unusable /retrieve).
   */
  async function retrieveEntry(text, classification) {
    const { label, confidence, source } = classification;

    if (source === "keyword_fallback") {
      return { entry: retrieve(label, text), retrievalScope: "local" };
    }

    // Abstain zone: the prediction is too uncertain to trust any entry,
    // even unscoped. Returning no entry produces the no-answer fallback.
    // A confidence exactly at the threshold is not abstained.
    if (typeof confidence === "number" && confidence < abstainThreshold) {
      logger.warn(
        `[classifierClient] abstaining from retrieval: confidence ` +
          `${confidence.toFixed(3)} is below the abstain threshold ${abstainThreshold}`,
      );
      return { entry: null, retrievalScope: "abstained" };
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

      return { entry, retrievalScope: scoped ? "scoped" : "unscoped" };
    } catch (error) {
      logger.warn(
        `[classifierClient] /retrieve unusable, using local retrieval: ${error.message}`,
      );

      return { entry: retrieve(label, text), retrievalScope: "local" };
    }
  }

  return { classify, retrieve: retrieveEntry };
}

module.exports = { createClassifierClient, configFromEnv, DEFAULT_CONFIG };
