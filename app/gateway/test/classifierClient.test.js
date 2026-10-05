/**
 * Unit tests for classifierClient.js.
 *
 * ml_service is never contacted: every test injects a mocked fetch that
 * records its calls, so each test can assert which path was taken.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  createClassifierClient,
  configFromEnv,
  DEFAULT_CONFIG,
} = require("../src/classifierClient");
const { getEntryById } = require("../src/retrievalModule");

const SERVICE_URL = "http://ml.test";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/**
 * Mocked fetch. `routes` maps an endpoint ("/classify", "/retrieve") to a
 * handler receiving the parsed request body and fetch options.
 */
function mockFetch(routes) {
  const calls = [];

  async function fetch(url, options) {
    const endpoint = url.slice(SERVICE_URL.length);
    const body = JSON.parse(options.body);
    calls.push({ endpoint, body });

    const handler = routes[endpoint];
    if (!handler) {
      throw new Error(`unexpected request to ${endpoint}`);
    }
    return handler(body, options);
  }

  return { fetch, calls };
}

const networkError = async () => {
  throw new TypeError("fetch failed");
};

// Never settles on its own; rejects only when the abort signal fires.
// Without a signal it hangs forever, so a missing timeout fails the test
// (via the per-test time limit) instead of passing by accident.
const hangUntilAborted = (_body, options) =>
  new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () =>
      reject(options.signal.reason),
    );
  });

// Applied to every failure-path test; generous next to the 50 ms timeout.
const TEST_LIMIT = { timeout: 2000 };

// The logged reason for each failure, so a test cannot pass via the
// wrong failure path.
const EXPECTED_REASON = {
  "HTTP 503": /HTTP 503/,
  "network error": /fetch failed/,
  timeout: /timeout/i,
  "malformed JSON": /Unexpected token/,
  "unexpected body shape": /unexpected response body/,
  "empty results": /no results/,
  "an id that is not an active local entry": /KB-P4/,
};

function setup(routes, { localResult = { kbId: "LOCAL" } } = {}) {
  const { fetch, calls } = mockFetch(routes);
  const localCalls = [];
  const warnings = [];

  const client = createClassifierClient({
    fetch,
    config: {
      serviceUrl: SERVICE_URL,
      confidenceThreshold: 0.5,
      timeoutMs: 50,
    },
    retrieve: (label, text) => {
      localCalls.push({ label, text });
      return localResult;
    },
    logger: { warn: (message) => warnings.push(message) },
  });

  return { client, calls, localCalls, warnings };
}

const QUERY = "Can I get birth control without my parents knowing?";

describe("classify()", () => {
  it("returns the DistilBERT prediction on success", async () => {
    const scores = {
      contraception: 0.8,
      sti: 0.1,
      pregnancy: 0.05,
      general: 0.05,
    };
    const { client, calls } = setup({
      "/classify": () =>
        jsonResponse({ intent: "contraception", confidence: 0.8, scores }),
    });

    const result = await client.classify(QUERY);

    assert.deepEqual(result, {
      label: "contraception",
      confidence: 0.8,
      scores,
      source: "distilbert",
    });
    assert.deepEqual(calls, [{ endpoint: "/classify", body: { text: QUERY } }]);
  });

  const failures = {
    "HTTP 503": () => jsonResponse({ detail: "not loaded" }, 503),
    "network error": networkError,
    timeout: hangUntilAborted,
    "malformed JSON": () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    }),
    "unexpected body shape": () => jsonResponse({ label: "sti" }),
  };

  for (const [name, handler] of Object.entries(failures)) {
    it(
      `falls back to the keyword classifier on ${name}`,
      TEST_LIMIT,
      async () => {
        const { client, warnings } = setup({ "/classify": handler });

        const started = Date.now();
        const result = await client.classify(QUERY);

        assert.deepEqual(result, {
          label: "contraception",
          confidence: null,
          source: "keyword_fallback",
        });
        assert.equal(warnings.length, 1);
        assert.match(warnings[0], /keyword fallback/);
        assert.match(warnings[0], EXPECTED_REASON[name]);
        assert.ok(Date.now() - started < 1000, "fallback should not hang");
      },
    );
  }
});

