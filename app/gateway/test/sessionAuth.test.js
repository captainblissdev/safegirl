/**
 * Tests for src/middleware/sessionAuth.js.
 *
 * No Firebase project or credentials are used: the middleware gets an
 * injected fake verifier. Console and stderr output is captured to check
 * that no token, token fragment, error message or uid is ever logged.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  createAuthMiddleware,
  createFirebaseVerifier,
  resolveAuthConfig,
  AUTH_REQUIRED,
  DISABLED_WARNING,
} = require("../src/middleware/sessionAuth");
const { captureOutput } = require("./support");

const VALID_TOKEN = "valid-token-123";
const UID = "anon-uid-SECRET-42";
const TOKEN_MARKER =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6Ik1BUktFUi10b2tlbi1mcmFnbWVudA";

function firebaseError(code, message = `Firebase says: ${code}`) {
  return Object.assign(new Error(message), { code });
}

/** Fake verifier: accepts VALID_TOKEN, otherwise throws the given error. */
function fakeVerifier(errorForOthers = firebaseError("auth/argument-error")) {
  return async (token) => {
    if (token === VALID_TOKEN) {
      return { uid: UID };
    }
    throw errorForOthers;
  };
}

/** Run the middleware against a fake request; report what happened. */
async function run(middleware, headers) {
  const req = { headers };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;

  const { output } = await captureOutput(() =>
    middleware(req, res, () => {
      nextCalled = true;
    }),
  );

  return { req, res, nextCalled, output };
}

describe("createAuthMiddleware()", () => {
  const rejections = [
    ["no Authorization header", {}, "missing"],
    ["an empty Authorization header", { authorization: "" }, "missing"],
    [
      "a non-Bearer scheme",
      { authorization: `Basic ${VALID_TOKEN}` },
      "malformed_header",
    ],
    ["Bearer with no token", { authorization: "Bearer " }, "malformed_header"],
    [
      "a token containing spaces",
      { authorization: "Bearer abc def" },
      "malformed_header",
    ],
    ["a bad token", { authorization: "Bearer not-a-real-token" }, "invalid"],
  ];

  for (const [name, headers, reason] of rejections) {
    it(`rejects ${name} with the shared 401 body`, async () => {
      const middleware = createAuthMiddleware({
        verifyIdToken: fakeVerifier(),
      });
      const { res, nextCalled, output } = await run(middleware, headers);

      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, AUTH_REQUIRED);
      assert.deepEqual(res.body, { error: "Authentication required." });
      assert.equal(nextCalled, false);
      assert.equal(output.trim(), `[auth] rejected request: ${reason}`);
    });
  }

  for (const [code, reason] of [
    ["auth/id-token-expired", "expired"],
    ["auth/id-token-revoked", "revoked"],
    ["auth/user-disabled", "disabled"],
    ["auth/argument-error", "invalid"],
    ["auth/internal-error", "verifier_error"],
    [undefined, "verifier_error"],
  ]) {
    it(`maps verifier error ${code ?? "(no code)"} to the "${reason}" category with the same body`, async () => {
      const middleware = createAuthMiddleware({
        verifyIdToken: fakeVerifier(firebaseError(code)),
      });
      const { res, nextCalled, output } = await run(middleware, {
        authorization: "Bearer some-token",
      });

      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, AUTH_REQUIRED);
      assert.equal(nextCalled, false);
      assert.equal(output.trim(), `[auth] rejected request: ${reason}`);
    });
  }

  it("accepts a valid token: calls next() with req.uid set, and logs nothing", async () => {
    const middleware = createAuthMiddleware({ verifyIdToken: fakeVerifier() });
    const { req, res, nextCalled, output } = await run(middleware, {
      authorization: `Bearer ${VALID_TOKEN}`,
    });

    assert.equal(nextCalled, true);
    assert.equal(req.uid, UID);
    assert.equal(res.body, undefined);
    assert.equal(output, "", "nothing logged on success, so no uid");
  });

  it("never echoes or logs the verifier's error message, the token or a fragment of it", async () => {
    const error = firebaseError(
      "auth/argument-error",
      `Decoding failed for token ${TOKEN_MARKER}.MARKER-sig`,
    );
    const middleware = createAuthMiddleware({
      verifyIdToken: fakeVerifier(error),
    });
    const token = `${TOKEN_MARKER}.payload.MARKER-sig`;

    const { res, output } = await run(middleware, {
      authorization: `Bearer ${token}`,
    });
    const response = JSON.stringify(res.body);

    for (const fragment of [
      TOKEN_MARKER,
      "MARKER",
      token.slice(0, 12),
      "Decoding",
    ]) {
      assert.ok(!response.includes(fragment), `response contains ${fragment}`);
      assert.ok(!output.includes(fragment), `logs contain ${fragment}`);
    }
    assert.equal(output.trim(), "[auth] rejected request: invalid");
  });

  it("rejects a verifier result without a uid", async () => {
    const middleware = createAuthMiddleware({
      verifyIdToken: async () => ({}),
    });
    const { res, nextCalled } = await run(middleware, {
      authorization: "Bearer x",
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
  });

  it("refuses to be created without a verifier", () => {
    assert.throws(() => createAuthMiddleware({}), TypeError);
  });
});

