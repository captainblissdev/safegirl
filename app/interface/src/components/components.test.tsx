import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
} from "../offline/helpContent";
import {
  ANSWER_DISCLAIMER,
  CLARIFY_FALLBACK,
  DANGER_LINE_CALL_ABOVE,
  LIMITED_MODE_NOTICE,
  NO_ANSWER_RETRY,
  PERSON_MESSAGE,
  HERO_PILL,
  ASK_LABEL,
  ASK_SEND_NAME,
  REPLY_PILLS,
} from "../content/uiText";
import {
  HELD_TOPIC_MESSAGES,
  NO_ANSWER_MESSAGE,
  SIGNPOSTING_MESSAGE,
  SUPPORT_SECTIONS,
  VAGUE_QUERY_MESSAGE,
  ABUSE_REFERRAL_MESSAGE,
  SELF_HARM_REFERRAL_MESSAGE,
} from "../offline/helpContent";
import {
  answerDetails,
  formatDetails,
  isDetailsEnabled,
  type AnswerDetails,
} from "../details";
import type { ChatTurn } from "../types";
import { telHref, telName } from "../content/telHref";
import { TOPICS } from "../content/topics";
import {
  KB_QUESTIONS,
  questionsFor,
  relatedQuestions,
} from "../content/kbQuestions";
import TopicList from "./TopicList";
import AnswerView from "./AnswerView";
import AskBar from "./AskBar";
import { announcementFor, replyViewOf } from "../replyView";
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

console.log("\nTest 7: the old example chips are gone (UI-12)");
{
  const html = renderChat([{ id: "1", role: "user", text: "hi" }]);
  assert(!html.includes('class="chip'), "no chip in the conversation");
  assert(!html.includes("category-chips"), "no chip group in the conversation");
}

