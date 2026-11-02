import { readFileSync } from "node:fs";
import * as React from "react";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clearAndLeave } from "./clearAndLeave";
import BandTopbar from "./components/BandTopbar";
import Home from "./components/Home";
import ChatInterface from "./components/ChatInterface";
import { HOME_EXAMPLE_QUESTIONS } from "./content/uiText";
import {
  continueFromSplash,
  SPLASH_SEEN_KEY,
  startScreen,
} from "./splashSession";

/**
 * Home (H1) behaviour: a suggestion fills the textarea and never sends;
 * "Hide suggestions" is React state only; Send is disabled until there
 * is text; "Clear and leave" empties the chat state, forgets the splash
 * flag and lands on the splash; and Home writes nothing to localStorage,
 * sessionStorage (other than the existing splash flag), cookies or
 * IndexedDB.
 *
 * There is no DOM library here: Home is called with a minimal stand-in
 * for React's hooks (useState, useRef, useEffect), and its buttons'
 * handlers are called directly, as a tap would.
 *
 * Run: tsx src/home.test.tsx
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

type Props = Parameters<typeof Home>[0];
type AnyElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

/**
 * Calls Home as a function with stand-in hooks. State and refs persist
 * across renders of the same harness; effects are not run (as on the
 * server). Returns the element tree of each render.
 */
function harness(props: Props) {
  const internals = (
    React as unknown as {
      __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
        ReactCurrentDispatcher: { current: unknown };
      };
    }
  ).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const slots: unknown[] = [];
  let cursor = 0;
  const dispatcher = {
    useState: (initial: unknown) => {
      const i = cursor++;
      if (!(i in slots)) {
        slots[i] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      }
      const set = (next: unknown) => {
        slots[i] =
          typeof next === "function"
            ? (next as (current: unknown) => unknown)(slots[i])
            : next;
      };
      return [slots[i], set];
    },
    useRef: (initial: unknown) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect: () => undefined,
  };
  return (next: Partial<Props> = {}) => {
    cursor = 0;
    const saved = internals.ReactCurrentDispatcher.current;
    internals.ReactCurrentDispatcher.current = dispatcher;
    try {
      return Home({ ...props, ...next }) as AnyElement;
    } finally {
      internals.ReactCurrentDispatcher.current = saved;
    }
  };
}

/** Every element in the tree (Home's own markup; children not rendered). */
function elements(node: ReactNode): AnyElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const el = node as AnyElement;
  return [el, ...elements(el.props.children)];
}

const byClass = (tree: AnyElement, name: string) =>
  elements(tree).filter((el) => el.props.className === name);
const textOf = (node: ReactNode): string =>
  Array.isArray(node)
    ? node.map(textOf).join("")
    : typeof node === "string"
      ? node
      : React.isValidElement(node)
        ? textOf((node as AnyElement).props.children)
        : "";

/** Recording fakes for every browser store, installed for fn. */
function recordingStorage(fn: () => void): string[] {
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
  const keys = ["localStorage", "sessionStorage", "indexedDB", "document"];
  const saved = keys.map((k) => [k, g[k]] as const);
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
    fn();
  } finally {
    for (const [k, v] of saved) g[k] = v;
  }
  return writes;
}

/** Home's props, with a log of every callback it makes. */
function homeProps(log: string[], draft = ""): Props {
  return {
    draft,
    onDraftChange: (value) => log.push(`draft:${value}`),
    onSubmit: () => log.push("submit"),
    isLoading: false,
    onTopic: (topic) => log.push(`topic:${topic.topicClass}`),
    onOpenHelp: () => log.push("help"),
    isHelpOpen: false,
    onExit: () => log.push("exit"),
    onClearAndLeave: () => log.push("clear"),
  };
}

