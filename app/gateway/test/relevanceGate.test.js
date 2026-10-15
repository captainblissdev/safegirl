/**
 * Tests for the relevance gate (src/relevanceGate.js and its wiring in
 * backend.js), with the real classifier client around a mocked
 * ml_service.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { createHandleQuery } = require("../src/backend");
const { createClassifierClient } = require("../src/classifierClient");
const { NO_ANSWER_MESSAGE } = require("../src/responseOrchestrator");
const { getEntryById } = require("../src/retrievalModule");
const {
  RELEVANCE_GATE_THRESHOLD,
  isRelevanceGateEnabled,
  relevanceGateDecision,
} = require("../src/relevanceGate");

const ENTRY_ID = "KB-C3";
const ENTRY = getEntryById(ENTRY_ID);

/**
 * A mocked ml_service: /classify returns the given confidence; /retrieve
 * returns ENTRY_ID with scopedScore when an intent is sent and with
 * unscopedScore otherwise. Records each request's endpoint and body.
 */
function mlService({
  confidence,
  scopedScore = 0.9,
  unscopedScore,
  failRetrieve = false,
}) {
  const requests = [];
  const client = createClassifierClient({
    fetch: async (url, init) => {
      const endpoint = new URL(url).pathname;
      const body = JSON.parse(init.body);
      requests.push({ endpoint, body });
      if (endpoint === "/retrieve" && failRetrieve) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      const payload =
        endpoint === "/classify"
          ? { intent: "contraception", confidence, scores: {} }
          : {
              results: [
                {
                  id: ENTRY_ID,
                  score: body.intent ? scopedScore : unscopedScore,
                },
              ],
            };
      return { ok: true, status: 200, json: async () => payload };
    },
    config: {
      serviceUrl: "http://ml.test",
      confidenceThreshold: 0.5,
      abstainThreshold: 0.35,
    },
    logger: { warn() {} },
  });
  return { client, requests };
}

const endpoints = (requests) => requests.map((r) => r.endpoint);

/** Asserts the response is the standard no-answer and leaks no entry. */
function assertAbstained(response) {
  assert.equal(response.outcome, "grounded_answer");
  assert.equal(response.answerFound, false);
  assert.equal(response.message, NO_ANSWER_MESSAGE);
  assert.equal(response.category, null);
  assert.equal(response.source, null);
  assert.equal(response.safetyNotes, null);
  assert.equal(response.relevanceGate, "abstained");
  const json = JSON.stringify(response);
  assert.ok(!json.includes(ENTRY.answer), "no retrieved entry text");
  assert.ok(!/score|0\.84/i.test(response.message), "no score in the message");
}

describe("relevance gate: threshold and flag", () => {
  it("uses the fixed threshold 0.8439", () => {
    assert.equal(RELEVANCE_GATE_THRESHOLD, 0.8439);
  });

  it("is on only for RELEVANCE_GATE exactly 'true'", () => {
    assert.equal(isRelevanceGateEnabled({ RELEVANCE_GATE: "true" }), true);
    for (const value of [undefined, "", "TRUE", "True", "1", "yes", " true"]) {
      assert.equal(
        isRelevanceGateEnabled({ RELEVANCE_GATE: value }),
        false,
        String(value),
      );
    }
  });

  it("decides just below, at and just above the threshold", () => {
    assert.equal(relevanceGateDecision(0.8438), "abstained");
    assert.equal(relevanceGateDecision(0.8439), "passed");
    assert.equal(relevanceGateDecision(0.844), "passed");
    for (const score of [null, undefined, Number.NaN, "0.9"]) {
      assert.equal(relevanceGateDecision(score), "not_applied", String(score));
    }
  });
});

