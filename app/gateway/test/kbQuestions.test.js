/**
 * The interface's Topic list data (app/interface/src/content/kbQuestions.json):
 * generated from the active knowledge base, up to date, and carrying no
 * answers or other entry fields.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const {
  buildKbQuestions,
  serialize,
  OUTPUT_FILE,
} = require("../scripts/build-kb-questions");
const { loadKnowledgeBase } = require("../src/retrievalModule");

describe("Topic list questions", () => {
  it("are up to date with the knowledge base", () => {
    assert.equal(
      fs.readFileSync(OUTPUT_FILE, "utf8"),
      serialize(buildKbQuestions()),
      "run: node scripts/build-kb-questions.js",
    );
  });

  it("list every active entry once, with its own class and question", () => {
    const { questions } = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"));
    const active = Object.entries(loadKnowledgeBase()).flatMap(
      ([topicClass, entries]) =>
        entries.map((entry) => ({
          id: entry.kbId,
          topicClass,
          question: entry.question,
        })),
    );
    assert.deepEqual(questions, active);
    assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  });

  it("carry no answers or other entry fields", () => {
    const text = fs.readFileSync(OUTPUT_FILE, "utf8");
    const { questions } = JSON.parse(text);
    for (const question of questions) {
      assert.deepEqual(Object.keys(question).sort(), [
        "id",
        "question",
        "topicClass",
      ]);
    }
    for (const entries of Object.values(loadKnowledgeBase())) {
      for (const entry of entries) {
        assert.ok(!text.includes(entry.answer), `${entry.kbId} answer`);
      }
    }
  });
});
