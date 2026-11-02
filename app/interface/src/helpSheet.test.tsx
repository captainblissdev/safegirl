import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import HelpSheet from "./components/HelpSheet";
import { FOCUSABLE_SELECTOR, nextFocusIndex } from "./focusTrap";
import { createEscapeRouter, returnFocusTarget } from "./helpSheet";
import { DOUBLE_ESCAPE_WINDOW_MS } from "./quickExit";
import { byClass, elements, harness, textOf } from "./testHarness";

/**
 * The Help sheet's dialog behaviour (HS1): its labels; focus moves to the
 * close button on open, is trapped inside, and returns to the control
 * that opened it on close; one Escape closes it; double Escape exits only
 * while it is closed.
 *
 * Run: tsx src/helpSheet.test.tsx
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

/** A router on a fake clock, recording what it did. */
function router(open: { value: boolean }) {
  let time = 0;
  const log: string[] = [];
  const route = createEscapeRouter({
    isHelpOpen: () => open.value,
    onCloseHelp: () => {
      log.push("close");
      open.value = false;
    },
    onExit: () => log.push("exit"),
    now: () => time,
  });
  const press = (after = 100, inSheet = false, key = "Escape") => {
    time += after;
    const result = route(key, inSheet);
    // The sheet closes itself on an Escape inside it.
    if (result === "close-help" && inSheet) open.value = false;
    return result;
  };
  return { press, log };
}

console.log("Test 1: labels and roles");
{
  const html = renderToStaticMarkup(
    <HelpSheet onClose={() => undefined} onExit={() => undefined} />,
  );
  assert(
    html.startsWith(
      '<div class="help-sheet" role="dialog" aria-modal="true" aria-labelledby="help-sheet-title">',
    ) &&
      html.includes(
        '<h1 id="help-sheet-title" class="help-title">Get help</h1>',
      ),
    'role="dialog", aria-modal, labelled by the h1 "Get help"',
  );
  assert(
    html.includes(
      '<button class="btn-help-close" type="button" aria-label="Close help">',
    ),
    'the close button is named "Close help"',
  );
  assert(
    html.includes(
      '<button class="help-how-toggle" type="button" aria-expanded="false" aria-controls="help-how-body">',
    ),
    '"How SafeGirl works" exposes its state (aria-expanded) and what it controls',
  );
}

console.log("\nTest 2: focus moves in, is trapped, and starts on close");
{
  const sheet = read("./components/HelpSheet.tsx");
  assert(
    /useEffect\(\(\) => \{\s*closeRef\.current\?\.focus\(\);\s*\}, \[\]\);/.test(
      sheet,
    ) && sheet.includes("ref={closeRef}"),
    "on open, focus moves to the close button (the first control reached)",
  );
  assert(
    sheet.includes("trapTab(event.nativeEvent, sheetRef.current);") &&
      sheet.includes("onKeyDown={onKeyDown}"),
    "Tab and Shift+Tab are kept inside the sheet (focusTrap.ts)",
  );
  // The sheet's controls in Tab order, as trapTab sees them.
  const html = renderToStaticMarkup(
    <HelpSheet onClose={() => undefined} onExit={() => undefined} />,
  );
  const controls = [...html.matchAll(/<(a|button)\s[^>]*class="([^"]+)"/g)].map(
    (m) => m[2],
  );
  assert(
    JSON.stringify(controls) ===
      JSON.stringify([
        "btn-help-exit",
        "btn-help-close",
        "help-danger-call",
        "help-danger-call",
        "help-line-call",
        "help-line-call",
        "help-how-toggle",
      ]),
    "seven controls: Quick exit, close, 999, 112, 1195, 116, How it works",
  );
  const n = controls.length;
  const close = controls.indexOf("btn-help-close");
  assert(
    nextFocusIndex(n - 1, n, false) === 0 &&
      nextFocusIndex(0, n, true) === n - 1 &&
      nextFocusIndex(close, n, false) === close + 1 &&
      nextFocusIndex(close, n, true) === 0,
    "Tab from the last control wraps to the first, Shift+Tab the other way; from close, Shift+Tab reaches Quick exit",
  );
  assert(
    FOCUSABLE_SELECTOR.includes("a[href]") &&
      FOCUSABLE_SELECTOR.includes("button:not([disabled])"),
    "the trap counts links and buttons",
  );
}