describe("createFirebaseVerifier()", () => {
  it("needs only a project ID: a malformed token is rejected as invalid, not a credential error", async () => {
    const verify = createFirebaseVerifier({ projectId: "demo-safegirl-test" });

    await assert.rejects(verify("not.a.jwt"), (error) => {
      assert.equal(error.code, "auth/argument-error");
      return true;
    });
  });
});

describe("resolveAuthConfig()", () => {
  const PROJECT = { FIREBASE_PROJECT_ID: "demo-project" };

  it("enables auth with a project ID and no warnings by default", () => {
    assert.deepEqual(resolveAuthConfig({ ...PROJECT }), {
      authEnabled: true,
      projectId: "demo-project",
      warnings: [],
    });
  });

  for (const nodeEnv of [undefined, "development", "test"]) {
    it(`disables auth for AUTH_DISABLED=true with NODE_ENV=${nodeEnv}, with the startup warning`, () => {
      const env = { AUTH_DISABLED: "true" };
      if (nodeEnv !== undefined) env.NODE_ENV = nodeEnv;

      assert.deepEqual(resolveAuthConfig(env), {
        authEnabled: false,
        projectId: null,
        warnings: [DISABLED_WARNING],
      });
      assert.equal(
        DISABLED_WARNING,
        "[auth] AUTH DISABLED (development only): POST /api/query is unauthenticated",
      );
    });
  }

  it("refuses to start for AUTH_DISABLED=true with NODE_ENV=production", () => {
    assert.throws(
      () =>
        resolveAuthConfig({
          AUTH_DISABLED: "true",
          NODE_ENV: "production",
          ...PROJECT,
        }),
      /not allowed when NODE_ENV=production/,
    );
  });

  for (const value of ["1", "yes", "TRUE ", "True", " true", "on"]) {
    it(`fails closed for AUTH_DISABLED=${JSON.stringify(value)}: auth stays on, with a warning`, () => {
      const config = resolveAuthConfig({ AUTH_DISABLED: value, ...PROJECT });
      assert.equal(config.authEnabled, true);
      assert.equal(config.warnings.length, 1);
      assert.match(config.warnings[0], /authentication stays enabled/);
    });
  }

  for (const value of ["", "false", undefined]) {
    it(`keeps auth on silently for AUTH_DISABLED=${JSON.stringify(value)}`, () => {
      const config = resolveAuthConfig({ AUTH_DISABLED: value, ...PROJECT });
      assert.equal(config.authEnabled, true);
      assert.deepEqual(config.warnings, []);
    });
  }

  for (const projectId of [undefined, "", "   "]) {
    it(`refuses to start with auth on and FIREBASE_PROJECT_ID=${JSON.stringify(projectId)}`, () => {
      assert.throws(
        () => resolveAuthConfig({ FIREBASE_PROJECT_ID: projectId }),
        /FIREBASE_PROJECT_ID is not set/,
      );
    });
  }

  it("refuses to start for a malformed AUTH_DISABLED without a project ID (fail closed)", () => {
    assert.throws(
      () => resolveAuthConfig({ AUTH_DISABLED: "yes" }),
      /FIREBASE_PROJECT_ID is not set/,
    );
  });

  it("trims the project ID", () => {
    assert.equal(
      resolveAuthConfig({ FIREBASE_PROJECT_ID: "  demo-project  " }).projectId,
      "demo-project",
    );
  });
});
