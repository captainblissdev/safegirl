import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import ChatInterface from "./components/ChatInterface";
import Splash from "./components/Splash";
import {
  SPLASH_EXAMPLE_QUESTIONS,
  splashStarter,
  toggleSplashChip,
} from "./content/uiText";
import { continueFromSplash, SPLASH_SEEN_KEY } from "./splashSession";

/**
 * The splash example questions (splash v3): a chosen question is put in
 * the chat input when the user continues, editable and never sent; none
 * chosen leaves the input empty; the choice lives in React state only.
 * The splash writes nothing to localStorage, sessionStorage, cookies or
 * IndexedDB; leaving it writes only the existing once-per-session flag
 * (splashSession.ts), never the chosen question.
 *
 * Run: tsx src/splashChips.test.tsx
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

console.log("Test 1: the three example questions");
{
  const expected = [
    "What is a normal period?",
    "What changes happen during puberty?",
    "What can I do about period pain?",
  ];
  assert(
    JSON.stringify(SPLASH_EXAMPLE_QUESTIONS) === JSON.stringify(expected),
    "the three agreed questions, in order",
  );
  for (const question of expected) {
    assert(splashStarter(question) === question, `${question}: itself`);
  }
  assert(splashStarter(null) === "", "none chosen: an empty starter");
  assert(splashStarter("Something else?") === "", "an unknown text: empty");
}

console.log("\nTest 2: tapping a question chooses it; tapping again clears it");
{
  const [a, b] = SPLASH_EXAMPLE_QUESTIONS;
  assert(toggleSplashChip(null, a) === a, "choose");
  assert(toggleSplashChip(a, a) === null, "clear");
  assert(toggleSplashChip(a, b) === b, "another question replaces it");
}

console.log("\nTest 3: on continue, the input is prefilled; nothing is sent");
{
  for (const question of SPLASH_EXAMPLE_QUESTIONS) {
    let sent = 0;
    let used = 0;
    const html = renderToStaticMarkup(
      <ChatInterface
        turns={[]}
        onSend={() => {
          sent += 1;
        }}
        isLoading={false}
        initialDraft={splashStarter(question)}
        onInitialDraftUsed={() => {
          used += 1;
        }}
      />,
    );
    assert(
      html.includes(`value="${escapeHtml(question)}"`),
      `the input holds "${question}"`,
    );
    assert(sent === 0, `${question}: nothing is sent`);
    assert(used === 0, `${question}: cleared only after the input rendered`);
  }
  const empty = renderToStaticMarkup(
    <ChatInterface
      turns={[]}
      onSend={() => {
        throw new Error("sent");
      }}
      isLoading={false}
      initialDraft={splashStarter(null)}
    />,
  );
  assert(
    !/<input[^>]*value="[^"]+"/.test(empty),
    "none chosen (skip): the input is empty",
  );
}

console.log("\nTest 4: the wiring sends nothing and routes nothing");
{
  const app = read("./App.tsx");
  const handler = app.slice(
    app.indexOf("const handleSplashContinue = (starter: string) => {"),
    app.indexOf("};", app.indexOf("const handleSplashContinue")) + 2,
  );
  assert(
    handler.includes("setStarterDraft(starter);") &&
      handler.includes("setScreen(continueFromSplash(browserSessionStorage));"),
    "continue only keeps the starter and leaves the splash",
  );
  assert(
    !/askFromChat|onSend|query|fetch|setTopic|openTopic/.test(handler),
    "continue sends no query and opens no topic",
  );
  assert(
    app.includes("initialDraft={starterDraft}") &&
      app.includes('onInitialDraftUsed={() => setStarterDraft("")}'),
    "the chat input gets the starter once, then App clears it",
  );
  const splash = read("./components/Splash.tsx");
  assert(
    splash.includes("onClick={() => onContinue(starter)}") &&
      !/onSend|fetch\(|topic=|intent/.test(splash),
    "the splash passes only the starter text: no request, topic or intent",
  );
  assert(
    !/starter|chip|SPLASH_/.test(read("./api/client.ts")),
    "the gateway client knows nothing of the splash questions",
  );
}

console.log("\nTest 5: the splash writes nothing to browser storage");
{
  // Recording fakes for every browser store, installed before rendering.
  const writes: string[] = [];
  const store = (name: string) => ({
    getItem: () => null,
    setItem: (key: string) => writes.push(`${name}.setItem(${key})`),
    removeItem: (key: string) => writes.push(`${name}.removeItem(${key})`),
    clear: () => writes.push(`${name}.clear()`),
    key: () => null,
    length: 0,
  });
  const g = globalThis as Record<string, unknown>;
  const saved = ["localStorage", "sessionStorage", "indexedDB", "document"].map(
    (k) => [k, g[k]] as const,
  );
  g.localStorage = store("localStorage");
  g.sessionStorage = store("sessionStorage");
  g.indexedDB = {
    open: (name: string) => writes.push(`indexedDB.open(${name})`),
    deleteDatabase: (name: string) => writes.push(`indexedDB.delete(${name})`),
  };
  g.document = {
    get cookie() {
      return "";
    },
    set cookie(value: string) {
      writes.push(`document.cookie=${value}`);
    },
  };
  try {
    for (const hour of [8, 14, 21]) {
      renderToStaticMarkup(
        <Splash
          onContinue={() => undefined}
          onExit={() => undefined}
          now={new Date(2026, 10, 2, hour)}
        />,
      );
    }
    assert(writes.length === 0, "rendering the splash writes nothing");
  } finally {
    for (const [k, v] of saved) {
      g[k] = v;
    }
  }

  const storage =
    /localStorage|sessionStorage|document\.cookie|indexedDB|IDBFactory/;
  for (const file of [
    "./components/Splash.tsx",
    "./content/uiText.ts",
    "./components/ChatInterface.tsx",
  ]) {
    assert(!storage.test(read(file)), `${file} uses no browser storage`);
  }
  const starterLines = read("./App.tsx")
    .split("\n")
    .filter((line) => /starter/i.test(line))
    .join("\n");
  assert(
    !storage.test(starterLines),
    "App.tsx keeps the chosen question in React state only",
  );

  // Leaving the splash: the existing once-per-session flag, nothing else.
  const leaveWrites: [string, string][] = [];
  continueFromSplash(() => ({
    getItem: () => null,
    setItem: (key: string, value: string) => leaveWrites.push([key, value]),
  }));
  assert(
    JSON.stringify(leaveWrites) === JSON.stringify([[SPLASH_SEEN_KEY, "1"]]),
    `continue writes only the existing flag (${SPLASH_SEEN_KEY} = "1"), never the question`,
  );
  const html = renderToStaticMarkup(
    <Splash onContinue={() => undefined} onExit={() => undefined} />,
  );
  assert(
    html.split('aria-pressed="false"').length === 4 &&
      !html.includes('aria-pressed="true"'),
    "no question is chosen when the splash opens",
  );
}

console.log("\nAll splash chip tests passed.");