console.log("Test 1: a suggestion fills the question and never sends");
{
  const log: string[] = [];
  const render = harness(homeProps(log));
  const chips = byClass(render(), "home-chip");
  assert(chips.length === 2, "two suggestion chips");
  for (const [i, chip] of chips.entries()) {
    assert(
      chip.props.type === "button",
      `chip ${i + 1} is not a submit button`,
    );
    (chip.props.onClick as () => void)();
  }
  assert(
    JSON.stringify(log) ===
      JSON.stringify(HOME_EXAMPLE_QUESTIONS.map((q) => `draft:${q}`)),
    "each tap puts its question in the field, replacing what was there",
  );
  assert(!log.includes("submit"), "nothing is sent");
  const html = renderToStaticMarkup(<Home {...homeProps([])} />);
  assert(
    html.indexOf('class="home-chips"') > html.indexOf("</form>"),
    "the chips are outside the question form, so they cannot submit it",
  );
  // In the chat: the chip's text becomes the draft, and no query is sent.
  let sent = 0;
  const chat = renderToStaticMarkup(
    <ChatInterface
      turns={[]}
      onSend={() => {
        sent += 1;
      }}
      isLoading={false}
      initialDraft={HOME_EXAMPLE_QUESTIONS[0]}
    />,
  );
  assert(
    chat.includes(">Will the clinic tell my parents?</textarea>") && sent === 0,
    "a filled question sits in the textarea, unsent",
  );
}

console.log("\nTest 2: Hide suggestions is React state only, for this visit");
{
  const log: string[] = [];
  let render = harness(homeProps(log));
  const writes = recordingStorage(() => {
    const first = render();
    const link = byClass(first, "home-link")[0];
    assert(
      textOf(link.props.children) === "Hide suggestions" &&
        link.props["aria-expanded"] === true &&
        byClass(first, "home-chips")[0].props.hidden === false,
      "suggestions shown at first, with a Hide link",
    );
    (link.props.onClick as () => void)();
    const hidden = render();
    const showLink = byClass(hidden, "home-link")[0];
    assert(
      textOf(showLink.props.children) === "Show suggestions" &&
        showLink.props["aria-expanded"] === false &&
        byClass(hidden, "home-chips")[0].props.hidden === true,
      'after Hide: the chips are hidden and the link reads "Show suggestions"',
    );
    (showLink.props.onClick as () => void)();
    const shown = render();
    assert(
      textOf(byClass(shown, "home-link")[0].props.children) ===
        "Hide suggestions" &&
        byClass(shown, "home-chips")[0].props.hidden === false,
      "Show brings them back",
    );
    (byClass(shown, "home-link")[0].props.onClick as () => void)();
  });
  assert(writes.length === 0, "hiding and showing writes nothing anywhere");
  assert(log.length === 0, "and calls nothing outside Home");
  // A new visit (Home mounted again) starts with the suggestions shown.
  render = harness(homeProps([]));
  assert(
    byClass(render(), "home-chips")[0].props.hidden === false,
    "a new visit shows the suggestions again (nothing remembered)",
  );
  assert(
    !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(
      read("./components/Home.tsx"),
    ),
    "Home.tsx touches no browser storage",
  );
}

console.log("\nTest 3: Send is disabled until there is a non-space character");
{
  const send = (draft: string, isLoading = false) =>
    byClass(
      harness({ ...homeProps([], draft), isLoading })(),
      "btn-home-send",
    )[0].props.disabled as boolean;
  assert(send(""), "empty: disabled");
  assert(send("  \n\t "), "spaces and new lines only: disabled");
  assert(!send(" a "), "any other character: enabled");
  assert(send("is this normal?", true), "while a reply loads: disabled");
  // Enter sends (as before); Shift+Enter is a new line.
  const log: string[] = [];
  const field = elements(harness(homeProps(log, "hi"))()).find(
    (el) => el.type === "textarea",
  )!;
  const key = (key: string, shiftKey = false) => {
    let prevented = false;
    (field.props.onKeyDown as (e: unknown) => void)({
      key,
      shiftKey,
      nativeEvent: { isComposing: false },
      preventDefault: () => {
        prevented = true;
      },
    });
    return prevented;
  };
  assert(key("Enter") && log.join() === "submit", "Enter sends");
  assert(
    !key("Enter", true) && log.join() === "submit",
    "Shift+Enter does not",
  );
  assert(!key("a") && log.join() === "submit", "other keys do not");
}

