/**
 * Tests for the reply kind and the matched question on every response
 * (src/responseOrchestrator.js), through handleQuery() with the real
 * classifier client around a mocked ml_service.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createHandleQuery } = require("../src/backend");
const { createClassifierClient } = require("../src/classifierClient");
const { REPLY_KINDS, orchestrate } = require("../src/responseOrchestrator");
const { generate } = require("../src/generationModule");
const { getEntryById, loadKnowledgeBase } = require("../src/retrievalModule");

const ENTRY_ID = "KB-S4";
const ENTRY = getEntryById(ENTRY_ID);

/**
 * handleQuery() around a mocked ml_service. /classify returns the given
 * confidence (or fails when it is undefined, giving the keyword
 * fallback); /retrieve returns ENTRY_ID with score 0.9.
 */
function handler({ confidence, relevanceGate = false } = {}) {
  const client = createClassifierClient({
    fetch: async (url) => {
      const endpoint = new URL(url).pathname;
      if (endpoint === "/classify" && confidence === undefined) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      const payload =
        endpoint === "/classify"
          ? { intent: "sti", confidence, scores: {} }
          : { results: [{ id: ENTRY_ID, score: 0.9 }] };
      return { ok: true, status: 200, json: async () => payload };
    },
    config: {
      serviceUrl: "http://ml.test",
      confidenceThreshold: 0.5,
      abstainThreshold: 0.35,
    },
    logger: { warn: () => {} },
  });
  return createHandleQuery({ classifierClient: client, relevanceGate });
}

const QUESTION = "I have unusual discharge and itching, could it be an STI?";

describe("reply kind and matched question", () => {
  it("lists exactly the eight reply kinds", () => {
    assert.deepEqual(
      [...REPLY_KINDS],
      [
        "answer-scoped",
        "answer-unscoped",
        "answer-direct",
        "abstain",
        "help",
        "held-topic",
        "vague",
        "referral",
      ],
    );
  });

  it("scoped answer: answer-scoped, with the entry's question verbatim", async () => {
    const response = await handler({ confidence: 0.9 })(QUESTION);
    assert.equal(response.retrievalScope, "scoped");
    assert.equal(response.kind, "answer-scoped");
    assert.equal(response.matchedQuestion, ENTRY.question);
    assert.equal(response.message, ENTRY.answer);
  });

  it("unscoped answer: answer-unscoped, with the entry's question", async () => {
    const response = await handler({ confidence: 0.45 })(QUESTION);
    assert.equal(response.retrievalScope, "unscoped");
    assert.equal(response.kind, "answer-unscoped");
    assert.equal(response.matchedQuestion, ENTRY.question);
  });

  it("keyword fallback (local retrieval): answer-unscoped, with the local entry's question", async () => {
    const response = await handler({ confidence: undefined })(QUESTION);
    assert.equal(response.retrievalScope, "local");
    assert.equal(response.answerFound, true);
    assert.equal(response.kind, "answer-unscoped");
    const local = loadKnowledgeBase()[response.category].find(
      (entry) => entry.answer === response.message,
    );
    assert.ok(local, "the served answer is a local entry");
    assert.equal(response.matchedQuestion, local.question);
  });

  it("classifier abstain: abstain, matchedQuestion null", async () => {
    const response = await handler({ confidence: 0.2 })(QUESTION);
    assert.equal(response.retrievalScope, "abstained");
    assert.equal(response.kind, "abstain");
    assert.equal(response.matchedQuestion, null);
  });

  it("relevance gate abstain: abstain, matchedQuestion null, no entry text", async () => {
    const client = createClassifierClient({
      fetch: async (url, init) => {
        const endpoint = new URL(url).pathname;
        const body = JSON.parse(init.body);
        const payload =
          endpoint === "/classify"
            ? { intent: "sti", confidence: 0.45, scores: {} }
            : { results: [{ id: ENTRY_ID, score: body.intent ? 0.9 : 0.8 }] };
        return { ok: true, status: 200, json: async () => payload };
      },
      config: { serviceUrl: "http://ml.test" },
      logger: { warn: () => {} },
    });
    const response = await createHandleQuery({
      classifierClient: client,
      relevanceGate: true,
    })(QUESTION);
    assert.equal(response.relevanceGate, "abstained");
    assert.equal(response.kind, "abstain");
    assert.equal(response.matchedQuestion, null);
    assert.ok(!JSON.stringify(response).includes(ENTRY.question));
  });

  it("help request: help, matchedQuestion null", async () => {
    const response = await handler({ confidence: 0.9 })(
      "Where can I get help?",
    );
    assert.equal(response.outcome, "signposting");
    assert.equal(response.kind, "help");
    assert.equal(response.matchedQuestion, null);
  });

  it("flagged query: referral, matchedQuestion null", async () => {
    const response = await handler({ confidence: 0.9 })(
      "someone forced me to have sex",
    );
    assert.equal(response.outcome, "referral");
    assert.equal(response.kind, "referral");
    assert.equal(response.matchedQuestion, null);
  });

  it("matchedQuestion is each active entry's own question, unchanged", () => {
    for (const entries of Object.values(loadKnowledgeBase())) {
      for (const entry of entries) {
        const response = orchestrate({
          safety: { flagged: false },
          classification: {
            label: entry.category,
            confidence: 0.9,
            source: "distilbert",
          },
          generation: generate(entry),
          retrievedEntry: entry,
          retrievalScope: "scoped",
        });
        assert.equal(response.matchedQuestion, entry.question, entry.kbId);
        assert.ok(entry.question.length > 0, `${entry.kbId} has a question`);
      }
    }
  });

  it("the interface's ReplyKind type lists the same kinds", () => {
    const types = fs.readFileSync(
      path.join(__dirname, "..", "..", "interface", "src", "types.ts"),
      "utf8",
    );
    const union = types.match(/export type ReplyKind =([^;]+);/);
    assert.ok(union, "ReplyKind is declared in types.ts");
    const kinds = [...union[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(kinds, [...REPLY_KINDS]);
  });
});
