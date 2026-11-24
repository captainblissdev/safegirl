import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import AnswerFeedback from "./components/AnswerFeedback";
import AnswerView from "./components/AnswerView";
import {
  FEEDBACK_ASK_AGAIN,
  FEEDBACK_NO,
  FEEDBACK_PERSON,
  FEEDBACK_QUESTION,
  FEEDBACK_SORRY,
  FEEDBACK_SORRY_RELATED,
  FEEDBACK_THANKS,
  FEEDBACK_YES,
} from "./content/uiText";
import { nextLoopCount, reachesLoopLimit } from "./loopLimit";
import type { AnyElement } from "./testHarness";
import { elements, harness, recordingStorage, textOf } from "./testHarness";

/**
 * "Did that help?" under a knowledge-base answer: the question and its
 * two buttons; "Yes, thanks" gives a thank-you; "Not quite" gives the
 * next steps (ask it another way, related questions, Talk to a person)
 * and is counted for the loop limit; nothing is sent or stored.
 *
 * Run: tsx src/answerFeedback.test.tsx
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

function setup(hasRelated = true) {
  const calls: string[] = [];
  const render = harness(AnswerFeedback, {
    hasRelated,
    onAskAgain: () => calls.push("askAgain"),
    onTalkToPerson: () => calls.push("person"),
    onNotHelpful: () => calls.push("notHelpful"),
  });
  return { calls, render };
}

const buttons = (tree: AnyElement) =>
  elements(tree).filter((el) => el.type === "button");

function tap(tree: AnyElement, label: string) {
  const button = buttons(tree).find(
    (el) => textOf(el.props.children) === label,
  );
  if (!button) throw new Error(`no button "${label}"`);
  (button.props.onClick as () => void)();
}

const statusText = (tree: AnyElement) =>
  elements(tree)
    .filter((el) => el.props.role === "status")
    .map((el) => textOf(el.props.children))
    .join(" ");

console.log("Test 1: the question and its two buttons, as a labelled section");
{
  const { render } = setup();
  const tree = render();
  const heading = elements(tree).find((el) => el.props.id === "feedback-title");
  assert(
    textOf(heading?.props.children) === FEEDBACK_QUESTION,
    "the label asks the question (a paragraph: the heading order is unchanged)",
  );
  assert(
    tree.props["aria-labelledby"] === heading?.props.id,
    "the section is labelled by it",
  );
  assert(
    buttons(tree)
      .map((b) => textOf(b.props.children))
      .join("|") === `${FEEDBACK_YES}|${FEEDBACK_NO}`,
    "Yes, thanks then Not quite",
  );
  assert(
    buttons(tree).every((b) => b.props.type === "button"),
    "both are plain buttons (no form submit)",
  );
}

console.log("Test 2: Yes, thanks gives the thank-you and calls nothing");
{
  const { calls, render } = setup();
  tap(render(), FEEDBACK_YES);
  const after = render();
  assert(
    statusText(after) === FEEDBACK_THANKS,
    "the thank-you is announced politely",
  );
  assert(buttons(after).length === 0, "no buttons are left");
  assert(calls.length === 0, "no callback runs (not counted, nothing sent)");
}

console.log("Test 3: Not quite gives the next steps and is counted once");
{
  const { calls, render } = setup(true);
  tap(render(), FEEDBACK_NO);
  const after = render();
  assert(
    statusText(after) === FEEDBACK_SORRY_RELATED,
    "points to the related questions when there are some",
  );
  assert(
    buttons(after)
      .map((b) => textOf(b.props.children))
      .join("|") === `${FEEDBACK_ASK_AGAIN}|${FEEDBACK_PERSON}`,
    "Ask it another way, then Talk to a person",
  );
  assert(calls.join(",") === "notHelpful", "onNotHelpful runs once");
}

console.log(
  "Test 4: with no related questions, the note does not mention them",
);
{
  const { render } = setup(false);
  tap(render(), FEEDBACK_NO);
  assert(statusText(render()) === FEEDBACK_SORRY, "the plain sorry note");
}

console.log("Test 5: the next steps call their actions");
{
  const { calls, render } = setup();
  tap(render(), FEEDBACK_NO);
  tap(render(), FEEDBACK_ASK_AGAIN);
  tap(render(), FEEDBACK_PERSON);
  assert(
    calls.join(",") === "notHelpful,askAgain,person",
    "ask again, then Talk to a person",
  );
}

console.log("Test 6: nothing is written to any browser store");
{
  const writes = recordingStorage(() => {
    const { render } = setup();
    tap(render(), FEEDBACK_NO);
    tap(render(), FEEDBACK_ASK_AGAIN);
    const other = setup();
    tap(other.render(), FEEDBACK_YES);
  });
  assert(
    writes.length === 0,
    "no localStorage, sessionStorage, IndexedDB or cookie write",
  );
}

console.log(
  "Test 7: on the answer screen, between the answer card and the related questions",
);
{
  const turn = {
    id: "a1",
    role: "assistant" as const,
    text: "An answer.",
    kind: "answer-scoped" as const,
    matchedQuestion: "Which birth control methods can a teenager use?",
    source: "A source",
  };
  const noop = () => undefined;
  const html = renderToStaticMarkup(
    <AnswerView
      turn={turn}
      onSend={noop}
      back={{ label: "Back to home", onBack: noop }}
      askBar={<div className="ask">ask</div>}
      feedback={{ onAskAgain: noop, onTalkToPerson: noop, onNotHelpful: noop }}
    />,
  );
  const card = html.indexOf('class="answer-card"');
  const feedback = html.indexOf('class="answer-feedback"');
  const related = html.indexOf('class="related"');
  assert(card >= 0 && feedback > card, "after the answer card");
  assert(related < 0 || feedback < related, "before the related questions");
  const without = renderToStaticMarkup(
    <AnswerView
      turn={turn}
      onSend={noop}
      back={{ label: "Back to home", onBack: noop }}
      askBar={<div className="ask">ask</div>}
    />,
  );
  assert(
    !without.includes("answer-feedback"),
    "absent when the chat passes no actions",
  );
}

console.log(
  "Test 8: Not quite counts toward the loop limit; an answer resets it",
);
{
  const app = read("./App.tsx");
  assert(
    /onNotHelpful=\{\(\) => \{[\s\S]*?loopCountRef\.current \+= 1;/.test(app),
    "App adds one to the loop count",
  );
  // Two vague replies, then a Not quite: the next vague reply is the third.
  let count = nextLoopCount(nextLoopCount(0, "vague"), "abstain");
  count += 1;
  assert(reachesLoopLimit(count), "three in a row reach the limit");
  assert(
    nextLoopCount(count, "answer-scoped") === 0,
    "an answer still resets the count",
  );
}

console.log("Test 9: Talk to a person replaces only that answer's screen");
{
  const chat = read("./components/ChatInterface.tsx");
  assert(
    chat.includes("personFor === lastTurn.id"),
    "shown only for the answer it was chosen on",
  );
  assert(
    chat.includes("onTalkToPerson: () => setPersonFor(lastTurn.id)"),
    "set from the answer's own id",
  );
  assert(
    chat.includes("onAskAgain: () => inputRef.current?.focus()"),
    "Ask it another way focuses the ask bar",
  );
}

console.log("All answer feedback tests passed.");
