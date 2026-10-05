/**
 * HTTP-level tests for server.js error handling.
 *
 * The app is built with createApp() and a stubbed handleQuery, started on a
 * random port, and called with global fetch. Everything written to the
 * console, stdout and stderr during each request is captured so the tests
 * can assert that no request text or error detail is logged or echoed.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { createApp, BODY_LIMIT } = require("../server");
const { startApp, captureOutput, request, allowAll } = require("./support");

const PRIVATE_TEXT = "MY PRIVATE QUESTION ABOUT HIV";
const ERROR_MARKER = "MARKER-7f3a-internal-detail";

const okResult = { outcome: "grounded_answer", message: "stub answer" };

describe("server error handling", () => {
  let server;
  let behaviour = async () => okResult;

  before(async () => {
    const app = createApp({
      handleQuery: (text) => behaviour(text),
      authMiddleware: allowAll,
    });
    server = await startApp(app);
  });

  after(() => server.close());

  const postQuery = (body, contentType = "application/json") =>
    request(`${server.url}/api/query`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });

  it("answers a valid query", async () => {
    behaviour = async () => okResult;
    const res = await postQuery(JSON.stringify({ text: "hello" }));
    assert.equal(res.status, 200);
    assert.deepEqual(res.json(), okResult);
  });

  for (const body of [PRIVATE_TEXT, `{"text": "${PRIVATE_TEXT}" oops}`]) {
    it(`rejects malformed JSON without leaking it: ${JSON.stringify(body.slice(0, 20))}…`, async () => {
      const { result: res, output } = await captureOutput(() =>
        postQuery(body),
      );

      assert.equal(res.status, 400);
      assert.match(res.contentType, /application\/json/);
      assert.deepEqual(res.json(), { error: "Malformed request body." });

      for (const fragment of [PRIVATE_TEXT, "PRIVATE"]) {
        assert.ok(!res.text.includes(fragment), "response must not echo it");
        assert.ok(!output.includes(fragment), "logs must not contain it");
      }
      // Something was logged, so the capture itself is working.
      assert.match(output, /\[gateway\] rejected request body: malformed/);
      assert.ok(!/ at /.test(output), "no stack trace in the logs");
    });
  }

  it(`rejects bodies over the ${BODY_LIMIT} limit with 413`, async () => {
    const big = JSON.stringify({ text: PRIVATE_TEXT + "x".repeat(11 * 1024) });
    const { result: res, output } = await captureOutput(() => postQuery(big));

    assert.equal(res.status, 413);
    assert.deepEqual(res.json(), { error: "Request too large." });
    assert.ok(!output.includes("PRIVATE"));
    assert.match(output, /too large \(PayloadTooLargeError\)/);
  });

  for (const [method, path] of [
    ["GET", "/nope"],
    ["POST", "/api/nope"],
    ["GET", "/api/query"],
  ]) {
    it(`returns a JSON 404 for ${method} ${path}`, async () => {
      const res = await request(`${server.url}${path}`, { method });
      assert.equal(res.status, 404);
      assert.match(res.contentType, /application\/json/);
      assert.deepEqual(res.json(), { error: "Not found." });
    });
  }

  it("returns a generic 500 when handleQuery throws, without echoing or logging the error", async () => {
    behaviour = async (text) => {
      throw new Error(`${ERROR_MARKER} while handling: ${text}`);
    };

    const { result: res, output } = await captureOutput(() =>
      postQuery(JSON.stringify({ text: PRIVATE_TEXT })),
    );

    assert.equal(res.status, 500);
    assert.deepEqual(res.json(), { error: "Unable to process query." });
    for (const fragment of [ERROR_MARKER, "PRIVATE"]) {
      assert.ok(!res.text.includes(fragment), "response must not echo it");
      assert.ok(!output.includes(fragment), "logs must not contain it");
    }
    assert.equal(output.trim(), "[gateway] request failed (Error)");
  });

  it("returns a generic 500 when handleQuery rejects with a non-Error", async () => {
    behaviour = async () => {
      throw ERROR_MARKER;
    };

    const { result: res, output } = await captureOutput(() =>
      postQuery(JSON.stringify({ text: "hello" })),
    );

    assert.equal(res.status, 500);
    assert.ok(!output.includes(ERROR_MARKER));
  });

  for (const [name, body] of [
    ["missing text", {}],
    ["non-string text", { text: 42 }],
    ["blank text", { text: "   " }],
  ]) {
    it(`keeps the 400 for ${name}`, async () => {
      const res = await postQuery(JSON.stringify(body));
      assert.equal(res.status, 400);
      assert.deepEqual(res.json(), { error: "Query text is required." });
    });
  }

  it("serves /health", async () => {
    const res = await request(`${server.url}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json(), { status: "ok" });
  });
});
