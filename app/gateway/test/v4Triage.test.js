/**
 * V4 triage behind V4_TRIAGE_ENABLED (V4 integration plan, step 4).
 *
 * ml_service is a fake: /triage, /classify and /retrieve answers are set
 * per test, and every request is recorded. Queries are author-written and
 * synthetic. The flag-off behaviour is pinned separately by
 * flagOffHandleQuery.test.js.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { createHandleQuery } = require("../src/backend");
const {
  createClassifierClient,
  configFromEnv,
  DEFAULT_CONFIG,
} = require("../src/classifierClient");
const { loadKnowledgeBase } = require("../src/retrievalModule");
const {
  VAGUE_QUERY_MESSAGE,
  NO_ANSWER_MESSAGE,
} = require("../src/responseOrchestrator");

const SERVICE_URL = "http://ml.test";
const ON = {
  serviceUrl: SERVICE_URL,
  confidenceThreshold: 0.5,
  abstainThreshold: 0.35,
  timeoutMs: 50,
  v4TriageEnabled: true,
};
const QUERY = "a synthetic question about the topic that must never be logged";
const ENTRIES = Object.values(loadKnowledgeBase()).flat();
const entryOf = (cls) => ENTRIES.find((e) => e.category === cls) ?? ENTRIES[0];

const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/**
 * A fake ml_service. routes maps an endpoint to (body, options) => response.
 * Defaults: /classify answers general 0.9 (V3), /retrieve returns an entry
 * of the requested class (or general) with score 0.95.
 */
function fakeMl(routes = {}) {
  const calls = [];
  const handlers = {
    "/classify": () => json({ intent: "general", confidence: 0.9, scores: {} }),
    "/retrieve": (body) => {
      const e = entryOf(body.intent ?? "general");
      return json({
        results: [
          {
            id: e.kbId,
            class: e.category,
            title: "t",
            content: "c",
            source: "s",
            score: 0.95,
          },
        ],
      });
    },
    ...routes,
  };
  async function fetch(url, options) {
    const endpoint = url.slice(SERVICE_URL.length);
    const body = JSON.parse(options.body);
    calls.push({ endpoint, body });
    const handler = handlers[endpoint];
    if (!handler) throw new Error(`unexpected request to ${endpoint}`);
    return handler(body, options);
  }
  return { fetch, calls };
}

function setup(routes, config = ON) {
  const ml = fakeMl(routes);
  const warnings = [];
  const client = createClassifierClient({
    fetch: ml.fetch,
    config,
    logger: { warn: (message) => warnings.push(message) },
  });
  const handleQuery = createHandleQuery({
    classifierClient: client,
    relevanceGate: true,
  });
  return { handleQuery, calls: ml.calls, warnings };
}

const triageAnswer = (label, confidence) => () =>
  json({ label, confidence, scores: { [label]: confidence }, model: "v4" });

const endpoints = (calls) => calls.map((c) => c.endpoint);
const retrieveIntents = (calls) =>
  calls.filter((c) => c.endpoint === "/retrieve").map((c) => c.body.intent);

