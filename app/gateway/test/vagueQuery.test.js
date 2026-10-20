/**
 * Tests for the vague-query rule (src/vagueQuery.js), its health-term
 * list (src/content/healthTerms.json) and its place in handleQuery():
 * after the Safety Net and the help rule, before the classifier.
 *
 * The query sets are read from the repository, not copied: the 13
 * example questions from the interface (TOPIC_EXAMPLES and SUGGESTIONS
 * in app/interface/src/content/uiText.ts), the 35 labelled
 * development-set queries and the 31 DR-04 test queries.
 */

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const {
  FUNCTION_WORDS,
  MAX_CONTENT_WORDS,
  contentWords,
  getExtraHealthTerms,
  getHealthTerms,
  hasHealthPhrase,
  isHealthTerm,
  isVagueQuery,
} = require("../src/vagueQuery");
const { createHandleQuery } = require("../src/backend");
const {
  VAGUE_QUERY_MESSAGE,
  SIGNPOSTING_MESSAGE,
} = require("../src/responseOrchestrator");
const {
  buildHealthTerms,
  readExtraTerms,
  renderOffline,
  serialize,
  EXTRA_FILE,
  OFFLINE_FILE,
  OUTPUT_FILE,
} = require("../scripts/build-health-terms");
const {
  DEV_LABELLED,
  DR04,
  VAGUE_QUERIES,
  loadExampleQuestions,
} = require("./fixtures/querySets");

/**
 * DR-04 queries the rule answers itself. With the knowledge-base terms
 * alone there were three (TC-079, Fail, kept as recorded). After the
 * extra terms were added, with those three already seen (a non-blind
 * retest, TC-090), one remains: "mess up" names no topic. Kept here so
 * any change is noticed and recorded.
 */
const DR04_INTERCEPTED = ["What can I do when I mess up ?"];

/** handleQuery() with a classifier client that records any call. */
function recordingHandler() {
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
    handleQuery: createHandleQuery({ classifierClient, relevanceGate: false }),
  };
}

describe("vague-query rule: the rule itself", () => {
  it("allows at most three content words", () => {
    assert.equal(MAX_CONTENT_WORDS, 3);
  });

  it("uses the frozen function-word list (decision log, 2026-10-20)", () => {
    const sorted = [...FUNCTION_WORDS].sort();
    assert.equal(sorted.length, 166);
    assert.equal(
      crypto.createHash("sha256").update(sorted.join("\n")).digest("hex"),
      "78c4667147a1b043a0ae9428435c7cd9a9e8108b308c3dd0b6f3c251b1339a7b",
    );
  });

  it("sets function words aside and keeps content words", () => {
    assert.deepEqual(contentWords("What should I do?"), []);
    assert.deepEqual(contentWords("Can I ask you something?"), [
      "ask",
      "something",
    ]);
    assert.deepEqual(contentWords("I'm worried"), ["worried"]);
    assert.deepEqual(contentWords("Hi, please, am I okay?"), ["okay"]);
  });

  it("matches health terms as written and with a plural added or removed", () => {
    for (const word of ["period", "periods", "pills", "breasts", "symptom"]) {
      assert.ok(isHealthTerm(word), word);
    }
    for (const word of ["normal", "worried", "okay", "exams", "feel"]) {
      assert.ok(!isHealthTerm(word), word);
    }
  });

  it("is vague only when short and with no health term", () => {
    assert.equal(isVagueQuery("is my period normal"), false, "health term");
    assert.equal(isVagueQuery("what is PrEP"), false, "health term");
    assert.equal(
      isVagueQuery("tell me about the history of Kenya today"),
      false,
      "four content words",
    );
    assert.equal(isVagueQuery("Am I okay?"), true);
    assert.equal(isVagueQuery(42), false, "not a string");
  });

  it("lets 'when should I start antenatal visits' through: 'antenatal' is an extra term", () => {
    // "antenatal" is not a knowledge-base word; it is in the extra list.
    assert.equal(isVagueQuery("when should I start antenatal visits"), false);
  });

  it("knows extra terms as words, with plurals, and as phrases", () => {
    for (const query of [
      "is a coil safe",
      "tampons or pads",
      "I took P2",
      "he pulled out early",
      "morning after",
    ]) {
      assert.equal(isVagueQuery(query), false, query);
    }
    assert.equal(hasHealthPhrase("my boyfriend pulled out"), true);
    assert.equal(hasHealthPhrase("he pulled the door out"), false);
    // A phrase's words alone are not terms.
    assert.equal(isVagueQuery("I pulled it"), true);
  });
});

