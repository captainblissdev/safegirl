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
import { telHref } from "../content/telHref";
import { TOPICS } from "../content/topics";
import { KB_QUESTIONS, questionsFor } from "../content/kbQuestions";
import TopicList from "./TopicList";
import { PLACEHOLDER_EXAMPLES, SOURCES_LINE } from "../content/uiText";
import AppHeader from "./AppHeader";
import AppShell from "./AppShell";
import ChatInterface from "./ChatInterface";
import ChatSidebar from "./ChatSidebar";
import HelpSheet from "./HelpSheet";
import ReferralScreen from "./ReferralScreen";
import SessionEnd from "./SessionEnd";
import Splash from "./Splash";
import SupportContent from "./SupportContent";

/**
 * Render tests for the interface components, using react-dom/server:
 * no browser and no DOM library.
 */

/** AppShell's Help props with the sheet closed (render tests only). */
const closedHelp = {
  isOpen: false,
  onOpen: () => undefined,
  onClose: () => undefined,
  onTopic: () => undefined,
  buttonRef: { current: null },
};

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

console.log("\nTest 2: the header has the wordmark, a Help button and Exit");
{
  const html = renderToStaticMarkup(
    <AppHeader
      onExit={() => undefined}
      onOpenHelp={() => undefined}
      isHelpOpen={false}
      helpButtonRef={{ current: null }}
    />,
  );

  assert(
    html.includes('Safe<span class="wordmark-girl">Girl</span>'),
    'the wordmark is "Safe" + "Girl"',
  );
  assert(
    /<button[^>]*class="btn-help"[^>]*>Help<\/button>/.test(html),
    "Help is a button",
  );
  assert(
    html.includes('aria-haspopup="dialog"'),
    "Help is announced as opening a dialog",
  );
  assert(!html.includes('role="dialog"'), "the panel starts closed");
  assert(
    html.includes('<button class="btn-exit" type="button">Exit</button>'),
    "Exit is a visible button in the header, not in a menu",
  );
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

console.log("\nTest 5: Home states what SafeGirl can and cannot do");
{
  const html = renderChat([]);

  assert(
    html.includes(
      '<h1 tabindex="-1" id="home-title" class="hero-title">Ask about your body, periods, pregnancy or sex.</h1>',
    ),
    "the hero heading is the h1",
  );
  assert(
    html.includes(`${SOURCES_LINE} ${escapeHtml("This can't diagnose you.")}`),
    "the shared sources line, then that it can't diagnose",
  );
}

console.log("\nTest 6: the privacy wording on the disclaimer and session end");
{
  const disclaimer = renderToStaticMarkup(
    <Splash onContinue={() => undefined} onExit={() => undefined} />,
  );
  const sessionEnd = renderToStaticMarkup(
    <SessionEnd onStartNew={() => undefined} />,
  );

  assert(
    disclaimer.includes(
      escapeHtml("We don't save your questions or your answers."),
    ),
    "the splash (the disclaimer) says questions and answers are not saved",
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

console.log("\nTest 7: the topic chips are real buttons (in the conversation)");
{
  const html = renderChat([{ id: "1", role: "user", text: "hi" }]);
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
    <ChatInterface
      turns={[{ id: "1", role: "user", text: "what is PrEP" }]}
      onSend={() => undefined}
      isLoading
    />,
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
  // Q14 is too close to the 0.35 no-answer cut-off (confidence 0.368 in
  // research/eval/results/suggested_questions_2026-10-14.csv) to offer.
  const offered = Object.values(SUGGESTIONS)
    .flat()
    .map((s) => s.evalId);
  assert(!offered.includes("Q14"), "Q14 (fragile, 0.368) is not offered");
  assert(offered.includes("Q15"), "Q15 replaces it in the general follow-ups");
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

console.log("\nTest 17: Home before the first question, the ask bar after it");
{
  const empty = renderChat([]);
  const started = renderChat([{ id: "1", role: "user", text: "hi" }]);
  assert(empty.includes('<div class="home">'), "an empty chat shows Home");
  assert(!empty.includes("Not sure where to start?"), "the old hint is gone");
  assert(!started.includes('class="home"'), "Home goes once the chat starts");
  assert(
    started.includes('<div class="input-row">') &&
      started.includes('placeholder="Ask about your body or health…"'),
    "the conversation has the ask bar at the bottom",
  );
  for (const html of [empty, started]) {
    assert(html.split("<input").length === 2, "exactly one input either way");
  }
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

console.log(
  "\nTest 19: every screen and reply kind has the header Exit and the footer line",
);
{
  const noop = () => undefined;
  const user: ChatTurn = { id: "u", role: "user", text: "a question" };
  const reply = (extra: Partial<ChatTurn>): ChatTurn[] => [
    user,
    { id: "r", role: "assistant", text: "reply", ...extra },
  ];
  // As App.tsx composes them: every screen inside AppShell; the chat
  // screen puts the footer line above its ask bar itself.
  const chat = (turns: ChatTurn[]) => (
    <AppShell onExit={noop} help={closedHelp} footerInContent>
      <ChatInterface turns={turns} onSend={noop} isLoading={false} />
    </AppShell>
  );
  const screens: [string, JSX.Element][] = [
    // The splash is full-bleed, outside AppShell, with its own Exit pill.
    ["splash", <Splash onContinue={noop} onExit={noop} />],
    ["chat, empty", chat([])],
    [
      "chat, answer",
      chat(reply({ outcome: "grounded_answer", answerFound: true })),
    ],
    [
      "chat, no answer",
      chat(reply({ outcome: "grounded_answer", answerFound: false })),
    ],
    ["chat, help", chat(reply({ outcome: "signposting" }))],
    ["chat, vague", chat(reply({ outcome: "clarification" }))],
    ["chat, held", chat(reply({ outcome: "held" }))],
    [
      "chat, limited mode",
      chat(reply({ outcome: "grounded_answer", limitedMode: true })),
    ],
    [
      "referral",
      <AppShell onExit={noop} help={closedHelp} calm>
        <ReferralScreen message="referral" onContinueChat={noop} />
      </AppShell>,
    ],
    [
      "session end",
      <AppShell onExit={noop} help={closedHelp}>
        <SessionEnd onStartNew={noop} />
      </AppShell>,
    ],
  ];
  const line = "In danger? Call ";
  const href = `href="${telHref(GBV_HELPLINE)}"`;

  for (const [name, element] of screens) {
    const html = renderToStaticMarkup(element);
    assert(
      html.split(line).length === 2,
      `${name}: the footer line appears once`,
    );
    assert(
      html.includes(
        `${line}<a ${href}>${GBV_HELPLINE}</a>, free and open 24 hours.`,
      ),
      `${name}: its tap-to-call link is built from GBV_HELPLINE`,
    );
    const exitAt = html.search(
      /<button class="btn-exit(-pill)?" type="button">Exit<\/button>/,
    );
    assert(
      exitAt > -1 && exitAt < html.indexOf(line),
      `${name}: an Exit button is present, before the content`,
    );
    if (name === "chat, empty") {
      const tilesAt = html.indexOf('class="topic-tiles"');
      const anonymousAt = html.indexOf('class="home-anonymous"');
      const lineAt = html.indexOf('class="danger-line"');
      assert(
        tilesAt > -1 && tilesAt < anonymousAt && anonymousAt < lineAt,
        "Home: the tiles, then 'Anonymous…', then the footer line",
      );
    } else if (name.startsWith("chat")) {
      const lineAt = html.indexOf('class="danger-line"');
      const barAt = html.indexOf('class="input-row"');
      assert(
        lineAt > -1 &&
          barAt > lineAt &&
          !html.slice(lineAt, barAt).includes("<button"),
        `${name}: the footer line sits directly above the ask bar`,
      );
    }
  }
}

console.log(
  "\nTest 20: tel: links come from the constants, never a typed number",
);
{
  assert(
    telHref(GBV_HELPLINE) === `tel:${GBV_HELPLINE}`,
    "telHref builds tel:",
  );
  for (const file of [
    "./DangerLine.tsx",
    "./AppShell.tsx",
    "./AppHeader.tsx",
    "./Splash.tsx",
    "./HelpSheet.tsx",
    "./Home.tsx",
    "./AskBar.tsx",
    "./TopicList.tsx",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert(!/\d{3}/.test(source), `${file} types no phone number`);
  }
}

console.log(
  "\nTest 21: App renders the splash on its own, every other screen in AppShell",
);
{
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const splashAt = app.indexOf('if (screen === "splash") {');
  const shellOpen = app.indexOf("<AppShell");
  const shellClose = app.lastIndexOf("</AppShell>");
  assert(
    splashAt > -1 && splashAt < shellOpen,
    "the splash returns before AppShell (no app header on it)",
  );
  assert(
    /<Splash\s+onContinue=\{[^}]*\}\s+onExit=\{handleExit\}/.test(
      app.slice(splashAt, shellOpen),
    ),
    "the splash gets the same Exit handler",
  );
  for (const screen of ["chat", "referral", "sessionEnd"]) {
    const at = app.indexOf(`screen === "${screen}" &&`);
    assert(
      at > shellOpen && at < shellClose,
      `the ${screen} screen is inside AppShell`,
    );
  }
  assert(
    app.includes("createDoubleEscapeHandler(") &&
      app.includes('addEventListener("keydown"'),
    "double Escape is wired to a keydown listener",
  );
  const effect = app.slice(
    app.indexOf("createDoubleEscapeHandler("),
    app.indexOf('if (screen === "splash") {'),
  );
  assert(
    effect.includes("}, []);"),
    "the listener is registered once, for every screen, the splash included",
  );
  assert(
    app.includes("replace: (url) => window.location.replace(url)") &&
      !app.includes("window.close("),
    "Exit uses location.replace, never window.close",
  );
}

console.log("\nTest 22: the splash is a full-bleed screen of its own");
{
  const html = renderToStaticMarkup(
    <Splash onContinue={() => undefined} onExit={() => undefined} />,
  );
  assert(
    html.startsWith('<main class="splash-screen surface-dark"'),
    "a full-bleed dark screen (white focus ring)",
  );
  assert(html.split("<h1").length === 2, "exactly one h1");
  assert(/<h1[^>]*>SafeGirl<\/h1>/.test(html), "the wordmark is the h1");
  assert(!html.includes("<header"), "no app header on the splash");
  assert(!html.includes("btn-help"), "no Help button on the splash");
  assert(
    html.includes('<button class="btn-exit-pill" type="button">Exit</button>'),
    "a compact Exit pill",
  );
  assert(
    html.includes('<div class="splash-decor" aria-hidden="true">') &&
      html.indexOf("splash-decor") < html.indexOf("btn-exit-pill"),
    "the decoration is hidden from screen readers, and the pill is above it",
  );
  assert(
    html.includes('class="mark mark--splash"') &&
      html.includes('style="width:84px;height:84px"'),
    "the shared shield-and-heart mark, 84 by 84",
  );
  assert(
    html.includes("Honest answers about your body, health and growing up."),
    "the tagline",
  );
  for (const promise of [
    "<strong>Anonymous.</strong> We never ask for your name.",
    `<strong>Real guidance.</strong> ${SOURCES_LINE}`,
    `<strong>Not a doctor.</strong> ${escapeHtml("This can't diagnose you.")} A nurse or clinic can.`,
  ]) {
    assert(html.includes(promise), `promise: ${promise.slice(0, 40)}…`);
  }
  for (const icon of ["lock", "speech", "shield"]) {
    assert(
      html.includes(`promise-icon promise-icon--${icon}`),
      `the ${icon} icon tile`,
    );
  }
  const privacyAt = html.indexOf(
    escapeHtml("We don't save your questions or your answers."),
  );
  const buttonAt = html.indexOf('<button class="btn-splash"');
  const lineAt = html.indexOf('class="danger-line"');
  assert(
    privacyAt > -1 && privacyAt < buttonAt && buttonAt < lineAt,
    "privacy line, then the button, then the footer line",
  );
  assert(
    html.includes(
      '<button class="btn-splash" type="button">I understand, continue <svg',
    ),
    '"I understand, continue" with an arrow',
  );
}

console.log("\nTest 23: the Help sheet");
{
  const html = renderToStaticMarkup(
    <HelpSheet
      onClose={() => undefined}
      onExit={() => undefined}
      onTopic={() => undefined}
    />,
  );
  assert(
    html.includes('role="dialog"') &&
      html.includes('aria-modal="true"') &&
      html.includes('aria-labelledby="help-sheet-title"') &&
      html.includes('id="help-sheet-title"'),
    "a labelled modal dialog",
  );
  assert(
    html.includes(
      '<button class="btn-close" type="button" aria-label="Close help">',
    ),
    "a labelled close button",
  );
  assert(
    html.includes('<button class="btn-exit" type="button">Exit</button>'),
    "the sheet has its own Exit button (it covers the header)",
  );
  for (const heading of [
    "How SafeGirl works",
    "Tips for asking",
    "Need to talk to someone?",
    "Topics",
  ]) {
    assert(html.includes(`>${heading}</h3>`), `section: ${heading}`);
  }
  assert(
    html.includes(
      `<a class="btn-call" href="${telHref(GBV_HELPLINE)}">Call ${GBV_HELPLINE}</a><span>GBV helpline. Free, 24 hours, English and Kiswahili.</span>`,
    ),
    "1195: tap-to-call from the constant, with the checked wording",
  );
  assert(
    html.includes(
      `<a class="btn-call" href="${telHref(CHILDLINE_KENYA)}">Call ${CHILDLINE_KENYA}</a><span>Childline Kenya, for children and young people.</span>`,
    ),
    "116: tap-to-call from the constant",
  );
  const childline = html.slice(
    html.indexOf(telHref(CHILDLINE_KENYA)),
    html.indexOf("</li>", html.indexOf(telHref(CHILDLINE_KENYA))),
  );
  assert(
    !/free|18|under/i.test(childline.replace(CHILDLINE_KENYA, "")),
    "the 116 line claims no cost and no age limit",
  );
  const [a, b] = EMERGENCY_NUMBERS;
  assert(
    html.includes(
      `In immediate danger? Call <a href="${telHref(a)}">${a}</a> or <a href="${telHref(b)}">${b}</a>.`,
    ),
    "999 and 112 from the constants",
  );
  const numbers = [...html.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]);
  assert(
    numbers.every((n) =>
      [GBV_HELPLINE, CHILDLINE_KENYA, ...EMERGENCY_NUMBERS].includes(n),
    ),
    "no helpline that is not in the constants",
  );
  assert(
    html.includes("press Escape twice") &&
      html.includes("This does not clear your browser history."),
    "explains quick exit without claiming to clear history",
  );
  for (const topic of TOPICS) {
    assert(
      html.includes(`>${topic.label}</button>`),
      `topic button: ${topic.label}`,
    );
  }
}

console.log("\nTest 24: no copy claims clinician review");
{
  const rendered = [
    renderToStaticMarkup(
      <Splash onContinue={() => undefined} onExit={() => undefined} />,
    ),
    renderToStaticMarkup(
      <HelpSheet
        onClose={() => undefined}
        onExit={() => undefined}
        onTopic={() => undefined}
      />,
    ),
    renderToStaticMarkup(<SupportContent />),
    renderToStaticMarkup(<SessionEnd onStartNew={() => undefined} />),
    renderToStaticMarkup(
      <ChatInterface turns={[]} onSend={() => undefined} isLoading={false} />,
    ),
  ];
  for (const html of rendered) {
    assert(!/review|clinician|clinically/i.test(html), "no review claim");
  }
}

console.log(
  "\nTest 25: App wires the Help sheet, its focus and the Escape rule",
);
{
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    app.includes("() => helpOpenRef.current,"),
    "the Escape handler ignores presses while the sheet is open",
  );
  assert(
    app.includes('window.addEventListener("keydown", onKeyDown, true);'),
    "it listens in the capture phase, before the sheet closes itself",
  );
  assert(
    /const closeHelp = \(\) => \{\s*setIsHelpOpen\(false\);\s*helpButtonRef\.current\?\.focus\(\);/.test(
      app,
    ),
    "closing the sheet returns focus to the Help button",
  );
  assert(
    app.includes("startScreen(browserSessionStorage)") &&
      app.includes("setScreen(continueFromSplash(browserSessionStorage))"),
    "the splash shows once per session and Continue leads to home",
  );
  const sheet = readFileSync(
    new URL("./HelpSheet.tsx", import.meta.url),
    "utf8",
  );
  assert(
    sheet.includes("closeRef.current?.focus()") &&
      sheet.includes('event.key === "Escape"') &&
      sheet.includes("trapTab(event.nativeEvent"),
    "the sheet focuses its close button, closes on Escape and traps Tab",
  );
}

console.log("\nTest 26: one sources line, used everywhere it appears");
{
  assert(
    SOURCES_LINE ===
      "Most answers come from Kenyan Ministry of Health and WHO guidance.",
    "the sources line says Most",
  );
  const splash = renderToStaticMarkup(
    <Splash onContinue={() => undefined} onExit={() => undefined} />,
  );
  const sheet = renderToStaticMarkup(
    <HelpSheet
      onClose={() => undefined}
      onExit={() => undefined}
      onTopic={() => undefined}
    />,
  );
  assert(splash.includes(SOURCES_LINE), "on the splash");
  assert(sheet.includes(SOURCES_LINE), "in the Help sheet");
  for (const file of ["./Splash.tsx", "./HelpSheet.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert(
      source.includes("SOURCES_LINE") && !source.includes("Ministry of"),
      `${file} uses the constant and does not retype the line`,
    );
  }
  assert(
    !(splash + sheet).includes("Answers come from Kenyan"),
    'the old "Answers come from…" wording is gone',
  );
}

console.log("\nTest 27: the header uses the shared shield-and-heart mark");
{
  const html = renderToStaticMarkup(
    <AppHeader
      onExit={() => undefined}
      onOpenHelp={() => undefined}
      isHelpOpen={false}
      helpButtonRef={{ current: null }}
    />,
  );
  assert(
    html.includes('class="mark mark--header"') &&
      html.includes('class="mark-shield"') &&
      html.includes('class="mark-heart"'),
    "the header mark is the shield and heart",
  );
}

console.log("\nTest 28: Home");
{
  const html = renderChat([]);
  assert(html.split("<h1").length === 2, "exactly one h1 on Home");
  assert(
    html.includes('<p class="hero-sub">') && html.includes(SOURCES_LINE),
    "the hero uses the shared sources constant",
  );
  assert(
    /<p class="hero-tag"><svg[^>]*>.*?<\/svg> Private and anonymous<\/p>/.test(
      html,
    ),
    'the "Private and anonymous" tag with its lock icon',
  );
  const pill = html.slice(
    html.indexOf('<div class="ask-pill">'),
    html.indexOf("</div>", html.indexOf('<div class="ask-pill">')),
  );
  assert(pill.split("<input").length === 2, "the ask pill has one input");
  assert(
    pill.includes(
      '<label class="sr-only" for="chat-input">Type your question</label>',
    ) && pill.includes('id="chat-input"'),
    "a visually hidden label for it",
  );
  assert(
    pill.includes('aria-label="Ask"') && pill.includes('class="btn-send"'),
    'a send button labelled "Ask"',
  );
  assert(
    pill.includes(`placeholder="${escapeHtml(PLACEHOLDER_EXAMPLES[0])}"`),
    "the placeholder starts with the first example",
  );
  assert(
    !html.slice(0, html.indexOf("ask-pill")).includes("aria-live"),
    "the placeholder is not in a live region",
  );
  const tiles = [
    ...html.matchAll(
      /<button class="topic-tile topic-tile--([a-z]+)" data-topic="[a-z]+" type="button">.*?<span class="topic-tile-label">([^<]+)<\/span><span class="topic-tile-sub">([^<]+)<\/span><\/button>/g,
    ),
  ].map((m) => ({ topicClass: m[1], label: m[2], subtitle: m[3] }));
  assert(
    JSON.stringify(tiles) ===
      JSON.stringify(
        TOPICS.map(({ topicClass, label, subtitle }) => ({
          topicClass,
          label,
          subtitle,
        })),
      ),
    "four tile buttons with the labels, classes and subtitles of content/topics.ts",
  );
  for (const topic of TOPICS) {
    const words = topic.subtitle.split(/\s+/).length;
    assert(words >= 3 && words <= 5, `"${topic.subtitle}" is 3 to 5 words`);
  }
  const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
  const tile = /\.topic-tile \{[^}]*min-height: (\d+)px;/.exec(css);
  assert(
    tile !== null && Number(tile[1]) >= 88,
    "tiles are at least 88px tall (44px or more)",
  );
  const shell = renderToStaticMarkup(
    <AppShell onExit={() => undefined} help={closedHelp} footerInContent>
      <ChatInterface turns={[]} onSend={() => undefined} isLoading={false} />
    </AppShell>,
  );
  assert(
    shell.includes('<button class="btn-exit" type="button">Exit</button>') &&
      shell.split("In danger? Call ").length === 2,
    "Exit and the footer line are on Home",
  );
}

console.log("\nTest 29: the Topic list for each topic");
{
  const noop = () => undefined;
  for (const topic of TOPICS) {
    const html = renderToStaticMarkup(
      <TopicList topic={topic} onAsk={noop} onBack={noop} />,
    );
    const data = questionsFor(topic.topicClass);
    assert(
      data.length > 0 &&
        data.every((item) => item.topicClass === topic.topicClass),
      `${topic.label}: the data holds only this class`,
    );
    assert(html.split("<h1").length === 2, `${topic.label}: one h1`);
    assert(
      html.includes(
        `<h1 tabindex="-1" class="topic-title">${topic.label}</h1>`,
      ),
      `${topic.label}: the label is the h1, focusable for the move on open`,
    );
    assert(
      html.includes(`<p class="topic-count">${data.length} questions</p>`),
      `${topic.label}: "${data.length} questions", from the data`,
    );
    const rows = [
      ...html.matchAll(
        /<button class="topic-question" type="button"><span>([^<]*)<\/span><span class="topic-question-go" aria-hidden="true">/g,
      ),
    ].map((m) => m[1]);
    assert(
      JSON.stringify(rows) ===
        JSON.stringify(
          data.map((item) => escapeHtml(item.question).replace(/"/g, "&quot;")),
        ),
      `${topic.label}: one row button per question, its name the question text`,
    );
    assert(
      /<button class="back-link" type="button"><svg[^>]*>.*?<\/svg> All topics<\/button>/.test(
        html,
      ),
      `${topic.label}: an "All topics" back link`,
    );
    const lineAt = html.indexOf('class="danger-line"');
    const barAt = html.indexOf('<div class="input-row">');
    assert(
      lineAt > html.lastIndexOf("topic-question") && lineAt < barAt,
      `${topic.label}: the footer line under the list, then the ask bar`,
    );
    assert(
      html.includes(
        '<label class="sr-only" for="chat-input">Ask something else</label>',
      ) && html.split("<input").length === 2,
      `${topic.label}: one ask bar, labelled "Ask something else"`,
    );
  }
  assert(
    KB_QUESTIONS.length === 21 &&
      KB_QUESTIONS.every((item) => Object.keys(item).length === 3),
    "21 questions with id, class and question only (no answers)",
  );
}

console.log(
  "\nTest 30: one path: rows and the ask bar go to the full pipeline",
);
{
  const list = readFileSync(
    new URL("./TopicList.tsx", import.meta.url),
    "utf8",
  );
  assert(
    list.includes("onClick={() => onAsk(item.question)}"),
    "a row hands its exact question text to onAsk",
  );
  assert(
    /const ask = \(\) => \{[^}]*onAsk\(text\);/.test(list),
    "the ask bar hands its text to the same onAsk",
  );
  assert(
    list.includes("onAsk: (text: string) => void;"),
    "onAsk takes the text only: nothing scopes it to the topic",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    /const askFromTopic = \(text: string\) => \{\s*setScreen\("chat"\);\s*void handleSend\(text\);/.test(
      app,
    ),
    "App sends it through handleSend, the full pipeline used for every question",
  );
  assert(
    app.includes("submitQuery(text, { signal: request.signal })"),
    "handleSend submits only the text",
  );
  assert(
    app.includes('onTopic={(next) => openTopic(next, "tile")}') &&
      /const handleHelpTopic = \(next: Topic\) => \{\s*setIsHelpOpen\(false\);\s*openTopic\(next, "help"\);/.test(
        app,
      ),
    "Home tiles and Help sheet buttons both open the Topic list",
  );
  assert(
    app.includes('`[data-topic="${topic.topicClass}"]`') &&
      app.includes("helpButtonRef.current?.focus();"),
    "back returns focus to the tile, or to Help",
  );
  const home = renderChat([]);
  for (const topic of TOPICS) {
    assert(
      home.includes(
        `class="topic-tile topic-tile--${topic.topicClass}" data-topic="${topic.topicClass}"`,
      ),
      `the ${topic.label} tile carries its class for the list and for focus`,
    );
  }
  assert(
    home.includes('<h1 tabindex="-1" id="home-title"'),
    "Home's h1 can take focus when Home appears",
  );
  assert(
    renderToStaticMarkup(
      <ReferralScreen message="m" onContinueChat={() => undefined} />,
    ).includes('<h2 tabindex="-1" id="referral-title">'),
    "the referral heading can take focus when it appears",
  );
}

console.log("\nAll component tests passed.");