describe("V4 triage: mapping when the flag is on", () => {
  it("vague -> the clarifying question, no retrieval", async () => {
    const { handleQuery, calls } = setup({
      "/triage": triageAnswer("vague", 0.9),
    });
    const r = await handleQuery(QUERY);
    assert.equal(r.kind, "vague");
    assert.equal(r.outcome, "clarification");
    assert.equal(r.message, VAGUE_QUERY_MESSAGE);
    assert.deepEqual(endpoints(calls), ["/triage"]);
  });

  it("out_of_scope -> the existing abstain reply, no retrieval", async () => {
    const { handleQuery, calls } = setup({
      "/triage": triageAnswer("out_of_scope", 0.95),
    });
    const r = await handleQuery(QUERY);
    assert.equal(r.kind, "abstain");
    assert.equal(r.message, NO_ANSWER_MESSAGE);
    assert.equal(r.retrievalScope, "abstained");
    assert.equal(r.classifierSource, "v4");
    assert.deepEqual(endpoints(calls), ["/triage"]);
  });

  it("0.44 -> abstain without retrieval", async () => {
    const { handleQuery, calls } = setup({
      "/triage": triageAnswer("sti", 0.44),
    });
    const r = await handleQuery(QUERY);
    assert.equal(r.kind, "abstain");
    assert.equal(r.retrievalScope, "abstained");
    assert.deepEqual(endpoints(calls), ["/triage"]);
  });

  for (const confidence of [0.45, 0.49]) {
    it(`${confidence} -> unscoped retrieval`, async () => {
      const { handleQuery, calls } = setup({
        "/triage": triageAnswer("sti", confidence),
      });
      const r = await handleQuery(QUERY);
      assert.equal(r.kind, "answer-unscoped");
      assert.equal(r.retrievalScope, "unscoped");
      assert.deepEqual(retrieveIntents(calls), [undefined]);
    });
  }

  it("0.5 -> scoped retrieval with the predicted class", async () => {
    const { handleQuery, calls } = setup({
      "/triage": triageAnswer("sti", 0.5),
    });
    const r = await handleQuery(QUERY);
    assert.equal(r.kind, "answer-scoped");
    assert.equal(r.retrievalScope, "scoped");
    assert.equal(retrieveIntents(calls)[0], "sti");
  });

  for (const cls of ["contraception", "sti", "pregnancy", "general"]) {
    it(`topic class ${cls} -> scoped retrieval of ${cls}`, async () => {
      const { handleQuery, calls } = setup({
        "/triage": triageAnswer(cls, 0.9),
      });
      const r = await handleQuery(QUERY);
      assert.equal(r.kind, "answer-scoped");
      assert.equal(r.predictedCategory, cls);
      assert.equal(r.classifierSource, "v4");
      assert.equal(retrieveIntents(calls)[0], cls);
      assert.ok(!endpoints(calls).includes("/classify"), "V3 is not called");
    });
  }

  it("the relevance gate is still applied after retrieval", async () => {
    const lowScore = (body) => {
      const e = entryOf(body.intent ?? "general");
      return json({
        results: [
          {
            id: e.kbId,
            class: e.category,
            title: "t",
            content: "c",
            source: "s",
            score: 0.7,
          },
        ],
      });
    };
    const { handleQuery } = setup({
      "/triage": triageAnswer("pregnancy", 0.9),
      "/retrieve": lowScore,
    });
    const r = await handleQuery(QUERY);
    assert.equal(r.kind, "abstain");
    assert.equal(r.relevanceGate, "abstained");
  });

  it("vague and out_of_scope never reach /retrieve", async () => {
    for (const [label, confidence] of [
      ["vague", 0.99],
      ["out_of_scope", 0.99],
      ["vague", 0.3],
      ["out_of_scope", 0.3],
    ]) {
      const { handleQuery, calls } = setup({
        "/triage": triageAnswer(label, confidence),
      });
      await handleQuery(QUERY);
      assert.deepEqual(retrieveIntents(calls), [], `${label} ${confidence}`);
      assert.ok(
        !endpoints(calls).includes("/retrieve"),
        `${label} ${confidence}`,
      );
    }
  });
});

describe("V4 triage: an unreachable ml_service goes straight to keywords", () => {
  const hang = (_body, options) =>
    new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () =>
        reject(options.signal.reason),
      );
    });
  const UNREACHABLE = {
    "network error": async () => {
      throw new TypeError("fetch failed");
    },
    timeout: hang,
  };

  for (const [name, handler] of Object.entries(UNREACHABLE)) {
    it(
      `${name} -> keyword fallback, no /classify request`,
      { timeout: 2000 },
      async () => {
        const { handleQuery, calls, warnings } = setup({ "/triage": handler });
        const r = await handleQuery(QUERY);
        assert.equal(r.classifierSource, "keyword_fallback");
        assert.ok(
          !endpoints(calls).includes("/classify"),
          endpoints(calls).join(", "),
        );
        assert.equal(endpoints(calls)[0], "/triage");
        assert.ok(
          warnings.some(
            (w) =>
              /\/triage unreachable, using keyword fallback/.test(w) &&
              w.includes(name),
          ),
          warnings.join("\n"),
        );
        assert.ok(
          !warnings.some((w) => w.includes(QUERY)),
          "no query text in the log",
        );
      },
    );
  }
});

