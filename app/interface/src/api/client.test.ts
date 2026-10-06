import type { QueryResponse } from "../types";
import {
  AUTH_ERROR_MESSAGES,
  AuthError,
  createQueryClient,
  type HttpResponse,
  type QueryClientDeps,
} from "./client";

/**
 * Tests for createQueryClient with injected fetch and token functions:
 * no Firebase, no network.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

const ONLINE_ANSWER: QueryResponse = {
  outcome: "grounded_answer",
  message: "online answer",
  generationInvoked: false,
};
const OFFLINE_ANSWER: QueryResponse = {
  outcome: "grounded_answer",
  message: "offline answer",
  generationInvoked: false,
};

const respond = (
  status: number,
  body: unknown = ONLINE_ANSWER,
): HttpResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

const firebaseError = (code: string): Error =>
  Object.assign(new Error(`Firebase: ${code}`), { code });

interface Recorded {
  requests: { token: string | undefined; body: unknown }[];
  tokenCalls: boolean[];
  offlineCalls: string[];
}

/** Build a client whose dependencies follow the given scripts. */
function setup({
  responses = [respond(200)],
  tokens = ["token-1", "token-2"],
  tokenError,
  online = true,
}: {
  responses?: (HttpResponse | Error)[];
  tokens?: string[];
  tokenError?: Error;
  online?: boolean;
}) {
  const recorded: Recorded = { requests: [], tokenCalls: [], offlineCalls: [] };
  const responseQueue = [...responses];
  const tokenQueue = [...tokens];

  const deps: QueryClientDeps = {
    fetch: (_url, init) => {
      const headers = init.headers as Record<string, string>;
      recorded.requests.push({
        token: headers.Authorization,
        body: JSON.parse(init.body as string),
      });
      const next = responseQueue.shift();
      if (next === undefined) {
        return Promise.reject(new Error("unexpected extra request"));
      }
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    },
    getToken: (forceRefresh) => {
      recorded.tokenCalls.push(forceRefresh);
      if (tokenError !== undefined) {
        return Promise.reject(tokenError);
      }
      return Promise.resolve(tokenQueue.shift() ?? "token-extra");
    },
    isOnline: () => online,
    offline: (text) => {
      recorded.offlineCalls.push(text);
      return OFFLINE_ANSWER;
    },
    isNetworkError: (error) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/network-request-failed",
  };

  return { submit: createQueryClient(deps), recorded };
}

async function expectAuthError(
  promise: Promise<QueryResponse>,
): Promise<AuthError | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof AuthError ? error : null;
  }
}

console.log("Test 1: the ID token is sent in the Authorization header");
{
  const { submit, recorded } = setup({});
  const result = await submit("can I get birth control");

  assert(result === ONLINE_ANSWER, "returns the gateway's answer");
  assert(recorded.requests.length === 1, "one request was sent");
  assert(
    recorded.requests[0]?.token === "Bearer token-1",
    "Authorization: Bearer <token> is present",
  );
  assert(
    JSON.stringify(recorded.requests[0]?.body) ===
      JSON.stringify({ text: "can I get birth control" }),
    "the body carries only the query text",
  );
  assert(
    recorded.offlineCalls.length === 0,
    "the offline pipeline was not used",
  );
}

console.log("\nTest 2: a 401 refreshes the token and retries once");
{
  const { submit, recorded } = setup({
    responses: [respond(401), respond(200)],
  });
  const result = await submit("hello");

  assert(result === ONLINE_ANSWER, "the retry's answer is returned");
  assert(
    JSON.stringify(recorded.tokenCalls) === JSON.stringify([false, true]),
    "the second token was force-refreshed",
  );
  assert(
    recorded.requests.map((r) => r.token).join(",") ===
      "Bearer token-1,Bearer token-2",
    "the retry used the refreshed token",
  );
  assert(
    recorded.offlineCalls.length === 0,
    "the offline pipeline was not used",
  );
}

console.log(
  "\nTest 3: a second 401 throws AuthError, without the offline pipeline",
);
{
  const { submit, recorded } = setup({
    responses: [respond(401), respond(401)],
  });
  const error = await expectAuthError(submit("hello"));

  assert(error !== null, "AuthError was thrown");
  assert(
    error?.message === AUTH_ERROR_MESSAGES.sessionRejected,
    "with the session-rejected message",
  );
  assert(recorded.requests.length === 2, "exactly one retry was made");
  assert(
    recorded.offlineCalls.length === 0,
    "the offline pipeline was NOT used",
  );
}

console.log(
  "\nTest 4: a fetch rejection (network failure) uses the offline pipeline",
);
{
  const { submit, recorded } = setup({
    responses: [new TypeError("Failed to fetch")],
  });
  const result = await submit("hello");

  assert(result === OFFLINE_ANSWER, "the offline answer is returned");
  assert(
    recorded.offlineCalls.length === 1 && recorded.offlineCalls[0] === "hello",
    "the offline pipeline got the query",
  );
}

console.log(
  "\nTest 5: sign-in that cannot reach Firebase uses the offline pipeline",
);
{
  const { submit, recorded } = setup({
    tokenError: firebaseError("auth/network-request-failed"),
  });
  const result = await submit("hello");

  assert(result === OFFLINE_ANSWER, "the offline answer is returned");
  assert(recorded.requests.length === 0, "no request was sent");
}

console.log("\nTest 6: sign-in failing for another reason throws AuthError");
{
  const { submit, recorded } = setup({
    tokenError: firebaseError("auth/operation-not-allowed"),
  });
  const error = await expectAuthError(submit("hello"));

  assert(error !== null, "AuthError was thrown");
  assert(
    error?.message === AUTH_ERROR_MESSAGES.signInFailed,
    "with the sign-in-failed message",
  );
  assert(
    recorded.offlineCalls.length === 0,
    "the offline pipeline was NOT used",
  );
}

console.log("\nTest 7: a 503 still uses the offline pipeline (unchanged)");
{
  const { submit, recorded } = setup({ responses: [respond(503)] });
  const result = await submit("hello");

  assert(result === OFFLINE_ANSWER, "the offline answer is returned");
  assert(
    recorded.tokenCalls.length === 1,
    "the token was not refreshed for a 503",
  );
}

console.log("\nTest 8: when the browser is offline, nothing is sent");
{
  const { submit, recorded } = setup({ online: false });
  const result = await submit("hello");

  assert(result === OFFLINE_ANSWER, "the offline answer is returned");
  assert(recorded.tokenCalls.length === 0, "no sign-in was attempted");
  assert(recorded.requests.length === 0, "no request was sent");
}

console.log("\nAll query client tests passed.");
