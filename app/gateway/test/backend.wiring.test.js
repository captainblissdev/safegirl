/**
 * Tests for the classifier-client wiring in backend.js.
 *
 * handleQuery is built around a mocked classifier client, so these tests
 * control exactly what classification and retrieval return and can check
 * whether retrieval was called at all.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { createHandleQuery } = require("../src/backend");
const { createClassifierClient } = require("../src/classifierClient");
const { NO_ANSWER_MESSAGE } = require("../src/responseOrchestrator");
const {
  retrieve: localRetrieve,
  getEntryById,
  loadKnowledgeBase,
} = require("../src/retrievalModule");

/**
 * A classifier client whose classify() and retrieve() return fixed
 * values and record every call.
 */
function mockClient({ classification, entry, retrievalScope = "scoped" }) {
  const calls = { classify: [], retrieve: [] };

  return {
    calls,
    client: {
      classify: async (text) => {
        calls.classify.push(text);
        return classification;
      },
      retrieve: async (text, cls) => {
        calls.retrieve.push({ text, classification: cls });
        return { entry, retrievalScope };
      },
    },
  };
}

describe("knowledge-base entries carry their category", () => {
  it("on every loaded entry, matching the file it came from", () => {
    for (const [category, entries] of Object.entries(loadKnowledgeBase())) {
      for (const entry of entries) {
        assert.equal(entry.category, category, entry.kbId);
      }
    }
  });

  it("from local retrieve() and getEntryById()", () => {
    assert.equal(localRetrieve("sti", "HIV test").category, "sti");
    assert.equal(getEntryById("KB-P2").category, "pregnancy");
    assert.equal(getEntryById("KB-G1").category, "general");
  });
});

describe("handleQuery() with a classifier client", () => {
  it("reports the served entry's category and keeps the prediction separately", async () => {
    // Low-confidence "sti" prediction; unscoped retrieval found a
    // pregnancy entry.
    const pregnancyEntry = getEntryById("KB-P2");
    const { client, calls } = mockClient({
      classification: { label: "sti", confidence: 0.42, source: "distilbert" },
      entry: pregnancyEntry,
      retrievalScope: "unscoped",
    });
    const handleQuery = createHandleQuery({ classifierClient: client });

    const query = "when should I start antenatal visits";
    const response = await handleQuery(query);

    assert.equal(response.outcome, "grounded_answer");
    assert.equal(response.message, pregnancyEntry.answer);
    assert.equal(response.category, "pregnancy");
    assert.equal(response.predictedCategory, "sti");
    assert.equal(response.classifierSource, "distilbert");
    assert.equal(response.confidence, 0.42);
    assert.equal(response.answerFound, true);
    assert.equal(response.retrievalScope, "unscoped");

    // retrieve() receives the query and the full classification.
    assert.deepEqual(calls.retrieve, [
      {
        text: query,
        classification: {
          label: "sti",
          confidence: 0.42,
          source: "distilbert",
        },
      },
    ]);
  });

  it("returns the referral for a flagged query and never calls retrieval", async () => {
    const { client, calls } = mockClient({
      classification: {
        label: "general",
        confidence: 0.9,
        source: "distilbert",
      },
      entry: getEntryById("KB-G1"),
    });
    const handleQuery = createHandleQuery({ classifierClient: client });

    const response = await handleQuery("he didn't stop when I said no");

    assert.equal(response.outcome, "referral");
    assert.equal(response.generationInvoked, false);
    assert.equal(calls.retrieve.length, 0);
    assert.equal(response.retrievalScope, null);

    // The classifier still runs in parallel with the Safety Net.
    assert.equal(calls.classify.length, 1);
    assert.equal(response.classificationSkipped, false);
  });

  it("returns the no-answer fallback, never null, when retrieval finds nothing", async () => {
    const { client } = mockClient({
      classification: {
        label: "contraception",
        confidence: 0.77,
        source: "distilbert",
      },
      entry: null,
      retrievalScope: "scoped",
    });
    const handleQuery = createHandleQuery({ classifierClient: client });

    const response = await handleQuery("what is consent");

    assert.equal(response.outcome, "grounded_answer");
    assert.equal(response.message, NO_ANSWER_MESSAGE);
    assert.equal(response.answerFound, false);
    assert.equal(response.category, null);
    assert.equal(response.predictedCategory, "contraception");
    assert.equal(response.confidence, 0.77);
    assert.equal(response.retrievalScope, "scoped");
  });

  it("passes a keyword-fallback classification through with null confidence", async () => {
    const { client } = mockClient({
      classification: {
        label: "contraception",
        confidence: null,
        source: "keyword_fallback",
      },
      entry: getEntryById("KB-C1"),
      retrievalScope: "local",
    });
    const handleQuery = createHandleQuery({ classifierClient: client });

    const response = await handleQuery("can I get birth control");

    assert.equal(response.category, "contraception");
    assert.equal(response.predictedCategory, "contraception");
    assert.equal(response.classifierSource, "keyword_fallback");
    assert.equal(response.confidence, null);
    assert.equal(response.retrievalScope, "local");
  });
});

describe("handleQuery() with the real classifier client and a mocked ml_service", () => {
  it("abstains below the abstain threshold: no /retrieve call, fallback message", async () => {
    const requests = [];
    const client = createClassifierClient({
      fetch: async (url) => {
        const endpoint = new URL(url).pathname;
        requests.push(endpoint);
        if (endpoint !== "/classify") {
          throw new Error(`unexpected request to ${endpoint}`);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            intent: "pregnancy",
            confidence: 0.333,
            scores: {},
          }),
        };
      },
      config: {
        serviceUrl: "http://ml.test",
        confidenceThreshold: 0.5,
        abstainThreshold: 0.35,
      },
      logger: { warn() {} },
    });
    const handleQuery = createHandleQuery({ classifierClient: client });

    const response = await handleQuery("what is consent");

    assert.deepEqual(requests, ["/classify"]);
    assert.equal(response.outcome, "grounded_answer");
    assert.equal(response.message, NO_ANSWER_MESSAGE);
    assert.equal(response.answerFound, false);
    assert.equal(response.category, null);
    assert.equal(response.predictedCategory, "pregnancy");
    assert.equal(response.classifierSource, "distilbert");
    assert.equal(response.confidence, 0.333);
    assert.equal(response.retrievalScope, "abstained");
  });
});
