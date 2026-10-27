/**
 * Gemini generation behind GENERATION_ENABLED (Gemini plan, step 7a).
 *
 * The Gemini API is a fake fetch: answers are set per test and every
 * request is recorded. The global fetch is replaced by a trap first, so
 * no test can make a real network call. Queries are author-written and
 * synthetic. The flag-off handleQuery replies are pinned separately by
 * flagOffHandleQuery.test.js.
 */

const realFetch = globalThis.fetch;
let globalFetchCalls = 0;
globalThis.fetch = async () => {
  globalFetchCalls += 1;
  throw new Error("generation tests must never use the global fetch");
};

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");

const {
  createGenerator,
  extractive,
  generate,
  GENERATION_CONFIG,
} = require("../src/generationModule");
const { createHandleQuery } = require("../src/backend");
const { loadKnowledgeBase } = require("../src/retrievalModule");
const { ABUSE_REFERRAL_MESSAGE } = require("../src/responseOrchestrator");

after(() => {
  globalThis.fetch = realFetch;
});

const KEY = "TEST-ONLY-KEY-7f3c9e1a-never-log-me";
const ON = { GENERATION_ENABLED: "true", GEMINI_API_KEY: KEY };
const QUERY = "a synthetic question about the topic that must never be logged";
const GENERATED =
  "A short synthetic rewrite of the entry that must never be logged.";

const ENTRIES = Object.values(loadKnowledgeBase()).flat();
const ENTRY = ENTRIES.find((e) => e.category === "contraception");
// Author-written entry with helplines, for the guard.
const HELPLINE_ENTRY = {
  kbId: "KB-TEST",
  category: "general",
  question: "Who can I talk to?",
  answer:
    "You can visit a clinic. Childline Kenya, 116, is free. The GBV " +
    "helpline is 1195. The Example Line is 0800 720 990.",
  conditions: "Hours were not checked in 2025.",
  safetyNotes: "Refer to a clinic.",
  source: "test",
};

const reply = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const success = (text = GENERATED, finishReason = "STOP") =>
  reply({
    candidates: [
      { content: { role: "model", parts: [{ text }] }, finishReason },
    ],
  });

/** A fake Gemini API; respond(request) returns the response or throws. */
function fakeGemini(respond = () => success()) {
  const calls = [];
  async function fetch(url, options) {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return respond({ url, options });
  }
  return { fetch, calls };
}

/** A logger that records every message. */
function recordingLogger() {
  const lines = [];
  return { lines, warn: (...args) => lines.push(args.join(" ")) };
}

function generator(respond, env = ON, config = {}) {
  const gemini = fakeGemini(respond);
  const logger = recordingLogger();
  const { enabled, generate: gen } = createGenerator({
    fetch: gemini.fetch,
    env,
    logger,
    config,
  });
  return { enabled, gen, gemini, logger };
}

describe("flag off: unchanged", () => {
  for (const value of [
    undefined,
    "",
    "false",
    "TRUE",
    "True",
    "1",
    " true",
    "true ",
  ]) {
    it(`GENERATION_ENABLED=${JSON.stringify(value)} returns the extractive answer synchronously`, () => {
      const env =
        value === undefined
          ? { GEMINI_API_KEY: KEY }
          : { GENERATION_ENABLED: value, GEMINI_API_KEY: KEY };
      const { enabled, gen, gemini, logger } = generator(undefined, env);
      const result = gen(ENTRY, QUERY);
      assert.equal(enabled, false);
      assert.equal(typeof result.then, "undefined");
      assert.deepEqual(result, extractive(ENTRY));
      assert.deepEqual(gen(null, QUERY), extractive(null));
      assert.equal(gemini.calls.length, 0);
      assert.deepEqual(logger.lines, []);
    });
  }

  it("the module's generate is the extractive answer under npm test", () => {
    assert.deepEqual(generate(ENTRY), extractive(ENTRY));
    assert.equal(generate(ENTRY).generated, false);
  });

  it("the extractive answer is the entry's answer verbatim", () => {
    const result = extractive(ENTRY);
    assert.equal(result.text, ENTRY.answer);
    assert.equal(result.generated, false);
  });
});

