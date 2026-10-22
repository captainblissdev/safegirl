/**
 * Review status of the knowledge-base entries ("- **Status:** approved"
 * or "pending", docs/decision-log.md, 22 October 2026).
 *
 * Every active entry carries a status, and a missing or unknown one fails
 * the load. The pending list below is the record of what still awaits
 * clinician sign-off: change it only together with the class files.
 *
 * The status is internal. It must never reach anything the user sees:
 * gateway responses, kbQuestions.json, ml_service's knowledge_base.json
 * (whose entries /retrieve returns) or the offline Kbdata.json.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  KB_STATUSES,
  getEntryById,
  loadKnowledgeBase,
  parseKbFile,
} = require("../src/retrievalModule");
const { createHandleQuery } = require("../src/backend");
const { createClassifierClient } = require("../src/classifierClient");

const ROOT = path.join(__dirname, "..", "..", "..");
const readJson = (...parts) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), "utf8"));

const APPROVED = [
  "KB-C1",
  "KB-C2",
  "KB-S3",
  "KB-P1",
  "KB-P5",
  "KB-P6",
  "KB-P7",
  "KB-G1",
  "KB-G2",
];

const PENDING = [
  "KB-C3",
  "KB-C4",
  "KB-C5",
  "KB-C7",
  "KB-C8",
  "KB-C9",
  "KB-C10",
  "KB-S4",
  "KB-S5",
  "KB-S6",
  "KB-S7",
  "KB-S8",
  "KB-S9",
  "KB-S10",
  "KB-S11",
  "KB-S12",
  "KB-S13",
  "KB-S14",
  "KB-S15",
  "KB-S16",
  "KB-S17",
  "KB-S18",
  "KB-P8",
  "KB-G3",
  "KB-G4",
  "KB-G5",
  "KB-G6",
  "KB-G7",
  "KB-G8",
  "KB-G9",
  "KB-G10",
  "KB-G11",
];

const entries = () => Object.values(loadKnowledgeBase()).flat();

/** Every key, at any depth, of a parsed JSON value. */
function keysOf(value, keys = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => keysOf(item, keys));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      keys.add(key);
      keysOf(item, keys);
    }
  }
  return keys;
}

/** Every string value, at any depth, of a parsed JSON value. */
function stringsOf(value, strings = []) {
  if (typeof value === "string") strings.push(value);
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => stringsOf(item, strings));
  }
  return strings;
}

function assertNoStatus(value, where) {
  assert.ok(!keysOf(value).has("status"), `${where}: a "status" key`);
  for (const text of stringsOf(value)) {
    assert.ok(!KB_STATUSES.includes(text), `${where}: the value "${text}"`);
    assert.ok(!text.includes("**Status:**"), `${where}: a Status line`);
  }
}

describe("knowledge-base review status", () => {
  it("is approved or pending on every active entry", () => {
    for (const entry of entries()) {
      assert.ok(KB_STATUSES.includes(entry.status), entry.kbId);
    }
  });

  it("lists every pending entry (32 of 41)", () => {
    const pending = entries()
      .filter((entry) => entry.status === "pending")
      .map((entry) => entry.kbId);
    assert.deepEqual(pending, PENDING);
  });

  it("lists every approved entry (9 of 41)", () => {
    const approved = entries()
      .filter((entry) => entry.status === "approved")
      .map((entry) => entry.kbId);
    assert.deepEqual(approved, APPROVED);
    assert.equal(entries().length, APPROVED.length + PENDING.length);
  });

  for (const [label, line] of [
    ["missing", ""],
    ["unknown", "- **Status:** reviewed\n"],
  ]) {
    it(`fails the load when an entry's status is ${label}`, () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-status-"));
      const file = path.join(dir, "general.md");
      fs.writeFileSync(
        file,
        "# General\n\n## KB-G1\n- **User question:** Q?\n" +
          `- **Answer:** A.\n- **Source:** S.\n${line}`,
      );
      try {
        assert.throws(() => parseKbFile(file), /KB-G1 has (no|unknown) status/);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

describe("the review status never reaches the user", () => {
  it("is not in kbQuestions.json", () => {
    assertNoStatus(
      readJson("app", "interface", "src", "content", "kbQuestions.json"),
      "kbQuestions.json",
    );
  });

  it("is not in ml_service/knowledge_base.json (what /retrieve returns)", () => {
    assertNoStatus(
      readJson("ml_service", "knowledge_base.json"),
      "knowledge_base.json",
    );
  });

  it("is not in the offline interface copy (Kbdata.json)", () => {
    assertNoStatus(
      readJson("app", "interface", "src", "offline", "Kbdata.json"),
      "Kbdata.json",
    );
  });

  it("is not in a gateway response for any of the 41 questions", async () => {
    // A fake ml_service that classes each question as its own entry's
    // class and retrieves that entry, so every answer path is exercised.
    const byQuestion = new Map(entries().map((e) => [e.question, e]));
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    const client = createClassifierClient({
      fetch: async (url, options) => {
        const body = JSON.parse(options.body);
        const entry = byQuestion.get(body.text ?? body.query);
        if (url.endsWith("/classify")) {
          return json({
            intent: entry.category,
            confidence: 0.95,
            scores: {},
          });
        }
        return json({
          results: [
            {
              id: entry.kbId,
              class: entry.category,
              title: entry.question,
              content: entry.answer,
              source: entry.source,
              score: 0.95,
            },
          ],
        });
      },
      config: { serviceUrl: "http://ml.test" },
      logger: { warn: () => {} },
    });
    const handleQuery = createHandleQuery({
      classifierClient: client,
      relevanceGate: true,
    });

    let answers = 0;
    for (const question of byQuestion.keys()) {
      const response = await handleQuery(question);
      assertNoStatus(response, question);
      if (response.outcome === "grounded_answer") answers += 1;
    }
    // The held-topic and vague rules may intercept a few questions first;
    // the rest must be answered, so the answer path is really covered.
    assert.ok(answers >= 35, `${answers} answers`);
    assert.ok(getEntryById("KB-S16").status, "status is kept in memory");
  });
});