describe("V4 triage: every other failure falls back to the V3 path", () => {
  const malformed = () => ({
    ok: true,
    status: 200,
    json: async () => JSON.parse("{not json"),
  });
  const FAILURES = {
    "HTTP 503": () => json({ detail: "V4 triage model is not loaded." }, 503),
    "HTTP 500": () => json({}, 500),
    "HTTP 404": () => json({}, 404),
    "malformed JSON": malformed,
    "null body": () => json(null),
    "unknown label": () => json({ label: "maybe", confidence: 0.9 }),
    "missing label": () => json({ confidence: 0.9 }),
    "confidence as a string": () => json({ label: "sti", confidence: "0.9" }),
    "confidence below 0": () => json({ label: "sti", confidence: -0.1 }),
    "confidence above 1": () => json({ label: "sti", confidence: 1.5 }),
    "confidence missing": () => json({ label: "sti" }),
  };
  const REASON = {
    "HTTP 503": /HTTP 503/,
    "HTTP 500": /HTTP 500/,
    "HTTP 404": /HTTP 404/,
    "malformed JSON": /malformed JSON/,
    "null body": /missing or unknown label/,
    "unknown label": /missing or unknown label/,
    "missing label": /missing or unknown label/,
    "confidence as a string": /confidence/,
    "confidence below 0": /confidence/,
    "confidence above 1": /confidence/,
    "confidence missing": /confidence/,
  };

  for (const [name, handler] of Object.entries(FAILURES)) {
    it(`${name} -> V3 /classify`, { timeout: 2000 }, async () => {
      const { handleQuery, calls, warnings } = setup({ "/triage": handler });
      const r = await handleQuery(QUERY);
      assert.equal(r.classifierSource, "distilbert");
      assert.deepEqual(endpoints(calls).slice(0, 2), ["/triage", "/classify"]);
      assert.ok(
        warnings.some(
          (w) =>
            /\/triage unavailable, using V3 \/classify/.test(w) &&
            REASON[name].test(w),
        ),
        warnings.join("\n"),
      );
      assert.ok(
        !warnings.some((w) => w.includes(QUERY)),
        "no query text in the log",
      );
    });
  }

  it("when /classify also fails -> the keyword fallback", async () => {
    const { handleQuery, warnings } = setup({
      "/triage": () => json({}, 503),
      "/classify": async () => {
        throw new TypeError("fetch failed");
      },
    });
    const r = await handleQuery(QUERY);
    assert.equal(r.classifierSource, "keyword_fallback");
    assert.ok(!warnings.some((w) => w.includes(QUERY)));
  });

  it("captured logs never contain the query, on any V4 path", async () => {
    const all = [];
    for (const routes of [
      { "/triage": triageAnswer("out_of_scope", 0.9) },
      { "/triage": triageAnswer("sti", 0.2) },
      { "/triage": () => json({}, 503) },
      { "/triage": () => json({ label: QUERY, confidence: 0.9 }) },
    ]) {
      const { handleQuery, warnings } = setup(routes);
      await handleQuery(QUERY);
      all.push(...warnings);
    }
    assert.ok(all.length >= 4);
    assert.ok(!all.some((w) => w.includes(QUERY)), all.join("\n"));
  });
});

describe("V4 triage: the order of checks is unchanged", () => {
  const UPSTREAM = [
    ["Safety Net", "someone forced me to have sex", "referral"],
    ["help", "where can i get help", "help"],
    ["held A", "can i use postinor after sex", "held-topic"],
    ["held B", "i have an unwanted pregnancy what can i do", "held-topic"],
    ["held C", "my period is late and i am scared", "held-topic"],
    ["vague rule", "am i okay", "vague"],
  ];
  for (const [name, text, kind] of UPSTREAM) {
    it(`${name}: /triage is never called`, async () => {
      const { handleQuery, calls } = setup({
        "/triage": triageAnswer("sti", 0.9),
      });
      const r = await handleQuery(text);
      assert.equal(r.kind, kind);
      assert.deepEqual(calls, []);
    });
  }
});

describe("V4 triage: the flag", () => {
  it('is on only when V4_TRIAGE_ENABLED is exactly "true"', () => {
    const logger = { warn() {} };
    assert.equal(
      configFromEnv({ V4_TRIAGE_ENABLED: "true" }, logger).v4TriageEnabled,
      true,
    );
    for (const value of [
      undefined,
      "",
      "TRUE",
      "True",
      "1",
      "yes",
      " true",
      "true ",
    ]) {
      const config = configFromEnv(
        value === undefined ? {} : { V4_TRIAGE_ENABLED: value },
        logger,
      );
      assert.deepEqual(config, { ...DEFAULT_CONFIG }, JSON.stringify(value));
    }
  });

  it("off: /triage is never requested", async () => {
    const { handleQuery, calls } = setup(
      { "/triage": triageAnswer("sti", 0.9) },
      { ...ON, v4TriageEnabled: false },
    );
    const r = await handleQuery(QUERY);
    assert.equal(r.classifierSource, "distilbert");
    assert.ok(!endpoints(calls).includes("/triage"));
  });
});