console.log("\nTest 8: nothing imports the old chips or follow-ups");
{
  const uiText = readFileSync(
    new URL("../content/uiText.ts", import.meta.url),
    "utf8",
  );
  for (const name of [
    "TOPIC_EXAMPLES",
    "SUGGESTIONS",
    "offersFollowUps",
    "suggestionsFor",
  ]) {
    assert(!uiText.includes(name), `uiText.ts no longer has ${name}`);
  }
  for (const file of [
    "./ChatInterface.tsx",
    "./AnswerView.tsx",
    "../App.tsx",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert(
      !/TOPIC_EXAMPLES|SUGGESTIONS|suggestionsFor|You could also ask/.test(
        source,
      ),
      `${file} uses none of them`,
    );
  }
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

console.log('\nTest 15: the "You could also ask" follow-ups are gone (UI-12)');
{
  const html = renderChat([
    { id: "1", role: "user", text: "what is PrEP" },
    {
      id: "2",
      role: "assistant",
      text: "answer",
      outcome: "grounded_answer",
      answerFound: true,
      details: { category: "sti" },
    },
  ]);
  assert(!html.includes("You could also ask"), "no follow-up label");
  assert(!html.includes('class="suggestion'), "no follow-up buttons");
}

console.log("\nTest 16: the screen shows the latest exchange only");
{
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    app.includes("setTurns([userTurn]);") &&
      !app.includes("setTurns((prev) => [...prev, userTurn])"),
    "a new question replaces the last exchange; earlier ones are not kept",
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

console.log("\nTest 18: the answer screen is for knowledge-base answers only");
{
  const question: ChatTurn = { id: "q", role: "user", text: "what is PrEP" };
  const reply = (extra: Partial<ChatTurn>): ChatTurn => ({
    id: "a",
    role: "assistant",
    text: "reply",
    outcome: "grounded_answer",
    ...extra,
  });
  const isAnswerScreen = (turns: ChatTurn[], isLoading = false) =>
    renderToStaticMarkup(
      <ChatInterface
        turns={turns}
        onSend={() => undefined}
        isLoading={isLoading}
      />,
    ).includes("answer-screen");
  const matched = KB_QUESTIONS[0].question;

  for (const kind of ["answer-scoped", "answer-unscoped"] as const) {
    assert(
      isAnswerScreen([question, reply({ kind, matchedQuestion: matched })]),
      `${kind}: the answer screen`,
    );
  }
  for (const kind of ["abstain", "help", "held-topic", "vague"] as const) {
    assert(
      !isAnswerScreen([question, reply({ kind, matchedQuestion: null })]),
      `${kind}: not the answer screen`,
    );
  }
  assert(
    !isAnswerScreen([question, reply({ limitedMode: true })]),
    "a limited-mode answer (no kind, no entry): not the answer screen",
  );
  assert(
    !isAnswerScreen([question]),
    "a question with no answer yet (an error): not the answer screen",
  );
  assert(
    !isAnswerScreen(
      [question, reply({ kind: "answer-scoped", matchedQuestion: matched })],
      true,
    ),
    "not while the next answer is loading",
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
      "chat, answer screen",
      chat(
        reply({
          outcome: "grounded_answer",
          answerFound: true,
          kind: "answer-scoped",
          matchedQuestion: KB_QUESTIONS[0].question,
          source: "WHO",
        }),
      ),
    ],
    [
      "chat, no answer",
      chat(
        reply({
          outcome: "grounded_answer",
          answerFound: false,
          kind: "abstain",
        }),
      ),
    ],
    ["chat, help", chat(reply({ outcome: "signposting", kind: "help" }))],
    ["chat, vague", chat(reply({ outcome: "clarification", kind: "vague" }))],
    ["chat, held", chat(reply({ outcome: "held", kind: "held-topic" }))],
    [
      "chat, limited mode",
      chat(reply({ outcome: "grounded_answer", limitedMode: true })),
    ],
    [
      "referral",
      <AppShell onExit={noop} help={closedHelp} calm footerInContent>
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

  // These replies show the GBV call button: the footer line points to it
  // instead of repeating the number.
  const callAbove = ["chat, help", "chat, held", "referral"];
  for (const [name, element] of screens) {
    const html = renderToStaticMarkup(element);
    assert(
      html.split('class="danger-line"').length === 2,
      `${name}: the footer line appears once`,
    );
    if (callAbove.includes(name)) {
      assert(
        html.includes(`<p class="danger-line">${DANGER_LINE_CALL_ABOVE}</p>`) &&
          !DANGER_LINE_CALL_ABOVE.includes(GBV_HELPLINE) &&
          html.includes(`class="call-button call-button--main" ${href}`),
        `${name}: the line points to the call button, without repeating the number`,
      );
    } else {
      assert(
        html.includes(
          `${line}<a ${href} aria-label="${telName(GBV_HELPLINE)}">${GBV_HELPLINE}</a>, free and open 24 hours.`,
        ),
        `${name}: its tap-to-call link is built from GBV_HELPLINE`,
      );
    }
    const exitAt = html.search(
      /<button class="btn-exit(-pill)?" type="button">Exit<\/button>/,
    );
    assert(
      exitAt > -1 && exitAt < html.indexOf('class="danger-line"'),
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
    "./AnswerView.tsx",
    "./ReplyViews.tsx",
    "./CallButtons.tsx",
    "./TopicChoices.tsx",
    "./ReferralScreen.tsx",
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
      `<a class="btn-call" href="${telHref(GBV_HELPLINE)}" aria-label="${telName(GBV_HELPLINE, `Call ${GBV_HELPLINE}`)}">Call ${GBV_HELPLINE}</a><span>GBV helpline. Free, 24 hours, English and Kiswahili.</span>`,
    ),
    "1195: tap-to-call from the constant, with the checked wording",
  );
  assert(
    html.includes(
      `<a class="btn-call" href="${telHref(CHILDLINE_KENYA)}" aria-label="${telName(CHILDLINE_KENYA, `Call ${CHILDLINE_KENYA}`)}">Call ${CHILDLINE_KENYA}</a><span>Childline Kenya, for children and young people.</span>`,
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
      `In immediate danger? Call <a href="${telHref(a)}" aria-label="${telName(a)}">${a}</a> or <a href="${telHref(b)}" aria-label="${telName(b)}">${b}</a>.`,
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
      html.includes(
        `data-topic="${topic.topicClass}"><span class="topic-choice-label">${topic.label}</span></button>`,
      ),
      `topic button (the shared TopicChoices): ${topic.label}`,
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
    html.indexOf('<div class="ask-card">'),
    html.indexOf("</div></div>", html.indexOf('<div class="ask-card">')),
  );
  assert(pill.split("<input").length === 2, "the ask card has one input");
  assert(
    pill.includes(
      `<label class="ask-card-label" for="chat-input">${ASK_LABEL}</label>`,
    ) && pill.includes('id="chat-input"'),
    `a visible label, "${ASK_LABEL}", tied to it`,
  );
  assert(
    pill.includes(`aria-label="${ASK_SEND_NAME}"`) &&
      pill.includes('class="btn-send"'),
    `a send button named "${ASK_SEND_NAME}"`,
  );
  assert(
    pill.includes(`placeholder="${escapeHtml(PLACEHOLDER_EXAMPLES[0])}"`),
    "the placeholder starts with the first example",
  );
  assert(
    !html.slice(0, html.indexOf("ask-card")).includes("aria-live"),
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
        /<button class="topic-question" type="button" data-question="[^"]*"><span>([^<]*)<\/span><span class="topic-question-go" aria-hidden="true">/g,
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
    list.includes("onClick={() => onAsk(item.question, item.id)}"),
    "a row hands its exact question text (and its id, for focus) to onAsk",
  );
  assert(
    /const ask = \(\) => \{[^}]*onAsk\(text, null\);/.test(list),
    "the ask bar hands its text to the same onAsk",
  );
  assert(
    list.includes("onAsk: (text: string, questionId: string | null) => void;"),
    "onAsk takes the text and the row id: nothing scopes it to the topic",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    /const askFromTopic = \(text: string, questionId: string \| null\) => \{\s*if \(topic\) setAnswerOrigin\(\{ topic, questionId \}\);\s*setScreen\("chat"\);\s*void handleSend\(text\);/.test(
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
    ).includes('<h1 tabindex="-1" class="reply-title">m</h1>'),
    "the referral heading (its message) can take focus when it appears",
  );
}

const KB_S5 = KB_QUESTIONS.find((item) => item.id === "KB-S5")!;
const answerTurn = (extra: Partial<ChatTurn> = {}): ChatTurn => ({
  id: "a1",
  role: "assistant",
  text: "First paragraph of the answer.\n\nSecond paragraph, after a break.",
  outcome: "grounded_answer",
  answerFound: true,
  kind: "answer-scoped",
  matchedQuestion: KB_S5.question,
  source: "Kenya MOH (2015); WHO (2018)",
  details: DETAILS,
  ...extra,
});
const renderAnswer = (turn: ChatTurn, showDetails = false) =>
  renderToStaticMarkup(
    <ChatInterface
      turns={[{ id: "u1", role: "user", text: "can stis be cured" }, turn]}
      onSend={() => undefined}
      isLoading={false}
      showDetails={showDetails}
      back={{ label: "Back to home", onBack: () => undefined }}
    />,
  );

console.log(
  "\nTest 31: the answer screen shows the closest question and the answer as sent",
);
{
  const turn = answerTurn();
  const html = renderAnswer(turn);
  assert(html.split("<h1").length === 2, "one h1");
  assert(
    html.includes(
      `<h1 tabindex="-1" class="closest"><span class="closest-label">The closest question I have</span><span class="closest-question">${escapeHtml(KB_S5.question)}</span></h1>`,
    ),
    "the h1 is the matched question, labelled as the closest one I have",
  );
  assert(
    !html.includes("can stis be cured"),
    "the question she typed is not shown as the matched one (nor at all)",
  );
  assert(
    !/You asked|Your question/.test(html),
    "the matched question is never presented as hers",
  );
  assert(
    html.includes(`<p class="answer-text">${turn.text}</p>`),
    "the answer text equals the response text, line breaks included",
  );
  const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
  assert(
    /\.answer-text \{[^}]*white-space: pre-line;/.test(css) &&
      /\.answer-text \{[^}]*font-size: 16px;[^}]*font-weight: var\(--weight-semibold\);[^}]*line-height: 1\.55;/.test(
        css,
      ),
    "paragraph breaks are kept (pre-line); 16px, weight 600, line-height 1.55",
  );
  assert(
    html.indexOf("closest-label") < html.indexOf("answer-card") &&
      html.indexOf("answer-card") < html.indexOf("answer-text"),
    "the closest question, then the answer card",
  );
  assert(
    /<h2 id="answer-title" class="answer-pill"><svg[^>]*><path[^>]*><\/path><\/svg> Answer<\/h2>/.test(
      html,
    ) && html.indexOf("answer-pill") < html.indexOf("answer-text"),
    'the "Answer" pill, with a check icon, at the top of the card (an h2)',
  );
}

console.log("\nTest 32: the source as sent, then the shared disclaimer");
{
  const withSource = renderAnswer(answerTurn());
  const sourceAt = withSource.indexOf(
    '<p class="answer-source">Source: Kenya MOH (2015); WHO (2018)</p>',
  );
  const disclaimerAt = withSource.indexOf(
    `<p class="answer-disclaimer">${ANSWER_DISCLAIMER}</p>`,
  );
  assert(
    sourceAt > withSource.indexOf("answer-text"),
    "the source line, under the answer",
  );
  assert(disclaimerAt > sourceAt, "then the disclaimer");
  assert(
    ANSWER_DISCLAIMER ===
      "General information, not a diagnosis. A nurse or clinic can test and treat you.",
    "the disclaimer wording",
  );
  for (const source of [null, undefined, ""]) {
    const html = renderAnswer(answerTurn({ source }));
    assert(
      !html.includes("Source:") && html.includes(ANSWER_DISCLAIMER),
      `no source in the response (${JSON.stringify(source)}): no source line, nothing invented; the disclaimer stays`,
    );
  }
  const view = readFileSync(
    new URL("./AnswerView.tsx", import.meta.url),
    "utf8",
  );
  assert(
    view.includes("{ANSWER_DISCLAIMER}") && !view.includes("not a diagnosis"),
    "the disclaimer is the one shared constant, not typed in the view",
  );
}

console.log("\nTest 33: no confidence pill, match label or score anywhere");
{
  for (const showDetails of [false, true]) {
    const html = renderAnswer(answerTurn(), showDetails);
    for (const word of [
      "confidence",
      "0.82",
      "strong match",
      "Strong match",
      "similarity",
      "score",
      "%",
      "answer-details",
    ]) {
      assert(
        !html.includes(word),
        `details ${showDetails ? "on" : "off"}: no "${word}"`,
      );
    }
  }
  const view = readFileSync(
    new URL("./AnswerView.tsx", import.meta.url),
    "utf8",
  );
  assert(
    !/details|confidence|similarity|score/i.test(
      view.slice(view.indexOf("export default")),
    ),
    "the view reads no details, confidence or score",
  );
}

console.log(
  "\nTest 34: two related questions of the same class, not the matched one",
);
{
  for (const item of KB_QUESTIONS) {
    const related = relatedQuestions(item.question);
    const others = questionsFor(item.topicClass).filter(
      (other) => other.id !== item.id,
    );
    assert(
      related.length === Math.min(2, others.length) &&
        related.every((q) => others.some((other) => other.question === q)) &&
        !related.includes(item.question),
      `${item.id}: ${related.length} others of ${item.topicClass}, excluding itself`,
    );
  }
  assert(
    relatedQuestions("a question not in the knowledge base").length === 0,
    "no matched entry: no related questions (none invented)",
  );
  const html = renderAnswer(answerTurn());
  const rows = [
    ...html.matchAll(
      /<button class="topic-question" type="button"><span>([^<]*)<\/span><span class="topic-question-go" aria-hidden="true">/g,
    ),
  ].map((m) => m[1]);
  assert(
    JSON.stringify(rows) ===
      JSON.stringify(relatedQuestions(KB_S5.question).map(escapeHtml)),
    "KB-S5: its two related questions as chevron rows",
  );
  assert(
    html.includes(
      '<h2 id="related-title" class="related-title">Related questions</h2>',
    ) && html.indexOf("related-title") > html.indexOf("answer-disclaimer"),
    '"Related questions" under the answer card',
  );
  const view = readFileSync(
    new URL("./AnswerView.tsx", import.meta.url),
    "utf8",
  );
  assert(
    view.includes("onClick={() => onSend(question)}"),
    "tapping one sends its exact text",
  );
  const chat = readFileSync(
    new URL("./ChatInterface.tsx", import.meta.url),
    "utf8",
  );
  assert(
    chat.includes("onSend={onSend}") && chat.includes("onSend(trimmed);"),
    "through the same onSend as the ask bar (App's full pipeline)",
  );
}

console.log("\nTest 35: back link, ask bar and frame of the answer screen");
{
  for (const label of ["Back to home", "Back to Pregnancy"]) {
    const html = renderToStaticMarkup(
      <AnswerView
        turn={answerTurn()}
        onSend={() => undefined}
        back={{ label, onBack: () => undefined }}
        askBar={null}
      />,
    );
    assert(
      new RegExp(
        `^<main class="screen chat-screen answer-screen"><button class="back-link" type="button"><svg[^>]*>.*?</svg> ${label}</button>`,
      ).test(html),
      `"${label}" is the first thing on the screen, a button`,
    );
  }
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    app.includes("label: `Back to ${answerOrigin.topic.label}`") &&
      app.includes(': { label: "Back to home", onBack: handleNewChat };'),
    'from a Topic list "Back to <topic label>", otherwise "Back to home"',
  );
  assert(
    app.includes("focusQuestionId={answerOrigin?.questionId ?? null}"),
    "back to the Topic list hands it the tapped row",
  );
  const list = readFileSync(
    new URL("./TopicList.tsx", import.meta.url),
    "utf8",
  );
  assert(
    list.includes("data-question={item.id}") &&
      list.includes("(row ?? headingRef.current)?.focus();"),
    "the Topic list focuses that row (its h1 if none was tapped)",
  );
  assert(
    /const openTopic = [^}]*setAnswerOrigin\(null\);/.test(app) &&
      /const askFromChat = \(text: string\) => \{\s*setAnswerOrigin\(null\);\s*void handleSend\(text\);/.test(
        app,
      ),
    "a question asked on the chat screen (ask bar, related) goes back to Home",
  );
  const html = renderAnswer(answerTurn());
  const lineAt = html.indexOf('class="danger-line"');
  const barAt = html.indexOf('<div class="input-row">');
  assert(
    lineAt > html.lastIndexOf("topic-question") && barAt > lineAt,
    "the footer line after the related questions, then the ask bar",
  );
  assert(
    html.includes(
      '<label class="sr-only" for="chat-input">Ask something else</label>',
    ) && html.split("<input").length === 2,
    'one ask bar, labelled "Ask something else"',
  );
  assert(
    app.includes("onSend={askFromChat}") &&
      app.includes("submitQuery(text, { signal: request.signal })"),
    "the ask bar runs the full pipeline with the text only: never scoped",
  );
}

console.log("\nTest 36: focus moves to the closest question; announced once");
{
  const html = renderAnswer(answerTurn());
  assert(
    html.includes('<h1 tabindex="-1" class="closest">'),
    "the h1 can take focus",
  );
  const view = readFileSync(
    new URL("./AnswerView.tsx", import.meta.url),
    "utf8",
  );
  assert(
    /useEffect\(\(\) => \{\s*headingRef\.current\?\.focus\(\);\s*\}, \[turn\.id\]\);/.test(
      view,
    ),
    "focus moves to it when a new answer arrives",
  );
  assert(
    !html.includes("aria-live") && !html.includes('role="status"'),
    "the answer is in no live region (not read twice)",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    app.includes('<p className="sr-only" role="status" aria-live="polite">') &&
      app.includes("announcementFor(replyViewOf(lastTurn))") &&
      announcementFor("answer") === "New answer.",
    'one polite live region, outside the screen, says "New answer." once',
  );
  const h2s = [...html.matchAll(/<h([1-6])/g)].map((m) => m[1]);
  assert(
    JSON.stringify(h2s) === JSON.stringify(["1", "2", "2"]),
    "heading order: h1 (closest question), h2 Answer, h2 Related questions",
  );
}

const ECHO = "<b>x</b>";
const replyTurns = (text: string, extra: Partial<ChatTurn>): ChatTurn[] => [
  { id: "u7", role: "user", text: ECHO },
  {
    id: "r7",
    role: "assistant",
    text,
    outcome: "grounded_answer",
    details: DETAILS,
    ...extra,
  },
];
const renderReply = (
  text: string,
  extra: Partial<ChatTurn>,
  showDetails = false,
) =>
  renderToStaticMarkup(
    <ChatInterface
      turns={replyTurns(text, extra)}
      onSend={() => undefined}
      isLoading={false}
      showDetails={showDetails}
    />,
  );
const KINDS: [string, string, Partial<ChatTurn>][] = [
  ["clarify", VAGUE_QUERY_MESSAGE, { outcome: "clarification", kind: "vague" }],
  ["held A", HELD_TOPIC_MESSAGES.A, { outcome: "held", kind: "held-topic" }],
  ["held B", HELD_TOPIC_MESSAGES.B, { outcome: "held", kind: "held-topic" }],
  ["held C", HELD_TOPIC_MESSAGES.C, { outcome: "held", kind: "held-topic" }],
  ["help", SIGNPOSTING_MESSAGE, { outcome: "signposting", kind: "help" }],
  ["no answer", NO_ANSWER_MESSAGE, { answerFound: false, kind: "abstain" }],
];
const referral = (message: string) =>
  renderToStaticMarkup(
    <ReferralScreen message={message} onContinueChat={() => undefined} />,
  );

console.log("\nTest 37: each reply kind has one h1, its reply text, focusable");
{
  const screens: [string, string, string][] = [
    ...KINDS.map(
      ([name, text, extra]) =>
        [name, text, renderReply(text, extra)] as [string, string, string],
    ),
    [
      "referral, abuse",
      ABUSE_REFERRAL_MESSAGE,
      referral(ABUSE_REFERRAL_MESSAGE),
    ],
    [
      "referral, self-harm",
      SELF_HARM_REFERRAL_MESSAGE,
      referral(SELF_HARM_REFERRAL_MESSAGE),
    ],
  ];
  for (const [name, text, html] of screens) {
    assert(html.split("<h1").length === 2, `${name}: one h1`);
    assert(
      html.includes(
        `<h1 tabindex="-1" class="reply-title">${escapeHtml(text)}</h1>`,
      ),
      `${name}: the h1 is the reply text exactly, and can take focus`,
    );
    const pillAt = html.indexOf('class="reply-pill"');
    assert(
      pillAt > -1 && pillAt < html.indexOf("<h1"),
      `${name}: a pill with an icon at the top of the card`,
    );
  }
  const views = readFileSync(
    new URL("./ReplyViews.tsx", import.meta.url),
    "utf8",
  );
  assert(
    /useEffect\(\(\) => \{\s*ref\.current\?\.focus\(\);\s*\}, \[key\]\);/.test(
      views,
    ) && views.split("useFocusOnArrival(id)").length === 6,
    "focus moves to the h1 on arrival, on all five reply screens",
  );
  const plain = renderChat([
    { id: "u", role: "user", text: "q" },
    {
      id: "p",
      role: "assistant",
      text: "limited answer",
      outcome: "grounded_answer",
      limitedMode: true,
    },
  ]);
  assert(
    plain.split("<h1").length === 2 &&
      plain.includes(
        '<h1 tabindex="-1" class="plain-reply">limited answer</h1>',
      ),
    "a reply with no kind (limited mode): its text is the one h1",
  );
  const waiting = renderToStaticMarkup(
    <ChatInterface
      turns={[{ id: "u", role: "user", text: "q" }]}
      onSend={() => undefined}
      isLoading
    />,
  );
  assert(
    waiting.split("<h1").length === 2 &&
      waiting.includes('<h1 class="sr-only">SafeGirl</h1>'),
    "waiting for a reply, or after an error: one (visually hidden) h1",
  );
  assert(
    renderToStaticMarkup(<SessionEnd onStartNew={() => undefined} />).includes(
      '<h1 id="session-end-title">Session ended.</h1>',
    ),
    "the session end has its h1",
  );
  const pills = [
    [KINDS[0], REPLY_PILLS.clarify],
    [KINDS[1], REPLY_PILLS.held],
    [KINDS[4], REPLY_PILLS.help],
    [KINDS[5], REPLY_PILLS.noAnswer],
  ] as const;
  for (const [[name, text, extra], label] of pills) {
    assert(
      /<p class="reply-pill"><svg[^>]*>[\s\S]*?<\/svg> ([^<]*)<\/p>/.exec(
        renderReply(text, extra),
      )?.[1] === label,
      `${name}: the pill reads "${label}"`,
    );
  }
  assert(
    referral("m").includes(`</svg> ${REPLY_PILLS.referral}</p>`),
    `referral: the pill reads "${REPLY_PILLS.referral}"`,
  );
}

console.log(
  "\nTest 38: her question shown back on clarify and no answer only, escaped",
);
{
  for (const [name, text, extra] of KINDS) {
    const html = renderReply(text, extra);
    const echoes = name === "clarify" || name === "no answer";
    assert(!html.includes(ECHO), `${name}: never rendered as HTML`);
    if (echoes) {
      assert(
        html.includes(
          '<p class="you-asked-label">You asked</p><p class="you-asked-text">&lt;b&gt;x&lt;/b&gt;</p>',
        ),
        `${name}: "You asked" and her text, as plain text`,
      );
    } else {
      assert(
        !html.includes("&lt;b&gt;") && !html.includes("You asked"),
        `${name}: her text is not shown`,
      );
    }
  }
  assert(
    !referral(ABUSE_REFERRAL_MESSAGE).includes("You asked"),
    "referral: her text is not shown (the screen gets the message only)",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    /setReferralMessage\(response\.message\);[\s\S]{0,200}setTurns\(\[\]\);/.test(
      app,
    ),
    "after a referral her question is dropped, so Continue chat never shows it",
  );
  const waiting = renderToStaticMarkup(
    <ChatInterface
      turns={[{ id: "u", role: "user", text: ECHO }]}
      onSend={() => undefined}
      isLoading
    />,
  );
  assert(
    !waiting.includes("&lt;b&gt;") && !waiting.includes("user-bubble"),
    "while the reply loads (or after an error), her text is not shown",
  );
}

console.log(
  "\nTest 39: call buttons from the constants on held, help and referral",
);
{
  const contacts = SUPPORT_SECTIONS.flatMap((section) => section.contacts);
  const note = (number: string) => {
    const contact = contacts.find((item) => item.numbers.includes(number));
    return `${contact?.label}. ${contact?.note}`;
  };
  const button = (kind: string, number: string) =>
    `<a class="call-button call-button--${kind}" href="${telHref(number)}"><svg`;
  const withCalls: [string, string][] = [
    ["held A", renderReply(HELD_TOPIC_MESSAGES.A, KINDS[1][2])],
    ["held C", renderReply(HELD_TOPIC_MESSAGES.C, KINDS[3][2])],
    ["help", renderReply(SIGNPOSTING_MESSAGE, KINDS[4][2])],
    ["referral", referral(ABUSE_REFERRAL_MESSAGE)],
  ];
  for (const [name, html] of withCalls) {
    const mainAt = html.indexOf(button("main", GBV_HELPLINE));
    const secondAt = html.indexOf(button("second", CHILDLINE_KENYA));
    assert(
      mainAt > -1 && secondAt > mainAt,
      `${name}: Call ${GBV_HELPLINE} then Call ${CHILDLINE_KENYA}, tel: hrefs from the constants`,
    );
    for (const number of [GBV_HELPLINE, CHILDLINE_KENYA]) {
      assert(
        html.includes(
          `<span class="call-button-number">Call ${number}</span><span class="call-button-note">${note(number)}</span>`,
        ),
        `${name}: ${number}'s description is its constant label and note`,
      );
    }
  }
  for (const [name, html] of withCalls.slice(2)) {
    const [first, second] = EMERGENCY_NUMBERS;
    assert(
      html.includes(
        `<p class="emergency-line">In immediate danger? Call <a href="${telHref(first)}" aria-label="${telName(first)}">${first}</a> or <a href="${telHref(second)}" aria-label="${telName(second)}">${second}</a>.</p>`,
      ),
      `${name}: "In immediate danger? Call ${first} or ${second}." from the constants`,
    );
    assert(
      html.includes('class="reply-card reply-card--support surface-dark"'),
      `${name}: the dark card, with the white focus ring (surface-dark)`,
    );
  }
  for (const [name, text, extra] of [KINDS[0], KINDS[5]]) {
    assert(
      !renderReply(text, extra).includes("call-button"),
      `${name}: no call buttons`,
    );
  }
  const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
  assert(
    /\.call-button \{[^}]*min-height: 58px;[^}]*border: 1\.5px solid/.test(css),
    "call buttons are 58px tall (44px minimum) with a 1.5px edge",
  );
}

console.log(
  "\nTest 40: the four topic buttons and pills open their Topic lists",
);
{
  for (const [name, text, extra, variant] of [
    [...KINDS[0], "grid"],
    [...KINDS[5], "pills"],
  ] as const) {
    const html = renderReply(text, extra);
    const buttons = [
      ...html.matchAll(
        /<button class="topic-choice topic-choice--(\w+)" type="button" data-topic="(\w+)">([\s\S]*?)<\/button>/g,
      ),
    ];
    assert(
      buttons.length === 4 &&
        buttons.every(
          (b, i) =>
            b[1] === TOPICS[i].topicClass &&
            b[2] === TOPICS[i].topicClass &&
            b[3].endsWith(
              `<span class="topic-choice-label">${TOPICS[i].label}</span>`,
            ),
        ),
      `${name}: the four topics, in order, each carrying its class`,
    );
    assert(
      html.includes(`topic-choices topic-choices--${variant}`) &&
        (variant === "grid") === html.includes("topic-choice-icon"),
      `${name}: ${variant === "grid" ? "a 2x2 grid with icon tiles" : "pills"}`,
    );
  }
  const views = readFileSync(
    new URL("./ReplyViews.tsx", import.meta.url),
    "utf8",
  );
  assert(
    readFileSync(
      new URL("./TopicChoices.tsx", import.meta.url),
      "utf8",
    ).includes("onClick={() => onTopic(topic)}") &&
      views.split("<TopicChoices").length === 4,
    "tapping one hands its topic to onTopic",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    app.includes('onTopic={(next) => openTopic(next, "tile")}'),
    "App opens that Topic list (and back returns focus to the button)",
  );
  const clarify = renderReply(
    ...(KINDS[0].slice(1) as [string, Partial<ChatTurn>]),
  );
  assert(
    clarify.indexOf(`<p class="reply-note">${CLARIFY_FALLBACK}</p>`) >
      clarify.indexOf("</section>"),
    "clarify: the fallback line below the card",
  );
  const none = renderReply(
    ...(KINDS[5].slice(1) as [string, Partial<ChatTurn>]),
  );
  assert(
    none.includes('<h2 class="reply-subtitle">Try a topic instead</h2>') &&
      none.indexOf(`<p class="reply-note">${NO_ANSWER_RETRY}</p>`) >
        none.indexOf("</section>"),
    'no answer: "Try a topic instead", then the retry line below the card',
  );
  const held = renderReply(HELD_TOPIC_MESSAGES.A, KINDS[1][2]);
  assert(
    held.includes(
      '<button class="reply-link" type="button">Ask a different question</button>',
    ) && app.includes("onHome={handleNewChat}"),
    'held: "Ask a different question" returns to Home (whose h1 takes focus)',
  );
}

console.log("\nTest 41: Exit, the footer line and the ask bar on every reply");
{
  const noop = () => undefined;
  const framed: [string, string][] = [
    ...KINDS.map(
      ([name, text, extra]) =>
        [
          name,
          renderToStaticMarkup(
            <AppShell onExit={noop} help={closedHelp} footerInContent>
              <ChatInterface
                turns={replyTurns(text, extra)}
                onSend={noop}
                isLoading={false}
              />
            </AppShell>,
          ),
        ] as [string, string],
    ),
    [
      "referral",
      renderToStaticMarkup(
        <AppShell onExit={noop} help={closedHelp} calm footerInContent>
          <ReferralScreen
            message={ABUSE_REFERRAL_MESSAGE}
            onContinueChat={noop}
          />
        </AppShell>,
      ),
    ],
  ];
  for (const [name, html] of framed) {
    assert(
      html.includes('<button class="btn-exit" type="button">Exit</button>'),
      `${name}: Exit in the header`,
    );
    assert(
      html.split('class="danger-line"').length === 2,
      `${name}: the footer line once`,
    );
    if (name !== "referral") {
      assert(
        html.includes(
          '<label class="sr-only" for="chat-input">Ask something else</label>',
        ),
        `${name}: the ask bar, "Ask something else"`,
      );
    }
  }
}

console.log(
  "\nTest 42: no score or confidence; details only in the plain view, when asked",
);
{
  for (const [name, text, extra] of KINDS) {
    for (const showDetails of [false, true]) {
      const html = renderReply(text, extra, showDetails);
      assert(
        !/confidence|similarity|score|strong match|classifier:|answer-details/i.test(
          html,
        ),
        `${name}, details ${showDetails ? "on" : "off"}: no score, confidence or details line`,
      );
    }
  }
  assert(
    !/confidence|score|classifier:/.test(referral(ABUSE_REFERRAL_MESSAGE)),
    "referral: none either",
  );
  const plain = (showDetails: boolean) =>
    renderToStaticMarkup(
      <ChatInterface
        turns={[
          {
            id: "p",
            role: "assistant",
            text: "limited answer",
            outcome: "grounded_answer",
            details: DETAILS,
          },
        ]}
        onSend={() => undefined}
        isLoading={false}
        showDetails={showDetails}
      />,
    );
  assert(
    !plain(false).includes("classifier:") &&
      plain(true).includes("classifier:"),
    "the ?details=1 line: hidden by default, shown only when asked for",
  );
}

console.log(
  "\nTest 43: one polite announcement per reply; no reply text in a live region",
);
{
  const turn = (extra: Partial<ChatTurn>): ChatTurn => ({
    id: "t",
    role: "assistant",
    text: "t",
    ...extra,
  });
  const expected: [string, string][] = [
    [
      announcementFor(replyViewOf(turn({ kind: "vague" }))),
      `New reply: ${REPLY_PILLS.clarify}.`,
    ],
    [
      announcementFor(replyViewOf(turn({ kind: "held-topic" }))),
      `New reply: ${REPLY_PILLS.held}.`,
    ],
    [
      announcementFor(replyViewOf(turn({ kind: "help" }))),
      `New reply: ${REPLY_PILLS.help}.`,
    ],
    [
      announcementFor(replyViewOf(turn({ kind: "abstain" }))),
      `New reply: ${REPLY_PILLS.noAnswer}.`,
    ],
    [announcementFor("referral"), `New reply: ${REPLY_PILLS.referral}.`],
    [announcementFor(replyViewOf(turn({ limitedMode: true }))), "New reply."],
    [announcementFor(replyViewOf({ id: "u", role: "user", text: "q" })), ""],
  ];
  for (const [actual, wanted] of expected) {
    assert(actual === wanted, `announces "${wanted}"`);
  }
  for (const [name, text, extra] of KINDS) {
    const html = renderReply(text, extra);
    assert(
      !html.includes("aria-live") && !html.includes('role="alert"'),
      `${name}: the reply text is in no live region`,
    );
  }
  assert(
    !referral(ABUSE_REFERRAL_MESSAGE).includes('role="alert"'),
    "referral: no alert re-reading the message",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    app.split('aria-live="polite"').length === 2 &&
      app.indexOf('aria-live="polite"') < app.indexOf('screen === "chat" &&'),
    "App's one live region sits outside the screens, so it survives a screen change (the referral)",
  );
}

console.log("\nTest 44: the topic grid and the footer line fit narrow phones");
{
  const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
  // The declarations of the top-level rule with exactly this selector.
  const rule = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
  };
  assert(
    rule(".topic-choices").includes(
      "grid-template-columns: repeat(2, minmax(0, 1fr));",
    ) && rule(".topic-choices").includes("gap: 10px;"),
    "two equal columns that can shrink, 10px apart",
  );
  assert(
    /min-width: 0;\s*max-width: 100%;/.test(rule(".topic-choices > li")),
    "every grid child: min-width 0, max-width 100%",
  );
  const button = rule(".topic-choice");
  assert(
    [
      "box-sizing: border-box;",
      "width: 100%;",
      "padding: 10px 12px;",
      "font-size: 15px;",
      "font-weight: var(--weight-black);",
      "border: 1.5px solid var(--color-control-border);",
    ].every((d) => button.includes(d)),
    "buttons: border-box, full width, 10px 12px, 15px weight 900, the 3:1 edge",
  );
  assert(
    rule(".topic-choice-label").includes("overflow-wrap: anywhere;") &&
      !/\.topic-choice[^{]*\{[^}]*white-space: nowrap/.test(css),
    "labels wrap; nothing forbids it",
  );
  assert(
    rule(".topic-choices--grid .topic-choice").includes("min-height: 58px;") &&
      rule(".topic-choice-icon").includes("flex: none;") &&
      rule(".topic-choice-icon").includes("width: 32px;"),
    "grid buttons keep 58px and the 32px icon tile, which does not shrink",
  );
  assert(
    /@media \(max-width: 359px\) \{\s*\.topic-choice \{\s*font-size: 14px;/.test(
      css,
    ),
    "under 360px the label is 14px",
  );
  assert(
    rule(".topic-choices--grid").includes("container-type: inline-size;") &&
      css.includes(
        "@container (max-width: 359px) {\n  .topic-choices--grid .topic-choice {\n    flex-direction: column;",
      ),
    "a grid too narrow for icon and label side by side puts the icon above, so no word breaks",
  );
  assert(
    rule(".reply-card").includes("overflow: visible;") &&
      rule(".reply-card").includes("min-width: 0;"),
    "the reply card neither clips nor scrolls sideways",
  );
  assert(
    rule(".danger-line").includes("line-height: 1.35;") &&
      !rule(".danger-line a").includes("min-height") &&
      css.includes(".danger-line a::after,\n.emergency-line a::after {") &&
      rule(".emergency-line a::after").includes("height: var(--tap-target);") &&
      rule(".emergency-line").includes("line-height: 1.35;") &&
      !rule(".emergency-line a").includes("min-height"),
    "footer and emergency lines: line-height 1.35; their links keep a 44px-tall tap area",
  );
  const sheet = readFileSync(
    new URL("./HelpSheet.tsx", import.meta.url),
    "utf8",
  );
  assert(
    sheet.includes('<TopicChoices variant="pills" onTopic={onTopic} />') &&
      !css.includes(".topic-button"),
    "the Help sheet uses the same TopicChoices; the old topic-button copy is gone",
  );
}

console.log("\nTest 45: the Talk to a person screen");
{
  const noop = () => undefined;
  const limited = (kind: "vague" | "abstain", extra: Partial<ChatTurn> = {}) =>
    renderToStaticMarkup(
      <AppShell onExit={noop} help={closedHelp} footerInContent>
        <ChatInterface
          turns={[
            { id: "u8", role: "user", text: ECHO },
            {
              id: "r8",
              role: "assistant",
              text: kind === "vague" ? VAGUE_QUERY_MESSAGE : NO_ANSWER_MESSAGE,
              outcome: kind === "vague" ? "clarification" : "grounded_answer",
              kind,
              loopLimited: true,
              ...extra,
            },
          ]}
          onSend={noop}
          isLoading={false}
        />
      </AppShell>,
    );
  for (const kind of ["vague", "abstain"] as const) {
    const html = limited(kind);
    assert(
      html.split("<h1").length === 2 &&
        html.includes(
          `<h1 tabindex="-1" class="reply-title">${escapeHtml(PERSON_MESSAGE)}</h1>`,
        ),
      `${kind} at the limit: one h1, the person message, focusable`,
    );
    assert(
      !html.includes(escapeHtml(VAGUE_QUERY_MESSAGE)) &&
        !html.includes(escapeHtml(NO_ANSWER_MESSAGE)),
      `${kind} at the limit: shown instead of the reply`,
    );
    assert(
      !html.includes("&lt;b&gt;") && !html.includes("You asked"),
      `${kind} at the limit: her text is not shown`,
    );
    assert(
      html.includes(`</svg> ${escapeHtml(REPLY_PILLS.person)}</p>`) &&
        html.includes(
          'class="reply-card reply-card--noanswer reply-card--person"',
        ),
      `${kind} at the limit: the no-answer card, pill "${REPLY_PILLS.person}"`,
    );
    assert(
      html.includes(
        '<button class="btn-see-help" type="button">See who can help</button>',
      ) &&
        !html.includes("call-button") &&
        !html
          .slice(
            html.indexOf("reply-card--person"),
            html.indexOf("</section>", html.indexOf("reply-card--person")),
          )
          .includes('href="tel:'),
      `${kind} at the limit: "See who can help", no call buttons in the card`,
    );
    const pills = [...html.matchAll(/data-topic="(\w+)"/g)].map((m) => m[1]);
    assert(
      JSON.stringify(pills) === JSON.stringify(TOPICS.map((t) => t.topicClass)),
      `${kind} at the limit: the four topic pills`,
    );
    assert(
      html.includes('<button class="btn-exit" type="button">Exit</button>') &&
        html.split('class="danger-line"').length === 2 &&
        html.includes(`${GBV_HELPLINE}</a>, free and open 24 hours.`),
      `${kind} at the limit: Exit and the footer line`,
    );
  }
  assert(
    !limited("vague", { loopLimited: false }).includes(
      PERSON_MESSAGE.slice(0, 20),
    ),
    "below the limit, the normal clarify screen",
  );
  const chat = readFileSync(
    new URL("./ChatInterface.tsx", import.meta.url),
    "utf8",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    chat.includes("onOpenHelp={onOpenHelp}") &&
      app.includes("onOpenHelp={openHelp}"),
    '"See who can help" opens the Help sheet',
  );
}

console.log("\nTest 46: every phone link's name says which service it calls");
{
  assert(
    telName(GBV_HELPLINE) === `${GBV_HELPLINE}, GBV helpline` &&
      telName(CHILDLINE_KENYA, `Call ${CHILDLINE_KENYA}`) ===
        `Call ${CHILDLINE_KENYA}, Childline Kenya` &&
      telName(EMERGENCY_NUMBERS[0]) === `${EMERGENCY_NUMBERS[0]}, Emergency`,
    "names: the visible text first, then the service label from SUPPORT_SECTIONS",
  );
  const noop = () => undefined;
  const pages = [
    renderToStaticMarkup(
      <HelpSheet onClose={noop} onExit={noop} onTopic={noop} />,
    ),
    renderToStaticMarkup(<SupportContent />),
    renderToStaticMarkup(
      <ReferralScreen message={ABUSE_REFERRAL_MESSAGE} onContinueChat={noop} />,
    ),
    renderChat([]),
  ];
  const services = ["GBV helpline", "Childline Kenya", "Emergency"];
  for (const html of pages) {
    for (const link of html.match(
      /<a [^>]*href="tel:[^"]*"[^>]*>[\s\S]*?<\/a>/g,
    ) ?? []) {
      const label = /aria-label="([^"]*)"/.exec(link)?.[1];
      const text = link.replace(/<[^>]*>/g, "");
      const name = label ?? text;
      const visible = text.replace(/\s+/g, " ").trim();
      assert(
        services.some((service) => name.includes(service)) &&
          (label === undefined ||
            label.startsWith(visible.split(/(?<=\d)(?=[A-Z])/)[0])),
        `"${visible.slice(0, 40)}": named "${name.slice(0, 50)}", which starts with the visible text`,
      );
    }
  }
}

