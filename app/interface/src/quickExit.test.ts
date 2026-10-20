import {
  DOUBLE_ESCAPE_WINDOW_MS,
  EXIT_URL,
  createDoubleEscapeHandler,
  quickExit,
} from "./quickExit";

/**
 * Tests for quick exit (quickExit.ts): state and sessionStorage are
 * cleared, the page is replaced with EXIT_URL, and Escape pressed twice
 * within one second triggers it while a single or slow press does not.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

/** Records what quickExit did, in order. */
function recorder(storage: "ok" | "throws" | "null" = "ok") {
  const events: string[] = [];
  let replacedWith: string | null = null;
  const deps = {
    clearState: () => {
      events.push("clearState");
    },
    getSessionStorage: () => {
      if (storage === "throws") throw new Error("SecurityError");
      if (storage === "null") return null;
      return { clear: () => events.push("storage.clear") };
    },
    replace: (url: string) => {
      events.push("replace");
      replacedWith = url;
    },
  };
  return { deps, events, replaced: () => replacedWith };
}

console.log("Test 1: the exit address is one constant");
assert(EXIT_URL === "https://www.google.com", "EXIT_URL is Google");
assert(DOUBLE_ESCAPE_WINDOW_MS === 1000, "the double-Escape window is 1 s");

console.log("\nTest 2: Exit clears state and storage, then replaces the page");
{
  const { deps, events, replaced } = recorder();
  quickExit(deps);
  assert(
    events.join(",") === "clearState,storage.clear,replace",
    "state cleared, then sessionStorage, then the page replaced",
  );
  assert(replaced() === EXIT_URL, "replace is called with EXIT_URL");
}

console.log("\nTest 3: blocked storage never stops the exit");
for (const storage of ["throws", "null"] as const) {
  const { deps, replaced, events } = recorder(storage);
  quickExit(deps);
  assert(events.includes("clearState"), `state cleared (storage ${storage})`);
  assert(replaced() === EXIT_URL, `the page is replaced (storage ${storage})`);
}

console.log("\nTest 4: a failing state reset never stops the exit");
{
  const { deps, replaced } = recorder();
  quickExit({
    ...deps,
    clearState: () => {
      throw new Error("boom");
    },
  });
  assert(replaced() === EXIT_URL, "the page is still replaced");
}

/** A handler with a controllable clock. */
function handlerAt() {
  let time = 0;
  let exits = 0;
  const press = createDoubleEscapeHandler(
    () => {
      exits += 1;
    },
    () => time,
  );
  return {
    press: (key: string, at: number) => {
      time = at;
      return press(key);
    },
    exits: () => exits,
  };
}

console.log("\nTest 5: Escape twice within 1 second triggers Exit");
{
  const h = handlerAt();
  assert(h.press("Escape", 0) === false, "the first Escape does nothing");
  assert(h.press("Escape", 400) === true, "the second, 400 ms later, exits");
  assert(h.exits() === 1, "Exit ran once");
}
{
  const h = handlerAt();
  h.press("Escape", 0);
  h.press("Escape", 1000);
  assert(h.exits() === 1, "exactly 1000 ms apart still exits");
}

console.log("\nTest 6: a single Escape does nothing");
{
  const h = handlerAt();
  h.press("Escape", 0);
  assert(h.exits() === 0, "no exit after one Escape");
}

console.log("\nTest 7: the 1-second window is respected");
{
  const h = handlerAt();
  h.press("Escape", 0);
  assert(h.press("Escape", 1001) === false, "1001 ms apart does not exit");
  assert(h.press("Escape", 1500) === true, "but starts a new window");
  assert(h.exits() === 1, "Exit ran once");
}
{
  const h = handlerAt();
  h.press("Escape", 0);
  h.press("a", 100);
  h.press("Escape", 200);
  assert(h.exits() === 0, "another key in between starts over");
}
{
  const h = handlerAt();
  h.press("Escape", 0);
  h.press("Escape", 100);
  h.press("Escape", 200);
  assert(h.exits() === 1, "a third quick Escape does not exit twice");
}

console.log("\nTest 8: an Escape that closes a panel does not count");
{
  let panelOpen = true;
  let time = 0;
  let exits = 0;
  const press = createDoubleEscapeHandler(
    () => {
      exits += 1;
    },
    () => time,
    () => panelOpen,
  );
  // The panel's own handler closes it; the press is seen while it is open.
  assert(press("Escape") === false, "the Escape that closes the panel");
  panelOpen = false;
  time = 500;
  assert(press("Escape") === false, "the next Escape within 1 s does not exit");
  assert(exits === 0, "no exit yet");
  time = 900;
  assert(press("Escape") === true, "a further Escape within 1 s exits");
  assert(exits === 1, "Exit ran once");
}
{
  let exits = 0;
  let time = 0;
  const press = createDoubleEscapeHandler(
    () => {
      exits += 1;
    },
    () => time,
    () => false,
  );
  press("Escape");
  time = 300;
  press("Escape");
  assert(exits === 1, "two Escapes with nothing open still exit");
}

console.log("\nAll quick exit tests passed.");
