import { readdirSync, readFileSync } from "node:fs";

/**
 * Guards the design tokens (styles/tokens.css): every token in the brief
 * is defined; every text pair reaches 4.5:1 and the focus ring 3:1,
 * computed from the token values themselves; the global focus and
 * reduced-motion rules are in place; and no other stylesheet or component
 * writes a colour value.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const tokensCss = read("./tokens.css");
const tokens = new Map<string, string>();
for (const match of tokensCss.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
  tokens.set(match[1], match[2].trim());
}
const token = (name: string) => {
  const value = tokens.get(name);
  if (!value) throw new Error(`FAIL: token ${name} is not defined`);
  return value;
};

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

console.log("Test 1: the brief's tokens are defined with their values");
{
  const expected: Record<string, string> = {
    "--color-ink": "#2a1245",
    "--color-muted": "#6b4f86",
    "--color-violet": "#6d28d9",
    "--color-orchid": "#c026d3",
    "--color-rose": "#db2777",
    "--color-plum": "#3b0f6b",
    "--color-page": "#fff6fb",
    "--glow-pink": "#ffd3ea",
    "--glow-lilac": "#e6d7ff",
    "--color-card": "#ffffff",
    "--color-card-border": "#f3d3e6",
    "--focus-ring-width": "3px",
    "--focus-ring-offset": "2px",
    "--tap-target": "44px",
    "--answer-bg-start": "#f3e8ff",
    "--answer-bg-end": "#ffe4f1",
    "--answer-text": "#5b21b6",
    "--clarify-bg-start": "#f1e4ff",
    "--clarify-bg-end": "#ffe1f0",
    "--clarify-text": "#86198f",
    "--held-bg": "#fff0f6",
    "--held-border": "#f472b6",
    "--held-text": "#9d174d",
    "--support-bg-start": "#3b0f6b",
    "--support-bg-end": "#86198f",
    "--support-text": "#ffffff",
    "--noanswer-bg": "#f3eefa",
    "--noanswer-border": "#dccdf0",
    "--noanswer-text": "#4b3f63",
    "--topic-periods-bg": "#ffddee",
    "--topic-periods-text": "#be185d",
    "--topic-pregnancy-bg": "#eadcff",
    "--topic-pregnancy-text": "#6d28d9",
    "--topic-contraception-bg": "#f8d9fa",
    "--topic-contraception-text": "#a21caf",
    "--topic-sti-bg": "#ffdce4",
    "--topic-sti-text": "#be123c",
  };
  for (const [name, value] of Object.entries(expected)) {
    assert(token(name) === value, `${name} is ${value}`);
  }
  assert(
    token("--gradient-primary") === "linear-gradient(135deg, #6d28d9, #c026d3)",
    "primary gradient #6D28D9 to #C026D3",
  );
  assert(
    token("--gradient-hero")
      .replace(/\s+/g, " ")
      .replace("( ", "(")
      .replace(" )", ")") ===
      "linear-gradient(135deg, #5b21b6 0%, #8a24c9 55%, #a21caf 100%)",
    "hero gradient #5B21B6, #8A24C9 (55%), #A21CAF",
  );
  const radius = (name: string) => parseInt(token(name), 10);
  assert(
    radius("--radius-card") >= 22 && radius("--radius-card-large") <= 28,
    "card radius between 22 and 28px",
  );
}

console.log("\nTest 2: every text pair reaches 4.5:1");
{
  const page = token("--color-page");
  const white = token("--color-card");
  const glows = [token("--glow-pink"), token("--glow-lilac")];
  const light = [page, white, ...glows];
  const pairs: [string, string, string[]][] = [
    ["ink", token("--color-ink"), light],
    ["muted", token("--color-muted"), light],
    ["violet", token("--color-violet"), light],
    ["rose text", token("--color-rose-text"), light],
    ["orchid text", token("--color-orchid-text"), light],
    ["white on primary", token("--color-on-dark"), ["#6d28d9", "#c026d3"]],
    ["white on hero", token("--color-on-dark"), ["#5b21b6", "#a21caf"]],
    [
      "support text",
      token("--support-text"),
      [token("--support-bg-start"), token("--support-bg-end")],
    ],
    [
      "answer text",
      token("--answer-text"),
      [token("--answer-bg-start"), token("--answer-bg-end")],
    ],
    [
      "clarify text",
      token("--clarify-text"),
      [token("--clarify-bg-start"), token("--clarify-bg-end")],
    ],
    ["held text", token("--held-text"), [token("--held-bg")]],
    ["no-answer text", token("--noanswer-text"), [token("--noanswer-bg")]],
    ["periods", token("--topic-periods-text"), [token("--topic-periods-bg")]],
    [
      "pregnancy",
      token("--topic-pregnancy-text"),
      [token("--topic-pregnancy-bg")],
    ],
    [
      "contraception",
      token("--topic-contraception-text"),
      [token("--topic-contraception-bg")],
    ],
    ["STIs", token("--topic-sti-text"), [token("--topic-sti-bg")]],
  ];
  for (const [name, fg, backgrounds] of pairs) {
    const worst = Math.min(...backgrounds.map((bg) => contrast(fg, bg)));
    assert(worst >= 4.5, `${name}: ${worst.toFixed(2)}:1`);
  }
}

console.log("\nTest 3: the focus ring reaches 3:1 where it is used");
{
  const light = [
    "--color-page",
    "--color-card",
    "--glow-pink",
    "--glow-lilac",
    "--answer-bg-start",
    "--answer-bg-end",
    "--clarify-bg-start",
    "--clarify-bg-end",
    "--held-bg",
    "--noanswer-bg",
    "--topic-periods-bg",
    "--topic-pregnancy-bg",
    "--topic-contraception-bg",
    "--topic-sti-bg",
  ].map(token);
  const dark = [
    "#6d28d9",
    "#c026d3",
    "#5b21b6",
    "#a21caf",
    token("--support-bg-start"),
    token("--support-bg-end"),
  ];
  const violet = token("--color-violet");
  const onDark = token("--focus-ring-on-dark");
  const worstLight = Math.min(...light.map((bg) => contrast(violet, bg)));
  const worstDark = Math.min(...dark.map((bg) => contrast(onDark, bg)));
  assert(worstLight >= 3, `violet ring on light: ${worstLight.toFixed(2)}:1`);
  assert(worstDark >= 3, `white ring on dark: ${worstDark.toFixed(2)}:1`);
}

console.log("\nTest 4: global focus, motion, font and tap-target rules");
{
  const css = read("../index.css");
  assert(
    css.startsWith('@import "./styles/tokens.css";'),
    "index.css imports the tokens first",
  );
  assert(
    /:focus-visible\s*\{\s*outline: var\(--focus-ring-width\) solid var\(--focus-ring-color\);\s*outline-offset: var\(--focus-ring-offset\);/.test(
      css,
    ),
    "focus ring: 3px violet, 2px offset, from the tokens",
  );
  assert(
    /\.surface-dark :focus-visible\s*\{\s*outline-color: var\(--focus-ring-on-dark\);/.test(
      css,
    ),
    "white focus ring on dark surfaces",
  );
  assert(
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important;[\s\S]*transition: none !important;/.test(
      css,
    ),
    "reduced motion turns animation and transition off",
  );
  assert(
    /body\s*\{[^}]*font-family: var\(--font-family\);[^}]*background: var\(--page-background\);/.test(
      css,
    ),
    "body uses the token font and page background",
  );
  assert(
    /button,\s*\[role="button"\]\s*\{\s*min-height: var\(--tap-target\);/.test(
      css,
    ),
    "buttons are at least the tap-target height",
  );
}

console.log("\nTest 5: no colour value outside tokens.css");
{
  const colour = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
  const files = [
    "../index.css",
    "../App.css",
    ...readdirSync(new URL("../components/", import.meta.url))
      .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
      .map((name) => `../components/${name}`),
  ];
  for (const file of files) {
    assert(
      !colour.test(read(file)),
      `${file.replace("../", "")} has no colour value`,
    );
  }
}

console.log("\nTest 6: control edges and the header's new pairs");
{
  const surfaces = [
    "--color-page",
    "--color-card",
    "--glow-pink",
    "--glow-lilac",
    "--color-tint",
    "--answer-bg-end",
    "--topic-periods-bg",
    "--topic-pregnancy-bg",
    "--topic-contraception-bg",
    "--topic-sti-bg",
  ].map(token);
  const edge = token("--color-control-border");
  const worstEdge = Math.min(...surfaces.map((bg) => contrast(edge, bg)));
  assert(
    worstEdge >= 3,
    `control border on every light surface: ${worstEdge.toFixed(2)}:1`,
  );

  const plum = token("--color-plum");
  const light = [
    "--color-page",
    "--color-card",
    "--glow-pink",
    "--glow-lilac",
  ].map(token);
  const worstPlum = Math.min(...light.map((bg) => contrast(plum, bg)));
  assert(
    worstPlum >= 4.5,
    `plum ("Safe", Exit fill) on light: ${worstPlum.toFixed(2)}:1`,
  );
  assert(
    contrast(token("--color-on-dark"), plum) >= 4.5,
    `white on plum (Exit label): ${contrast(token("--color-on-dark"), plum).toFixed(2)}:1`,
  );

  // Controls never rely on the light card border as their only edge.
  const app = read("../App.css");
  for (const control of [
    ".topic-questions",
    ".btn-close",
    ".btn-help",
    ".btn-exit",
  ]) {
    const rule = new RegExp(
      `\\${control}\\s*\\{[^}]*border: [^;]*var\\(--(control-border|primary|color-plum|color-control-border|list-edge|sheet-control-edge)\\)`,
    );
    assert(rule.test(app), `${control} has a 3:1 edge, not the card border`);
  }
  assert(
    /\.input-row input\s*\{[^}]*border: 1px solid var\(--control-border\)/.test(
      app,
    ),
    "the ask bar input has the control border",
  );
}

console.log(
  "\nTest 7: the splash, worst case: lightest stop with a glow on top",
);
{
  const stops = [...token("--gradient-splash").matchAll(/#[0-9a-f]{6}/g)].map(
    (m) => m[0],
  );
  assert(
    stops.join(",") === "#3b0f6b,#5b21b6,#a21caf",
    "the splash gradient runs #3B0F6B, #5B21B6, #A21CAF",
  );

  /** rgba(r, g, b, a) composited over a hex colour, as hex. */
  const over = (rgba: string, hex: string) => {
    const [r, g, b, a] = rgba
      .replace(/[^0-9.,]/g, "")
      .split(",")
      .map(Number);
    const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return (
      "#" +
      [r, g, b]
        .map((c, i) => Math.round(c * a + base[i] * (1 - a)))
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")
    );
  };
  const worst = (fg: string, backgrounds: string[]) =>
    Math.min(...backgrounds.map((bg) => contrast(fg, bg)));

  const lightest = stops[2];
  const withRose = over(token("--splash-glow-rose"), lightest);
  const withOrchid = over(token("--splash-glow-orchid"), lightest);
  const anywhere = [...stops, withRose, withOrchid];
  const white = token("--color-on-dark");

  const text = worst(white, anywhere);
  assert(
    text >= 4.5,
    `white text anywhere on the splash: ${text.toFixed(2)}:1`,
  );

  // The rose glow ends above the tagline (.splash-glow--rose ends 150px
  // from the top; the tagline starts below the 84px tile and the 44px
  // wordmark), so the tagline is checked without it.
  const tagline = worst(token("--splash-tagline"), [...stops, withOrchid]);
  assert(
    tagline >= 4.5,
    `tagline and privacy line #F6E9FF: ${tagline.toFixed(2)}:1`,
  );
  const taglineOverRose = contrast(token("--splash-tagline"), withRose);
  console.log(
    `  (for the record: #F6E9FF over the rose glow would be ${taglineOverRose.toFixed(2)}:1)`,
  );

  const glass = anywhere.map((bg) => over(token("--splash-glass-bg"), bg));
  const cards = worst(white, glass);
  assert(
    cards >= 4.5,
    `white text on the glass cards and Exit pill: ${cards.toFixed(2)}:1`,
  );
  const pillEdge = worst(white, anywhere);
  assert(
    pillEdge >= 3,
    `the Exit pill's white border: ${pillEdge.toFixed(2)}:1`,
  );

  const ring = worst(token("--focus-ring-on-dark"), anywhere);
  assert(ring >= 3, `white focus ring on the splash: ${ring.toFixed(2)}:1`);

  const button = contrast(token("--splash-button-text"), token("--color-card"));
  assert(button >= 4.5, `#4C1D95 on the white button: ${button.toFixed(2)}:1`);
  const buttonEdge = worst(token("--color-card"), anywhere);
  assert(
    buttonEdge >= 3,
    `the white button's edge: ${buttonEdge.toFixed(2)}:1`,
  );

  for (const name of [
    "--splash-icon-lock",
    "--splash-icon-speech",
    "--splash-icon-shield",
  ]) {
    const icon = contrast(token(name), token("--color-card"));
    assert(icon >= 3, `${name} on its white tile: ${icon.toFixed(2)}:1`);
  }
}

