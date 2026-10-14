import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
} from "../offline/helpContent";
import {
  LIMITED_MODE_NOTICE,
  SUGGESTIONS,
  TOPIC_EXAMPLES,
} from "../content/uiText";
import {
  answerDetails,
  formatDetails,
  isDetailsEnabled,
  type AnswerDetails,
} from "../details";
import type { ChatTurn } from "../types";
import AppHeader from "./AppHeader";
import ChatInterface from "./ChatInterface";
import ChatSidebar from "./ChatSidebar";
import Disclaimer from "./Disclaimer";
import ReferralScreen from "./ReferralScreen";
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
  const chips = html.match(/<button class="chip[ "][^>]*>.*?<\/button>/g) ?? [];

  assert(chips.length === 4, "four chip buttons");
  assert(!html.includes('aria-hidden="true">'), "no chip is aria-hidden");
  for (const example of TOPIC_EXAMPLES) {
    assert(
      chips.some((chip) => chip.endsWith(`</svg>${example.label}</button>`)),
      `a "${example.label}" chip with an icon`,
    );
    assert(
      chips.some((chip) => chip.includes(`chip--${example.topic}`)),
      `the "${example.label}" chip has its own colour`,
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

console.log("\nTest 9: the details view is off unless asked for");
{
  assert(!isDetailsEnabled("", undefined), "off by default");
  assert(!isDetailsEnabled("?details=0", "false"), "off for details=0");
  assert(isDetailsEnabled("?details=1", undefined), "on with ?details=1");
  assert(
    isDetailsEnabled("?a=b&details=1", undefined),
    "on with details=1 among other parameters",
  );
  assert(isDetailsEnabled("", "true"), "on with VITE_SHOW_DETAILS=true");
}

const DETAILS: AnswerDetails = answerDetails({
  outcome: "grounded_answer",
  message: "full answer",
  category: "sti",
  predictedCategory: "sti",
  confidence: 0.8234,
  classifierSource: "distilbert",
  retrievalScope: "scoped",
  source: "WHO (2018)",
  generationInvoked: true,
});
const EXPECTED_LINE =
  "category: sti · predicted: sti · confidence: 0.82 · classifier: distilbert · retrieval: scoped · source: WHO (2018)";

console.log("\nTest 10: the details line shows the six fields");
{
  assert(formatDetails(DETAILS) === EXPECTED_LINE, "formatted in order");
  assert(
    formatDetails({ category: "general" }) ===
      "category: general · predicted: none · confidence: none · classifier: none · retrieval: none · source: none",
    "missing fields read 'none'",
  );
}

console.log("\nTest 11: the line is shown under answers only when enabled");
{
  const turns: ChatTurn[] = [
    {
      id: "1",
      role: "assistant",
      text: "full answer",
      outcome: "grounded_answer",
      details: DETAILS,
    },
  ];
  const on = renderToStaticMarkup(
    <ChatInterface
      turns={turns}
      onSend={() => undefined}
      isLoading={false}
      showDetails
    />,
  );
  const off = renderChat(turns);

  assert(on.includes("classifier: distilbert"), "shown when enabled");
  assert(
    on.indexOf("full answer") < on.indexOf("classifier: distilbert"),
    "under the answer",
  );
  assert(!off.includes("classifier:"), "hidden by default");
}

console.log("\nTest 12: the referral screen never shows details");
{
  const html = renderToStaticMarkup(
    <ReferralScreen message="referral" onContinueChat={() => undefined} />,
  );

  assert(!html.includes("classifier:"), "no details line");
  assert(!html.includes("category:"), "no category");
}

console.log(
  "\nTest 13: the wide-screen sidebar has New chat and the anonymous card",
);
{
  const html = renderToStaticMarkup(
    <ChatSidebar onNewChat={() => undefined} />,
  );

  assert(html.includes(">New chat</button>"), "a New chat button");
  assert(html.includes("re anonymous"), "the anonymous card");
  assert(
    html.includes(escapeHtml("We don't save your questions or your answers.")),
    "the same privacy wording as the disclaimer",
  );
}

console.log(
  "\nTest 14: the typing indicator still tells screen readers it is thinking",
);
{
  const html = renderToStaticMarkup(
    <ChatInterface turns={[]} onSend={() => undefined} isLoading />,
  );

  assert(html.includes('role="status"'), "the indicator is a status");
  assert(
    html.includes('aria-live="polite"><span class="typing-dots"'),
    "announced politely (aria-live)",
  );
  assert(
    html.includes('<span class="sr-only">Thinking…</span>'),
    "with 'Thinking…' for screen readers",
  );
  assert(
    html.includes('class="typing-dots" aria-hidden="true"'),
    "the dots are hidden from screen readers",
  );
}

console.log(
  "\nTest 15: every suggestion is a 'clear' development-set query on its topic",
);
{
  const csv = readFileSync(
    new URL(
      "../../../../resources/eval/retrieval_eval_set.csv",
      import.meta.url,
    ),
    "utf8",
  );
  const rows = new Map(
    csv
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.split(","))
      .map((cells) => [cells[0], cells] as const),
  );
  const prefix: Record<string, string> = {
    contraception: "KB-C",
    sti: "KB-S",
    pregnancy: "KB-P",
    general: "KB-G",
  };

  for (const [category, list] of Object.entries(SUGGESTIONS)) {
    for (const suggestion of list) {
      const row = rows.get(suggestion.evalId);
      assert(
        row?.[1] === suggestion.question && row[2] === "clear",
        `${suggestion.evalId} is a verbatim "clear" query`,
      );
      assert(
        row?.[4]?.startsWith(prefix[category] ?? "?") === true,
        `${suggestion.evalId} is answered from the ${category} entries`,
      );
    }
  }
}

console.log("\nTest 16: follow-ups appear under the latest answer only");
{
  const answer = (id: string, category: string): ChatTurn => ({
    id,
    role: "assistant",
    text: `answer ${id}`,
    outcome: "grounded_answer",
    details: { category },
  });
  const turns: ChatTurn[] = [
    { id: "1", role: "user", text: "what is PrEP" },
    answer("2", "sti"),
    { id: "3", role: "user", text: "Can chlamydia be cured" },
    answer("4", "sti"),
  ];
  const html = renderChat(turns);
  const suggestions =
    html.match(/<button class="suggestion"[^>]*>[^<]*</g) ?? [];

  assert(html.includes("You could also ask:"), "the label is shown");
  assert(
    html.indexOf("You could also ask:") > html.indexOf("answer 4"),
    "under the latest answer",
  );
  assert(
    html.split("You could also ask:").length === 2,
    "only once, not under earlier answers",
  );
  assert(
    suggestions.length === 2 &&
      !suggestions.some((s) => s.toLowerCase().includes("chlamydia")),
    "two follow-ups, leaving out the question just asked (case-insensitive)",
  );
  assert(
    !renderToStaticMarkup(
      <ChatInterface turns={turns} onSend={() => undefined} isLoading />,
    ).includes("You could also ask:"),
    "hidden while the next answer is loading",
  );
  assert(
    !renderChat([turns[0], answer("2", "")]).includes("You could also ask:"),
    "none when the category is unknown",
  );
}

console.log("\nTest 17: a hint above the chips before the first question");
{
  assert(
    renderChat([]).includes("Not sure where to start? Try one:"),
    "shown on an empty chat",
  );
  assert(
    !renderChat([{ id: "1", role: "user", text: "hi" }]).includes(
      "Not sure where to start?",
    ),
    "hidden once the chat has started",
  );
  assert(
    renderChat([]).includes('placeholder="Ask about your body or health…"'),
    "the input has the friendlier placeholder",
  );
}

console.log(
  "\nTest 18: no follow-ups after a referral, limited mode, no-answer, signposting or an error",
);
{
  const question: ChatTurn = { id: "q", role: "user", text: "what is PrEP" };
  const answer = (extra: Partial<ChatTurn>): ChatTurn => ({
    id: "a",
    role: "assistant",
    text: "reply",
    outcome: "grounded_answer",
    answerFound: true,
    details: { category: "sti" },
    ...extra,
  });
  const follows = (turns: ChatTurn[]) =>
    renderChat(turns).includes("You could also ask:");

  assert(follows([question, answer({})]), "shown after a full answer");
  // A referral and an error never add an answer turn: the chat ends with
  // the user's question, even after an earlier full answer.
  assert(
    !follows([
      question,
      answer({}),
      { id: "q2", role: "user", text: "my boyfriend hits me" },
    ]),
    "not after a referral or an error (the last turn is the question)",
  );
  assert(
    !follows([question, answer({ limitedMode: true })]),
    "not after a limited-mode answer",
  );
  assert(
    !follows([
      question,
      answer({ answerFound: false, details: { category: null } }),
    ]),
    "not after the no-answer reply",
  );
  assert(
    !follows([
      question,
      answer({
        outcome: "signposting",
        answerFound: false,
        details: { category: null },
      }),
    ]),
    "not after signposting",
  );
  assert(
    !follows([question, answer({ answerFound: false })]),
    "not after a no-answer reply even if it names a category",
  );
}

console.log("\nAll component tests passed.");
