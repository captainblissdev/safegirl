import { createSession, isNetworkError, type SessionUser } from "./session";

/**
 * Tests for createSession with a fake auth object: no Firebase, no
 * network.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

interface FakeAuth {
  currentUser: SessionUser | null;
}

function fakeUser(name: string): SessionUser {
  return {
    getIdToken: (forceRefresh = false) =>
      Promise.resolve(`${name}-token${forceRefresh ? "-refreshed" : ""}`),
  };
}

/** A fake sign-in that resolves on the next tick and records each call. */
function setup({ failFirst = false }: { failFirst?: boolean } = {}) {
  const auth: FakeAuth = { currentUser: null };
  let signInCalls = 0;
  let getAuthCalls = 0;

  const session = createSession<FakeAuth>({
    getAuth: () => {
      getAuthCalls += 1;
      return auth;
    },
    signIn: async (a) => {
      signInCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (failFirst && signInCalls === 1) {
        throw new Error("sign-in failed");
      }
      a.currentUser = fakeUser(`user-${signInCalls}`);
      return a.currentUser;
    },
  });

  return {
    session,
    auth,
    signInCalls: () => signInCalls,
    getAuthCalls: () => getAuthCalls,
  };
}

console.log("Test 1: nothing signs in until a session is needed");
{
  const { signInCalls, getAuthCalls } = setup();

  assert(signInCalls() === 0, "creating the session does not sign in");
  assert(getAuthCalls() === 0, "creating the session does not touch auth");
}

console.log("\nTest 2: concurrent ensureSession() calls sign in once");
{
  const { session, signInCalls } = setup();
  const users = await Promise.all([
    session.ensureSession(),
    session.ensureSession(),
    session.ensureSession(),
  ]);

  assert(signInCalls() === 1, "signIn was called exactly once");
  assert(
    users.every((user) => user === users[0]),
    "every caller got the same user",
  );
}

console.log("\nTest 3: later calls reuse the signed-in user");
{
  const { session, signInCalls } = setup();
  await session.ensureSession();
  await session.ensureSession();

  assert(signInCalls() === 1, "no second sign-in");
}

console.log("\nTest 4: a failed sign-in is not cached");
{
  const { session, signInCalls } = setup({ failFirst: true });
  let failed = false;
  try {
    await session.ensureSession();
  } catch {
    failed = true;
  }
  const user = await session.ensureSession();

  assert(failed, "the first call rejected");
  assert(signInCalls() === 2, "the next call signed in again");
  assert(user !== null, "and got a user");
}

console.log("\nTest 5: getIdToken passes forceRefresh through");
{
  const { session } = setup();

  assert(
    (await session.getIdToken()) === "user-1-token",
    "a normal token by default",
  );
  assert(
    (await session.getIdToken(true)) === "user-1-token-refreshed",
    "a refreshed token when forced",
  );
}

console.log(
  "\nTest 6: only auth/network-request-failed counts as a network error",
);
{
  assert(
    isNetworkError({ code: "auth/network-request-failed" }),
    "network-request-failed is a network error",
  );
  assert(
    !isNetworkError({ code: "auth/operation-not-allowed" }),
    "operation-not-allowed (provider disabled) is not",
  );
  assert(!isNetworkError(new Error("x")), "an error without a code is not");
  assert(!isNetworkError(null), "null is not");
}

console.log("\nAll session tests passed.");
