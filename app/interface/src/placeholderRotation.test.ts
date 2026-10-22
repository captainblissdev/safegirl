import { PLACEHOLDER_EXAMPLES, PLACEHOLDER_ROTATE_MS } from "./content/uiText";
import { startPlaceholderRotation } from "./placeholderRotation";

/**
 * Tests for Home's placeholder rotation (placeholderRotation.ts), with a
 * fake clock: every 6 s to the next example, never with reduced motion.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

/** A fake setInterval that records its callback and delay. */
function fakeTimers() {
  let callback: (() => void) | null = null;
  let delay = 0;
  let cleared = false;
  return {
    deps: {
      setInterval: (cb: () => void, ms: number) => {
        callback = cb;
        delay = ms;
        return 1;
      },
      clearInterval: () => {
        cleared = true;
      },
    },
    tick: () => callback?.(),
    delay: () => delay,
    started: () => callback !== null,
    cleared: () => cleared,
  };
}

console.log("Test 1: the examples and the 6-second interval");
assert(
  PLACEHOLDER_EXAMPLES.length >= 5 && PLACEHOLDER_EXAMPLES.length <= 6,
  "5 or 6 examples",
);
assert(PLACEHOLDER_ROTATE_MS === 6000, "rotates every 6 seconds");

console.log("\nTest 2: rotation steps through the examples and wraps");
{
  const timers = fakeTimers();
  const shown: number[] = [];
  const stop = startPlaceholderRotation({
    count: 3,
    intervalMs: PLACEHOLDER_ROTATE_MS,
    reducedMotion: false,
    onChange: (i) => shown.push(i),
    ...timers.deps,
  });
  assert(timers.started(), "an interval is started");
  assert(timers.delay() === 6000, "every 6000 ms");
  timers.tick();
  timers.tick();
  timers.tick();
  assert(shown.join(",") === "1,2,0", "1, 2, then back to 0");
  stop();
  assert(timers.cleared(), "stopping clears the interval");
}

console.log("\nTest 3: reduced motion stops the rotation");
{
  const timers = fakeTimers();
  const shown: number[] = [];
  startPlaceholderRotation({
    count: PLACEHOLDER_EXAMPLES.length,
    intervalMs: PLACEHOLDER_ROTATE_MS,
    reducedMotion: true,
    onChange: (i) => shown.push(i),
    ...timers.deps,
  });
  assert(!timers.started(), "no interval with reduced motion");
  assert(shown.length === 0, "the first example stays");
}

console.log("\nTest 4: one example never rotates");
{
  const timers = fakeTimers();
  startPlaceholderRotation({
    count: 1,
    intervalMs: PLACEHOLDER_ROTATE_MS,
    reducedMotion: false,
    onChange: () => undefined,
    ...timers.deps,
  });
  assert(!timers.started(), "no interval for a single example");
}

console.log("\nAll placeholder rotation tests passed.");
