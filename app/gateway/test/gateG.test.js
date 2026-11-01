/**
 * Tests for gate (g) behind GATE_G_ENABLED (src/gateG.js) and its wiring
 * in classifierClient.js and backend.js.
 *
 * - the flag: on only when GATE_G_ENABLED and V4_TRIAGE_ENABLED are both
 *   exactly "true";
 * - the hash check: a changed or missing frozen file is refused, and the
 *   gateway refuses to start;
 * - parity: the JavaScript gate reproduces the 107 in-sample decisions
 *   and probabilities recorded when the gate was frozen in Python
 *   (research/v4/gate_refit/frozen/gate_g_insample.csv);
 * - wiring: with the gate on, V4-classified queries are gated by (g) from
 *   the unscoped top-2 results; with it off, or for a query V4 did not
 *   classify, the requests and decisions are the current gate's.
 *
 * ml_service is never contacted. Queries are author-written synthetic
 * text.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  GATE_G_PATH,
  gateGDecision,
  gateGFeatures,
  gateGFromEnv,
  gateGProbability,
  isGateGEnabled,
  loadGateG,
} = require("../src/gateG");
const { createClassifierClient } = require("../src/classifierClient");
const { createHandleQuery } = require("../src/backend");

const ROUTING =
  "57c6a5b638ab24b22beacbf50a2e1d6ef5741ec7dd45eeb6ed583949452a418a";
const INSAMPLE = path.join(path.dirname(GATE_G_PATH), "gate_g_insample.csv");
const quiet = { warn() {}, error() {} };

function insampleRows() {
  const [header, ...lines] = fs
    .readFileSync(INSAMPLE, "utf8")
    .trim()
    .split("\n");
  const cols = header.split(",");
  return lines.map((line) =>
    Object.fromEntries(line.split(",").map((v, i) => [cols[i], v])),
  );
}

describe("isGateGEnabled", () => {
  it("is on only when both flags are exactly true", () => {
    assert.equal(isGateGEnabled({}), false);
    assert.equal(isGateGEnabled({ GATE_G_ENABLED: "true" }), false);
    assert.equal(isGateGEnabled({ V4_TRIAGE_ENABLED: "true" }), false);
    assert.equal(
      isGateGEnabled({ GATE_G_ENABLED: "TRUE", V4_TRIAGE_ENABLED: "true" }),
      false,
    );
    assert.equal(
      isGateGEnabled({ GATE_G_ENABLED: "1", V4_TRIAGE_ENABLED: "true" }),
      false,
    );
    assert.equal(
      isGateGEnabled({ GATE_G_ENABLED: "true", V4_TRIAGE_ENABLED: "true" }),
      true,
    );
  });
});

describe("loadGateG and the hash check", () => {
  it("loads the frozen file", () => {
    const gate = loadGateG();
    assert.deepEqual(gate.features, ["s1", "margin", "agree", "v4_p"]);
    assert.equal(gate.threshold, 0.5);
    assert.equal(gate.routing, ROUTING);
  });

  it("refuses a file whose SHA-256 is not the frozen one", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-g-"));
    const copy = path.join(dir, "gate_g.json");
    fs.writeFileSync(
      copy,
      Buffer.concat([fs.readFileSync(GATE_G_PATH), Buffer.from(" ")]),
    );
    try {
      assert.throws(() => loadGateG(copy), /SHA-256/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a missing file", () => {
    assert.throws(
      () => loadGateG(path.join(os.tmpdir(), "no-such-gate-g.json")),
      /not readable/,
    );
  });
});

describe("gateGFromEnv", () => {
  it("is null with the flag off, so nothing is loaded", () => {
    let loaded = false;
    const load = () => {
      loaded = true;
    };
    assert.equal(gateGFromEnv({}, { logger: quiet, load }), null);
    assert.equal(
      gateGFromEnv({ V4_TRIAGE_ENABLED: "true" }, { logger: quiet, load }),
      null,
    );
    assert.equal(loaded, false);
  });

  it("warns and keeps the current gate when V4 is off", () => {
    const warnings = [];
    const gate = gateGFromEnv(
      { GATE_G_ENABLED: "true" },
      { logger: { warn: (m) => warnings.push(m) } },
    );
    assert.equal(gate, null);
    assert.match(warnings[0], /V4_TRIAGE_ENABLED is not/);
  });

  it("loads the gate when both flags are on", () => {
    const gate = gateGFromEnv(
      { GATE_G_ENABLED: "true", V4_TRIAGE_ENABLED: "true" },
      { logger: quiet },
    );
    assert.equal(gate.routing, ROUTING);
  });

  it("refuses to start when the file fails its check", () => {
    const load = () => loadGateG(GATE_G_PATH, "0".repeat(64));
    assert.throws(
      () =>
        gateGFromEnv(
          { GATE_G_ENABLED: "true", V4_TRIAGE_ENABLED: "true" },
          { logger: quiet, load },
        ),
      /Refusing to start: .*SHA-256/,
    );
  });
});

describe("parity with the frozen Python decisions", () => {
  const gate = loadGateG();
  const rows = insampleRows();

  it("reproduces all in-sample decisions and probabilities", () => {
    assert.equal(rows.length, 107);
    let agree = 0;
    for (const r of rows) {
      const features = {
        s1: +r.s1,
        margin: +r.margin,
        agree: +r.agree,
        v4_p: +r.v4_p,
      };
      const p = gateGProbability(gate, features);
      assert.ok(
        Math.abs(p - +r.p) < 1e-12,
        `${r.id}: probability ${p} vs ${r.p}`,
      );
      agree += p >= gate.threshold === (r.serve === "1");
    }
    assert.equal(agree, rows.length);
  });

  it("builds the features from retrieval and V4 results", () => {
    assert.deepEqual(
      gateGFeatures({
        s1: 0.9,
        s2: 0.85,
        top1Class: "sti",
        v4Label: "sti",
        v4Confidence: 0.7,
      }),
      { s1: 0.9, margin: 0.9 - 0.85, agree: 1, v4_p: 0.7 },
    );
    assert.equal(
      gateGFeatures({
        s1: 0.9,
        s2: 0.85,
        top1Class: "general",
        v4Label: "sti",
        v4Confidence: 0.7,
      }).agree,
      0,
    );
    assert.equal(
      gateGDecision(gate, {
        s1: 0.9,
        s2: null,
        top1Class: "sti",
        v4Label: "sti",
        v4Confidence: 0.7,
      }),
      "not_applied",
    );
  });
});

// One in-sample row the gate serves and one it does not, as gateway inputs.
function inputsFor(serve) {
  const r = insampleRows().find(
    (row) => row.serve === (serve ? "1" : "0") && row.agree === "1.0",
  );
  return {
    unscopedTop: { s1: +r.s1, s2: +r.s1 - +r.margin, top1Class: "sti" },
    confidence: +r.v4_p,
  };
}

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

describe("classifierClient with withGateFeatures", () => {
  const scopedResults = {
    results: [{ id: "KB-S4", class: "sti", score: 0.9 }],
  };
  const unscoped = {
    results: [
      { id: "KB-S4", class: "sti", score: 0.91 },
      { id: "KB-C1", class: "contraception", score: 0.87 },
    ],
  };

  function client(calls) {
    const fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body);
      return jsonResponse(body.intent ? scopedResults : unscoped);
    };
    return createClassifierClient({
      fetch,
      config: { serviceUrl: "http://ml.test" },
      logger: quiet,
    });
  }
  const v4 = { label: "sti", confidence: 0.9, source: "v4" };

  it("asks for the unscoped top 2 and returns s1, s2 and the top-1 class", async () => {
    const calls = [];
    const res = await client(calls).retrieve("q", v4, {
      withUnscopedScore: true,
      withGateFeatures: true,
    });
    assert.equal(calls[1].top_k, 2);
    assert.deepEqual(res.unscopedTop, { s1: 0.91, s2: 0.87, top1Class: "sti" });
    assert.equal(res.unscopedScore, 0.91);
  });

  it("is unchanged without the option: top 1, no unscopedTop", async () => {
    const calls = [];
    const res = await client(calls).retrieve("q", v4, {
      withUnscopedScore: true,
    });
    assert.equal(calls[1].top_k, 1);
    assert.equal("unscopedTop" in res, false);
  });

  it("takes s1, s2 and the class from an unscoped retrieval directly", async () => {
    const calls = [];
    const res = await client(calls).retrieve(
      "q",
      { ...v4, confidence: 0.47 },
      { withUnscopedScore: true, withGateFeatures: true },
    );
    assert.equal(calls.length, 1);
    assert.deepEqual(res.unscopedTop, { s1: 0.91, s2: 0.87, top1Class: "sti" });
  });
});

describe("backend wiring", () => {
  const entry = {
    kbId: "KB-S4",
    question: "q",
    answer: "a",
    source: "s",
    category: "sti",
  };

  function handler({
    gateG,
    source = "v4",
    serve = true,
    unscopedScore = 0.9,
  }) {
    const calls = [];
    const { unscopedTop, confidence } = inputsFor(serve);
    const classifierClient = {
      classify: async () => ({ label: "sti", confidence, source }),
      retrieve: async (_text, _classification, options) => {
        calls.push(options);
        return {
          entry,
          retrievalScope: "scoped",
          unscopedScore,
          ...(options.withGateFeatures ? { unscopedTop } : {}),
        };
      },
    };
    const handleQuery = createHandleQuery({
      classifierClient,
      checkSafety: () => ({ flagged: false }),
      isHelpRequest: () => false,
      matchHeld: () => null,
      isVague: () => false,
      relevanceGate: true,
      generate: (e) => ({
        generated: false,
        text: e ? e.answer : null,
        source: e ? e.source : null,
      }),
      gateG,
    });
    return { handleQuery, calls };
  }
  const gate = loadGateG();

  it("serves when gate (g) serves", async () => {
    const { handleQuery, calls } = handler({ gateG: gate, serve: true });
    const res = await handleQuery("synthetic question");
    assert.equal(res.kind, "answer-scoped");
    assert.deepEqual(calls[0], {
      withUnscopedScore: true,
      withGateFeatures: true,
    });
  });

  it("abstains when gate (g) abstains, even above 0.8439", async () => {
    const { handleQuery } = handler({
      gateG: gate,
      serve: false,
      unscopedScore: 0.99,
    });
    const res = await handleQuery("synthetic question");
    assert.equal(res.kind, "abstain");
  });

  it("keeps the current gate when the flag is off", async () => {
    const { handleQuery, calls } = handler({
      gateG: null,
      serve: false,
      unscopedScore: 0.9,
    });
    const res = await handleQuery("synthetic question");
    assert.deepEqual(calls[0], { withUnscopedScore: true });
    assert.equal(res.kind, "answer-scoped");
  });

  it("keeps the current gate for a query V4 did not classify", async () => {
    const { handleQuery, calls } = handler({
      gateG: gate,
      source: "distilbert",
      unscopedScore: 0.8,
    });
    const res = await handleQuery("synthetic question");
    assert.deepEqual(calls[0], { withUnscopedScore: true });
    assert.equal(res.kind, "abstain");
  });
});