describe("flag on: success", () => {
  it("returns the generated text with generated: true", async () => {
    const { enabled, gen, gemini } = generator();
    const result = await gen(ENTRY, QUERY);
    assert.equal(enabled, true);
    assert.equal(result.generated, true);
    assert.equal(result.text, GENERATED);
    assert.match(result.note, /gemini-3\.6-flash/);
    assert.equal(result.source, ENTRY.source);
    assert.equal(result.safetyNotes, ENTRY.safetyNotes);
    assert.equal(gemini.calls.length, 1);
  });

  it("calls the pinned model with the key in the header only", async () => {
    const { gen, gemini } = generator();
    await gen(ENTRY, QUERY);
    const [{ url, options }] = gemini.calls;
    assert.equal(
      url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    );
    assert.ok(!url.includes(KEY));
    assert.equal(options.method, "POST");
    assert.equal(options.headers["x-goog-api-key"], KEY);
    assert.ok(!options.body.includes(KEY));
    assert.ok(options.signal instanceof AbortSignal);
  });

  it("sends the query and the entry only, with the fixed settings", async () => {
    const { gen, gemini } = generator();
    await gen(ENTRY, QUERY);
    const [{ body }] = gemini.calls;
    assert.deepEqual(Object.keys(body).sort(), [
      "contents",
      "generationConfig",
      "systemInstruction",
    ]);
    assert.deepEqual(body.generationConfig, {
      temperature: 1.0,
      maxOutputTokens: 1024,
      candidateCount: 1,
      thinkingConfig: { thinkingLevel: "minimal" },
    });
    assert.equal(body.contents.length, 1);
    const sent = body.contents[0].parts[0].text;
    assert.ok(sent.includes(QUERY));
    for (const field of ["question", "answer", "conditions", "safetyNotes"]) {
      if (ENTRY[field]) assert.ok(sent.includes(ENTRY[field]), field);
    }
    for (const field of ["kbId", "source", "evidenceClaim"]) {
      if (ENTRY[field]) assert.ok(!sent.includes(ENTRY[field]), field);
    }
    const rules = body.systemInstruction.parts[0].text;
    assert.match(rules, /only from the knowledge-base entry/);
    assert.match(rules, /Do not add any\s+medical fact/);
    assert.match(rules, /helpline name and phone number exactly/);
    assert.match(rules, /clinic/);
  });

  it("joins text parts and ignores thought parts", async () => {
    const { gen } = generator(() =>
      reply({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                { text: "thinking that must not be shown", thought: true },
                { text: "Part one. " },
                { text: "Part two." },
              ],
            },
          },
        ],
      }),
    );
    assert.equal((await gen(ENTRY, QUERY)).text, "Part one. Part two.");
  });

  it("pins the documented settings", () => {
    assert.deepEqual(
      { ...GENERATION_CONFIG },
      {
        apiBase: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-3.6-flash",
        temperature: 1.0,
        maxOutputTokens: 1024,
        thinkingLevel: "minimal",
        timeoutMs: 8000,
      },
    );
    assert.ok(Object.isFrozen(GENERATION_CONFIG));
  });
});

const networkError = () => {
  throw new TypeError("fetch failed");
};
const timeout = ({ options }) =>
  new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () =>
      reject(options.signal.reason),
    );
  });

// [name, respond, expected log reason]
const FAILURES = [
  ["network error", networkError, "network error"],
  ["timeout", timeout, "timeout"],
  ["HTTP 400", () => reply({ error: { message: "bad" } }, 400), "HTTP 400"],
  ["HTTP 403", () => reply({}, 403), "HTTP 403"],
  ["HTTP 429", () => reply({}, 429), "HTTP 429"],
  ["HTTP 500", () => reply({}, 500), "HTTP 500"],
  ["HTTP 503", () => reply({}, 503), "HTTP 503"],
  [
    "malformed JSON",
    () => ({
      ok: true,
      status: 200,
      json: async () => JSON.parse("{not json"),
    }),
    "malformed JSON",
  ],
  ["null body", () => reply(null), "unexpected response body"],
  ["string body", () => reply("text"), "unexpected response body"],
  [
    "blocked prompt",
    () => reply({ promptFeedback: { blockReason: "SAFETY" } }),
    "prompt blocked: SAFETY",
  ],
  [
    "blocked prompt, odd reason",
    () => reply({ promptFeedback: { blockReason: GENERATED } }),
    "prompt blocked: unrecognised",
  ],
  ["no candidates", () => reply({ candidates: [] }), "no candidate"],
  ["candidates missing", () => reply({}), "no candidate"],
  ["finish SAFETY", () => success(GENERATED, "SAFETY"), "finish reason SAFETY"],
  [
    "finish MAX_TOKENS",
    () => success(GENERATED, "MAX_TOKENS"),
    "finish reason MAX_TOKENS",
  ],
  [
    "finish RECITATION",
    () => success(GENERATED, "RECITATION"),
    "finish reason RECITATION",
  ],
  [
    "finish PROHIBITED_CONTENT",
    () => success(GENERATED, "PROHIBITED_CONTENT"),
    "finish reason PROHIBITED_CONTENT",
  ],
  [
    "finish reason missing",
    () =>
      reply({ candidates: [{ content: { parts: [{ text: GENERATED }] } }] }),
    "finish reason unrecognised",
  ],
  ["empty text", () => success(""), "empty text"],
  ["whitespace text", () => success("  \n "), "empty text"],
  [
    "no parts",
    () => reply({ candidates: [{ finishReason: "STOP", content: {} }] }),
    "empty text",
  ],
  [
    "only thought parts",
    () =>
      reply({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: GENERATED, thought: true }] },
          },
        ],
      }),
    "empty text",
  ],
  [
    "error echoing the key",
    () => {
      throw new Error(`upstream rejected key ${KEY} for ${QUERY}`);
    },
    "unknown error",
  ],
];

