/**
 * Home's placeholder examples (PLACEHOLDER_EXAMPLES in
 * app/interface/src/content/uiText.ts): each must be the exact text of a
 * knowledge-base question, come from neither the DR-04 nor the
 * demo-risk set, and be answered with its own entry.
 *
 * "Its own entry" is checked on the path that needs no ml_service: the
 * keyword classifier and local keyword retrieval, the gateway's fallback
 * when ml_service is unavailable, run through handleQuery() so the
 * Safety Net, help, held-topic and vague rules all see the example
 * first. (The interface's offline pipeline does not retrieve entries; it
 * gives a general answer for the category, checked in its own test.)
 */

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { createHandleQuery } = require("../src/backend");
const { createClassifierClient } = require("../src/classifierClient");
const { loadKnowledgeBase, retrieve } = require("../src/retrievalModule");
const {
  KeywordBaselineClassifier,
} = require("../src/fallback/keywordClassifier");
const { DR04 } = require("./fixtures/querySets");

const REPO = path.join(__dirname, "..", "..", "..");

const entryByQuestion = new Map();
for (const entries of Object.values(loadKnowledgeBase())) {
  for (const entry of entries) entryByQuestion.set(entry.question, entry);
}

/** handleQuery() with ml_service unreachable: the keyword fallback path. */
function keywordOnlyHandler() {
  const client = createClassifierClient({
    fetch: async () => {
      throw new Error("ml_service unavailable");
    },
    config: { serviceUrl: "http://ml.test" },
    logger: { warn: () => {} },
  });
  return createHandleQuery({ classifierClient: client });
}

describe("Home's placeholder examples", () => {
  let examples;

  before(async () => {
    const uiText = await import(
      pathToFileURL(
        path.join(REPO, "app", "interface", "src", "content", "uiText.ts"),
      ).href
    );
    examples = [...uiText.PLACEHOLDER_EXAMPLES];
  });

  it("has 5 or 6 examples", () => {
    assert.ok(examples.length >= 5 && examples.length <= 6, examples.length);
  });

  it("are each the exact text of a knowledge-base question", () => {
    for (const example of examples) {
      assert.ok(entryByQuestion.has(example), example);
    }
  });

  it("come from neither DR-04 nor the demo-risk set", () => {
    const demo = fs
      .readFileSync(
        path.join(REPO, "docs", "testing", "demo-risk-set.csv"),
        "utf8",
      )
      .toLowerCase();
    for (const example of examples) {
      assert.ok(!DR04.includes(example), `${example} is in DR-04`);
      assert.ok(
        !demo.includes(example.toLowerCase()),
        `${example} is in the demo-risk set`,
      );
    }
  });

  it("are retrieved as their own entry by keyword retrieval", () => {
    const classifier = new KeywordBaselineClassifier();
    for (const example of examples) {
      const { label } = classifier.classify(example);
      const entry = retrieve(label, example);
      assert.equal(entry?.kbId, entryByQuestion.get(example).kbId, example);
    }
  });

  it("are answered with their own entry by the full pipeline without ml_service", async () => {
    const handleQuery = keywordOnlyHandler();
    for (const example of examples) {
      const response = await handleQuery(example);
      assert.equal(response.outcome, "grounded_answer", example);
      assert.equal(response.retrievalScope, "local", example);
      assert.equal(response.matchedQuestion, example, example);
      assert.equal(
        response.message,
        entryByQuestion.get(example).answer,
        example,
      );
    }
  });
});