describe("retrieve()", () => {
  const highConfidence = {
    label: "contraception",
    confidence: 0.82,
    source: "distilbert",
  };
  const lowConfidence = {
    label: "sti",
    confidence: 0.42,
    source: "distilbert",
  };

  it("scopes /retrieve to the label when confidence >= threshold", async () => {
    const { client, calls, localCalls } = setup({
      "/retrieve": () =>
        jsonResponse({ results: [{ id: "KB-C2", class: "contraception" }] }),
    });

    const entry = await client.retrieve(QUERY, highConfidence);

    assert.deepEqual(calls[0].body, {
      query: QUERY,
      top_k: 3,
      intent: "contraception",
    });
    // Same entry object shape local retrieval returns.
    assert.deepEqual(entry, getEntryById("KB-C2"));
    assert.equal(entry.kbId, "KB-C2");
    assert.equal(localCalls.length, 0);
  });

  it("treats confidence exactly at the threshold as scoped", async () => {
    const { client, calls } = setup({
      "/retrieve": () => jsonResponse({ results: [{ id: "KB-S2" }] }),
    });

    await client.retrieve(QUERY, { ...lowConfidence, confidence: 0.5 });

    assert.equal(calls[0].body.intent, "sti");
  });

  it("omits intent (unscoped) when confidence < threshold", async () => {
    const { client, calls, localCalls } = setup({
      "/retrieve": () =>
        jsonResponse({ results: [{ id: "KB-P2", class: "pregnancy" }] }),
    });

    const entry = await client.retrieve(QUERY, lowConfidence);

    assert.deepEqual(calls[0].body, { query: QUERY, top_k: 3 });
    assert.ok(!("intent" in calls[0].body));
    assert.equal(entry.kbId, "KB-P2");
    assert.equal(localCalls.length, 0);
  });

  it("uses local retrieval without contacting ml_service after a keyword fallback", async () => {
    const { client, calls, localCalls } = setup({});

    const entry = await client.retrieve(QUERY, {
      label: "contraception",
      confidence: null,
      source: "keyword_fallback",
    });

    assert.equal(calls.length, 0);
    assert.deepEqual(localCalls, [{ label: "contraception", text: QUERY }]);
    assert.deepEqual(entry, { kbId: "LOCAL" });
  });

  const failures = {
    "HTTP 503": () => jsonResponse({ detail: "not loaded" }, 503),
    "network error": networkError,
    timeout: hangUntilAborted,
    "empty results": () => jsonResponse({ results: [] }),
    "an id that is not an active local entry": () =>
      jsonResponse({ results: [{ id: "KB-P4" }] }), // HELD entry
  };

  for (const [name, handler] of Object.entries(failures)) {
    it(`falls back to local retrieval on ${name}`, TEST_LIMIT, async () => {
      const { client, localCalls, warnings } = setup({ "/retrieve": handler });

      const entry = await client.retrieve(QUERY, highConfidence);

      assert.deepEqual(localCalls, [{ label: "contraception", text: QUERY }]);
      assert.deepEqual(entry, { kbId: "LOCAL" });
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /local retrieval/);
      assert.match(warnings[0], EXPECTED_REASON[name]);
    });
  }
});

describe("abstain zone", () => {
  const distilbert = (confidence) => ({
    label: "pregnancy",
    confidence,
    source: "distilbert",
  });

  it("does not call /retrieve below the abstain threshold and returns no entry", async () => {
    const { client, calls, localCalls, warnings } = setup({
      "/retrieve": () => jsonResponse({ results: [{ id: "KB-C2" }] }),
    });

    const entry = await client.retrieve("what is consent", distilbert(0.333));

    assert.equal(entry, null);
    assert.equal(calls.length, 0);
    assert.equal(localCalls.length, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /abstaining/);
    assert.match(warnings[0], /0\.333/);
  });

  for (const [name, confidence] of [
    ["exactly at the abstain threshold (0.35)", 0.35],
    ["between the abstain and confidence thresholds", 0.42],
  ]) {
    it(`retrieves unscoped ${name}`, async () => {
      const { client, calls } = setup({
        "/retrieve": () => jsonResponse({ results: [{ id: "KB-P2" }] }),
      });

      const entry = await client.retrieve(QUERY, distilbert(confidence));

      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].body, { query: QUERY, top_k: 3 });
      assert.equal(entry.kbId, "KB-P2");
    });
  }

  it("never abstains after a keyword fallback (confidence is null)", async () => {
    const { client, localCalls } = setup({});

    const entry = await client.retrieve(QUERY, {
      label: "contraception",
      confidence: null,
      source: "keyword_fallback",
    });

    assert.deepEqual(entry, { kbId: "LOCAL" });
    assert.equal(localCalls.length, 1);
  });
});

