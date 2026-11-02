import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import ChatInterface from "./components/ChatInterface";
import Splash from "./components/Splash";
import {
  SPLASH_TOPIC_STARTERS,
  splashStarter,
  toggleSplashChip,
} from "./content/uiText";

/**
 * The splash chips (splash refresh): a chosen chip's starter phrase is
 * put in the chat input when the user continues, editable and never sent;
 * no chip leaves the input empty; the choice lives in React state only
 * and nothing about it is stored in the browser.
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

console.log("Test 1: the five chips and their starter phrases");
{
  const expected: [string, string][] = [
    ["Periods", "I have a question about my period"],
    ["My body", "I have a question about my body"],
    ["Feelings", "I want to talk about my feelings"],
    ["Friends and boys", "I have a question about friends and boys"],
    ["Staying safe", "I want to know how to stay safe"],
  ];
  assert(
    JSON.stringify(SPLASH_TOPIC_STARTERS.map((c) => [c.label, c.starter])) ===
      JSON.stringify(expected),
    "the five chips with the agreed starter phrases",
  );
  for (const [label, starter] of expected) {
    assert(splashStarter(label) === starter, `${label}: its starter`);
  }
  assert(splashStarter(null) === "", "no chip: an empty starter");
  assert(splashStarter("Unknown") === "", "an unknown label: empty");
}

console.log("\nTest 2: tapping a chip chooses it; tapping it again clears it");
{
  assert(toggleSplashChip(null, "Feelings") === "Feelings", "choose");
  assert(toggleSplashChip("Feelings", "Feelings") === null, "clear");
  assert(
    toggleSplashChip("Feelings", "Periods") === "Periods",
    "another chip replaces the choice",
  );
}

console.log("\nTest 3: on continue, the input is prefilled; nothing is sent");
{
  for (const { label, starter } of SPLASH_TOPIC_STARTERS) {
    let sent = 0;
    let used = 0;
    const html = renderToStaticMarkup(
      <ChatInterface
        turns={[]}
        onSend={() => {
          sent += 1;
        }}
        isLoading={false}
        initialDraft={splashStarter(label)}
        onInitialDraftUsed={() => {
          used += 1;
        }}
      />,
    );
    assert(
      html.includes(`value="${escapeHtml(starter)}"`),
      `${label}: the input holds "${starter}"`,
    );
    assert(sent === 0, `${label}: nothing is sent`);
    assert(used === 0, `${label}: cleared only after the input has rendered`);
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
    "no chip (skip): the input is empty",
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
  const client = read("./api/client.ts");
  assert(
    !/starter|chip|SPLASH_/.test(client),
    "the gateway client knows nothing of the chips",
  );
}

console.log("\nTest 5: the choice is never stored in the browser");
{
  const storage =
    /localStorage|sessionStorage|document\.cookie|indexedDB|IDBFactory/;
  for (const file of [
    "./components/Splash.tsx",
    "./content/uiText.ts",
    "./components/ChatInterface.tsx",
  ]) {
    assert(!storage.test(read(file)), `${file} uses no browser storage`);
  }
  const app = read("./App.tsx");
  const starterLines = app
    .split("\n")
    .filter((line) => /starter/i.test(line))
    .join("\n");
  assert(
    !storage.test(starterLines),
    "App.tsx keeps the starter in React state only",
  );
  const html = renderToStaticMarkup(
    <Splash onContinue={() => undefined} onExit={() => undefined} />,
  );
  assert(
    html.split('aria-pressed="false"').length === 6 &&
      !html.includes('aria-pressed="true"'),
    "no chip is chosen when the splash opens",
  );
}

console.log("\nAll splash chip tests passed.");
