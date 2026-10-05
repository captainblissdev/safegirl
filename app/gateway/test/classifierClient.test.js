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

describe("configFromEnv()", () => {
  it("uses the defaults when nothing is set", () => {
    assert.deepEqual(configFromEnv({}), { ...DEFAULT_CONFIG });
  });

  it("reads valid overrides and strips a trailing slash from the URL", () => {
    assert.deepEqual(
      configFromEnv({
        CLASSIFIER_SERVICE_URL: "http://ml:9000/",
        CLASSIFIER_CONFIDENCE_THRESHOLD: "0.65",
        CLASSIFIER_TIMEOUT_MS: "1500",
      }),
      {
        serviceUrl: "http://ml:9000",
        confidenceThreshold: 0.65,
        timeoutMs: 1500,
      },
    );
  });

  it("ignores invalid values instead of using them", () => {
    for (const env of [
      { CLASSIFIER_CONFIDENCE_THRESHOLD: "abc", CLASSIFIER_TIMEOUT_MS: "-5" },
      { CLASSIFIER_CONFIDENCE_THRESHOLD: "1.5", CLASSIFIER_TIMEOUT_MS: "2.5" },
      { CLASSIFIER_CONFIDENCE_THRESHOLD: "", CLASSIFIER_TIMEOUT_MS: "" },
    ]) {
      const config = configFromEnv(env);
      assert.equal(
        config.confidenceThreshold,
        DEFAULT_CONFIG.confidenceThreshold,
      );
      assert.equal(config.timeoutMs, DEFAULT_CONFIG.timeoutMs);
    }
  });
});
