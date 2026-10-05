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
 *   distilbert: POST /retrieve, scoped to the predicted label when
 *   confidence >= threshold and unscoped otherwise. The top result's id is
 *   resolved against the gateway's own knowledge base, so callers receive
 *   the same entry shape as local retrieval. On any failure, an empty result
 *   or an unknown id, local retrieve(label, text) is used instead.
 *
 * The Safety Net is deliberately not involved: it stays independent of
 * classification.
 */

const { KeywordBaselineClassifier } = require("./fallback/keywordClassifier");
const {
  retrieve: localRetrieve,
  getEntryById: localGetEntryById,
} = require("./retrievalModule");

const DEFAULT_CONFIG = Object.freeze({
  serviceUrl: "http://127.0.0.1:8001",
  confidenceThreshold: 0.5,
  timeoutMs: 3000,
});

const RETRIEVE_TOP_K = 3;

/**
 * Read client configuration from environment variables.
 *
 * Invalid values fall back to the defaults rather than, for example,
 * turning a typo into a threshold that scopes every query or none.
 *
 * @param {object} env - Environment variables (defaults to process.env).
 * @returns {{serviceUrl: string, confidenceThreshold: number, timeoutMs: number}}
 */
function configFromEnv(env = process.env) {
  // Unset, empty and whitespace-only values all mean "use the default"
  // (Number("") is 0, which would otherwise be a valid threshold).
  const read = (name) => {
    const value = env[name];
    return typeof value === "string" && value.trim() !== ""
      ? value.trim()
      : undefined;
  };

  const rawThreshold = read("CLASSIFIER_CONFIDENCE_THRESHOLD");
  const rawTimeout = read("CLASSIFIER_TIMEOUT_MS");
  const threshold = Number(rawThreshold);
  const timeoutMs = Number(rawTimeout);

  return {
    serviceUrl: (
      read("CLASSIFIER_SERVICE_URL") || DEFAULT_CONFIG.serviceUrl
    ).replace(/\/+$/, ""),
    confidenceThreshold:
      rawThreshold !== undefined &&
      Number.isFinite(threshold) &&
      threshold >= 0 &&
      threshold <= 1
        ? threshold
        : DEFAULT_CONFIG.confidenceThreshold,
    timeoutMs:
      rawTimeout !== undefined && Number.isInteger(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : DEFAULT_CONFIG.timeoutMs,
  };
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
  const { serviceUrl, confidenceThreshold, timeoutMs } = {
    ...configFromEnv(),
    ...config,
  };

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

  async function retrieveEntry(text, classification) {
    const { label, confidence, source } = classification;

    if (source === "keyword_fallback") {
      return retrieve(label, text);
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

      return entry;
    } catch (error) {
      logger.warn(
        `[classifierClient] /retrieve unusable, using local retrieval: ${error.message}`,
      );

      return retrieve(label, text);
    }
  }

  return { classify, retrieve: retrieveEntry };
}

module.exports = { createClassifierClient, configFromEnv, DEFAULT_CONFIG };
