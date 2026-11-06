/**
 * Tests for the knowledge-base set selection (KB_SET, retrievalModule.js)
 * and the question builder's --kb-set option.
 *
 * - default unchanged: with KB_SET unset or anything but exactly "kb62",
 *   the gateway reads the 21-entry files exactly as before (same ids,
 *   same fields, no status) and kbQuestions.json is current;
 * - kb62: the 62 approved entries only; the 4 pending entries (KB-C6,
 *   KB-C14, KB-S19, KB-C22) are never served; the set agrees with
 *   ml_service/knowledge_base_kb62.json and the interface's two kb62
 *   copies; an entry without a valid status fails the load.
 */
const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  KB_SETS,
  getEntryById,
  kbSetFromEnv,
  loadKnowledgeBase,
  parseKbFile,
} = require("../src/retrievalModule");
const {
  buildKbQuestions,
  serialize,
  OUTPUT_FILE,
  OUTPUT_FILE_KB62,
} = require("../scripts/build-kb-questions");

const REPO = path.join(__dirname, "..", "..", "..");
const PENDING = ["KB-C6", "KB-C14", "KB-S19", "KB-C22"];
const ids = (kb) =>
  Object.values(kb)
    .flat()
    .map((e) => e.kbId);
const readJson = (rel) =>
  JSON.parse(fs.readFileSync(path.join(REPO, rel), "utf8"));

afterEach(() => {
  delete process.env.KB_SET;
});

describe("kbSetFromEnv", () => {
  it("is kb62 only for exactly kb62", () => {
    assert.equal(kbSetFromEnv({}), "kb21");
    assert.equal(kbSetFromEnv({ KB_SET: "kb62" }), "kb62");
    for (const other of ["KB62", "62", "kb21", "true", ""]) {
      assert.equal(kbSetFromEnv({ KB_SET: other }), "kb21", other);
    }
  });
});

describe("default unchanged", () => {
  it("reads the 21-entry files, without a status field", () => {
    const kb = loadKnowledgeBase();
    assert.equal(ids(kb).length, 21);
    assert.deepEqual(kb, loadKnowledgeBase("kb21"));
    for (const entry of Object.values(kb).flat()) {
      assert.equal("status" in entry, false);
    }
    assert.deepEqual(
      ids(kb).sort(),
      readJson("ml_service/knowledge_base.json")
        .map((e) => e.id)
        .sort(),
    );
  });

  it("ignores a KB_SET that is not exactly kb62", () => {
    const before = loadKnowledgeBase();
    process.env.KB_SET = "KB62";
    assert.deepEqual(loadKnowledgeBase(), before);
  });

  it("keeps kbQuestions.json current", () => {
    assert.equal(
      fs.readFileSync(OUTPUT_FILE, "utf8"),
      serialize(buildKbQuestions()),
    );
  });

  it("parses a file without status exactly as before", () => {
    const file = path.join(KB_SETS.kb21, "sti.md");
    assert.deepEqual(parseKbFile(file), parseKbFile(file, {}));
  });
});

describe("kb62 set", () => {
  const kb = loadKnowledgeBase("kb62");

  it("serves the 62 approved entries and none of the 4 pending", () => {
    assert.equal(ids(kb).length, 62);
    assert.deepEqual(
      Object.fromEntries(Object.entries(kb).map(([c, e]) => [c, e.length])),
      { contraception: 19, sti: 18, pregnancy: 7, general: 18 },
    );
    for (const id of PENDING) {
      assert.equal(ids(kb).includes(id), false, id);
    }
    assert.ok(
      Object.values(kb)
        .flat()
        .every((e) => e.status === "approved"),
    );
  });

  it("parses the 4 pending entries but does not serve them", () => {
    const all = ["contraception", "sti", "pregnancy", "general"].flatMap((c) =>
      parseKbFile(path.join(KB_SETS.kb62, `${c}.md`), { withStatus: true }),
    );
    assert.deepEqual(
      all
        .filter((e) => e.status === "pending")
        .map((e) => e.kbId)
        .sort(),
      [...PENDING].sort(),
    );
  });

  it("agrees with ml_service's and the interface's kb62 copies", () => {
    const expected = ids(kb).sort();
    assert.deepEqual(
      readJson("ml_service/knowledge_base_kb62.json")
        .map((e) => e.id)
        .sort(),
      expected,
    );
    assert.deepEqual(
      Object.values(readJson("app/interface/src/offline/Kbdata_kb62.json"))
        .flat()
        .map((e) => e.kbId)
        .sort(),
      expected,
    );
    assert.deepEqual(
      readJson("app/interface/src/content/kbQuestions_kb62.json")
        .questions.map((q) => q.id)
        .sort(),
      expected,
    );
    assert.equal(
      fs.readFileSync(OUTPUT_FILE_KB62, "utf8"),
      serialize(buildKbQuestions("kb62")),
    );
  });

  it("is what getEntryById reads when KB_SET is kb62", () => {
    assert.equal(getEntryById("KB-C12"), null);
    process.env.KB_SET = "kb62";
    assert.equal(getEntryById("KB-C12").kbId, "KB-C12");
    assert.equal(getEntryById("KB-C6"), null);
  });

  it("fails on an entry without a valid status", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb62-"));
    const file = path.join(dir, "sti.md");
    fs.writeFileSync(
      file,
      "# STI\n\n## KB-S1\n\n- **User question:** q\n- **Answer:** a\n- **Source:** s\n",
    );
    try {
      assert.throws(() => parseKbFile(file, { withStatus: true }), /no status/);
      assert.equal(parseKbFile(file).length, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
