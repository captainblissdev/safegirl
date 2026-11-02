import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createQueryClient } from "./api/client";
import AskBar from "./components/AskBar";
import BandTopbar from "./components/BandTopbar";
import TopicList from "./components/TopicList";
import { questionsFor } from "./content/kbQuestions";
import { TOPICS, type Topic } from "./content/topics";
import {
  elements,
  harness,
  recordingStorage,
  type AnyElement,
} from "./testHarness";

/**
 * Topic list (T1) tap behaviour, unchanged by the restyle: a tapped
 * question hands its exact text and its entry id to onAsk; App sets the
 * topic, the entry id and the "tapped" marker as before and sends the
 * text alone through the full pipeline; the ask bar still works; and
 * the Topic list writes nothing to browser storage.
 *
 * Run: tsx src/topicTap.test.tsx
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

type Props = Parameters<typeof TopicList>[0];
type Call = [string, string | null];

/** A Topic list with stand-in hooks, logging every onAsk call. */
function topicPage(topic: Topic, calls: Call[]) {
  return harness(TopicList, {
    topic,
    onAsk: (text, id) => calls.push([text, id]),
    onBack: () => undefined,
  } satisfies Props);
}

/** Tap the row for this entry id, as a finger would. */
function tap(tree: AnyElement, id: string) {
  // Rows are QuestionRow elements (no hooks): call one to get its button.
  const row = elements(tree).find(
    (el) => (el.props.item as { id?: string } | undefined)?.id === id,
  );
  if (!row) throw new Error(`no row for ${id}`);
  const li = (row.type as (p: unknown) => AnyElement)(row.props);
  const button = elements(li).find((el) => el.type === "button")!;
  assert(
    button.props["data-question"] === id,
    `${id}: the row's button carries its entry id`,
  );
  (button.props.onClick as () => void)();
}

const byTopic = (cls: string) => TOPICS.find((t) => t.topicClass === cls)!;

console.log("Test 1: a tapped question hands its exact text and entry id");
{
  const cases: [string, string[]][] = [
    ["sti", questionsFor("sti").map((q) => q.id)],
    ["general", [questionsFor("general")[0].id]],
    ["pregnancy", [questionsFor("pregnancy")[0].id]],
    ["contraception", [questionsFor("contraception")[0].id]],
  ];
  assert(cases[0][1].length === 5, "all five STI questions are checked");
  for (const [cls, ids] of cases) {
    const topic = byTopic(cls);
    for (const id of ids) {
      const calls: Call[] = [];
      tap(topicPage(topic, calls)(), id);
      const entry = questionsFor(topic.topicClass).find((q) => q.id === id)!;
      assert(
        calls.length === 1 &&
          calls[0][0] === entry.question &&
          calls[0][1] === id,
        `${topic.label}, ${id}: onAsk(exact question text, "${id}"), once`,
      );
    }
  }
}

