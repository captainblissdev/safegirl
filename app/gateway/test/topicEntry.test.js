/**
 * Topic-list taps by entry id: POST /api/entry and src/topicEntry.js.
 *
 * A tapped row returns its own served entry, with no Safety Net,
 * classifier, retrieval or gate; a pending, held, unknown or malformed id
 * returns nothing; the route needs a session like /api/query.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createApp } = require("../server");
const { answerEntry } = require("../src/topicEntry");
const { getEntryById, loadAllEntries } = require("../src/retrievalModule");
const { startApp, request, allowAll } = require("./support");

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
).questions;
const PENDING = Object.values(loadAllEntries())
  .flat()
  .filter((entry) => entry.status === "pending")
  .map((entry) => entry.kbId);

describe("answerEntry()", () => {
  it("returns KB-P9's own answer for KB-P9 (mis-scoped when typed)", () => {
    const entry = getEntryById("KB-P9");
    const response = answerEntry("KB-P9");
    assert.equal(response.kind, "answer-direct");
    assert.equal(response.outcome, "grounded_answer");
    assert.equal(response.matchedQuestion, entry.question);
    assert.equal(response.message, entry.answer);
    assert.equal(response.source, entry.source);
    assert.equal(response.category, "pregnancy");
    assert.equal(response.retrievalScope, "direct");
    assert.equal(response.predictedCategory, null);
    assert.equal(response.classifierSource, null);
    assert.ok(!("relevanceGate" in response), "no gate decision");
  });

  it("returns every Topic list row's own entry", () => {
    for (const row of KB_QUESTIONS) {
      const response = answerEntry(row.id);
      assert.ok(response, row.id);
      assert.equal(response.matchedQuestion, row.question, row.id);
      assert.equal(response.category, row.topicClass, row.id);
    }
  });

  it("returns nothing for a pending entry", () => {
    assert.ok(PENDING.length > 0, "there are pending entries to test");
    for (const id of PENDING) {
      assert.equal(answerEntry(id), null, id);
    }
  });

  it("returns nothing for held, unknown or malformed ids", () => {
    for (const id of [
      "KB-S1",
      "KB-P2",
      "KB-P4",
      "KB-Z99",
      "kb-p9",
      "KB-P9 ",
      "",
      null,
      9,
      {},
    ]) {
      assert.equal(answerEntry(id), null, JSON.stringify(id));
    }
  });
});

describe("POST /api/entry", () => {
  let server;
  let queries = 0;

  before(async () => {
    const app = createApp({
      handleQuery: async () => {
        queries += 1;
        return { outcome: "grounded_answer", message: "pipeline" };
      },
      authMiddleware: allowAll,
    });
    server = await startApp(app);
  });

  after(() => server.close());

  const postEntry = (body) =>
    request(`${server.url}/api/entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("answers a tapped row directly, without the query pipeline", async () => {
    const res = await postEntry({ id: "KB-P9" });
    assert.equal(res.status, 200);
    const body = res.json();
    assert.equal(body.kind, "answer-direct");
    assert.equal(body.matchedQuestion, getEntryById("KB-P9").question);
    assert.equal(
      queries,
      0,
      "handleQuery (classifier, retrieval, gate) never ran",
    );
    assert.ok(!JSON.stringify(body).includes('"status"'), "no review status");
  });

  it("gives 404 and no entry for a pending id", async () => {
    const res = await postEntry({ id: PENDING[0] });
    assert.equal(res.status, 404);
    assert.deepEqual(res.json(), { error: "No such entry." });
  });

  it("gives 400 for a missing or malformed id, and ignores text", async () => {
    for (const body of [
      {},
      { id: "" },
      { id: "KB-P9; drop" },
      { text: "hello" },
    ]) {
      const res = await postEntry(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(res.json(), { error: "Entry id is required." });
    }
    assert.equal(queries, 0);
  });

  it("needs a session, like /api/query", async () => {
    const app = createApp({
      handleQuery: async () => ({}),
      authMiddleware: (req, res) => res.status(401).json({ error: "no" }),
    });
    const locked = await startApp(app);
    try {
      const res = await request(`${locked.url}/api/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "KB-P9" }),
      });
      assert.equal(res.status, 401);
    } finally {
      await locked.close();
    }
  });
});
