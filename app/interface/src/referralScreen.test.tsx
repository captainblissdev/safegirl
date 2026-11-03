import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import BandTopbar from "./components/BandTopbar";
import ReferralScreen from "./components/ReferralScreen";
import { telHref } from "./content/telHref";
import {
  BACK_TO_QUESTIONS,
  GBV_HELP_SHEET_NOTE,
  HELP_CALLS_NOTE,
  HOME_CLEAR_LEAVE,
  QUICK_EXIT_HINT,
  QUICK_EXIT_LABEL,
  REPLY_PILLS,
} from "./content/uiText";
import {
  ABUSE_REFERRAL_MESSAGE,
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
  SELF_HARM_REFERRAL_MESSAGE,
} from "./offline/helpContent";
import { splitReply } from "./replySplit";
import { byClass, elements, harness, recordingStorage } from "./testHarness";
import {
  smsHref,
  TRUSTED_MESSAGE_BODY,
  TRUSTED_MESSAGE_HREF,
} from "./trustedMessage";

/**
 * The referral screen (RF1): the same layout for both referral messages
 * (self-harm, and abuse for every other flagged category), built around
 * the message as sent; the calls in order (999, 112, 1195, 116); the
 * "Message someone I trust" link; "Back to questions" and "Clear and
 * leave"; focus on the h1; no title, URL, storage or history change.
 *
 * Run: tsx src/referralScreen.test.tsx
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

const noop = () => undefined;
const render = (message: string) =>
  renderToStaticMarkup(
    <ReferralScreen
      message={message}
      onContinueChat={noop}
      onExit={noop}
      onClearAndLeave={noop}
    />,
  );

const MESSAGES: [string, string][] = [
  ["self-harm", SELF_HARM_REFERRAL_MESSAGE],
  ["abuse", ABUSE_REFERRAL_MESSAGE],
];

console.log("Test 1: the message, as sent, in the same layout for both");
for (const [name, message] of MESSAGES) {
  const html = render(message);
  const { first, rest } = splitReply(message);
  assert(
    html.split("<h1").length === 2 &&
      html.includes(
        `<h1 tabindex="-1" class="referral-title">${escapeHtml(first)}</h1>`,
      ) &&
      rest !== null &&
      html.includes(`<p class="referral-text">${escapeHtml(rest)}</p>`) &&
      `${first} ${rest}` === message,
    `${name}: one h1, the first sentence (focusable); the rest under it; together the message exactly`,
  );
  const pillAt = html.indexOf(`</svg> ${REPLY_PILLS.referral}</p>`);
  assert(
    html.includes('<p class="reply-pill">') &&
      pillAt > -1 &&
      pillAt < html.indexOf("<h1"),
    `${name}: the "${REPLY_PILLS.referral}" pill, with its heart, above the h1`,
  );
  const order = [
    'class="home-band referral-band surface-dark"',
    'class="referral-text"',
    'class="referral-danger"',
    'class="referral-talk"',
    'class="referral-trust"',
    `<p class="referral-exit-hint">${QUICK_EXIT_HINT}</p>`,
    `>${BACK_TO_QUESTIONS}</button>`,
    `>${HOME_CLEAR_LEAVE}</button>`,
  ].map((part) => html.indexOf(part));
  assert(
    order.every((at, i) => at > -1 && (i === 0 || at > order[i - 1])),
    `${name}: band, message, danger card, helplines, trusted message, Quick exit hint, Back to questions, Clear and leave`,
  );
  assert(
    !/splash-flower|sparkle|hero-decor|support-circle/.test(html),
    `${name}: no flowers, sparkles or decoration`,
  );
  assert(
    !html.includes("You asked") && !html.includes("ask-bubble"),
    `${name}: her question is not shown`,
  );
}

console.log("\nTest 2: the calls, in order, from the constants");
for (const [name, message] of MESSAGES) {
  const html = render(message);
  const tels = [...html.matchAll(/href="(tel:[^"]+)"/g)].map((m) => m[1]);
  const [a, b] = EMERGENCY_NUMBERS;
  assert(
    JSON.stringify(tels) ===
      JSON.stringify([a, b, GBV_HELPLINE, CHILDLINE_KENYA].map(telHref)),
    `${name}: Call ${a}, Call ${b}, then ${GBV_HELPLINE} and ${CHILDLINE_KENYA}, tel: hrefs from the constants`,
  );
  const danger = html.slice(
    html.indexOf('class="referral-danger"'),
    html.indexOf('class="referral-talk"'),
  );
  assert(
    danger.includes(">In immediate danger?</h2>") &&
      danger.split('class="help-danger-call"').length === 3 &&
      danger.includes(`<span>Call ${a}</span>`) &&
      danger.includes(`<span>Call ${b}</span>`),
    `${name}: "In immediate danger?" with the two rose buttons`,
  );
  const talk = html.slice(
    html.indexOf('class="referral-talk"'),
    html.indexOf('class="referral-trust"'),
  );
  assert(
    talk.includes(">Someone to talk to</h2>") &&
      talk.includes(
        `<span class="help-line-number">${GBV_HELPLINE}</span><span class="help-line-note">${GBV_HELP_SHEET_NOTE}</span>`,
      ) &&
      talk.includes(
        `<span class="help-line-number">${CHILDLINE_KENYA}</span><span class="help-line-note">Childline Kenya. Free, 24 hours, for children.</span>`,
      ) &&
      talk.split('class="help-line-call"').length === 3 &&
      talk.includes(`<p class="help-calls-note">${HELP_CALLS_NOTE}</p>`),
    `${name}: "Someone to talk to": ${GBV_HELPLINE} and ${CHILDLINE_KENYA} as on the Help sheet (22 Oct wording), a Call pill each, then "${HELP_CALLS_NOTE}"`,
  );
  // Outside the message, each number is shown once, as a button.
  const shown = html
    .replace(/<p class="referral-text">[^<]*<\/p>/, "")
    .replace(/<[^>]+>/g, " ");
  for (const number of [a, b, GBV_HELPLINE, CHILDLINE_KENYA]) {
    assert(
      shown.split(new RegExp(`\\b${number}\\b`)).length === 2,
      `${name}: ${number} is shown once outside the message`,
    );
  }
  assert(
    !/confidential|counsellor answers|trained staff/i.test(
      html.replace(/<p class="referral-text">[^<]*<\/p>/, ""),
    ),
    `${name}: no claim about who answers or about confidentiality`,
  );
}

console.log(
  "\nTest 3: Message someone I trust (href only; not tested on a phone)",
);
{
  assert(
    TRUSTED_MESSAGE_BODY === "Can you call me?" &&
      smsHref(TRUSTED_MESSAGE_BODY) === "sms:?&body=Can%20you%20call%20me%3F" &&
      TRUSTED_MESSAGE_HREF === "sms:?&body=Can%20you%20call%20me%3F",
    'the link is exactly sms:?&body=Can%20you%20call%20me%3F: "Can you call me?", no recipient',
  );
  assert(
    smsHref("a b?&=") === "sms:?&body=a%20b%3F%26%3D",
    "the body is URL-encoded, so it cannot add parameters",
  );
  const html = render(ABUSE_REFERRAL_MESSAGE);
  assert(
    html.includes(
      '<a class="referral-trust" href="sms:?&amp;body=Can%20you%20call%20me%3F"><span class="referral-trust-label">Message someone I trust</span><span class="referral-trust-note">Opens your messages with &quot;Can you call me?&quot;</span></a>',
    ),
    'the white button and its sub-line, "Opens your messages with "Can you call me?""',
  );
}

console.log("\nTest 4: the buttons");
{
  const log: string[] = [];
  const tree = harness(ReferralScreen, {
    message: ABUSE_REFERRAL_MESSAGE,
    onContinueChat: () => log.push("back"),
    onExit: () => log.push("exit"),
    onClearAndLeave: () => log.push("clear"),
  })();
  const [back, clear] = byClass(tree, "btn-referral-text");
  (back.props.onClick as () => void)();
  (clear.props.onClick as () => void)();
  const band = elements(tree).find((el) => el.type === BandTopbar)!;
  (band.props.onExit as () => void)();
  assert(
    log.join() === "back,clear,exit",
    "Back to questions, Clear and leave and Quick exit each call their own action",
  );
  assert(band.props.onOpenHelp === undefined, 'the band has no "Get help"');
  const html = render(ABUSE_REFERRAL_MESSAGE);
  assert(
    html.includes(`<button class="btn-home-exit" type="button">`) &&
      html.includes(` ${QUICK_EXIT_LABEL}</button>`) &&
      !html.includes("btn-home-help"),
    `the band: the logo and "${QUICK_EXIT_LABEL}", no "Get help"`,
  );
  const app = read("./App.tsx");
  assert(
    app.includes('onContinueChat={() => setScreen("chat")}') &&
      app.includes("onClearAndLeave={handleClearAndLeave}") &&
      app.includes("onExit={handleExit}"),
    "App: Back to questions goes to Home (as today); Clear and leave is Home's action; Quick exit as everywhere",
  );
  assert(
    /headerless=\{[^}]*screen === "referral"/.test(app),
    "App: no app header on the referral (its band has the logo and Quick exit)",
  );
}

console.log(
  "\nTest 5: on arrival, focus moves to the h1; nothing else changes",
);
{
  const screen = read("./components/ReferralScreen.tsx");
  assert(
    screen.includes("const headingRef = useFocusOnArrival(message);") &&
      screen.includes("ref={headingRef} tabIndex={-1}"),
    "focus moves to the h1 (tabindex -1) when a referral arrives",
  );
  const app = read("./App.tsx");
  assert(
    /screen === "referral"\s*\?\s*announcementFor\("referral"\)/.test(app),
    "the live region names the reply once (New reply: We hear you.)",
  );
  for (const [name, source] of [
    ["ReferralScreen.tsx", screen],
    ["HelpCalls.tsx", read("./components/HelpCalls.tsx")],
    ["trustedMessage.ts", read("./trustedMessage.ts")],
  ]) {
    assert(
      !/document\.title|history\.|location\.|localStorage|sessionStorage|indexedDB|geolocation|fetch\(/.test(
        source,
      ),
      `${name}: no title, history, URL, storage, location or network use`,
    );
  }
  const writes = recordingStorage(() => {
    const render = harness(ReferralScreen, {
      message: SELF_HARM_REFERRAL_MESSAGE,
      onContinueChat: noop,
      onExit: noop,
      onClearAndLeave: noop,
    });
    (byClass(render(), "btn-referral-text")[0].props.onClick as () => void)();
  });
  assert(
    writes.length === 0,
    "rendering it and Back to questions write nothing to any browser store",
  );
}

console.log("\nTest 6: styles");
{
  const css = read("./App.css");
  const rule = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
  };
  const tokens = read("./styles/tokens.css");
  assert(
    tokens.includes(
      "--referral-band: linear-gradient(170deg, #5b21b6 0%, #4c1d95 100%);",
    ) && rule(".home-band.referral-band").includes("var(--referral-band)"),
    "a flat purple band, #5B21B6 to #4C1D95",
  );
  assert(
    rule(".help-danger-call").includes("min-height: 52px;") &&
      rule(".help-danger-call").includes(
        "border: 2px solid var(--splash-helpline-border);",
      ) &&
      rule(".help-danger-call").includes(
        "background: var(--splash-helpline-bg);",
      ) &&
      rule(".referral-danger").includes("var(--referral-danger-bg)"),
    "Call 999 and Call 112: solid rose, 2px pink border, 52px, in a pale rose card",
  );
  assert(
    rule(".help-line").includes("border: 1.5px solid var(--home-card-edge);") &&
      rule(".help-line-call").includes("min-height: var(--tap-target);"),
    "the helpline cards: a 1.5px #8F82B3 edge, a 44px Call pill",
  );
  assert(
    rule(".btn-referral-text").includes("min-height: 48px;") &&
      rule(".referral-trust").includes("min-height: 56px;"),
    "Back to questions and Clear and leave are 48px tall; the trusted-message button 56px",
  );
  const referralCss = css.slice(css.indexOf(" * Referral (RF1)"));
  assert(
    !/animation|transition|@keyframes/.test(referralCss),
    "no animation on the referral screen",
  );
}

console.log("\nAll referral screen tests passed.");
