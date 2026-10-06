/**
 * HELD knowledge-base entries must never be served by any consumer: the
 * gateway's getEntryById and local keyword retrieval, ml_service (which
 * loads ml_service/knowledge_base.json), or the offline interface copy
 * (app/interface/src/offline/Kbdata.json).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  getEntryById,
  loadKnowledgeBase,
  retrieve,
} = require("../src/retrievalModule");
const { createClassifierClient } = require("../src/classifierClient");

const ROOT = path.join(__dirname, "..", "..", "..");

// Held entries and a question each one answered while it was active.
const HELD = {
  "KB-P2": {
    category: "pregnancy",
    question: "Do I have to pay for antenatal checkups as a teenager?",
  },
  "KB-S2": {
    category: "sti",
    question: "Can teenagers access HIV testing without their parents?",
  },
  "KB-P4": {
    category: "pregnancy",
    question: "Can I get safe abortion care even if what I did was illegal?",
  },
  "KB-S1": {
    category: "sti",
    question: "How soon after exposure can I get an accurate HIV test?",
  },
};

const idsIn = (value) => JSON.stringify(value).match(/KB-[A-Z]\d+/g) || [];

describe("HELD entries are never served", () => {
  for (const [id, { category, question }] of Object.entries(HELD)) {
    it(`${id}: not loaded, not found by id, not returned by local retrieval`, () => {
      const loaded = Object.values(loadKnowledgeBase()).flat();
      assert.ok(!loaded.some((entry) => entry.kbId === id));
      assert.equal(getEntryById(id), null);
      for (const cat of [
        category,
        "contraception",
        "sti",
        "pregnancy",
        "general",
      ]) {
        const entry = retrieve(cat, question);
        assert.notEqual(entry && entry.kbId, id);
      }
    });
  }

  it("are absent from ml_service/knowledge_base.json", () => {
    const kb = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "ml_service", "knowledge_base.json"),
        "utf8",
      ),
    );
    const served = kb.map((entry) => entry.id);
    for (const id of Object.keys(HELD)) {
      assert.ok(!served.includes(id), `${id} in knowledge_base.json`);
    }
  });

  it("are absent from the offline interface copy (Kbdata.json)", () => {
    const kb = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "app", "interface", "src", "offline", "Kbdata.json"),
        "utf8",
      ),
    );
    const served = idsIn(kb);
    for (const id of Object.keys(HELD)) {
      assert.ok(!served.includes(id), `${id} in Kbdata.json`);
    }
  });

  it("are refused even if a stale ml_service still returns them", async () => {
    const client = createClassifierClient({
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ id: "KB-P2", class: "pregnancy" }] }),
      }),
      config: { serviceUrl: "http://ml.test", confidenceThreshold: 0.5 },
      logger: { warn() {} },
    });

    const { entry, retrievalScope } = await client.retrieve(
      "Do I have to pay for antenatal checkups?",
      { label: "pregnancy", confidence: 0.9, source: "distilbert" },
    );

    assert.equal(retrievalScope, "local");
    assert.notEqual(entry && entry.kbId, "KB-P2");
  });
});
