/**
 * Tests for the generic help-request rule and its place in the pipeline.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { isGenericHelpRequest } = require("../src/helpSignposting");
const { createHandleQuery } = require("../src/backend");
const { createClassifierClient } = require("../src/classifierClient");
const {
  SIGNPOSTING_MESSAGE,
  NO_ANSWER_MESSAGE,
  HELP_CONTACTS_VERIFIED,
  UNVERIFIED_CONTACTS_WARNING,
  warnIfContactsUnverified,
} = require("../src/content/helpContent");
const { captureOutput } = require("./support");

const POSITIVE = [
  "Where can I get help?",
  "where can i get help",
  "WHERE CAN I FIND HELP",
  "How can I get some help?",
  "Where can I go for help?",
  "Where do I turn for help?",
  "Who can I talk to?",
  "Who should I speak to?",
  "Is there someone I can talk to?",
  "I want to talk to someone",
  "I need someone to talk to",
  "I need help",
  "I need some help!!",
  "Can someone help me?",
  "Could anyone help me please",
  "Can you help?",
  "Help",
  "Help me",
  "Hi, where can I get help?",
];

const NEGATIVE = [
  "Where can I get birth control?",
  "Help me understand the HIV window period",
  "I need help with contraception",
  "Who can I talk to about my period?",
  "Can someone help me get the morning after pill?",
  "Where can I get help with an STI test?",
  "I need help, I think I'm pregnant",
  "Where can I get help if the condom broke?",
  "Is the clinic helpful?",
  "What is the helpline number for HIV testing?",
  "Help me find a clinic for contraception",
  "Who can I talk to at the clinic about PrEP?",
  "I fear that I am pregnant",
  "Is the clinic confidential?",
  "What is consent?",
  "helping a friend who might be pregnant",
  "I need help paying for antenatal checkups",
  "Where can I get condoms?",
  "",
  "   ",
];

describe("isGenericHelpRequest()", () => {
  for (const text of POSITIVE) {
    it(`matches the generic request ${JSON.stringify(text)}`, () => {
      assert.equal(isGenericHelpRequest(text), true);
    });
  }

  for (const text of NEGATIVE) {
    it(`does not match ${JSON.stringify(text)}`, () => {
      assert.equal(isGenericHelpRequest(text), false);
    });
  }

  it("ignores straight and curly quotes and apostrophes", () => {
    assert.equal(isGenericHelpRequest("‘Help me’"), true);
    assert.equal(isGenericHelpRequest("'Who can I talk to?'"), true);
    assert.equal(isGenericHelpRequest("I’d like help with PrEP"), false);
  });

  it("returns false for non-strings", () => {
    assert.equal(isGenericHelpRequest(undefined), false);
    assert.equal(isGenericHelpRequest(42), false);
  });
});

/** Real classifier client around a mocked ml_service that records calls. */
function mlServiceMock() {
  const requests = [];
  const client = createClassifierClient({
    fetch: async (url) => {
      const endpoint = new URL(url).pathname;
      requests.push(endpoint);
      const body =
        endpoint === "/classify"
          ? { intent: "contraception", confidence: 0.9, scores: {} }
          : { results: [{ id: "KB-C1" }] };
      return { ok: true, status: 200, json: async () => body };
    },
    config: {
      serviceUrl: "http://ml.test",
      confidenceThreshold: 0.5,
      abstainThreshold: 0.35,
    },
    logger: { warn() {} },
  });
  return { client, requests };
}

describe("handleQuery() with the help rule", () => {
  it("signposts a generic help request without calling /classify or /retrieve", async () => {
    const { client, requests } = mlServiceMock();
    const handleQuery = createHandleQuery({ classifierClient: client });

    const { result, output } = await captureOutput(() =>
      handleQuery("Where can I get help?"),
    );

    assert.deepEqual(requests, [], "ml_service must not be called");
    assert.equal(result.outcome, "signposting");
    assert.equal(result.message, SIGNPOSTING_MESSAGE);
    assert.equal(result.answerFound, false);
    assert.equal(result.retrievalScope, "none");
    assert.equal(result.category, null);
    assert.equal(result.predictedCategory, null);
    assert.equal(result.classifierSource, null);
    assert.equal(result.generationInvoked, false);
    assert.ok(!output.toLowerCase().includes("where can i get help"));
  });

  it("sends a topic question through the normal pipeline", async () => {
    const { client, requests } = mlServiceMock();
    const handleQuery = createHandleQuery({ classifierClient: client });
    const query = "Where can I get birth control?";

    const { result, output } = await captureOutput(() => handleQuery(query));

    assert.deepEqual(requests, ["/classify", "/retrieve"]);
    assert.equal(result.outcome, "grounded_answer");
    assert.equal(result.retrievalScope, "scoped");
    assert.ok(!output.toLowerCase().includes("birth control"));
  });

  it("lets the safety net win when a query matches both rules", async () => {
    const { client, requests } = mlServiceMock();
    let helpRuleConsulted = false;
    const handleQuery = createHandleQuery({
      classifierClient: client,
      checkSafety: () => ({ flagged: true, matchedKeywords: ["stub"] }),
      isHelpRequest: () => {
        helpRuleConsulted = true;
        return true;
      },
    });

    const result = await handleQuery("Where can I get help?");

    assert.equal(result.outcome, "referral");
    assert.equal(helpRuleConsulted, false, "the help rule is never reached");
    // The classifier still runs for flagged queries, as before; retrieval
    // does not.
    assert.deepEqual(requests, ["/classify"]);
  });

  it("returns the referral for a real flagged query that asks for help", async () => {
    const { client } = mlServiceMock();
    const handleQuery = createHandleQuery({ classifierClient: client });

    const result = await handleQuery("I was raped, I need help");

    assert.equal(result.outcome, "referral");
  });
});

describe("help content", () => {
  it("uses the help information, without the first sentence, as the no-answer message", () => {
    assert.ok(SIGNPOSTING_MESSAGE.endsWith(NO_ANSWER_MESSAGE));
    assert.ok(
      SIGNPOSTING_MESSAGE.startsWith("I don't have information on that yet. "),
    );
    assert.ok(!NO_ANSWER_MESSAGE.startsWith("I don't have information"));
    for (const number of ["1195", "116"]) {
      assert.ok(NO_ANSWER_MESSAGE.includes(number));
    }
  });

  it("warns once at startup while the contact numbers are unverified", () => {
    const warnings = [];
    warnIfContactsUnverified({ warn: (message) => warnings.push(message) });

    assert.equal(HELP_CONTACTS_VERIFIED, false);
    assert.deepEqual(warnings, [UNVERIFIED_CONTACTS_WARNING]);
    assert.match(
      UNVERIFIED_CONTACTS_WARNING,
      /UNVERIFIED: confirm before real users/,
    );
  });
});