describe("configFromEnv()", () => {
  const silent = () => {
    const warnings = [];
    return { warnings, logger: { warn: (message) => warnings.push(message) } };
  };

  it("uses the defaults when nothing is set", () => {
    const { warnings, logger } = silent();
    assert.deepEqual(configFromEnv({}, logger), { ...DEFAULT_CONFIG });
    assert.equal(DEFAULT_CONFIG.abstainThreshold, 0.35);
    assert.equal(warnings.length, 0);
  });

  it("reads valid overrides and strips a trailing slash from the URL", () => {
    const { warnings, logger } = silent();
    assert.deepEqual(
      configFromEnv(
        {
          CLASSIFIER_SERVICE_URL: "http://ml:9000/",
          CLASSIFIER_CONFIDENCE_THRESHOLD: "0.65",
          CLASSIFIER_ABSTAIN_THRESHOLD: "0.4",
          CLASSIFIER_TIMEOUT_MS: "1500",
        },
        logger,
      ),
      {
        serviceUrl: "http://ml:9000",
        confidenceThreshold: 0.65,
        abstainThreshold: 0.4,
        timeoutMs: 1500,
      },
    );
    assert.equal(warnings.length, 0);
  });

  it("ignores invalid values, with a warning, instead of using them", () => {
    for (const env of [
      {
        CLASSIFIER_CONFIDENCE_THRESHOLD: "abc",
        CLASSIFIER_ABSTAIN_THRESHOLD: "abc",
        CLASSIFIER_TIMEOUT_MS: "-5",
      },
      {
        CLASSIFIER_CONFIDENCE_THRESHOLD: "1.5",
        CLASSIFIER_ABSTAIN_THRESHOLD: "-0.1",
        CLASSIFIER_TIMEOUT_MS: "2.5",
      },
    ]) {
      const { warnings, logger } = silent();
      const config = configFromEnv(env, logger);
      assert.equal(
        config.confidenceThreshold,
        DEFAULT_CONFIG.confidenceThreshold,
      );
      assert.equal(config.abstainThreshold, DEFAULT_CONFIG.abstainThreshold);
      assert.equal(config.timeoutMs, DEFAULT_CONFIG.timeoutMs);
      assert.equal(warnings.length, 3);
    }
  });

  it("treats empty values as unset, without warnings", () => {
    const { warnings, logger } = silent();
    const config = configFromEnv(
      {
        CLASSIFIER_CONFIDENCE_THRESHOLD: "",
        CLASSIFIER_ABSTAIN_THRESHOLD: " ",
        CLASSIFIER_TIMEOUT_MS: "",
      },
      logger,
    );
    assert.deepEqual(config, { ...DEFAULT_CONFIG });
    assert.equal(warnings.length, 0);
  });

  for (const abstain of ["0.5", "0.6"]) {
    it(`replaces an abstain threshold at or above the confidence threshold (${abstain}) with the default`, () => {
      const { warnings, logger } = silent();
      const config = configFromEnv(
        { CLASSIFIER_ABSTAIN_THRESHOLD: abstain },
        logger,
      );
      assert.equal(config.abstainThreshold, DEFAULT_CONFIG.abstainThreshold);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /must be below/);
    });
  }

  it("disables abstaining when even the default is not below the confidence threshold", () => {
    const { warnings, logger } = silent();
    const config = configFromEnv(
      {
        CLASSIFIER_CONFIDENCE_THRESHOLD: "0.3",
        CLASSIFIER_ABSTAIN_THRESHOLD: "0.4",
      },
      logger,
    );
    assert.equal(config.confidenceThreshold, 0.3);
    assert.equal(config.abstainThreshold, 0);
    assert.match(warnings[0], /abstaining disabled/);
  });

  it("re-checks the order after createClassifierClient config overrides", async () => {
    const warnings = [];
    const calls = [];
    const client = createClassifierClient({
      fetch: async (url, options) => {
        calls.push(JSON.parse(options.body));
        return jsonResponse({ results: [{ id: "KB-G1" }] });
      },
      // Lowering the scoped threshold below the default abstain threshold.
      config: { serviceUrl: SERVICE_URL, confidenceThreshold: 0.3 },
      logger: { warn: (message) => warnings.push(message) },
    });

    // 0.2 would be abstained under 0.35; with abstaining disabled it is
    // retrieved unscoped instead.
    await client.retrieve(QUERY, {
      label: "general",
      confidence: 0.2,
      source: "distilbert",
    });

    assert.equal(calls.length, 1);
    assert.ok(warnings.some((message) => /abstaining disabled/.test(message)));
  });
});
