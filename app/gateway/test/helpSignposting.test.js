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
  HELP_GUIDANCE,
  UNVERIFIED_CONTACTS_WARNING,
  warnIfContactsUnverified,
} = require("../src/content/helpContent");
const { captureOutput } = require("./support");

const {
  HELP_POSITIVE: POSITIVE,
  HELP_NEGATIVE: NEGATIVE,
} = require("./fixtures/helpCases");

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

    // The second /retrieve is the relevance gate's unscoped score: the
    // gate is on by default and retrieval here was scoped.
    assert.deepEqual(requests, ["/classify", "/retrieve", "/retrieve"]);
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
    // Neither the classifier nor retrieval runs for flagged queries.
    assert.deepEqual(requests, []);
  });

  it("returns the referral for a real flagged query that asks for help", async () => {
    const { client } = mlServiceMock();
    const handleQuery = createHandleQuery({ classifierClient: client });

    const result = await handleQuery("I was raped, I need help");

    assert.equal(result.outcome, "referral");
  });
});

describe("help content", () => {
  it("opens the help reply plainly, then gives the help information", () => {
    assert.equal(
      SIGNPOSTING_MESSAGE,
      `You're not alone. These people can help right now. ${HELP_GUIDANCE}`,
    );
    assert.ok(!SIGNPOSTING_MESSAGE.includes("I don't have information"));
  });

  it("says no answer was found before the help information", () => {
    assert.equal(
      NO_ANSWER_MESSAGE,
      `I couldn't find a good answer to that. ${HELP_GUIDANCE}`,
    );
  });

  it("keeps the help numbers in both messages", () => {
    for (const message of [SIGNPOSTING_MESSAGE, NO_ANSWER_MESSAGE]) {
      for (const number of ["1195", "116"]) {
        assert.ok(message.includes(number), number);
      }
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