describe("flag on: every failure returns the extractive answer", () => {
  for (const [name, respond, reason] of FAILURES) {
    it(name, async () => {
      const { gen, gemini, logger } = generator(respond, ON, { timeoutMs: 20 });
      const result = await gen(ENTRY, QUERY);
      assert.deepEqual(result, extractive(ENTRY));
      assert.equal(gemini.calls.length, 1);
      assert.deepEqual(logger.lines, [
        `[generationModule] Gemini unavailable, using extractive answer: ${reason}`,
      ]);
    });
  }

  it("no key: extractive, Gemini never called, one startup warning", async () => {
    for (const env of [
      { GENERATION_ENABLED: "true" },
      { GENERATION_ENABLED: "true", GEMINI_API_KEY: "  " },
    ]) {
      const { gen, gemini, logger } = generator(undefined, env);
      assert.deepEqual(await gen(ENTRY, QUERY), extractive(ENTRY));
      assert.equal(gemini.calls.length, 0);
      assert.equal(logger.lines.length, 1);
      assert.match(logger.lines[0], /GEMINI_API_KEY is not set/);
    }
  });

  it("no entry, or an entry without an answer: extractive, no call", async () => {
    const { gen, gemini } = generator();
    assert.deepEqual(await gen(null, QUERY), extractive(null));
    const blank = { ...ENTRY, answer: "" };
    assert.deepEqual(await gen(blank, QUERY), extractive(blank));
    assert.equal(gemini.calls.length, 0);
  });

  it("no query text: extractive, no call", async () => {
    const { gen, gemini } = generator();
    for (const query of [undefined, "", "   "]) {
      assert.deepEqual(await gen(ENTRY, query), extractive(ENTRY));
    }
    assert.equal(gemini.calls.length, 0);
  });
});

describe("flag on: number and helpline guard", () => {
  const KEEPS_ALL =
    "Visit a clinic. Childline Kenya on 116 is free, the GBV helpline is " +
    "1195, and the Example Line is 0800 720 990.";

  const cases = [
    ["keeps every helpline", KEEPS_ALL, true],
    [
      "keeps a number written with hyphens",
      KEEPS_ALL.replace("0800 720 990", "0800-720-990"),
      true,
    ],
    [
      "keeps a year from the entry",
      `${KEEPS_ALL} Hours were not checked in 2025.`,
      true,
    ],
    [
      "adds a new phone number",
      `${KEEPS_ALL} Or call 0722 000 111.`,
      false,
      "a phone number not in the entry",
    ],
    [
      "adds a new short number",
      `${KEEPS_ALL} Or dial 999.`,
      false,
      "a phone number not in the entry",
    ],
    [
      "changes a helpline number",
      KEEPS_ALL.replace("1195", "1196"),
      false,
      "a phone number not in the entry",
    ],
    [
      "omits 116",
      KEEPS_ALL.replace(" on 116", ""),
      false,
      "a helpline number from the entry is missing",
    ],
    [
      "omits 1195",
      KEEPS_ALL.replace(" is 1195,", ","),
      false,
      "a helpline number from the entry is missing",
    ],
    [
      "omits the long number",
      KEEPS_ALL.replace(" is 0800 720 990", ""),
      false,
      "a helpline number from the entry is missing",
    ],
  ];

  for (const [name, text, passes, reason] of cases) {
    it(name, async () => {
      const { gen, logger } = generator(() => success(text));
      const result = await gen(HELPLINE_ENTRY, QUERY);
      if (passes) {
        assert.equal(result.generated, true);
        assert.equal(result.text, text);
        assert.deepEqual(logger.lines, []);
      } else {
        assert.deepEqual(result, extractive(HELPLINE_ENTRY));
        assert.deepEqual(logger.lines, [
          `[generationModule] generated text rejected, using extractive answer: ${reason}`,
        ]);
      }
    });
  }

  it("an entry without numbers rejects any number in the text", async () => {
    const plain = {
      ...HELPLINE_ENTRY,
      answer: "Visit a clinic.",
      conditions: null,
    };
    const { gen } = generator(() => success("Visit a clinic or call 116."));
    assert.deepEqual(await gen(plain, QUERY), extractive(plain));
  });
});

