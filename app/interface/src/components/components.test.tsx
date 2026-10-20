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
    <Splash onContinue={() => undefined} />,
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
    [
      "splash",
      <AppShell onExit={noop} help={closedHelp} footerInContent>
        <Splash onContinue={noop} />
      </AppShell>,
    ],
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
    assert(
      html.includes('class="btn-exit"') &&
        html.indexOf('class="btn-exit"') < html.indexOf(line),
      `${name}: the header Exit button is present, before the content`,
    );
    if (name.startsWith("chat")) {
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
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert(!/\d{3}/.test(source), `${file} types no phone number`);
  }
}

console.log(
  "\nTest 21: App renders every screen inside AppShell and wires Exit",
);
{
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const shellOpen = app.indexOf("<AppShell");
  const shellClose = app.lastIndexOf("</AppShell>");
  for (const screen of ["splash", "chat", "referral", "sessionEnd"]) {
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
  assert(
    app.includes("replace: (url) => window.location.replace(url)") &&
      !app.includes("window.close("),
    "Exit uses location.replace, never window.close",
  );
}

console.log("\nTest 22: the splash is the once-per-session disclaimer");
{
  const html = renderToStaticMarkup(<Splash onContinue={() => undefined} />);
  assert(html.includes('class="splash surface-dark"'), "a dark surface");
  assert(/<h1[^>]*>SafeGirl<\/h1>/.test(html), "the wordmark is the h1");
  assert(
    html.includes("Honest answers about your body, health and growing up."),
    "the tagline",
  );
  for (const promise of [
    "<strong>Anonymous.</strong> We never ask for your name.",
    "<strong>Real guidance.</strong> Answers come from Kenyan Ministry of Health and WHO sources.",
    `<strong>Not a doctor.</strong> ${escapeHtml("This can't diagnose you.")} A nurse or clinic can.`,
  ]) {
    assert(html.includes(promise), `promise: ${promise.slice(0, 40)}…`);
  }
  assert(
    html.includes(
      '<button class="btn-splash" type="button">I understand, continue</button>',
    ),
    'the "I understand, continue" button',
  );
  const surfaceEnd = html.lastIndexOf("</section>");
  assert(
    html.includes('class="danger-line"') &&
      html.indexOf('class="danger-line"') < surfaceEnd,
    "the footer line is on the splash surface",
  );
  const shell = renderToStaticMarkup(
    <AppShell onExit={() => undefined} help={closedHelp} footerInContent>
      <Splash onContinue={() => undefined} />
    </AppShell>,
  );
  assert(
    shell.includes('class="btn-exit"') &&
      shell.indexOf('class="btn-exit"') < shell.indexOf("splash surface-dark"),
    "the header Exit button is present on the splash",
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
    renderToStaticMarkup(<Splash onContinue={() => undefined} />),
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

console.log("\nAll component tests passed.");
