import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createQueryClient, type QueryClientDeps } from "./api/client";
import AnswerView from "./components/AnswerView";
import { FOLLOW_UP_LABEL } from "./content/uiText";
import type { ChatTurn, QueryResponse } from "./types";

/**
 * Follow-up context in the interface: the client adds the previous
 * answer's knowledge-base question to the request only when it is given
 * (the body is otherwise unchanged); App gives it only for a typed
 * message right after an answer; the answer screen shows how the gateway
 * read the follow-up, and nothing when it did not.
 *
 * Run: tsx src/followUpContext.test.tsx
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const ANSWER: QueryResponse = {
  outcome: "grounded_answer",
  message: "online answer",
  generationInvoked: false,
};

function client() {
  const bodies: unknown[] = [];
  const deps: QueryClientDeps = {
    fetch: (_url, init) => {
      bodies.push(JSON.parse(init.body as string));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(ANSWER),
      });
    },
    getToken: () => Promise.resolve("token"),
    isOnline: () => true,
    offline: () => ANSWER,
    isNetworkError: () => false,
  };
  return { submit: createQueryClient(deps), bodies };
}

const PREVIOUS =
  "How does the contraceptive implant work, and how long does it last?";

async function main() {
  console.log("Test 1: without a previous question, the body is { text } only");
  {
    const { submit, bodies } = client();
    await submit("how long does it last?");
    assert(
      JSON.stringify(bodies[0]) ===
        JSON.stringify({ text: "how long does it last?" }),
      "the body is unchanged",
    );
  }

  console.log("Test 2: with one, the body adds previousQuestion");
  {
    const { submit, bodies } = client();
    await submit("how long does it last?", { previousQuestion: PREVIOUS });
    assert(
      JSON.stringify(bodies[0]) ===
        JSON.stringify({
          text: "how long does it last?",
          previousQuestion: PREVIOUS,
        }),
      "text and previousQuestion are sent",
    );
  }

  console.log("Test 3: App sends it only for a typed message after an answer");
  {
    const app = read("./App.tsx");
    assert(
      app.includes(`via === "typed" &&`),
      "only when typed (not a tapped row)",
    );
    assert(
      /lastReply\.kind === "answer-scoped" \|\|\s*lastReply\.kind === "answer-unscoped"/.test(
        app,
      ),
      "only after an answer",
    );
    assert(
      /\? lastReply\.matchedQuestion\s*: undefined/.test(app),
      "the previous answer's knowledge-base question, never her words",
    );
    assert(
      app.includes("followUpQuestion: response.followUp?.resolvedQuestion"),
      "the reply keeps how the gateway read her follow-up",
    );
  }

  console.log("Test 4: the answer screen shows the reading, and only then");
  {
    const noop = () => undefined;
    const turn: ChatTurn = {
      id: "a1",
      role: "assistant",
      text: "An answer.",
      kind: "answer-scoped",
      matchedQuestion: "Can birth control make me gain or lose weight?",
      via: "typed",
    };
    const render = (t: ChatTurn) =>
      renderToStaticMarkup(
        <AnswerView
          turn={t}
          onSend={noop}
          back={{ label: "Back to home", onBack: noop }}
          askBar={<div>ask</div>}
        />,
      );
    const shown = render({
      ...turn,
      followUpQuestion: "can the contraceptive implant make me gain weight?",
    });
    assert(shown.includes('class="follow-up-read"'), "the line is shown");
    assert(
      shown.includes(FOLLOW_UP_LABEL) &&
        shown.includes("can the contraceptive implant make me gain weight?"),
      "with the label and the question as read",
    );
    assert(
      !shown.includes("<h2") ||
        shown.indexOf("follow-up-read") < shown.indexOf("<h2"),
      "above the answer card, not a heading",
    );
    assert(!render(turn).includes("follow-up-read"), "absent without one");
  }

  console.log("All follow-up context tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
