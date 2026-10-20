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
const gatewayContent = require("../src/content/helpContent");
const { orchestrate } = require("../src/responseOrchestrator");
const { POSITIVE, NEGATIVE } = require("./fixtures/safetyCases");

const OFFLINE_CONTENT_FILE = path.join(
  __dirname,
  "..",
  "..",
  "interface",
  "src",
  "offline",
  "helpContent.ts",
);

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

describe("gateway and offline referral message parity", () => {
  let offlineContent;

  before(async () => {
    offlineContent = await import(pathToFileURL(OFFLINE_CONTENT_FILE).href);
  });

  it("has the same self-harm and abuse messages", () => {
    assert.equal(
      offlineContent.SELF_HARM_REFERRAL_MESSAGE,
      gatewayContent.SELF_HARM_REFERRAL_MESSAGE,
    );
    assert.equal(
      offlineContent.ABUSE_REFERRAL_MESSAGE,
      gatewayContent.ABUSE_REFERRAL_MESSAGE,
    );
  });

  it("has the same help, signposting and no-answer messages", () => {
    for (const name of [
      "HELP_GUIDANCE",
      "SIGNPOSTING_MESSAGE",
      "NO_ANSWER_MESSAGE",
    ]) {
      assert.equal(offlineContent[name], gatewayContent[name], name);
    }
  });

  it("has the same numbers and the same verified flag", () => {
    assert.deepEqual(
      [...offlineContent.EMERGENCY_NUMBERS],
      gatewayContent.EMERGENCY_NUMBERS,
    );
    assert.equal(offlineContent.GBV_HELPLINE, gatewayContent.GBV_HELPLINE);
    assert.equal(
      offlineContent.CHILDLINE_KENYA,
      gatewayContent.CHILDLINE_KENYA,
    );
    assert.equal(
      offlineContent.HELP_CONTACTS_VERIFIED,
      gatewayContent.HELP_CONTACTS_VERIFIED,
    );
  });

  it("warns offline exactly when the gateway warns", () => {
    const offlineWarnings = [];
    const gatewayWarnings = [];
    offlineContent.warnIfContactsUnverified({
      warn: (message) => offlineWarnings.push(message),
    });
    gatewayContent.warnIfContactsUnverified({
      warn: (message) => gatewayWarnings.push(message),
    });
    assert.equal(offlineWarnings.length, gatewayWarnings.length);
    assert.equal(offlineWarnings.length, 1);
    assert.match(offlineWarnings[0], /UNVERIFIED: confirm before real users/);
  });

  it("gives the same referral message per category for every positive case", () => {
    const differences = POSITIVE.filter(([text]) => {
      const safety = gateway.checkSafety(text);
      const online = orchestrate({
        safety,
        classification: null,
        generation: null,
      }).message;
      return online !== offlineContent.referralMessage(safety.category);
    }).map(([text]) => text);
    assert.deepEqual(differences, []);
  });
});
