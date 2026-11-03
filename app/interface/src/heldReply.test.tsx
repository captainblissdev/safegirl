import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import BandTopbar from "./components/BandTopbar";
import HelplineButton from "./components/HelplineButton";
import { HeldReply } from "./components/ReplyViews";
import { telHref } from "./content/telHref";
import {
  CALL_CARD_HEADING,
  GBV_HELP_SHEET_NOTE,
  HELD_ASK_DIFFERENT,
  HELD_WONDER_QUESTIONS,
  HELD_WONDER_TITLE,
  REPLY_PILLS,
} from "./content/uiText";
import {
  CHILDLINE_KENYA,
  GBV_HELPLINE,
  HELD_TOPIC_MESSAGES,
} from "./offline/helpContent";
import { splitLastSentence, splitReply } from "./replySplit";
import { byClass, elements, harness, recordingStorage } from "./testHarness";

/**
 * The held-topic reply (H2-B): Home's band with the "Talk to a nurse"
 * pill and the reply's first sentence; the rest of the reply; for group
 * C, its last sentence as a callout and no call card; for groups A and
 * B, the call card with the Help sheet's cards; two related questions
 * that fill the ask bar; "Ask a different question"; the ask bar and
 * the helpline, pinned. No source badge and no entry id.
 *
 * Run: tsx src/heldReply.test.tsx
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
const band = {
  onOpenHelp: noop,
  isHelpOpen: false,
  onExit: noop,
};
const ASK_BAR = <div className="ask-pill-bar">ask</div>;
type Group = "A" | "B" | "C";
const render = (group: Group) =>
  renderToStaticMarkup(
    <HeldReply
      id="r1"
      text={HELD_TOPIC_MESSAGES[group]}
      group={group}
      askBar={ASK_BAR}
      onAskDifferent={noop}
      onFillAsk={noop}
      band={band}
    />,
  );

console.log("Test 1: the reply, as sent, under the band");
for (const group of ["A", "B", "C"] as const) {
  const text = HELD_TOPIC_MESSAGES[group];
  const html = render(group);
  const { first, rest } = splitReply(text);
  assert(
    html.split("<h1").length === 2 &&
      html.includes(
        `<h1 tabindex="-1" class="held-title">${escapeHtml(first)}</h1>`,
      ),
    `${group}: one h1, the first sentence, focusable`,
  );
  const pillAt = html.indexOf(`</svg> ${REPLY_PILLS.held}</p>`);
  assert(
    pillAt > -1 &&
      pillAt < html.indexOf("<h1") &&
      html.includes('class="home-band held-band surface-dark"') &&
      html.indexOf('class="home-band held-band surface-dark"') < pillAt,
    `${group}: the "${REPLY_PILLS.held}" pill and the h1 in Home's band`,
  );
  const shown = [
    ...html.matchAll(/<p class="held-(?:text|callout)">([^<]*)<\/p>/g),
  ]
    .map((m) => m[1])
    .join(" ");
  assert(
    rest !== null && shown === escapeHtml(rest),
    `${group}: the rest of the reply, word for word, under the band`,
  );
  assert(
    !/source|KB-[A-Z]|answer-badge|entry/i.test(html),
    `${group}: no source badge and no entry id`,
  );
}

console.log("\nTest 2: group C's callout; the call card on A and B");
{
  const rest = splitReply(HELD_TOPIC_MESSAGES.C).rest!;
  const split = splitLastSentence(rest);
  assert(
    split !== null &&
      split.last ===
        "If you have heavy bleeding or severe pain, go to a health facility straight away." &&
      `${split.head} ${split.last}` === rest,
    "C: the last sentence splits off cleanly (head + space + last is the text)",
  );
  const html = render("C");
  assert(
    html.includes(`<p class="held-callout">${escapeHtml(split!.last)}</p>`) &&
      !html.includes(CALL_CARD_HEADING) &&
      !html.includes("help-line"),
    "C: the sentence as a callout, word for word; no call card",
  );
  for (const group of ["A", "B"] as const) {
    const card = render(group);
    const calls = card.slice(card.indexOf('<section class="held-calls"'));
    assert(
      !card.includes("held-callout") &&
        calls.includes(
          `<h2 id="call-card-title" class="help-section-title">${CALL_CARD_HEADING}</h2>`,
        ) &&
        calls.includes(
          `class="help-line-call" href="${telHref(GBV_HELPLINE)}"`,
        ) &&
        calls.indexOf(
          `class="help-line-call" href="${telHref(CHILDLINE_KENYA)}"`,
        ) >
          calls.indexOf(
            `class="help-line-call" href="${telHref(GBV_HELPLINE)}"`,
          ) &&
        calls.includes(GBV_HELP_SHEET_NOTE) &&
        calls.includes("Childline Kenya. Free, 24 hours, for children."),
      `${group}: the call card under "${CALL_CARD_HEADING}", with the Help sheet's cards (${GBV_HELPLINE}, then ${CHILDLINE_KENYA})`,
    );
  }
  assert(
    splitLastSentence("One sentence only.") === null &&
      JSON.stringify(splitLastSentence("One. Two. Three.")) ===
        JSON.stringify({ head: "One. Two.", last: "Three." }),
    "splitLastSentence: nothing to split in one sentence; otherwise the last one",
  );
  const noGroup = renderToStaticMarkup(
    <HeldReply
      id="r1"
      text={HELD_TOPIC_MESSAGES.C}
      askBar={ASK_BAR}
      onAskDifferent={noop}
      onFillAsk={noop}
      band={band}
    />,
  );
  assert(
    !noGroup.includes("held-callout") && noGroup.includes("held-calls"),
    "without a group (an older response), the text stays whole and the call card shows",
  );
}

console.log("\nTest 3: related questions fill the ask bar; nothing is sent");
{
  const html = render("A");
  assert(
    html.includes(
      `<h2 id="held-wonder-title" class="help-section-title">${HELD_WONDER_TITLE}</h2>`,
    ) &&
      JSON.stringify(
        [
          ...html.matchAll(
            /<button class="home-chip" type="button">([^<]*)<\/button>/g,
          ),
        ].map((m) => m[1]),
      ) === JSON.stringify(HELD_WONDER_QUESTIONS),
    `"${HELD_WONDER_TITLE}": "${HELD_WONDER_QUESTIONS.join('", "')}"`,
  );
  const filled: string[] = [];
  const log: string[] = [];
  const tree = harness(HeldReply, {
    id: "r1",
    text: HELD_TOPIC_MESSAGES.A,
    group: "A",
    askBar: ASK_BAR,
    onAskDifferent: () => log.push("home"),
    onFillAsk: (q: string) => filled.push(q),
    band: { ...band, onExit: () => log.push("exit") },
  })();
  byClass(tree, "home-chip").forEach((chip) =>
    (chip.props.onClick as () => void)(),
  );
  assert(
    JSON.stringify(filled) === JSON.stringify(HELD_WONDER_QUESTIONS),
    "each chip puts its question in the ask bar",
  );
  const chat = read("./components/ChatInterface.tsx");
  const fill = chat.slice(
    chat.indexOf("onFillAsk={"),
    chat.indexOf("band={{", chat.indexOf("onFillAsk={")),
  );
  assert(
    fill.includes("setDraft(question);") &&
      fill.includes("inputRef.current?.focus();") &&
      !fill.includes("onSend") &&
      !fill.includes("handleSend"),
    "ChatInterface: a chip sets the draft and focuses the field; it sends nothing",
  );
  (byClass(tree, "held-different")[0].props.onClick as () => void)();
  const topbar = elements(tree).find((el) => el.type === BandTopbar)!;
  (topbar.props.onExit as () => void)();
  assert(
    log.join() === "home,exit" &&
      html.includes(
        `<button class="held-different" type="button">${HELD_ASK_DIFFERENT}</button>`,
      ),
    `"${HELD_ASK_DIFFERENT}" goes Home; Quick exit is the band's`,
  );
  assert(
    topbar.props.onOpenHelp === band.onOpenHelp &&
      html.includes('class="btn-home-help"'),
    'the band has "Get help" and Quick exit, as on Home and the Topic list',
  );
  const footer = elements(tree).find(
    (el) => el.props.className === "topic-footer",
  )!;
  const kids = elements(footer.props.children);
  assert(
    kids.some((el) => el === ASK_BAR) &&
      kids.some((el) => el.type === HelplineButton),
    "pinned at the bottom: the ask bar, then the helpline (the Topic page's footer)",
  );
  const writes = recordingStorage(() => {
    const again = harness(HeldReply, {
      id: "r1",
      text: HELD_TOPIC_MESSAGES.B,
      group: "B",
      askBar: ASK_BAR,
      onAskDifferent: noop,
      onFillAsk: noop,
      band,
    })();
    byClass(again, "home-chip").forEach((chip) =>
      (chip.props.onClick as () => void)(),
    );
  });
  assert(writes.length === 0, "rendering and tapping write nothing to storage");
}

console.log("\nTest 4: App and styles");
{
  const app = read("./App.tsx");
  assert(
    app.includes("heldTopicGroup: response.heldTopicGroup,") &&
      app.includes(
        '(onChatScreen && !isLoading && replyViewOf(lastTurn) === "held")',
      ),
    "App keeps the group from the response (display only) and drops its header on the held reply",
  );
  const css = read("./App.css");
  const rule = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
  };
  assert(
    rule(".held-page > .held-callout").includes(
      "border: 1.5px solid var(--held-callout-edge);",
    ) &&
      rule(".held-page > .held-callout").includes(
        "background: var(--held-callout-bg);",
      ) &&
      rule(".held-page > .held-callout").includes(
        "font-weight: var(--weight-bold);",
      ),
    "the callout: pale rose, a 1.5px rose border, bold",
  );
  assert(
    rule(".held-page > .held-different").includes(
      "min-height: var(--tap-target);",
    ) &&
      rule(".held-page > .held-different").includes(
        "border: 2px solid var(--home-card-edge);",
      ),
    '"Ask a different question": an outlined button, 44px tall',
  );
  const heldCss = css.slice(css.indexOf(" * Held-topic reply (H2-B)"));
  assert(
    !/animation|transition|@keyframes/.test(heldCss),
    "no animation on the held reply",
  );
}

console.log("\nAll held reply tests passed.");