describe("vague-query rule: required query sets", () => {
  let examples;

  before(async () => {
    examples = await loadExampleQuestions();
  });

  it("intercepts all 8 vague test queries", () => {
    assert.deepEqual(
      VAGUE_QUERIES.filter((q) => !isVagueQuery(q)),
      [],
    );
  });

  it("intercepts none of the 13 example questions", () => {
    assert.equal(examples.length, 13);
    assert.deepEqual(
      examples.filter((q) => isVagueQuery(q)),
      [],
    );
  });

  it("intercepts none of the 35 labelled development-set queries", () => {
    assert.equal(DEV_LABELLED.length, 35);
    assert.deepEqual(
      DEV_LABELLED.filter((q) => isVagueQuery(q)),
      [],
    );
  });

  it("intercepts exactly the 1 recorded DR-04 query of 31 (non-blind retest)", () => {
    assert.equal(DR04.length, 31);
    assert.deepEqual(
      DR04.filter((q) => isVagueQuery(q)),
      DR04_INTERCEPTED,
    );
  });
});

describe("vague-query rule in handleQuery()", () => {
  it("returns the clarifying question without classifying or retrieving", async () => {
    for (const query of VAGUE_QUERIES) {
      const { calls, handleQuery } = recordingHandler();
      const response = await handleQuery(query);
      assert.equal(response.outcome, "clarification", query);
      assert.equal(response.kind, "vague", query);
      assert.equal(response.message, VAGUE_QUERY_MESSAGE);
      assert.equal(response.matchedQuestion, null);
      assert.equal(response.category, null);
      assert.equal(response.retrievalScope, "none");
      assert.deepEqual(calls, [], query);
    }
  });

  it("asks about the four topics and gives no numbers", () => {
    assert.equal(
      VAGUE_QUERY_MESSAGE,
      "I'm not sure what you mean. Is your question about periods, pregnancy, contraception or STIs?",
    );
    assert.ok(!/\d/.test(VAGUE_QUERY_MESSAGE));
  });

  it("never overrides the Safety Net", async () => {
    let vagueConsulted = false;
    const { calls } = recordingHandler();
    const handleQuery = createHandleQuery({
      classifierClient: {
        classify: async () => calls.push("classify"),
        retrieve: async () => calls.push("retrieve"),
      },
      checkSafety: () => ({ flagged: true, matchedKeywords: ["stub"] }),
      isVague: () => {
        vagueConsulted = true;
        return true;
      },
      relevanceGate: false,
    });

    const response = await handleQuery("I'm worried");

    assert.equal(response.outcome, "referral");
    assert.equal(response.kind, "referral");
    assert.equal(vagueConsulted, false);
    assert.deepEqual(calls, []);
  });

  it("leaves 'Help' to the help rule, which runs first", async () => {
    const { handleQuery } = recordingHandler();
    const response = await handleQuery("Help");
    assert.equal(response.outcome, "signposting");
    assert.equal(response.kind, "help");
    assert.equal(response.message, SIGNPOSTING_MESSAGE);
  });

  it("sends a short health question on to the classifier", async () => {
    const { calls, handleQuery } = recordingHandler();
    await handleQuery("what is PrEP");
    assert.deepEqual(calls, ["classify", "retrieve"]);
  });
});

describe("health-term list", () => {
  it("is up to date with the knowledge base and the selection", () => {
    assert.equal(
      fs.readFileSync(OUTPUT_FILE, "utf8"),
      serialize(buildHealthTerms()),
      "run: node scripts/build-health-terms.js",
    );
  });

  it("is up to date in the offline copy (queryRules.ts)", () => {
    const source = fs.readFileSync(OFFLINE_FILE, "utf8");
    assert.equal(
      source,
      renderOffline(source, buildHealthTerms().terms),
      "run: node scripts/build-health-terms.js",
    );
  });

  it("is what the rule uses, and every term is lowercase", () => {
    const { terms } = buildHealthTerms();
    assert.deepEqual([...getHealthTerms()].sort(), terms);
    assert.ok(terms.every((term) => /^[a-z]+$/.test(term)));
  });
});

describe("extra health terms (outside the knowledge base)", () => {
  it("has a name and a criterion for every category, and well-formed terms", () => {
    const { categories } = JSON.parse(fs.readFileSync(EXTRA_FILE, "utf8"));
    assert.deepEqual(
      categories.map((category) => category.name),
      [
        "contraceptive methods and names",
        "menstrual and body",
        "STIs and HIV",
        "pregnancy",
      ],
    );
    for (const category of categories) {
      assert.ok(category.criterion.length > 20, category.name);
      assert.ok(category.terms.length > 0, category.name);
    }
    // Throws on a malformed or duplicated term.
    assert.ok(readExtraTerms().length > 0);
  });

  it("is what the rule uses: single words and phrases", () => {
    const terms = readExtraTerms();
    const { words, phrases } = getExtraHealthTerms();
    assert.deepEqual(
      [...words],
      terms.filter((term) => !term.includes(" ")),
    );
    assert.deepEqual(
      phrases,
      terms.filter((term) => term.includes(" ")),
    );
  });

  it("does not list any of the vague test queries' content words", () => {
    for (const query of VAGUE_QUERIES) {
      for (const word of contentWords(query)) {
        assert.ok(!getExtraHealthTerms().words.has(word), word);
      }
    }
  });
});