console.log(
  "\nTest 47: reflow at 200% zoom: header, Home tiles and the wordmark",
);
{
  const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
  const rule = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
  };
  assert(
    rule(".app-header").includes("flex-wrap: wrap;") &&
      rule(".header-actions").includes("flex-wrap: wrap;") &&
      rule(".header-actions").includes("margin-left: auto;"),
    "the header wraps: Help and Exit move to a second row instead of scrolling",
  );
  assert(
    rule(".topic-tiles").includes(
      "grid-template-columns: repeat(2, minmax(0, 1fr));",
    ) &&
      rule(".topic-tiles > *").includes("min-width: 0;") &&
      rule(".topic-tile-label").includes("overflow-wrap: anywhere;"),
    "Home's tiles: two shrinkable columns, labels that wrap",
  );
  assert(
    rule(".splash-wordmark").includes("font-size: min(44px, 16vw);"),
    "the splash wordmark is never wider than the screen",
  );
  assert(
    css.includes("html:has(.answer-dock) {\n  scroll-padding-bottom: 40vh;\n}"),
    "a focused control scrolls clear of the docked ask bar (WCAG 2.4.11)",
  );
}

/** The Home ask bar alone, for its send button's state. */
function AskBarForTest({ value }: { value: string }) {
  return (
    <AskBar
      variant="hero"
      value={value}
      onChange={() => undefined}
      onSubmit={() => undefined}
      disabled={false}
      placeholder="p"
      inputRef={{ current: null }}
    />
  );
}

