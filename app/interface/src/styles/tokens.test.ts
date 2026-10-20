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
    token("--gradient-hero") === "linear-gradient(135deg, #5b21b6, #a21caf)",
    "hero gradient #5B21B6 to #A21CAF",
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
  for (const control of [".chip", ".btn-close", ".btn-help", ".btn-exit"]) {
    const rule = new RegExp(
      `\\${control}\\s*\\{[^}]*border: [^;]*var\\(--(control-border|primary|color-plum|color-control-border)\\)`,
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

console.log("\nAll design token tests passed.");
