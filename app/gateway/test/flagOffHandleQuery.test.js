/**
 * Flag-off handleQuery snapshots (V4 integration plan, step 4A).
 *
 * Pins the gateway's replies before the V4 triage work: every response
 * of createHandleQuery, with a deterministic fake ml_service and pinned
 * classifier settings, must equal test/snapshots/flagOffHandleQuery.json.
 * The queries are the 58 dev-set queries (an equivalence check only,
 * never for tuning) and author-written synthetic queries covering the
 * Safety Net, help, held topics A/B/C, the vague rule, each V3 class,
 * low-confidence abstain, the relevance gate and an unreachable
 * ml_service (keyword fallback). /triage must never be requested.
 *
 * Record (only when the flag-off behaviour is meant to change, with a
 * decision-log note): RECORD_SNAPSHOTS=1 node --test test/flagOffHandleQuery.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createHandleQuery } = require("../src/backend");
const { createClassifierClient } = require("../src/classifierClient");
const { loadKnowledgeBase } = require("../src/retrievalModule");

const SERVICE_URL = "http://ml.test";
const SNAPSHOT = path.join(__dirname, "snapshots", "flagOffHandleQuery.json");
const DEV_SET = path.join(__dirname, "..", "..", "..", "resources", "eval", "retrieval_eval_set.csv");
const CONFIG = { serviceUrl: SERVICE_URL, confidenceThreshold: 0.5, abstainThreshold: 0.35, timeoutMs: 50 };
const V3_CLASSES = ["contraception", "sti", "pregnancy", "general"];

// Author-written synthetic queries: [id, text, fake /classify answer or
// null, fake retrieval score or null, expected reply kind].
const SYNTHETIC = [
  ["S-safety", "someone forced me to have sex", null, null, "referral"],
  ["S-help", "where can i get help", null, null, "help"],
  ["S-held-A", "can i use postinor after sex", null, null, "held-topic"],
  ["S-held-B", "i have an unwanted pregnancy what can i do", null, null, "held-topic"],
  ["S-held-C", "my period is late and i am scared", null, null, "held-topic"],
  ["S-vague", "am i okay", null, null, "vague"],
  ["S-contraception", "how do condoms work for teenagers", ["contraception", 0.91], 0.93, "answer-scoped"],
  ["S-sti", "what are the signs of an sti infection", ["sti", 0.88], 0.92, "answer-scoped"],
  ["S-pregnancy", "what are the early signs of pregnancy", ["pregnancy", 0.86], 0.9, "answer-scoped"],
  ["S-general", "is it normal to have cramps before my period starts", ["general", 0.83], 0.91, "answer-scoped"],
  ["S-unscoped", "what does a youth friendly clinic offer", ["general", 0.42], 0.9, "answer-unscoped"],
  ["S-low-confidence", "i have a question about something that happened at school yesterday", ["general", 0.2],
    null, "abstain"],
  ["S-gate", "what are the side effects of the contraceptive implant", ["contraception", 0.9], 0.7, "abstain"],
];

// Queries answered by an unreachable ml_service: keyword fallback.
const UNREACHABLE = [
  ["U-contraception", "how do condoms work for teenagers"],
  ["U-sti", "what are the signs of an sti infection"],
  ["U-general", "where is the nearest youth clinic"],
];

/** FNV-1a, for deterministic fake answers. */
function hash(text) {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.replace(/^﻿/, ""), r[i] ?? ""])));
}

function devQueries() {
  return parseCsv(fs.readFileSync(DEV_SET, "utf8")).map((r) => [`DEV-${r.id}`, r.query]);
}

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

/** A deterministic fake ml_service; records every endpoint requested. */
function fakeMlService() {
  const entries = Object.values(loadKnowledgeBase()).flat();
  const fixed = new Map(SYNTHETIC.map(([, text, cls, score]) => [text, { cls, score }]));
  const calls = [];

  async function fetch(url, options) {
    const endpoint = url.slice(SERVICE_URL.length);
    const body = JSON.parse(options.body);
    calls.push(endpoint);
    if (endpoint === "/classify") {
      const f = fixed.get(body.text);
      const h = hash(body.text);
      const [intent, confidence] = f?.cls ?? [V3_CLASSES[h % 4], [0.2, 0.4, 0.62, 0.93][(h >>> 4) % 4]];
      const scores = Object.fromEntries(V3_CLASSES.map((c) => [c, c === intent ? confidence : (1 - confidence) / 3]));
      return jsonResponse({ intent, confidence, scores });
    }
    if (endpoint === "/retrieve") {
      const pool = body.intent ? entries.filter((e) => e.category === body.intent) : entries;
      const h = hash(body.query);
      const entry = pool[h % pool.length];
      const score = fixed.get(body.query)?.score ?? 0.7 + ((h >>> 8) % 30) / 100;
      return jsonResponse({
        results: [{ id: entry.kbId, class: entry.category, title: "t", content: "c", source: "s", score }],
      });
    }
    throw new Error(`unexpected request to ${endpoint}`);
  }

  return { fetch, calls };
}

const unreachableFetch = async () => {
  throw new TypeError("fetch failed");
};

async function runAll(extraConfig = {}) {
  const ml = fakeMlService();
  const silent = { warn() {} };
  const online = createHandleQuery({
    classifierClient: createClassifierClient({ fetch: ml.fetch, config: { ...CONFIG, ...extraConfig }, logger: silent }),
    relevanceGate: true,
  });
  const offline = createHandleQuery({
    classifierClient: createClassifierClient({
      fetch: unreachableFetch,
      config: { ...CONFIG, ...extraConfig },
      logger: silent,
    }),
    relevanceGate: true,
  });
  const out = {};
  for (const [id, text] of [...devQueries(), ...SYNTHETIC.map(([sid, t]) => [sid, t])]) {
    out[id] = await online(text);
  }
  for (const [id, text] of UNREACHABLE) {
    out[id] = await offline(text);
  }
  return { responses: out, calls: ml.calls };
}

if (process.env.RECORD_SNAPSHOTS === "1") {
  runAll().then(({ responses }) => {
    fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
    fs.writeFileSync(SNAPSHOT, `${JSON.stringify(responses, null, 1)}\n`);
    console.log(`recorded ${Object.keys(responses).length} responses`);
  });
} else {
  describe("flag-off handleQuery snapshots", () => {
    it("every response equals the snapshot", async () => {
      const expected = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
      const { responses } = await runAll();
      assert.equal(Object.keys(responses).length, Object.keys(expected).length);
      for (const [id, response] of Object.entries(expected)) {
        assert.deepStrictEqual(responses[id], response, id);
      }
      assert.equal(JSON.stringify(responses), JSON.stringify(expected), "byte-identical in order too");
    });

    it("covers the 58 dev queries and each synthetic branch", async () => {
      const { responses, calls } = await runAll();
      assert.equal(Object.keys(responses).filter((id) => id.startsWith("DEV-")).length, 58);
      for (const [id, , , , kind] of SYNTHETIC) {
        assert.equal(responses[id].kind, kind, id);
      }
      for (const [id] of UNREACHABLE) {
        assert.equal(responses[id].classifierSource, "keyword_fallback", id);
      }
      assert.ok(!calls.includes("/triage"), "/triage is never requested");
    });
  });
}