describe("the key, query and answer never reach logs or errors", () => {
  it("no log line contains them, on any path", async () => {
    const paths = [
      ...FAILURES.map(([, respond]) => respond),
      () => success(),
      () => success(`${GENERATED} Call 0722 000 111.`),
    ];
    for (const respond of paths) {
      const { gen, logger } = generator(respond, ON, { timeoutMs: 20 });
      await gen(ENTRY, QUERY);
      await gen(HELPLINE_ENTRY, QUERY);
      for (const line of logger.lines) {
        for (const secret of [KEY, QUERY, GENERATED, ENTRY.answer]) {
          assert.ok(!line.includes(secret), line);
        }
      }
    }
  });

  it("generate never throws, so no error can carry the key", async () => {
    const { gen } = generator(() => {
      throw new Error(KEY);
    });
    await assert.doesNotReject(gen(ENTRY, QUERY));
  });

  it("the key is not in the generator object", () => {
    const made = createGenerator({
      fetch: fakeGemini().fetch,
      env: ON,
      logger: recordingLogger(),
    });
    assert.ok(!JSON.stringify(made).includes(KEY));
  });
});

describe("handleQuery with generation on", () => {
  const classifierClient = (calls) => ({
    classify: async () => {
      calls.push("classify");
      return { label: "contraception", confidence: 0.9, source: "distilbert" };
    },
    retrieve: async () => {
      calls.push("retrieve");
      return { entry: ENTRY, retrievalScope: "scoped", unscopedScore: 0.95 };
    },
  });

  it("a clear query gets the generated answer", async () => {
    const calls = [];
    const { gen, gemini } = generator();
    const handle = createHandleQuery({
      classifierClient: classifierClient(calls),
      generate: gen,
      relevanceGate: true,
    });
    const response = await handle("how do condoms work, a synthetic question");
    assert.equal(response.kind, "answer-scoped");
    assert.equal(response.generated, true);
    assert.equal(response.message, GENERATED);
    assert.equal(response.matchedQuestion, ENTRY.question);
    assert.equal(gemini.calls.length, 1);
  });

  it("a failure gives the same reply as generation off", async () => {
    const query = "how do condoms work, a synthetic question";
    const on = generator(() => reply({}, 500));
    const off = generator(undefined, {});
    const replyWith = (gen) =>
      createHandleQuery({
        classifierClient: classifierClient([]),
        generate: gen,
        relevanceGate: true,
      })(query);
    assert.deepEqual(await replyWith(on.gen), await replyWith(off.gen));
  });

  it("a referral never reaches Gemini", async () => {
    const calls = [];
    const { gen, gemini } = generator();
    const handle = createHandleQuery({
      classifierClient: classifierClient(calls),
      generate: gen,
    });
    const response = await handle("someone forced me to have sex");
    assert.equal(response.message, ABUSE_REFERRAL_MESSAGE);
    assert.equal(gemini.calls.length, 0);
    assert.deepEqual(calls, []);
  });

  it("help, held and vague replies never reach Gemini", async () => {
    const { gen, gemini } = generator();
    const handle = createHandleQuery({
      classifierClient: classifierClient([]),
      generate: gen,
    });
    for (const query of [
      "where can i get help",
      "can i use postinor after sex",
      "am i okay",
    ]) {
      const response = await handle(query);
      assert.equal(response.generated, false);
    }
    assert.equal(gemini.calls.length, 0);
  });

  it("an abstained relevance gate never reaches Gemini", async () => {
    const { gen, gemini } = generator();
    const handle = createHandleQuery({
      classifierClient: {
        classify: async () => ({
          label: "general",
          confidence: 0.9,
          source: "distilbert",
        }),
        retrieve: async () => ({
          entry: ENTRY,
          retrievalScope: "scoped",
          unscopedScore: 0.1,
        }),
      },
      generate: gen,
      relevanceGate: true,
    });
    const response = await handle(
      "a synthetic question far from the knowledge base",
    );
    assert.equal(response.kind, "abstain");
    assert.equal(gemini.calls.length, 0);
  });
});

describe("no real network call", () => {
  it("the global fetch was never called", () => {
    assert.equal(globalFetchCalls, 0);
  });
});