console.log("\nTest 3: the sheet's own handlers");
{
  const log: string[] = [];
  const render = harness(HelpSheet, {
    onClose: () => log.push("close"),
    onExit: () => log.push("exit"),
  });
  const tree = render();
  (byClass(tree, "btn-help-close")[0].props.onClick as () => void)();
  (byClass(tree, "btn-help-exit")[0].props.onClick as () => void)();
  assert(
    log.join() === "close,exit",
    "the close button closes; Quick exit exits (quickExit.ts)",
  );
  const sheet = elements(tree).find((el) => el.props.role === "dialog")!;
  const key = (k: string) =>
    (sheet.props.onKeyDown as (e: unknown) => void)({
      key: k,
      nativeEvent: { key: k },
    });
  log.length = 0;
  key("Escape");
  assert(log.join() === "close", "Escape inside the sheet closes it, once");
  key("a");
  assert(log.join() === "close", "other keys do not");
  // How SafeGirl works: closed, then open, then closed.
  const toggle = () => byClass(render(), "help-how-toggle")[0];
  const body = () =>
    elements(render()).find((el) => el.props.id === "help-how-body")!;
  assert(
    toggle().props["aria-expanded"] === false && body().props.hidden === true,
    "How SafeGirl works is closed when the sheet opens",
  );
  (toggle().props.onClick as () => void)();
  assert(
    toggle().props["aria-expanded"] === true &&
      body().props.hidden === false &&
      textOf(body().props.children).includes("Tips for asking"),
    "one tap opens it (aria-expanded true): the three paragraphs and the tips",
  );
  (toggle().props.onClick as () => void)();
  assert(
    toggle().props["aria-expanded"] === false && body().props.hidden === true,
    "a second tap closes it",
  );
}

console.log("\nTest 4: Escape while the sheet is open");
{
  const open = { value: true };
  const { press, log } = router(open);
  assert(
    press(100, false) === "close-help" && log.join() === "close",
    "one Escape closes it even with focus outside the sheet",
  );
  open.value = true;
  log.length = 0;
  assert(
    press(100, true) === "close-help" && log.length === 0,
    "an Escape inside the sheet is left to the sheet (not closed twice)",
  );
  open.value = true;
  log.length = 0;
  press(100, true);
  open.value = true;
  press(100, true);
  assert(
    !log.includes("exit"),
    "two quick Escapes while it is open never exit",
  );
}

console.log("\nTest 5: double Escape exits only while the sheet is closed");
{
  const open = { value: true };
  const { press, log } = router(open);
  press(100, true); // closes the sheet
  assert(
    press(200) === "none" && !log.includes("exit"),
    "the closing Escape does not count: one more Escape does not exit",
  );
  assert(
    press(200) === "exit" && log.filter((l) => l === "exit").length === 1,
    "two Escapes within the window, with the sheet closed, exit once",
  );
  const slow = router({ value: false });
  slow.press(100);
  assert(
    slow.press(DOUBLE_ESCAPE_WINDOW_MS + 1) === "none" &&
      !slow.log.includes("exit"),
    "two Escapes further apart than the window do not exit",
  );
  const single = router({ value: false });
  assert(
    single.press(100) === "none" && single.log.length === 0,
    "a single Escape with the sheet closed does nothing",
  );
  const other = router({ value: false });
  other.press(100);
  other.press(100, false, "a");
  assert(
    other.press(100) === "none",
    "another key between two Escapes starts over",
  );
}

console.log("\nTest 6: focus returns to the control that opened the sheet");
{
  const el = (name: string, isConnected = true) => ({ name, isConnected });
  const opener = el("Feelings and staying safe");
  const band = el("band Get help");
  const header = el("header Help");
  assert(
    returnFocusTarget(opener, band, header) === opener,
    "the opener, when it is still on the page",
  );
  assert(
    returnFocusTarget(el("old header Help", false), null, header) === header,
    "the header's Help button (replaced while the sheet was open): its new copy",
  );
  assert(
    returnFocusTarget(null, band, header) === band,
    "no opener: the band's Get help",
  );
  assert(
    returnFocusTarget(null, null, null) === null,
    "nothing to focus: nothing",
  );
  const app = read("./App.tsx");
  assert(
    app.includes("restoreFocusRef.current = true;") &&
      app.includes("helpOpenerRef.current =") &&
      app.includes("returnFocusTarget<HTMLElement>("),
    "App records the opener on open and returns focus to it after closing",
  );
  assert(
    !/history\.(push|replace)State|popstate|location\.hash/.test(app) &&
      !/history\.|geolocation/.test(read("./components/HelpSheet.tsx")),
    "no history API and no location use",
  );
}

console.log("\nAll Help sheet tests passed.");