console.log(
  "\nTest 2: App sets the topic, entry id and tapped marker as before",
);
{
  const app = read("./App.tsx");
  const askFromTopic = app.slice(
    app.indexOf(
      "const askFromTopic = (text: string, questionId: string | null) => {",
    ),
    app.indexOf("};", app.indexOf("const askFromTopic")) + 2,
  );
  assert(
    askFromTopic.includes("if (topic) setAnswerOrigin({ topic, questionId });"),
    "the topic and the tapped entry id are kept for the back link and focus",
  );
  assert(
    askFromTopic.includes('setScreen("chat");') &&
      /void handleSend\(\s*text,\s*questionId === null \? "typed" : "tapped",?\s*\);/.test(
        askFromTopic,
      ),
    'a row is sent as "tapped", the ask bar as "typed", through handleSend',
  );
  assert(
    !/questionId[^=]*(submitQuery|fetch)|submitQuery\([^)]*questionId/.test(
      app,
    ) && app.includes("submitQuery(text, { signal: request.signal })"),
    "handleSend submits the text only: the entry id is never sent",
  );
  assert(
    /const botTurn: ChatTurn = \{[\s\S]*?\n\s*via,\n/.test(app),
    "the reply carries the via marker",
  );
  assert(
    app.includes("label: `Back to ${answerOrigin.topic.label}`") &&
      app.includes("focusQuestionId={answerOrigin?.questionId ?? null}"),
    "the answer's back link names the topic and returns focus to the tapped row",
  );
  assert(
    read("./components/TopicList.tsx").includes(
      "onClick={() => onAsk(item.question, item.id)}",
    ),
    "the row's handler is the same as before",
  );
}

console.log("\nTest 3: the request body is the text alone");
{
  const bodies: string[] = [];
  const urls: string[] = [];
  const submit = createQueryClient({
    fetch: (url, init) => {
      urls.push(url);
      bodies.push(typeof init.body === "string" ? init.body : "(not a string)");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ outcome: "grounded_answer", message: "m" }),
      });
    },
    getToken: () => Promise.resolve("token"),
    isOnline: () => true,
    offline: () => ({
      outcome: "grounded_answer",
      message: "offline",
      generationInvoked: false,
    }),
    isNetworkError: () => false,
  });
  const tapped = questionsFor("sti").map((q) => q.question);
  for (const text of tapped) await submit(text);
  assert(
    urls.every((u) => u === "/api/query") &&
      JSON.stringify(bodies) ===
        JSON.stringify(tapped.map((text) => JSON.stringify({ text }))),
    "each tapped question posts {text} to /api/query, with no id or topic",
  );
}

console.log("\nTest 4: the ask bar still works");
{
  const calls: Call[] = [];
  const render = topicPage(byTopic("sti"), calls);
  const bar = () => elements(render()).find((el) => el.type === AskBar)!;
  const sendDisabled = () =>
    renderToStaticMarkup(bar() as never).includes(
      'disabled="" aria-label="Ask"',
    );
  assert(sendDisabled(), "Send is disabled while the field is empty");
  (bar().props.onChange as (v: string) => void)("   ");
  assert(sendDisabled(), "and while it holds only spaces");
  (bar().props.onSubmit as () => void)();
  assert(calls.length === 0, "spaces only: nothing is sent");
  (bar().props.onChange as (v: string) => void)("  is this normal?  ");
  assert(!sendDisabled(), "Send is enabled once there is text");
  (bar().props.onSubmit as () => void)();
  assert(
    JSON.stringify(calls) === JSON.stringify([["is this normal?", null]]),
    "it hands the trimmed text, with no entry id, to the same onAsk",
  );
  const props = bar().props;
  assert(
    props.variant === "pill" &&
      props.placeholder === "Or type your own question" &&
      props.disabled === false,
    'the existing pill: "Or type your own question"',
  );
}

console.log("\nTest 5: the Topic list writes nothing to browser storage");
{
  const calls: Call[] = [];
  const writes = recordingStorage(() => {
    for (const topic of TOPICS) {
      renderToStaticMarkup(
        <TopicList
          topic={topic}
          onAsk={() => undefined}
          onBack={() => undefined}
        />,
      );
      const render = topicPage(topic, calls);
      for (const q of questionsFor(topic.topicClass)) tap(render(), q.id);
      const tree = render();
      const bar = elements(tree).find((el) => el.type === AskBar)!;
      (bar.props.onChange as (v: string) => void)("typed");
      (
        elements(render()).find((el) => el.type === AskBar)!.props
          .onSubmit as () => void
      )();
      const top = elements(tree).find((el) => el.type === BandTopbar)!;
      (top.props.onOpenHelp as () => void)();
      (top.props.onExit as () => void)();
      for (const el of elements(tree)) {
        if (el.props.className === "topic-back")
          (el.props.onClick as () => void)();
      }
    }
  });
  assert(calls.length > 21, "every row and the ask bar were used");
  assert(
    writes.length === 0,
    "rendering and using every Topic list writes nothing to localStorage, sessionStorage, cookies or IndexedDB",
  );
  for (const file of ["./components/TopicList.tsx", "./content/topics.ts"]) {
    assert(
      !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(
        read(file),
      ),
      `${file} names no browser storage`,
    );
  }
}

console.log("\nAll topic tap tests passed.");