console.log("\nTest 4: Clear and leave");
{
  const log: string[] = [];
  const clear = byClass(harness(homeProps(log))(), "home-clear")[0];
  (clear.props.onClick as () => void)();
  assert(
    log.join() === "clear",
    "the button calls Clear and leave, nothing else",
  );

  // The helper: App's state first, then only the splash flag.
  const steps: string[] = [];
  const session = new Map([
    [SPLASH_SEEN_KEY, "1"],
    ["other", "kept"],
  ]);
  const store = {
    getItem: (k: string) => session.get(k) ?? null,
    setItem: (k: string, v: string) => void session.set(k, v),
    removeItem: (k: string) => {
      steps.push(`remove:${k}`);
      session.delete(k);
    },
  };
  assert(startScreen(() => store) === "chat", "before: the splash was seen");
  clearAndLeave({
    clearState: () => steps.push("clearState"),
    getSessionStorage: () => store,
  });
  assert(
    JSON.stringify(steps) ===
      JSON.stringify(["clearState", `remove:${SPLASH_SEEN_KEY}`]),
    "it clears App's state, then removes the splash flag only",
  );
  assert(
    !session.has(SPLASH_SEEN_KEY) && session.get("other") === "kept",
    "the flag is gone; nothing else in sessionStorage is touched",
  );
  assert(
    startScreen(() => store) === "splash",
    "so the splash shows again (and on a reload of this tab)",
  );
  continueFromSplash(() => store);
  assert(
    startScreen(() => store) === "chat",
    "continuing from it works as before",
  );
  for (const blocked of [
    () => null,
    () => {
      throw new Error("blocked");
    },
  ]) {
    let cleared = false;
    clearAndLeave({
      clearState: () => {
        cleared = true;
      },
      getSessionStorage: blocked,
    });
    assert(cleared, "blocked storage never stops it");
  }

  // App: what clearState resets, and where it lands. Not a redirect.
  const app = read("./App.tsx");
  const handler = app.slice(
    app.indexOf("const handleClearAndLeave = () =>"),
    app.indexOf("getSessionStorage:", app.indexOf("const handleClearAndLeave")),
  );
  for (const step of [
    "cancelPending();",
    "loopCountRef.current = 0;",
    "setTurns([]);",
    'setReferralMessage("");',
    "setError(null);",
    "setIsHelpOpen(false);",
    "setTopic(null);",
    "setAnswerOrigin(null);",
    'setStarterDraft("");',
    'setScreen("splash");',
  ]) {
    assert(handler.includes(step), `Clear and leave runs ${step}`);
  }
  assert(
    !/replace|location|EXIT_URL|\.clear\(\)/.test(handler) &&
      !/location|replace\(/.test(read("./clearAndLeave.ts")),
    "it stays on SafeGirl: no redirect, no sessionStorage.clear()",
  );
  assert(
    app.includes("onClearAndLeave={handleClearAndLeave}"),
    "Home's button is wired to it",
  );
}

console.log("\nTest 5: Home writes nothing to browser storage");
{
  const log: string[] = [];
  const writes = recordingStorage(() => {
    for (const hour of [8, 14, 21]) {
      renderToStaticMarkup(
        <Home {...homeProps([])} now={new Date(2026, 10, 2, hour)} />,
      );
    }
    renderToStaticMarkup(
      <ChatInterface turns={[]} onSend={() => undefined} isLoading={false} />,
    );
    const render = harness(homeProps(log, "typed"));
    const tree = render();
    for (const el of elements(tree)) {
      const click = el.props.onClick as (() => void) | undefined;
      if (click && el.props.className !== "home-clear") click();
      // The band's top row (BandTopbar): "Get help" and Quick exit.
      if (el.type === BandTopbar) {
        (el.props.onOpenHelp as () => void)();
        (el.props.onExit as () => void)();
      }
    }
    (
      elements(tree).find((el) => el.type === "textarea")!.props.onChange as (
        e: unknown,
      ) => void
    )({ target: { value: "a question" } });
    render();
  });
  assert(
    log.includes("submit") === false &&
      log.includes("draft:a question") &&
      log.includes("help") &&
      log.includes("exit") &&
      log.filter((l) => l.startsWith("topic:")).length === 4,
    "every control was used (chips, Hide, Get help, Quick exit, topics, support)",
  );
  assert(
    writes.length === 0,
    "rendering and using Home writes nothing to localStorage, sessionStorage, cookies or IndexedDB",
  );
  const sessionWrites = recordingStorage(() =>
    clearAndLeave({
      clearState: () => undefined,
      getSessionStorage: () => globalThis.sessionStorage,
    }),
  );
  assert(
    JSON.stringify(sessionWrites) ===
      JSON.stringify([`sessionStorage.removeItem(${SPLASH_SEEN_KEY})`]),
    "Clear and leave touches only the existing splash flag",
  );
  for (const file of ["./components/Home.tsx", "./clearAndLeave.ts"]) {
    assert(
      !/localStorage|indexedDB|IDBFactory|document\.cookie/.test(read(file)),
      `${file} never names localStorage, cookies or IndexedDB`,
    );
  }
}

console.log("\nAll home tests passed.");
