/**
 * Tests for the held-topic rule (src/heldTopics.js), its pattern file
 * (src/content/heldTopics.json), its replies and its place in
 * handleQuery(): after the Safety Net and the help rule, before the
 * vague-query rule and the classifier.
 *
 * All queries here are synthetic and written for these tests.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const { matchHeldTopic, getHeldTopicGroups } = require("../src/heldTopics");
const { isVagueQuery } = require("../src/vagueQuery");
const { createHandleQuery } = require("../src/backend");
const { HELD_TOPIC_MESSAGES } = require("../src/content/helpContent");
const {
  readHeldTopicGroups,
  renderOffline,
  OFFLINE_FILE,
} = require("../scripts/build-held-topics");
const { HELD_A, HELD_B, HELD_C, HELD_NONE } = require("./fixtures/heldCases");

/** handleQuery() with a classifier client that records any call. */
function recordingHandler(overrides = {}) {
  const calls = [];
  const classifierClient = {
    classify: async () => {
      calls.push("classify");
      return { label: "general", confidence: 0.9, source: "distilbert" };
    },
    retrieve: async () => {
      calls.push("retrieve");
      return { entry: null, retrievalScope: "scoped" };
    },
  };
  return {
    calls,
    handleQuery: createHandleQuery({
      classifierClient,
      relevanceGate: false,
      ...overrides,
    }),
  };
}

describe("held-topic patterns", () => {
  it("has groups A, B and C, each with a name, a criterion and patterns", () => {
    const groups = getHeldTopicGroups();
    assert.deepEqual(
      groups.map((group) => group.id),
      ["A", "B", "C"],
    );
    for (const group of groups) {
      assert.ok(group.name.length > 0, group.id);
      assert.ok(group.criterion.length > 20, group.id);
      assert.ok(group.patterns.length > 0, group.id);
    }
    // Throws on a malformed or duplicated pattern.
    assert.equal(readHeldTopicGroups().length, 3);
  });

  it("is copied, up to date, into the offline queryRules.ts", () => {
    const source = fs.readFileSync(OFFLINE_FILE, "utf8");
    assert.equal(
      source,
      renderOffline(source),
      "run: node scripts/build-held-topics.js",
    );
  });
});

describe("matchHeldTopic()", () => {
  it("matches group A: after sex or contraception failure", () => {
    for (const query of HELD_A) {
      assert.equal(matchHeldTopic(query), "A", query);
    }
  });

  it("matches group B: pregnancy decisions", () => {
    for (const query of HELD_B) {
      assert.equal(matchHeldTopic(query), "B", query);
    }
  });

  it("gives group A when a query matches both groups", () => {
    assert.equal(
      matchHeldTopic("the condom broke, should I think about abortion"),
      "A",
    );
  });

  it("matches group C: possible pregnancy and testing", () => {
    for (const query of HELD_C) {
      assert.equal(matchHeldTopic(query), "C", query);
    }
  });

  it("checks the groups in the order A, B, C", () => {
    assert.equal(matchHeldTopic("I took P2 and my period is late"), "A");
    assert.equal(
      matchHeldTopic("my period is late and I want an abortion"),
      "B",
    );
  });

  it("leaves general period questions alone", () => {
    for (const query of [
      "Is my period normal",
      "irregular periods",
      "period pain",
      "Is my period normal, and when should I see a health worker?",
      "is it normal for my period to be irregular",
      "how do I deal with period cramps",
    ]) {
      assert.equal(matchHeldTopic(query), null, query);
    }
  });

  it("leaves other questions alone", () => {
    for (const query of HELD_NONE) {
      assert.equal(matchHeldTopic(query), null, query);
    }
    assert.equal(matchHeldTopic(42), null, "not a string");
  });
});

describe("held-topic replies", () => {
  it("uses the provisional wording for group A", () => {
    assert.equal(
      HELD_TOPIC_MESSAGES.A,
      "This is an important question, and I can't answer it safely here yet. A nurse, a pharmacist or a clinic can help, and you do not have to give a reason. If something happened recently, do not wait: some options work best soon after sex. If you are in danger or someone has hurt you, call the GBV helpline 1195. Childline Kenya, 116, is a free 24-hour helpline for children.",
    );
  });

  it("uses the provisional wording for group B", () => {
    assert.equal(
      HELD_TOPIC_MESSAGES.B,
      "This is an important question, and I can't answer it safely here yet. A nurse or counsellor can talk it through with you privately and without judgement, and you do not have to give a reason. If you are in danger or someone has hurt you, call the GBV helpline 1195. Childline Kenya, 116, is a free 24-hour helpline for children.",
    );
  });

  it("uses the provisional wording for group C", () => {
    assert.equal(
      HELD_TOPIC_MESSAGES.C,
      "A late period can have many causes, including pregnancy, so it is worth checking. A pharmacist or clinic can help you do a pregnancy test, and a nurse can talk it through with you privately and without judgement. You do not have to give a reason. If you have heavy bleeding or severe pain, go to a health facility straight away.",
    );
  });
});

describe("held-topic rule in handleQuery()", () => {
  it("returns the group's signpost without classifying or retrieving", async () => {
    for (const [query, group] of [
      ["the condom broke last night", "A"],
      ["where can I get an abortion", "B"],
      ["my period is late this month", "C"],
    ]) {
      const { calls, handleQuery } = recordingHandler();
      const response = await handleQuery(query);
      assert.equal(response.outcome, "held", query);
      assert.equal(response.kind, "held-topic", query);
      assert.equal(response.heldTopicGroup, group, query);
      assert.equal(response.message, HELD_TOPIC_MESSAGES[group], query);
      assert.equal(response.matchedQuestion, null);
      assert.equal(response.category, null);
      assert.equal(response.answerFound, false);
      assert.equal(response.retrievalScope, "none");
      assert.deepEqual(calls, [], query);
    }
  });

  it("never overrides the Safety Net", async () => {
    let heldConsulted = false;
    const { calls, handleQuery } = recordingHandler({
      checkSafety: () => ({ flagged: true, matchedKeywords: ["stub"] }),
      matchHeld: () => {
        heldConsulted = true;
        return "A";
      },
    });
    const response = await handleQuery("the condom broke last night");
    assert.equal(response.outcome, "referral");
    assert.equal(heldConsulted, false);
    assert.deepEqual(calls, []);
  });

  it("gives the referral for a real disclosure that names a held topic", async () => {
    const { handleQuery } = recordingHandler();
    const response = await handleQuery("he forced me and the condom broke");
    assert.equal(response.outcome, "referral");
  });

  it("leaves 'Help' to the help rule, which runs first", async () => {
    const { handleQuery } = recordingHandler();
    const response = await handleQuery("Help");
    assert.equal(response.kind, "help");
  });

  it("runs before the vague-query rule", async () => {
    // "plan b?" has two content words and no health term, so the vague
    // rule alone would ask a clarifying question.
    assert.equal(isVagueQuery("plan b?"), true);
    const { handleQuery } = recordingHandler();
    const response = await handleQuery("plan b?");
    assert.equal(response.kind, "held-topic");
    assert.equal(response.heldTopicGroup, "A");
  });

  it("sends other questions on to the classifier", async () => {
    const { calls, handleQuery } = recordingHandler();
    await handleQuery("Which birth control methods can a teenager use?");
    assert.deepEqual(calls, ["classify", "retrieve"]);
  });
});
