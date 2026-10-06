/**
 * Parity between the gateway Safety Net (src/safetyNet.js) and the
 * offline interface copy (app/interface/src/offline/safetyNet.ts).
 *
 * The offline file is a port, not a shared module, because the gateway
 * is CommonJS on Node and the interface is browser ESM built by Vite.
 * This test keeps the port honest: it compares the rule tables
 * themselves (keywords, and every rule's name, category and regex
 * source) and then runs the shared case list through both
 * implementations. Node imports the TypeScript file directly (type
 * stripping), so the real offline code is tested, not a copy.
 */

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const gateway = require("../src/safetyNet");
const { POSITIVE, NEGATIVE } = require("./fixtures/safetyCases");

const OFFLINE_FILE = path.join(
  __dirname,
  "..",
  "..",
  "interface",
  "src",
  "offline",
  "safetyNet.ts",
);

// The safety queries from the retrieval development set, as plain text.
const EVAL_SET_QUERIES = [
  "someone forced me to have sex",
  "I was raped",
  "my boyfriend hits me when I say no",
  "I want to kill myself",
  "I do not want to be alive anymore",
  "my uncle touches me and I am scared",
  "I am scared to ask my mother about periods",
  "my teacher threatened to fail me",
  "I am so tired of exams",
];

const CASES = [
  ...POSITIVE.map(([text]) => text),
  ...NEGATIVE,
  ...EVAL_SET_QUERIES,
];

describe("gateway and offline Safety Net parity", () => {
  let offline;

  before(async () => {
    offline = await import(pathToFileURL(OFFLINE_FILE).href);
  });

  it("uses at least 40 shared cases", () => {
    assert.ok(CASES.length >= 40, `only ${CASES.length} cases`);
  });

  it("has the same keyword list", () => {
    assert.deepEqual([...offline.DISTRESS_KEYWORDS], gateway.DISTRESS_KEYWORDS);
  });

  it("has the same rules: name, category and regex source, in order", () => {
    const describeRules = (rules) =>
      rules.map((rule) => ({
        category: rule.category,
        name: rule.name,
        source: rule.pattern.source,
        flags: rule.pattern.flags,
      }));
    assert.deepEqual(
      describeRules(offline.RULES),
      describeRules(gateway.RULES),
    );
  });

  it("normalises text the same way", () => {
    for (const text of [
      "I DIDN’T  Consent",
      "i was r@ped",
      "a@b c",
      "  x\t y ",
    ]) {
      assert.equal(offline.normalize(text), gateway.normalize(text), text);
    }
  });

  it(`gives the same result for all ${CASES.length} shared cases`, () => {
    const differences = CASES.filter((text) => {
      const a = gateway.checkSafety(text);
      const b = offline.checkSafety(text);
      return (
        a.flagged !== b.flagged ||
        a.category !== b.category ||
        a.matchedKeywords.join("|") !== b.matchedKeywords.join("|")
      );
    });
    assert.deepEqual(differences, []);
  });
});
