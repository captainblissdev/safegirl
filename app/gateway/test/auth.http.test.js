/**
 * HTTP-level authentication tests.
 *
 * The app is built with createApp() and createAuthFromEnv() using an
 * injected fake verifier, so no Firebase project or credentials are
 * needed. Startup refusals are checked by running server.js as a child
 * process.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const { createApp } = require("../server");
const {
  createAuthFromEnv,
  DISABLED_WARNING,
} = require("../src/middleware/sessionAuth");
const { startApp, captureOutput, request } = require("./support");

const VALID_TOKEN = "valid-token-123";
const UID = "anon-uid-SECRET-42";

const OUTAGE_TOKEN = "token-during-outage";

const fakeVerifier = async (token) => {
  if (token === VALID_TOKEN) {
    return { uid: UID };
  }
  if (token === OUTAGE_TOKEN) {
    throw Object.assign(new Error("keys unavailable"), {
      code: "gateway/verifier-unavailable",
    });
  }
  throw Object.assign(new Error("bad token"), { code: "auth/argument-error" });
};

const okResult = { outcome: "grounded_answer", message: "stub answer" };

/** Build an app from an env, recording handleQuery's arguments. */
function buildApp(env) {
  const calls = [];
  const authMiddleware = createAuthFromEnv(env, {
    verifyIdToken: fakeVerifier,
    logger: { warn() {}, error() {} },
  });
  const app = createApp({
    handleQuery: async (...args) => {
      calls.push(args);
      return okResult;
    },
    authMiddleware,
    logger: { error() {} },
  });
  return { app, calls };
}

const query = (url, { token, body = JSON.stringify({ text: "hello" }) } = {}) =>
  request(`${url}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });

describe("authentication enabled (FIREBASE_PROJECT_ID set)", () => {
  let server;
  let calls;

  before(async () => {
    const built = buildApp({ FIREBASE_PROJECT_ID: "demo-project" });
    calls = built.calls;
    server = await startApp(built.app);
  });

  after(() => server.close());

  it("rejects POST /api/query without a token: 401 and handleQuery never runs", async () => {
    calls.length = 0;
    const res = await query(server.url);

    assert.equal(res.status, 401);
    assert.deepEqual(res.json(), { error: "Authentication required." });
    assert.equal(calls.length, 0);
  });

  it("rejects POST /api/query with an invalid token, with the same body", async () => {
    const res = await query(server.url, { token: "forged" });
    assert.equal(res.status, 401);
    assert.deepEqual(res.json(), { error: "Authentication required." });
  });

  it("accepts a valid token: 200, handleQuery gets only the text, and the uid is not in the response", async () => {
    calls.length = 0;
    const res = await query(server.url, { token: VALID_TOKEN });

    assert.equal(res.status, 200);
    assert.deepEqual(res.json(), okResult);
    assert.deepEqual(calls, [["hello"]]);
    assert.ok(!res.text.includes(UID));
  });

  it("returns 503, not 401, when tokens cannot be verified (verifier outage)", async () => {
    calls.length = 0;
    const res = await query(server.url, { token: OUTAGE_TOKEN });

    assert.equal(res.status, 503);
    assert.deepEqual(res.json(), { error: "Service temporarily unavailable." });
    assert.equal(calls.length, 0);
  });

  it("serves /health without a token", async () => {
    const res = await request(`${server.url}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json(), { status: "ok" });
  });

  it("does not parse an unauthenticated body: a malformed body without a token gets 401", async () => {
    const res = await query(server.url, { body: "MY PRIVATE QUESTION" });
    assert.equal(res.status, 401);
  });

  it("still returns 400 for a malformed body with a valid token", async () => {
    const res = await query(server.url, {
      token: VALID_TOKEN,
      body: "MY PRIVATE QUESTION",
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.json(), { error: "Malformed request body." });
  });
});

describe("authentication disabled (AUTH_DISABLED=true, not production)", () => {
  let server;
  let startupOutput;

  before(async () => {
    const { result, output } = await captureOutput(async () =>
      createAuthFromEnv({ AUTH_DISABLED: "true", NODE_ENV: "development" }),
    );
    startupOutput = output;
    const app = createApp({
      handleQuery: async () => okResult,
      authMiddleware: result,
    });
    server = await startApp(app);
  });

  after(() => server.close());

  it("logs the startup warning exactly once", () => {
    assert.equal(startupOutput.trim(), DISABLED_WARNING);
  });

  it("accepts POST /api/query without a token", async () => {
    const res = await query(server.url);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json(), okResult);
  });
});

describe("createApp()", () => {
  it("refuses to build an app without an authMiddleware", () => {
    assert.throws(
      () => createApp({ handleQuery: async () => okResult }),
      /requires an authMiddleware/,
    );
  });
});

describe("node server.js startup refusals", () => {
  const serverPath = path.join(__dirname, "..", "server.js");

  // Minimal environment: none of the auth variables are inherited.
  const baseEnv = Object.fromEntries(
    ["PATH", "Path", "SystemRoot", "TEMP", "TMP", "HOME", "USERPROFILE"]
      .filter((name) => process.env[name] !== undefined)
      .map((name) => [name, process.env[name]]),
  );

  const startServer = (env) =>
    spawnSync(process.execPath, [serverPath], {
      env: { ...baseEnv, PORT: "0", ...env },
      encoding: "utf8",
      timeout: 20000,
    });

  for (const [name, env, pattern] of [
    [
      "no FIREBASE_PROJECT_ID and no AUTH_DISABLED",
      {},
      /FIREBASE_PROJECT_ID is not set/,
    ],
    [
      "a malformed AUTH_DISABLED and no FIREBASE_PROJECT_ID",
      { AUTH_DISABLED: "yes" },
      /FIREBASE_PROJECT_ID is not set/,
    ],
    [
      "AUTH_DISABLED=true with NODE_ENV=production",
      { AUTH_DISABLED: "true", NODE_ENV: "production" },
      /not allowed when NODE_ENV=production/,
    ],
  ]) {
    it(`exits with code 1 and never listens for ${name}`, () => {
      const child = startServer(env);

      assert.equal(child.status, 1);
      assert.match(child.stderr, pattern);
      assert.ok(!child.stdout.includes("listening"));
    });
  }
});
