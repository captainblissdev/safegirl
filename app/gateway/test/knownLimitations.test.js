/**
 * Known limitations kept in the knowledge base, in the style of KB-P1
 * (docs/decision-log.md, "Known mismatch kept in the list: KB-P1"): the
 * question stays in its Topic list, but V3 classes it outside its own
 * class with confidence above the scoping threshold, so scoped retrieval
 * cannot reach its own entry and the pipeline answers with another one.
 *
 * The fake ml_service below replays what the live V3 and retriever
 * returned on 22 October 2026 for the 62-entry KB of Step K3
 * (scripts/self-retrieval-check.js). If the classifier or the KB
 * changes so that these questions get their own entry, update this file
 * and the decision log together.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { getEntryById } = require("../src/retrievalModule");
const { createHandleQuery } = require("../src/backend");
const { createClassifierClient } = require("../src/classifierClient");

const KB_QUESTIONS = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "interface",
      "src",
      "content",
      "kbQuestions.json",
    ),
    "utf8",
  ),
);

// Own entry, the live classification, and what scoped retrieval served.
const LIMITATIONS = [
  { id: "KB-C11", label: "pregnancy", confidence: 0.88, served: "KB-P8" },
  { id: "KB-S16", label: "general", confidence: 0.87, served: "KB-G16" },
  { id: "KB-P1", label: "general", confidence: 0.85, served: "KB-G14" },
  { id: "KB-G13", label: "pregnancy", confidence: 0.88, served: "KB-P8" },
];

function replayHandler({ id, label, confidence, served }) {
  const calls = [];
  const json = (body) => ({ ok: true, status: 200, json: async () => body });
  const result = (kbId, score) => {
    const entry = getEntryById(kbId);
    return {
      id: kbId,
      class: entry.category,
      title: entry.question,
      content: entry.answer,
      source: entry.source,
      score,
    };
  };
  const client = createClassifierClient({
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ endpoint: url.slice(url.lastIndexOf("/")), body });
      if (url.endsWith("/classify")) {
        return json({ intent: label, confidence, scores: {} });
      }
      // Unscoped, the own entry is on top; scoped to the wrong class, it
      // is not a candidate at all.
      return json({
        results: [body.intent ? result(served, 0.86) : result(id, 0.93)],
      });
    },
    config: { serviceUrl: "http://ml.test" },
    logger: { warn: () => {} },
  });
  return {
    calls,
    handleQuery: createHandleQuery({ classifierClient: client }),
  };
}

describe("known limitations: questions answered with another entry", () => {
  for (const limitation of LIMITATIONS) {
    const { id, label, served } = limitation;
    const own = getEntryById(id);

    it(`${id} stays listed in its own Topic list (${own.category})`, () => {
      const listed = KB_QUESTIONS.questions.find(
        (question) => question.id === id,
      );
      assert.ok(listed, `${id} not in kbQuestions.json`);
      assert.equal(listed.topicClass, own.category);
      assert.equal(listed.question, own.question);
      assert.notEqual(own.category, label);
    });

    it(`${id} is scoped to ${label} and answered with ${served}`, async () => {
      const { calls, handleQuery } = replayHandler(limitation);
      const response = await handleQuery(own.question);

      const scoped = calls.find(
        (call) => call.endpoint === "/retrieve" && call.body.intent,
      );
      assert.equal(scoped.body.intent, label);
      assert.equal(response.kind, "answer-scoped");
      assert.equal(response.matchedQuestion, getEntryById(served).question);
      assert.notEqual(response.matchedQuestion, own.question);
    });
  }
});
