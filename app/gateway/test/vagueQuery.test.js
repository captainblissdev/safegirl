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
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const {
  MAX_CONTENT_WORDS,
  contentWords,
  getHealthTerms,
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
  serialize,
  OUTPUT_FILE,
} = require("../scripts/build-health-terms");

const REPO = path.join(__dirname, "..", "..", "..");

/** The vague test queries the rule must answer itself. */
const VAGUE_QUERIES = [
  "Am I okay?",
  "Is this normal?",
  "I feel strange",
  "Can I ask you something?",
  "I'm worried",
  "What should I do?",
  "Do I have it?",
  "hmm",
];

/**
 * DR-04 queries the rule answers itself: an open, recorded failure
 * (docs/testing/test-cases.md, TC-079). "coil" and "tampon" are not
 * knowledge-base words, and "mess up" names no topic. Kept here so any
 * change is noticed and recorded.
 */
const DR04_INTERCEPTED = [
  "What can I do when I mess up ?",
  "How is a coil inserted?",
  "Tell me how to use a tampon?",
];

/** Minimal CSV reader: quoted fields, commas inside quotes, CRLF. */
function readCsv(file) {
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && quoted && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        fields.push(field);
        field = "";
      } else {
        field += ch;
      }
    }
    fields.push(field);
    rows.push(fields);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const DEV_LABELLED = readCsv(
  path.join(
    REPO,
    "resources",
    "eval",
    "retrieval_eval_set_labels_2026-10-15.csv",
  ),
)
  .filter((row) => row.expected_class !== "none")
  .map((row) => row.query);

const DR04 = readCsv(
  path.join(REPO, "resources", "test", "independent_test_set.csv"),
).map((row) => row.text);

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

  it("answers 'when should I start antenatal visits' itself: a known limit", () => {
    // "antenatal" is not a knowledge-base word. Recorded in the
    // decision log; no entry covers antenatal timing either.
    assert.equal(isVagueQuery("when should I start antenatal visits"), true);
  });
});

describe("vague-query rule: required query sets", () => {
  let examples;

  before(async () => {
    const uiText = await import(
      pathToFileURL(
        path.join(REPO, "app", "interface", "src", "content", "uiText.ts"),
      ).href
    );
    examples = [
      ...new Set([
        ...uiText.TOPIC_EXAMPLES.map((example) => example.question),
        ...Object.values(uiText.SUGGESTIONS)
          .flat()
          .map((suggestion) => suggestion.question),
      ]),
    ];
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

  it("intercepts exactly the 3 recorded DR-04 queries of 31 (open failure)", () => {
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

  it("is what the rule uses, and every term is lowercase", () => {
    const { terms } = buildHealthTerms();
    assert.deepEqual([...getHealthTerms()].sort(), terms);
    assert.ok(terms.every((term) => /^[a-z]+$/.test(term)));
  });
});
