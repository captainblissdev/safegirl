import { nextFocusIndex, trapTab } from "./focusTrap";

/**
 * Tests for the Help sheet's focus trap (focusTrap.ts): Tab and Shift+Tab
 * cycle through the sheet's own controls and never leave it.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

console.log("Test 1: Tab moves forward and wraps to the first control");
assert(nextFocusIndex(0, 3, false) === 1, "first to second");
assert(nextFocusIndex(2, 3, false) === 0, "last wraps to first");

console.log("\nTest 2: Shift+Tab moves backward and wraps to the last");
assert(nextFocusIndex(1, 3, true) === 0, "second to first");
assert(nextFocusIndex(0, 3, true) === 2, "first wraps to last");

console.log("\nTest 3: from outside the controls, focus enters the sheet");
assert(nextFocusIndex(-1, 3, false) === 0, "Tab goes to the first control");
assert(nextFocusIndex(-1, 3, true) === 2, "Shift+Tab goes to the last");
assert(nextFocusIndex(-1, 0, false) === -1, "nothing to focus: -1");

console.log("\nTest 4: trapTab keeps focus inside the container");
{
  // Minimal stand-ins for the DOM objects trapTab uses.
  const focused: string[] = [];
  const controls = ["close", "call", "topic"].map((name) => ({
    name,
    focus: () => focused.push(name),
  }));
  let active: unknown = controls[2];
  const container = {
    querySelectorAll: () => controls,
    ownerDocument: {
      get activeElement() {
        return active;
      },
    },
  } as unknown as HTMLElement;
  let prevented = 0;
  const key = (key: string, shiftKey = false) =>
    ({
      key,
      shiftKey,
      preventDefault: () => {
        prevented += 1;
      },
    }) as unknown as KeyboardEvent;

  assert(trapTab(key("Tab"), container), "Tab is handled");
  assert(
    focused[focused.length - 1] === "close",
    "Tab on the last control wraps to Close",
  );
  assert(prevented === 1, "the browser's own Tab is prevented");

  active = controls[0];
  trapTab(key("Tab", true), container);
  assert(
    focused[focused.length - 1] === "topic",
    "Shift+Tab on the first control wraps to the last",
  );

  assert(!trapTab(key("Enter"), container), "other keys are left alone");
  assert(prevented === 2, "and not prevented");
}

console.log("\nAll focus trap tests passed.");
