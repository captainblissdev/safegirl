import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
} from "../offline/helpContent";
import { LIMITED_MODE_NOTICE, TOPIC_EXAMPLES } from "../content/uiText";
import type { ChatTurn } from "../types";
import AppHeader from "./AppHeader";
import ChatInterface from "./ChatInterface";
import Disclaimer from "./Disclaimer";
import SessionEnd from "./SessionEnd";
import SupportContent from "./SupportContent";

/**
 * Render tests for the interface components, using react-dom/server:
 * no browser and no DOM library.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

console.log("Test 1: the help options list every number from helpContent");
{
  const html = renderToStaticMarkup(<SupportContent />);

  for (const number of [...EMERGENCY_NUMBERS, GBV_HELPLINE, CHILDLINE_KENYA]) {
    assert(
      html.includes(`href="tel:${number}"`),
      `${number} is a tap-to-call link`,
    );
  }
  assert(
    html.includes("Go to a health facility"),
    "advises going to a health facility",
  );
  for (const title of [
    "Local health services",
    "Confidential helplines",
    "Emergency guidance",
  ]) {
    assert(html.includes(title), `has the "${title}" section`);
  }
  assert(
    !/verified/i.test(html),
    "says nothing about the numbers being verified",
  );
}

console.log("\nTest 2: the header has a standing 'Need help now?' button");
{
  const html = renderToStaticMarkup(<AppHeader />);

  assert(html.includes("Need help now?"), "the button is present");
  assert(
    html.includes('aria-haspopup="dialog"'),
    "it is announced as opening a dialog",
  );
  assert(!html.includes('role="dialog"'), "the panel starts closed");
}

const renderChat = (turns: ChatTurn[]) =>
  renderToStaticMarkup(
    <ChatInterface turns={turns} onSend={() => undefined} isLoading={false} />,
  );

// renderToStaticMarkup escapes the apostrophe in "can't".
const escapeHtml = (text: string) => text.replace(/'/g, "&#x27;");

console.log("\nTest 3: a limited-mode answer has the notice above it");
{
  const html = renderChat([
    { id: "1", role: "user", text: "what is PrEP" },
    {
      id: "2",
      role: "assistant",
      text: "general answer",
      outcome: "grounded_answer",
      limitedMode: true,
    },
  ]);
  const notice = html.indexOf(escapeHtml(LIMITED_MODE_NOTICE));

  assert(notice !== -1, "the notice is shown");
  assert(
    notice < html.indexOf("general answer"),
    "the notice comes before the answer",
  );
}

console.log("\nTest 4: a full-service answer has no notice");
{
  const html = renderChat([
    {
      id: "2",
      role: "assistant",
      text: "full answer",
      outcome: "grounded_answer",
      limitedMode: false,
    },
  ]);

  assert(!html.includes("Limited mode"), "no notice");
}

console.log("\nTest 5: the greeting states what SafeGirl can and cannot do");
{
  const html = renderChat([]);

  assert(
    html.includes(escapeHtml("Hi, I'm here to help.")) &&
      html.includes("Ask me a question about your body or your health."),
    "the greeting is shown",
  );
  assert(
    html.includes(
      escapeHtml(
        "I can answer questions about contraception, STIs, pregnancy and periods. I'm not a doctor or a counsellor.",
      ),
    ),
    "the scope line is shown",
  );
}

console.log("\nTest 6: the privacy wording on the disclaimer and session end");
{
  const disclaimer = renderToStaticMarkup(
    <Disclaimer onContinue={() => undefined} />,
  );
  const sessionEnd = renderToStaticMarkup(
    <SessionEnd onStartNew={() => undefined} />,
  );

  assert(
    disclaimer.includes(
      escapeHtml("We don't save your questions or your answers."),
    ),
    "the disclaimer says questions and answers are not saved",
  );
  assert(
    !disclaimer.includes("keep anything"),
    "the old 'anything' wording is gone",
  );
  assert(
    sessionEnd.includes("Your questions and answers were not saved."),
    "the session end says questions and answers were not saved",
  );
  assert(
    !sessionEnd.includes("Nothing was saved"),
    "the old 'Nothing was saved' wording is gone",
  );
}

console.log("\nTest 7: the topic chips are real buttons");
{
  const html = renderChat([]);
  const chips = html.match(/<button class="chip"[^>]*>[^<]*<\/button>/g) ?? [];

  assert(chips.length === 4, "four chip buttons");
  assert(!html.includes('aria-hidden="true">'), "no chip is aria-hidden");
  for (const example of TOPIC_EXAMPLES) {
    assert(
      chips.some((chip) => chip.endsWith(`>${example.label}</button>`)),
      `a "${example.label}" chip`,
    );
  }
}

console.log(
  "\nTest 8: each chip's question is a 'clear' development-set query, one per topic",
);
{
  const csv = readFileSync(
    new URL(
      "../../../../resources/eval/retrieval_eval_set.csv",
      import.meta.url,
    ),
    "utf8",
  );
  // id,query,group,expected_behavior,acceptable_entry_ids,...
  const rows = new Map(
    csv
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.split(","))
      .map((cells) => [cells[0], cells] as const),
  );
  const topics = new Set<string>();

  for (const example of TOPIC_EXAMPLES) {
    const row = rows.get(example.evalId);
    assert(
      row?.[1] === example.question,
      `${example.evalId} is "${example.question}", verbatim`,
    );
    assert(row?.[2] === "clear", `${example.evalId} is in the "clear" group`);
    topics.add(row?.[4]?.slice(0, 4) ?? "");
  }
  assert(
    [...topics].sort().join(",") === "KB-C,KB-G,KB-P,KB-S",
    "the four questions cover the four topics",
  );
}

console.log("\nAll component tests passed.");