console.log("\nTest 48: Home polish (step 4b)");
{
  const html = renderChat([]);
  assert(
    html.includes(`</svg> ${HERO_PILL}</p>`) &&
      html.indexOf('class="hero-tag"') < html.indexOf("<h1"),
    `the "${HERO_PILL}" pill with its lock, above the h1`,
  );
  assert(
    HERO_PILL === "Private and anonymous" &&
      ASK_LABEL === "Type your question" &&
      ASK_SEND_NAME === "Get an answer",
    "the new copy, each in one constant",
  );
  assert(
    html.includes('<span class="hero-decor" aria-hidden="true">') &&
      html.split("hero-circle hero-circle--").length === 3 &&
      html.includes("hero-sparkle-icon"),
    "the hero decoration (two circles and a sparkle) is hidden from screen readers",
  );
  assert(
    html.indexOf('class="ask-card"') > html.indexOf("</section>"),
    "the ask card follows the hero card",
  );
  /** True when Home's send button is enabled for this field value. */
  const send = (value: string) =>
    !renderToStaticMarkup(<AskBarForTest value={value} />).includes(
      'disabled="" aria-label="Get an answer"',
    );
  assert(!send(""), "the send button is disabled while the field is empty");
  assert(!send("   "), "and while it holds only spaces");
  assert(send("is my period normal"), "and enabled once there is text");
  const footer = html.slice(html.indexOf('<footer class="home-footer">'));
  assert(
    footer.includes('<p class="home-anonymous"><svg') &&
      footer.includes("Anonymous. We never ask for your name.") &&
      footer.includes(
        `<a href="${telHref(GBV_HELPLINE)}" aria-label="${telName(GBV_HELPLINE)}">${GBV_HELPLINE}</a>`,
      ),
    "the footer card: lock, the anonymous line and the footer line with its tel: link from the constant",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert(
    app.includes("End session") &&
      app.indexOf("<ChatInterface") < app.indexOf("End session"),
    "End session stays, directly after the chat (below the footer card)",
  );
  assert(
    JSON.stringify(TOPICS.map((t) => [t.label, t.topicClass, t.subtitle])) ===
      JSON.stringify([
        ["Periods and health", "general", "Cycle, pain, clinics"],
        ["Pregnancy", "pregnancy", "Signs, care, school"],
        ["Contraception", "contraception", "Methods and myths"],
        ["STIs and HIV", "sti", "Signs, testing, care"],
      ]),
    "labels and classes unchanged; the new subtitles",
  );
  const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
  const rule = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
  };
  assert(
    rule(".ask-field").includes("border: 1.5px solid var(--ask-field-edge);") &&
      rule(".ask-field .btn-send:disabled").includes(
        "background: var(--send-disabled-bg);",
      ) &&
      rule(".ask-field .btn-send:disabled").includes("opacity: 1;"),
    "the field has a 3:1 edge; the disabled send button keeps a mid-violet fill at full opacity",
  );
  assert(
    rule(".topic-tile").includes("border: 1.5px solid;") &&
      rule(".topic-tile").includes("min-height: 104px;"),
    "the topic cards keep their coloured edges",
  );
  assert(
    /@media \(max-width: 600px\) \{[\s\S]*?\.app-header \{\s*margin-right: 8px;\s*margin-left: 8px;/.test(
      css,
    ),
    "on phones the header lines up with the 20px content gutter",
  );
  const narrow = css.slice(css.lastIndexOf("@media (max-width: 359px) {"));
  assert(
    narrow.includes("column-gap: 8px;") &&
      narrow.includes(".topic-tile-label {\n    font-size: 15px;"),
    "under 360px: a 16px gutter, the header on one row, tile titles at 15px",
  );
}

console.log("\nAll component tests passed.");