console.log("\nTest 8: the shield-and-heart mark");
{
  const header = [...token("--mark-gradient").matchAll(/#[0-9a-f]{6}/g)].map(
    (m) => m[0],
  );
  assert(
    header.join(",") === "#6d28d9,#db2777",
    "header tile #6D28D9 to #DB2777",
  );
  const onHeader = Math.min(
    ...header.map((bg) => contrast(token("--color-on-dark"), bg)),
  );
  assert(
    onHeader >= 3,
    `white shield and heart on the header tile: ${onHeader.toFixed(2)}:1`,
  );
  const tile = [...token("--mark-tile-light").matchAll(/#[0-9a-f]{6}/g)].map(
    (m) => m[0],
  );
  assert(tile.join(",") === "#ffffff,#ffe4f1", "splash tile white to #FFE4F1");
  const violet = Math.min(
    ...tile.map((bg) => contrast(token("--color-violet"), bg)),
  );
  const rose = Math.min(
    ...tile.map((bg) => contrast(token("--color-rose"), bg)),
  );
  assert(
    violet >= 3,
    `violet shield on the splash tile: ${violet.toFixed(2)}:1`,
  );
  assert(rose >= 3, `rose heart on the splash tile: ${rose.toFixed(2)}:1`);
}

console.log("\nTest 9: Home");
{
  const hero = [...token("--gradient-hero").matchAll(/#[0-9a-f]{6}/g)].map(
    (m) => m[0],
  );
  const white = token("--color-on-dark");
  const worst = (fg: string, backgrounds: string[]) =>
    Math.min(...backgrounds.map((bg) => contrast(fg, bg)));

  const tag = contrast(token("--hero-pill-text"), token("--hero-pill-bg"));
  assert(tag >= 4.5, `hero pill text on white: ${tag.toFixed(2)}:1`);
  const sub = worst(white, hero);
  assert(
    sub >= 4.5,
    `heading and subtext, white on the hero: ${sub.toFixed(2)}:1`,
  );

  const card = token("--color-card");
  const pillEdge = worst(card, hero);
  assert(
    pillEdge >= 3,
    `the white pill's edge on the hero: ${pillEdge.toFixed(2)}:1`,
  );
  const placeholder = contrast(token("--color-muted"), card);
  assert(
    placeholder >= 4.5,
    `placeholder on the pill: ${placeholder.toFixed(2)}:1`,
  );
  const inputText = contrast(token("--color-ink"), card);
  assert(inputText >= 4.5, `typed text on the pill: ${inputText.toFixed(2)}:1`);
  const send = [...token("--gradient-primary").matchAll(/#[0-9a-f]{6}/g)].map(
    (m) => m[0],
  );
  const arrow = worst(white, send);
  assert(
    arrow >= 3,
    `the send arrow, white on violet to orchid: ${arrow.toFixed(2)}:1`,
  );
  const sendEdge = worst(card, send);
  assert(
    sendEdge >= 3,
    `the send button on the white pill: ${sendEdge.toFixed(2)}:1`,
  );
  const ring = contrast(token("--color-violet"), card);
  assert(
    ring >= 3,
    `violet focus ring inside the white pill: ${ring.toFixed(2)}:1`,
  );

  const page = [
    token("--color-page"),
    card,
    token("--glow-pink"),
    token("--glow-lilac"),
  ];
  for (const [name, edge, bg, text] of [
    [
      "periods",
      "--topic-periods-edge",
      "--topic-periods-bg",
      "--topic-periods-text",
    ],
    [
      "pregnancy",
      "--topic-pregnancy-edge",
      "--topic-pregnancy-bg",
      "--topic-pregnancy-text",
    ],
    [
      "contraception",
      "--topic-contraception-edge",
      "--topic-contraception-bg",
      "--topic-contraception-text",
    ],
    ["sti", "--topic-sti-edge", "--topic-sti-bg", "--topic-sti-text"],
  ]) {
    const e = worst(token(edge), page);
    assert(
      e >= 3,
      `${name} tile edge on the page and glows: ${e.toFixed(2)}:1`,
    );
    const icon = contrast(token(text), token(bg));
    assert(icon >= 3, `${name} icon on its tint: ${icon.toFixed(2)}:1`);
    const subOnTint = contrast(token("--color-muted"), token(bg));
    assert(
      subOnTint >= 4.5,
      `${name}: muted text on the tint, for the record: ${subOnTint.toFixed(2)}:1`,
    );
  }
  const label = contrast(token("--color-ink"), card);
  assert(
    label >= 4.5,
    `tile labels, ink on the white tile: ${label.toFixed(2)}:1`,
  );
  const subtitle = contrast(token("--color-muted"), card);
  assert(
    subtitle >= 4.5,
    `tile subtitles, muted on the white tile: ${subtitle.toFixed(2)}:1`,
  );
  const footer = worst(token("--color-muted"), page);
  assert(
    footer >= 4.5,
    `"Anonymous…", muted on the page: ${footer.toFixed(2)}:1`,
  );
  const heading = worst(token("--color-plum"), page);
  assert(
    heading >= 4.5,
    `"Or browse by topic", plum on the page: ${heading.toFixed(2)}:1`,
  );
}

console.log("\nTest 10: the Topic list");
{
  const page = [
    token("--color-page"),
    token("--color-card"),
    token("--glow-pink"),
    token("--glow-lilac"),
  ];
  const worst = (fg: string, backgrounds: string[]) =>
    Math.min(...backgrounds.map((bg) => contrast(fg, bg)));
  const back = worst(token("--color-violet"), page);
  assert(back >= 4.5, `"All topics", violet on the page: ${back.toFixed(2)}:1`);
  const title = worst(token("--color-plum"), page);
  assert(title >= 4.5, `the h1, plum on the page: ${title.toFixed(2)}:1`);
  const count = worst(token("--color-muted"), page);
  assert(
    count >= 4.5,
    `"N questions", muted on the page: ${count.toFixed(2)}:1`,
  );
  const row = contrast(token("--color-ink"), token("--color-card"));
  assert(row >= 4.5, `question rows, ink on white: ${row.toFixed(2)}:1`);
  const edge = worst(token("--color-control-border"), page);
  assert(edge >= 3, `the list card's edge: ${edge.toFixed(2)}:1`);
  const chevron = contrast(
    token("--color-rose-text"),
    token("--chevron-tile-bg"),
  );
  assert(chevron >= 3, `chevron, rose on its tile: ${chevron.toFixed(2)}:1`);
  const ring = contrast(token("--color-violet"), token("--color-card"));
  assert(ring >= 3, `focus ring inside the white card: ${ring.toFixed(2)}:1`);
}

console.log("\nTest 11: the answer screen");
{
  const page = [
    token("--color-page"),
    token("--color-card"),
    token("--glow-pink"),
    token("--glow-lilac"),
  ];
  const worst = (fg: string, backgrounds: string[]) =>
    Math.min(...backgrounds.map((bg) => contrast(fg, bg)));
  const label = contrast(token("--closest-label"), token("--closest-bg"));
  assert(
    label >= 4.5,
    `"The closest question I have" on its card: ${label.toFixed(2)}:1`,
  );
  const question = contrast(token("--color-ink"), token("--closest-bg"));
  assert(
    question >= 4.5,
    `the matched question on its card: ${question.toFixed(2)}:1`,
  );
  const ringOnCard = contrast(token("--color-violet"), token("--closest-bg"));
  assert(
    ringOnCard >= 3,
    `focus ring on the closest card: ${ringOnCard.toFixed(2)}:1`,
  );
  const pill = worst(token("--answer-text"), [
    token("--answer-bg-start"),
    token("--answer-bg-end"),
  ]);
  assert(
    pill >= 4.5,
    `"Answer" on the pill gradient (worst end): ${pill.toFixed(2)}:1`,
  );
  const text = contrast(token("--color-ink"), token("--color-card"));
  assert(text >= 4.5, `the answer text on white: ${text.toFixed(2)}:1`);
  const meta = contrast(token("--color-muted"), token("--color-card"));
  assert(meta >= 4.5, `source and disclaimer on white: ${meta.toFixed(2)}:1`);
  const related = worst(token("--color-plum"), page);
  assert(
    related >= 4.5,
    `"Related questions" on the page: ${related.toFixed(2)}:1`,
  );
  const line = contrast(token("--color-ink"), token("--color-card"));
  assert(line >= 4.5, `footer line on the white dock: ${line.toFixed(2)}:1`);
  const link = contrast(token("--color-violet"), token("--color-card"));
  assert(link >= 4.5, `footer link on the white dock: ${link.toFixed(2)}:1`);
  // The card's border is decorative: the card is not a control and its
  // text stands on white, so it needs no 3:1 (it is shown for the record).
  const border = worst(token("--answer-card-border"), page);
  console.log(
    `  INFO: the answer card's decorative border: ${border.toFixed(2)}:1`,
  );
}

console.log(
  "\nTest 12: the reply screens (clarify, held, help and referral, no answer)",
);
{
  // The help and referral pairs moved to Test 17 (step 7c redesign).
  const page = [
    token("--color-page"),
    token("--color-card"),
    token("--glow-pink"),
    token("--glow-lilac"),
  ];
  const worst = (fg: string, backgrounds: string[]) =>
    Math.min(...backgrounds.map((bg) => contrast(fg, bg)));
  const check = (ratio: number, min: number, what: string) =>
    assert(ratio >= min, `${what}: ${ratio.toFixed(2)}:1`);

  // Clarify.
  const clarify = [token("--clarify-bg-start"), token("--clarify-bg-end")];
  check(
    worst(token("--color-muted"), page),
    4.5,
    '"You asked", muted on the page',
  );
  check(
    worst(token("--color-ink"), page),
    4.5,
    "her question, ink on the page",
  );
  check(
    worst(token("--color-ink"), clarify),
    4.5,
    "clarify text on its gradient (worst end)",
  );
  check(
    contrast(token("--clarify-text"), token("--reply-pill-bg")),
    4.5,
    '"Tell me a bit more" on the white pill',
  );
  check(
    worst(token("--color-control-border"), clarify),
    3,
    "topic button edge on the clarify gradient",
  );
  check(
    contrast(token("--color-ink"), token("--color-card")),
    4.5,
    "topic button label on white",
  );
  check(
    worst(token("--color-violet"), clarify),
    3,
    "focus ring on the clarify gradient",
  );
  check(
    worst(token("--color-muted"), page),
    4.5,
    "the fallback line, muted on the page",
  );

  // Held.
  const held = token("--held-bg");
  check(contrast(token("--held-text"), held), 4.5, "held text on its card");
  check(
    contrast(token("--held-text"), token("--reply-pill-bg")),
    4.5,
    "held pill text on white",
  );
  check(
    contrast(token("--color-on-dark"), token("--color-plum")),
    4.5,
    "1195 button: white on plum",
  );
  check(
    contrast(token("--color-plum"), held),
    3,
    "1195 button edge on the held card",
  );
  check(
    contrast(token("--held-text"), token("--color-card")),
    4.5,
    "116 button text on white",
  );
  check(
    contrast(token("--color-control-border"), held),
    3,
    "116 button edge on the held card",
  );
  check(
    contrast(token("--color-violet"), held),
    3,
    "focus ring on the held card",
  );
  check(
    worst(token("--color-violet"), page),
    4.5,
    '"Ask a different question" on the page',
  );

  // No answer.
  const none = token("--noanswer-bg");
  check(
    contrast(token("--noanswer-text"), none),
    4.5,
    "no-answer text on its card",
  );
  check(
    contrast(token("--noanswer-text"), token("--reply-pill-bg")),
    4.5,
    '"No answer yet" on the white pill',
  );
  check(
    contrast(token("--color-control-border"), none),
    3,
    "topic pill edge on the no-answer card",
  );
  check(
    contrast(token("--color-violet"), none),
    3,
    "focus ring on the no-answer card",
  );

  // Decorative only, for the record.
  console.log(
    `  INFO: decorative: held card border ${contrast(token("--held-border"), held).toFixed(2)}:1, no-answer card border ${contrast(token("--noanswer-border"), none).toFixed(2)}:1`,
  );
}

console.log("\nTest 13: the Talk to a person screen");
{
  const card = token("--noanswer-bg");
  const check = (ratio: number, min: number, what: string) =>
    assert(ratio >= min, `${what}: ${ratio.toFixed(2)}:1`);
  check(contrast(token("--noanswer-text"), card), 4.5, "message on the card");
  check(
    contrast(token("--noanswer-text"), token("--reply-pill-bg")),
    4.5,
    '"Let\'s find a person" on the white pill',
  );
  check(
    contrast(token("--color-on-dark"), token("--color-plum")),
    4.5,
    '"See who can help": white on plum',
  );
  check(
    contrast(token("--color-plum"), card),
    3,
    "the button's edge on the card",
  );
  check(contrast(token("--color-violet"), card), 3, "focus ring on the card");
  check(
    contrast(token("--color-control-border"), card),
    3,
    "topic pill edge on the card",
  );
}

console.log("\nTest 14: Home polish (step 4b)");
{
  const over = (rgba: string, hex: string) => {
    const [r, g, b, a] = rgba
      .replace(/[^0-9.,]/g, "")
      .split(",")
      .map(Number);
    const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return (
      "#" +
      [r, g, b]
        .map((c, i) => Math.round(c * a + base[i] * (1 - a)))
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")
    );
  };
  const check = (ratio: number, min: number, what: string) =>
    assert(ratio >= min, `${what}: ${ratio.toFixed(2)}:1`);
  const stops = [...token("--gradient-hero").matchAll(/#[0-9a-f]{6}/g)].map(
    (m) => m[0],
  );
  assert(
    JSON.stringify(stops) === '["#5b21b6","#8a24c9","#a21caf"]',
    "the hero gradient runs #5B21B6, #8A24C9, #A21CAF",
  );
  const worst = (fg: string, bgs: string[]) =>
    Math.min(...bgs.map((bg) => contrast(fg, bg)));
  const behind = [
    ...stops,
    ...stops.map((s) => over(token("--hero-circle-strong"), s)),
    ...stops.map((s) => over(token("--hero-circle-soft"), s)),
  ];
  check(
    worst(token("--color-on-dark"), behind),
    4.5,
    "headline, white on the hero, circles included",
  );
  // The paragraph sits below the large top-right circle (the browser
  // check confirms it never meets it at 320 to 430px), so only the small
  // circle can be behind it. Over the large one it would be 4.04:1.
  check(
    worst(token("--hero-sub-text"), [
      ...stops,
      ...stops.map((s) => over(token("--hero-circle-soft"), s)),
    ]),
    4.5,
    "paragraph #F6E9FF on the hero, small circle included",
  );
  check(
    contrast(token("--hero-pill-text"), token("--hero-pill-bg")),
    4.5,
    "pill #9D174D on white",
  );
  check(
    contrast(token("--color-muted"), token("--color-card")),
    4.5,
    "ask label #6B4F86 on white",
  );
  const field = token("--ask-field-bg");
  check(
    contrast(token("--ask-field-edge"), field),
    3,
    "field edge on the field",
  );
  check(
    contrast(token("--ask-field-edge"), token("--color-card")),
    3,
    "field edge on the white card",
  );
  console.log(
    `  INFO: the design's field edge #f3c6de would be ${contrast("#f3c6de", field).toFixed(2)}:1 on the field`,
  );
  check(
    contrast(token("--color-muted"), field),
    4.5,
    "placeholder on the field",
  );
  check(contrast(token("--color-ink"), field), 4.5, "typed text on the field");
  const send = [...token("--gradient-primary").matchAll(/#[0-9a-f]{6}/g)].map(
    (m) => m[0],
  );
  check(
    worst(token("--color-on-dark"), send),
    3,
    "send arrow, white on the gradient",
  );
  check(worst(field, send), 3, "send button's edge on the field");
  check(
    contrast(token("--color-on-dark"), token("--send-disabled-bg")),
    3,
    "disabled send arrow, white on mid-violet",
  );
  check(
    contrast(token("--send-disabled-bg"), field),
    3,
    "disabled send button's edge on the field",
  );
  check(contrast(token("--color-violet"), field), 3, "focus ring on the field");
  const foot = token("--footer-card-bg");
  check(
    contrast(token("--footer-card-text"), foot),
    4.5,
    "footer card text #5E2A58 on #FFE9F4",
  );
  check(
    contrast(token("--color-violet"), foot),
    4.5,
    "footer card's 1195 link on #FFE9F4",
  );
  check(
    contrast(token("--color-violet"), foot),
    3,
    "focus ring on the footer card",
  );
  check(
    contrast(token("--color-muted"), token("--color-card")),
    4.5,
    "topic subtitle #6B4F86 on white",
  );
}

console.log("\nTest 16: Topic list and answer screen polish (step 6b)");
{
  const check = (ratio: number, min: number, what: string) =>
    assert(ratio >= min, `${what}: ${ratio.toFixed(2)}:1`);
  const head = [token("--topic-head-bg-start"), token("--topic-head-bg-end")];
  const card = token("--color-card");
  const page = [
    token("--color-page"),
    card,
    token("--glow-pink"),
    token("--glow-lilac"),
  ];
  const worst = (fg: string, bgs: string[]) =>
    Math.min(...bgs.map((bg) => contrast(fg, bg)));
  check(
    worst(token("--color-plum"), head),
    4.5,
    "Topic list h1 #3B0F6B on the header card",
  );
  check(
    worst(token("--footer-card-text"), head),
    4.5,
    "hint #5E2A58 on the header card",
  );
  for (const tint of ["periods", "pregnancy", "contraception", "sti"]) {
    check(
      contrast(token(`--topic-${tint}-text`), card),
      3,
      `${tint} icon on its white tile`,
    );
  }
  check(
    worst(token("--color-violet"), page),
    4.5,
    '"All topics" #6D28D9 on the page',
  );
  check(
    contrast(token("--list-edge"), card),
    3,
    "question card edge against its white rows",
  );
  check(
    worst(token("--list-edge"), page),
    3,
    "question card edge on the page and glows",
  );
  check(
    contrast(token("--color-ink"), card),
    4.5,
    "question rows #2A1245 on white",
  );
  check(
    contrast(token("--color-rose-text"), token("--chevron-tile-bg")),
    3,
    "chevron on its #FFE4F1 circle",
  );
  check(
    worst(token("--color-muted"), page),
    4.5,
    "footnote #6B4F86 on the page",
  );
  check(
    worst(token("--footer-card-text"), page),
    4.5,
    "footer line #5E2A58 on the page",
  );
  check(
    worst(token("--color-violet"), page),
    4.5,
    "footer line's 1195 link on the page",
  );
  check(
    contrast(token("--closest-label"), token("--closest-bg")),
    4.5,
    "closest label #5B21B6 on #EEE4FF",
  );
  check(
    contrast(token("--color-ink"), token("--closest-bg")),
    4.5,
    "closest question #2A1245 on #EEE4FF",
  );
  check(
    worst(token("--answer-text"), [
      token("--answer-bg-start"),
      token("--answer-bg-end"),
    ]),
    4.5,
    "Answer pill #5B21B6 on its gradient",
  );
  check(
    contrast(token("--color-muted"), card),
    4.5,
    "source and disclaimer #6B4F86 on white",
  );
  check(
    contrast(token("--color-ink"), card),
    4.5,
    '"Source:" #2A1245 on white',
  );
  check(
    contrast(token("--ask-field-edge"), card),
    3,
    "ask pill edge against its white fill",
  );
  check(
    worst(token("--ask-field-edge"), page),
    3,
    "ask pill edge on the page and glows",
  );
  check(
    contrast(token("--color-muted"), card),
    4.5,
    "ask pill placeholder on white",
  );
  console.log(
    `  INFO: the design's #F3D3E6 card edge would be ${contrast("#f3d3e6", card).toFixed(2)}:1 on white`,
  );
}

console.log("\nTest 17: reply screens aligned with the design (step 7c)");
{
  const over = (rgba: string, hex: string) => {
    const [r, g, b, a] = rgba
      .replace(/[^0-9.,]/g, "")
      .split(",")
      .map(Number);
    const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return (
      "#" +
      [r, g, b]
        .map((c, i) => Math.round(c * a + base[i] * (1 - a)))
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")
    );
  };
  const check = (ratio: number, min: number, what: string) =>
    assert(ratio >= min, `${what}: ${ratio.toFixed(2)}:1`);
  const stops = (name: string) =>
    [...token(name).matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0]);
  const worst = (fg: string, bgs: string[]) =>
    Math.min(...bgs.map((bg) => contrast(fg, bg)));
  const white = token("--color-on-dark");
  const card = token("--color-card");
  const page = [
    token("--color-page"),
    card,
    token("--glow-pink"),
    token("--glow-lilac"),
  ];

  // Held.
  check(
    contrast(token("--held-title"), token("--held-bg")),
    4.5,
    "held h1 and paragraph #4A0D2B on #FFF0F6",
  );
  check(
    contrast(token("--held-text"), card),
    4.5,
    "held pill #9D174D on white",
  );
  check(
    contrast(token("--color-ink"), card),
    4.5,
    "call card heading on white",
  );
  check(
    worst(white, stops("--gradient-primary")),
    4.5,
    "held 1195: white title and 13px description on its gradient (both ends)",
  );
  check(
    contrast(token("--call-second-edge"), card),
    3,
    "116 button edge on the white call card",
  );
  check(
    contrast(token("--color-ink"), card),
    4.5,
    "116 title #2A1245 on white",
  );
  check(
    contrast(token("--color-muted"), card),
    4.5,
    "116 description #6B4F86 on white",
  );
  check(
    worst(token("--color-violet"), page),
    4.5,
    '"Ask a different question" #6D28D9 on the page',
  );
  check(
    contrast(token("--color-violet"), card),
    3,
    "focus ring on the call card",
  );

  // Help and referral.
  const hero = stops("--support-hero-bg");
  assert(
    JSON.stringify(hero) === '["#3b0f6b","#6b21a8","#86198f"]',
    "the hero gradient runs #3B0F6B, #6B21A8, #86198F",
  );
  const behind = [
    ...hero,
    ...hero.map((s) => over(token("--support-circle"), s)),
  ];
  check(worst(white, behind), 4.5, "hero h1, white, circle included");
  check(
    worst(token("--hero-sub-text"), behind),
    4.5,
    "hero paragraph #F6E9FF, circle included",
  );
  check(
    contrast(token("--support-pill-text"), card),
    4.5,
    "hero pill #6B21A8 on white",
  );
  check(
    worst(token("--focus-ring-on-dark"), hero),
    3,
    "white focus ring on the hero",
  );
  const pink = stops("--support-call-bg");
  assert(
    JSON.stringify(pink) === '["#c2185b","#a21caf"]',
    "the 1195 button runs #C2185B to #A21CAF (step 7d; no darkening needed)",
  );
  check(
    worst(white, pink),
    4.5,
    "1195: white 13px description at both gradient stops",
  );
  check(
    worst(token("--call-second-edge"), page),
    3,
    "116 button edge on the page and glows",
  );
  check(contrast(token("--color-ink"), card), 4.5, "116 title on white");
  check(
    contrast(token("--color-muted"), card),
    4.5,
    "116 description on white",
  );
  check(
    contrast(token("--footer-card-text"), token("--footer-card-bg")),
    4.5,
    "emergency card text #5E2A58 on #FFE9F4",
  );
  check(
    contrast(token("--color-violet"), token("--footer-card-bg")),
    4.5,
    "999 and 112 links on #FFE9F4",
  );
  check(
    worst(token("--color-muted"), page),
    4.5,
    '"Need to leave quickly?" #6B4F86 on the page',
  );
  check(
    worst(token("--back-button-edge"), page),
    3,
    '"Back to questions" edge on the page and glows',
  );
  check(
    contrast(token("--back-button-text"), card),
    4.5,
    '"Back to questions" #4A1D7A on white',
  );
  console.log(
    `  INFO: design edges: #E3C4EE ${contrast("#e3c4ee", card).toFixed(2)}:1 on white, #F0C4DD ${worst("#f0c4dd", page).toFixed(2)}:1 on the page`,
  );
}

console.log("\nTest 18: clarify and help/referral boards (step 7d)");
{
  const over = (rgba: string, hex: string) => {
    const [r, g, b, a] = rgba
      .replace(/[^0-9.,]/g, "")
      .split(",")
      .map(Number);
    const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return (
      "#" +
      [r, g, b]
        .map((c, i) => Math.round(c * a + base[i] * (1 - a)))
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")
    );
  };
  const check = (ratio: number, min: number, what: string) =>
    assert(ratio >= min, `${what}: ${ratio.toFixed(2)}:1`);
  const worst = (fg: string, bgs: string[]) =>
    Math.min(...bgs.map((bg) => contrast(fg, bg)));
  const white = token("--color-on-dark");
  const card = token("--color-card");
  const page = [
    token("--color-page"),
    card,
    token("--glow-pink"),
    token("--glow-lilac"),
  ];
  const clarify = [token("--clarify-bg-start"), token("--clarify-bg-end")];

  check(
    worst(white, [token("--bubble-bg-start"), token("--bubble-bg-end")]),
    4.5,
    "her bubble: white on #3B0F6B to #6B21A8",
  );
  check(
    contrast(token("--clarify-text"), card),
    4.5,
    "clarify pill #86198F on white",
  );
  check(
    worst(token("--color-ink"), clarify),
    4.5,
    "clarify h1 #2A1245 on the card",
  );
  check(
    worst(token("--color-muted"), clarify),
    4.5,
    '"Pick the closest" #6B4F86 on the card',
  );
  for (const tint of ["periods", "pregnancy", "contraception", "sti"]) {
    check(
      worst(token(`--topic-${tint}-text`), clarify),
      3,
      `${tint} button border on the card`,
    );
    check(
      contrast(token(`--topic-${tint}-text`), token(`--topic-${tint}-bg`)),
      3,
      `${tint} icon on its tile`,
    );
  }
  check(contrast(token("--color-ink"), card), 4.5, "topic labels on white");
  const more = page.map((bg) => over(token("--clarify-more-bg"), bg));
  check(
    worst(token("--color-ink"), more),
    4.5,
    '"Not sure which one?" on its block',
  );
  check(
    worst(token("--color-muted"), more),
    4.5,
    '"Something else?" on its block',
  );
  check(
    contrast(token("--clarify-pill-edge"), card),
    3,
    "clarify ask pill edge #9A6AB5 on white",
  );
  check(
    worst(token("--clarify-pill-edge"), page),
    3,
    "clarify ask pill edge on the page",
  );
  const call = [...token("--support-call-bg").matchAll(/#[0-9a-f]{6}/g)].map(
    (m) => m[0],
  );
  check(worst(white, call), 4.5, "1195 description, white 13px at both stops");
  check(
    contrast(token("--call-second-icon"), card),
    3,
    "116 icon #A21CAF on white",
  );
  check(
    worst(token("--call-second-edge"), page),
    3,
    "116 edge #9A6AB5 on the page",
  );
  check(
    contrast(token("--emergency-button-edge"), token("--footer-card-bg")),
    3,
    "999 and 112 button edge #B8447E on the pink card",
  );
  check(
    contrast(token("--emergency-button-text"), card),
    4.5,
    "999 and 112 #7A0E45 on white",
  );
  check(
    contrast(token("--footer-card-text"), token("--footer-card-bg")),
    4.5,
    "emergency line #5E2A58 on #FFE9F4",
  );
  check(
    worst(token("--back-button-edge"), page),
    3,
    '"Back to questions" edge #9A6AB5 on the page',
  );
  check(
    contrast(token("--color-violet"), token("--footer-card-bg")),
    3,
    "focus ring on the pink card",
  );
}

console.log("\nTest 19: the Help sheet (step 3c)");
{
  const check = (ratio: number, min: number, what: string) =>
    assert(ratio >= min, `${what}: ${ratio.toFixed(2)}:1`);
  const worst = (fg: string, bgs: string[]) =>
    Math.min(...bgs.map((bg) => contrast(fg, bg)));
  const card = token("--color-card");
  const page = [
    token("--color-page"),
    card,
    token("--glow-pink"),
    token("--glow-lilac"),
  ];
  const how = [token("--help-how-bg-start"), token("--help-how-bg-end")];
  check(worst(token("--color-plum"), page), 4.5, 'h1 "Help" on the page');
  check(
    worst(token("--sheet-control-edge"), page),
    3,
    "close button edge #9A6AB5 on the page",
  );
  check(contrast(token("--close-icon"), card), 3, "close X #4A1D7A on white");
  check(
    worst(token("--color-on-dark"), how),
    4.5,
    '"How SafeGirl works" white on its gradient',
  );
  check(
    worst(token("--hero-sub-text"), how),
    4.5,
    "how-it-works text #F6E9FF at both stops",
  );
  check(contrast(token("--tips-text"), card), 4.5, "tips #3A2D52 on white");
  check(worst(token("--color-ink"), page), 4.5, "section headings on the page");
  check(
    contrast(token("--color-on-dark"), token("--color-plum")),
    4.5,
    "1195 title, white on #3B0F6B",
  );
  check(
    contrast(token("--hero-sub-text"), token("--color-plum")),
    4.5,
    "1195 note #F6E9FF on #3B0F6B",
  );
  check(
    contrast(token("--focus-ring-on-dark"), token("--color-plum")),
    3,
    "white focus ring inside the 1195 button",
  );
  check(
    worst(token("--sheet-control-edge"), page),
    3,
    "116 edge #9A6AB5 on the page",
  );
  check(contrast(token("--color-ink"), card), 4.5, "116 title on white");
  check(
    contrast(token("--color-muted"), card),
    4.5,
    "116 note #6B4F86 on white",
  );
  check(
    contrast(
      token("--help-call-second-icon"),
      token("--help-call-second-tile"),
    ),
    3,
    "116 icon #BE185D on #FFE4F1",
  );
  check(
    contrast(token("--footer-card-text"), token("--footer-card-bg")),
    4.5,
    "emergency line #5E2A58 on #FFE9F4",
  );
  check(
    contrast(token("--color-violet"), token("--footer-card-bg")),
    4.5,
    "999 and 112 links on #FFE9F4",
  );
  for (const t of ["periods", "pregnancy", "contraception", "sti"]) {
    check(
      contrast(token(`--pill-${t}-text`), card),
      4.5,
      `${t} pill text on white`,
    );
    check(
      worst(token(`--pill-${t}-edge`), page),
      3,
      `${t} pill border on the page`,
    );
    check(
      contrast(token(`--pill-${t}-edge`), card),
      3,
      `${t} pill border against its white fill`,
    );
  }
  check(
    worst(token("--color-muted"), page),
    4.5,
    "the anonymous line #6B4F86 on the page",
  );
}

console.log("\nAll design token tests passed.");
