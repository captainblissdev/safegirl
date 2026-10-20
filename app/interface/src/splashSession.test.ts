import {
  SPLASH_SEEN_KEY,
  continueFromSplash,
  hasSeenSplash,
  markSplashSeen,
  startScreen,
} from "./splashSession";

/**
 * Tests for the once-per-session splash (splashSession.ts), with a fake
 * sessionStorage and with storage blocked in each way a browser can.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

/** A fake sessionStorage backed by a Map. */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    store: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    },
  };
}

console.log("Test 1: the splash shows once per session");
{
  const { store, data } = fakeStorage();
  const get = () => store;
  assert(startScreen(get) === "splash", "a new session starts on the splash");
  assert(continueFromSplash(get) === "chat", "continue leads to home");
  assert(data.get(SPLASH_SEEN_KEY) === "1", "the seen flag is stored");
  assert(hasSeenSplash(get), "the splash counts as seen");
  assert(
    startScreen(get) === "chat",
    "a reload in the same session starts at home",
  );
}

console.log("\nTest 2: a new session (empty storage) shows it again");
{
  const { store } = fakeStorage();
  assert(startScreen(() => store) === "splash", "empty storage: splash");
}

console.log("\nTest 3: blocked storage shows the splash every time and works");
{
  const throwingGetter = () => {
    throw new Error("SecurityError");
  };
  const throwingStore = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  for (const [name, get] of [
    ["sessionStorage getter throws", throwingGetter],
    ["getItem and setItem throw", () => throwingStore],
    ["no storage at all", () => null],
  ] as const) {
    assert(startScreen(get) === "splash", `${name}: starts on the splash`);
    let threw = false;
    let next = "";
    try {
      next = continueFromSplash(get);
      markSplashSeen(get);
    } catch {
      threw = true;
    }
    assert(!threw, `${name}: continuing never throws`);
    assert(next === "chat", `${name}: continue still leads to home`);
    assert(
      startScreen(get) === "splash",
      `${name}: the next load shows the splash again`,
    );
  }
}

console.log("\nAll splash session tests passed.");