describe("relevance gate in handleQuery (flag on)", () => {
  it("abstains just below the threshold, with no entry text", async () => {
    const { client, requests } = mlService({
      confidence: 0.4,
      unscopedScore: 0.8438,
    });
    const handleQuery = createHandleQuery({
      classifierClient: client,
      relevanceGate: true,
    });

    const response = await handleQuery("which pill can I use");

    assertAbstained(response);
    assert.equal(response.retrievalScope, "unscoped");
    assert.deepEqual(endpoints(requests), ["/classify", "/retrieve"]);
  });

  it("answers just above the threshold", async () => {
    const { client, requests } = mlService({
      confidence: 0.4,
      unscopedScore: 0.844,
    });
    const handleQuery = createHandleQuery({
      classifierClient: client,
      relevanceGate: true,
    });

    const response = await handleQuery("which pill can I use");

    assert.equal(response.answerFound, true);
    assert.equal(response.message, ENTRY.answer);
    assert.equal(response.relevanceGate, "passed");
    assert.deepEqual(endpoints(requests), ["/classify", "/retrieve"]);
  });

  it("gates a scoped answer on the unscoped score, with one extra unscoped call", async () => {
    const { client, requests } = mlService({
      confidence: 0.9,
      scopedScore: 0.95,
      unscopedScore: 0.8,
    });
    const handleQuery = createHandleQuery({
      classifierClient: client,
      relevanceGate: true,
    });

    const response = await handleQuery("which pill can I use");

    assertAbstained(response);
    assert.equal(response.retrievalScope, "scoped");
    assert.deepEqual(endpoints(requests), [
      "/classify",
      "/retrieve",
      "/retrieve",
    ]);
    assert.equal(requests[1].body.intent, "contraception");
    assert.equal(requests[2].body.intent, undefined);
  });

  it("is not applied when ml_service gives no score (local retrieval)", async () => {
    const { client } = mlService({ confidence: 0.4, failRetrieve: true });
    const handleQuery = createHandleQuery({
      classifierClient: client,
      relevanceGate: true,
    });

    const response = await handleQuery("which pill can I use");

    assert.equal(response.retrievalScope, "local");
    assert.equal(response.relevanceGate, "not_applied");
  });

  it("never reaches a flagged query", async () => {
    const { client, requests } = mlService({
      confidence: 0.9,
      unscopedScore: 0.5,
    });
    const handleQuery = createHandleQuery({
      classifierClient: client,
      relevanceGate: true,
    });

    const response = await handleQuery("I want to kill myself");

    assert.equal(response.outcome, "referral");
    assert.equal(response.classificationSkipped, true);
    assert.ok(!("relevanceGate" in response));
    // Neither the classifier nor retrieval runs for a flagged query.
    assert.deepEqual(requests, []);
  });

  it("never reaches help signposting", async () => {
    const { client, requests } = mlService({
      confidence: 0.9,
      unscopedScore: 0.5,
    });
    const handleQuery = createHandleQuery({
      classifierClient: client,
      relevanceGate: true,
    });

    const response = await handleQuery("Where can I get help?");

    assert.equal(response.outcome, "signposting");
    assert.ok(!("relevanceGate" in response));
    assert.deepEqual(requests, []);
  });
});

describe("relevance gate off (the default)", () => {
  it("leaves the response and the ml_service calls unchanged", async () => {
    const previous = process.env.RELEVANCE_GATE;
    delete process.env.RELEVANCE_GATE;
    try {
      const low = { confidence: 0.4, unscopedScore: 0.5 };
      const offByDefault = mlService(low);
      const explicitOff = mlService(low);

      const byDefault = await createHandleQuery({
        classifierClient: offByDefault.client,
      })("which pill can I use");
      const off = await createHandleQuery({
        classifierClient: explicitOff.client,
        relevanceGate: false,
      })("which pill can I use");

      for (const [response, requests] of [
        [byDefault, offByDefault.requests],
        [off, explicitOff.requests],
      ]) {
        assert.equal(response.answerFound, true);
        assert.equal(response.message, ENTRY.answer);
        assert.ok(!("relevanceGate" in response));
        assert.deepEqual(endpoints(requests), ["/classify", "/retrieve"]);
      }
      assert.deepEqual(byDefault, off);

      // A scoped query also makes no extra call when the gate is off.
      const scoped = mlService({ confidence: 0.9, unscopedScore: 0.5 });
      await createHandleQuery({ classifierClient: scoped.client })(
        "which pill can I use",
      );
      assert.deepEqual(endpoints(scoped.requests), ["/classify", "/retrieve"]);
    } finally {
      if (previous === undefined) delete process.env.RELEVANCE_GATE;
      else process.env.RELEVANCE_GATE = previous;
    }
  });
});
