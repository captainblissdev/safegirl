// Step 9 accessibility evidence. usage: node step9_a11y.mjs <repo> <evidenceDir>
// Live gateway and ml_service on localhost; the preview server on 4173. Synthetic queries only.
// Firebase anonymous sign-in is answered locally with a synthetic token (the gateway runs with
// AUTH_DISABLED=true); Google hosts never get a request.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
const [REPO, EVID] = process.argv.slice(2);
const AXE = fs.readFileSync(path.join(REPO, "app/interface/node_modules/axe-core/axe.min.js"), "utf8");
const AXE_VERSION = JSON.parse(fs.readFileSync(path.join(REPO, "app/interface/node_modules/axe-core/package.json"), "utf8")).version;
const BASE = "http://127.0.0.1:4173/";
fs.mkdirSync(path.join(EVID, "axe"), { recursive: true });
fs.mkdirSync(path.join(EVID, "zoom"), { recursive: true });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const CHROME = await browser.version();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const JWT = `${b64({ alg: "none" })}.${b64({ iat: now, exp: now + 3600, user_id: "a", sub: "a" })}.s`;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

async function open({ width = 390, height = 844, dsf = 1, reduce = false, queryDelay = 0 } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dsf, isMobile: true, hasTouch: true });
  if (reduce) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.hostname === "www.google.com") return req.respond({ status: 200, contentType: "text/html", body: "<title>exit</title>" });
    if (u.pathname === "/api/query" && queryDelay) { setTimeout(() => req.continue(), queryDelay); return; }
    if (!u.hostname.endsWith("googleapis.com")) return req.continue();
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: CORS, body: "" });
    const body = u.pathname.endsWith("accounts:signUp") ? { idToken: JWT, refreshToken: "r", expiresIn: "3600", localId: "a" } : { users: [{ localId: "a" }] };
    return req.respond({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(BASE, { waitUntil: "networkidle0" });
  return { page, context };
}
// Setup uses DOM clicks, so a layout problem being measured cannot stop the run.
const tap = (page, sel) => page.$eval(sel, (e) => e.click());
const toHome = async (page) => { await tap(page, ".btn-splash"); await page.waitForSelector(".home"); };
async function ask(page, text) {
  await page.$eval("#chat-input", (e) => { e.scrollIntoView({ block: "center" }); e.focus(); });
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".bot-bubble--loading") && !document.querySelector("#chat-input")?.disabled && (document.querySelector(".reply-screen, .answer-screen, .reply-card--support, .bot-turn")), { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 300));
}
const S5 = "Can STIs be cured, and can they harm me if I leave them?";
const SCREENS = {
  splash: async () => {},
  home: async (p) => toHome(p),
  "help-sheet": async (p) => { await toHome(p); await tap(p, ".btn-help"); await p.waitForSelector('[role="dialog"]'); await new Promise((r) => setTimeout(r, 200)); },
  "topic-list": async (p) => { await toHome(p); await tap(p, '[data-topic="sti"]'); await p.waitForSelector(".topic-screen"); },
  answer: async (p) => { await toHome(p); await ask(p, S5); },
  clarify: async (p) => { await toHome(p); await ask(p, "Am I okay?"); },
  "held-a": async (p) => { await toHome(p); await ask(p, "the condom broke last night"); },
  "held-b": async (p) => { await toHome(p); await ask(p, "how do I get rid of the pregnancy"); },
  "held-c": async (p) => { await toHome(p); await ask(p, "my period is late this month"); },
  help: async (p) => { await toHome(p); await ask(p, "Where can I get help?"); },
  referral: async (p) => { await toHome(p); await ask(p, "someone touched me"); },
  "no-answer": async (p) => { await toHome(p); await ask(p, "can my dog eat chocolate biscuits"); },
  person: async (p) => { await toHome(p); for (const q of ["Am I okay?", "hmm", "Am I okay?"]) await ask(p, q); },
  "limited-mode": async (p) => { await toHome(p); await p.setOfflineMode(true); await p.evaluate(() => window.dispatchEvent(new Event("offline"))); await ask(p, "what is PrEP"); },
};

// Measurements taken in the page.
const MEASURE = () => {
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const desc = (e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${e.classList.length ? "." + [...e.classList].join(".") : ""} "${(e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40)}"`;
  // With the modal Help sheet open, only the sheet is in play.
  const scope = document.querySelector('[role="dialog"]') ?? document;
  const tabbables = [...scope.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter(visible);
  const name = (e) => {
    if (e.getAttribute("aria-label")) return e.getAttribute("aria-label");
    if (e.labels?.length) return e.labels[0].textContent.trim();
    return e.textContent.trim().replace(/\s+/g, " ");
  };
  // Effective target: the rendered box, or the area that still hits the element (an ::after tap area).
  const target = (e) => {
    const r = e.getBoundingClientRect();
    let w = r.width, h = r.height;
    if (w < 44 || h < 44) {
      e.scrollIntoView({ block: "center", inline: "center" });
      const q = e.getBoundingClientRect();
      const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
      const hits = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
      let up = 0, down = 0, left = 0, right = 0;
      while (up < 40 && hits(cx, cy - up - 1)) up++;
      while (down < 40 && hits(cx, cy + down + 1)) down++;
      while (left < 40 && hits(cx - left - 1, cy)) left++;
      while (right < 40 && hits(cx + right + 1, cy)) right++;
      w = Math.max(w, left + right + 1); h = Math.max(h, up + down + 1);
    }
    return { w: Math.round(w), h: Math.round(h) };
  };
  const small = tabbables.map((e) => ({ e: desc(e), ...target(e) })).filter((t) => t.w < 44 || t.h < 44);
  window.scrollTo(0, 0);
  const live = [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')];
  const h1 = document.querySelector("h1");
  const tel = [...document.querySelectorAll('a[href^="tel:"]')].filter(visible).map((a) => ({ href: a.getAttribute("href"), name: name(a) }));
  const positive = [...document.querySelectorAll("[tabindex]")].filter((e) => Number(e.getAttribute("tabindex")) > 0).map(desc);
  const reversed = tabbables.map((e) => e.parentElement).filter((p) => p && /reverse/.test(getComputedStyle(p).flexDirection)).map(desc);
  const ordered = tabbables.filter((e) => getComputedStyle(e).order !== "0").map(desc);
  const banners = [...document.querySelectorAll("header")].filter((h) => !h.closest("main, section, article, aside, nav"));
  return {
    lang: document.documentElement.lang,
    h1s: document.querySelectorAll("h1").length,
    h1: h1?.textContent.trim().slice(0, 80) ?? null,
    landmarks: { banner: banners.length, main: document.querySelectorAll("main, [role=main]").length, nav: document.querySelectorAll("nav, [role=navigation]").length },
    askBarName: document.querySelector("#chat-input") ? name(document.querySelector("#chat-input")) : null,
    live: live.map((e) => ({ el: desc(e), text: e.textContent.trim().slice(0, 80) })),
    liveWithReplyText: h1 ? live.filter((e) => e.textContent.trim().length > 0 && h1.textContent.trim().length > 20 && e.textContent.includes(h1.textContent.trim().slice(0, 20))).map(desc) : [],
    tel,
    tabbables: tabbables.map(desc),
    positiveTabindex: positive, reversedFlex: reversed, cssOrder: ordered,
    smallTargets: small,
    sw: document.documentElement.scrollWidth, iw: innerWidth,
  };
};
// Text elements that overlap one another, and clipped boxes.
const OVERLAP = () => {
  const scope = document.querySelector('[role="dialog"]') ?? document.body;
  const leaves = [...scope.querySelectorAll("*")].filter((e) => {
    if (e.closest(".sr-only, [aria-hidden='true']")) return false;
    const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return false;
    return [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  });
  const rects = leaves.map((e) => {
    const range = document.createRange(); range.selectNodeContents(e);
    return { e, r: [...range.getClientRects()] };
  });
  const out = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const inDock = (x) => !!x.e.closest(".answer-dock");
    if (inDock(a) !== inDock(b)) continue; // the sticky dock covering scrolled content is by design; measured separately
    for (const ra of a.r) for (const rb of b.r) {
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      // Glyph boxes run past a tight line box; count only a real overlap.
      if (w > 2 && h > 0.25 * Math.min(ra.height, rb.height)) { out.push(`${a.e.tagName.toLowerCase()}.${a.e.className} "${a.e.textContent.trim().slice(0, 25)}" x ${b.e.tagName.toLowerCase()}.${b.e.className} "${b.e.textContent.trim().slice(0, 25)}"`); break; }
    }
  }
  const clipped = [...document.querySelectorAll("body *")].filter((e) => { const cs = getComputedStyle(e); return ["hidden", "clip"].includes(cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && !e.classList.contains("sr-only"); }).map((e) => `${e.tagName.toLowerCase()}.${e.className}`);
  const dock = document.querySelector(".answer-dock")?.getBoundingClientRect();
  return { overlaps: [...new Set(out)], clipped, sw: document.documentElement.scrollWidth, iw: innerWidth, dockShare: dock ? Math.round((dock.height / innerHeight) * 100) : null };
};

const report = { tools: { chrome: CHROME, axe: AXE_VERSION, puppeteer: "puppeteer-core 23.11.1", node: process.version }, date: new Date().toISOString(), screens: {} };
const axeSummary = {};
for (const [name, go] of Object.entries(SCREENS)) {
  report.screens[name] = {};
  for (const width of [390, 320]) {
    const { page, context } = await open({ width });
    await go(page);
    await page.evaluate(AXE);
    const axe = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }, resultTypes: ["violations", "incomplete"] }));
    fs.writeFileSync(path.join(EVID, "axe", `${name}-${width}.json`), JSON.stringify(axe, null, 1));
    axeSummary[`${name}-${width}`] = axe.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`);
    const m = await page.evaluate(MEASURE);
    report.screens[name][width] = { axeViolations: axeSummary[`${name}-${width}`], axeIncomplete: axe.incomplete.map((v) => `${v.id} (${v.nodes.length})`), ...(width === 390 ? m : { sw: m.sw, iw: m.iw }) };
    await context.close();
  }
  // Keyboard: Tab walk from the top of the page, focus style at each stop,
  // and whether the focused control is hidden (under the dock, or off screen).
  for (const [kbLabel, kbOpts] of [["keyboard", {}], ["keyboardZoom200", { width: 195, height: 422, dsf: 2 }]]) {
    const { page, context } = await open(kbOpts);
    await go(page);
    // Start the walk from the top of the page (a click on the page's top
    // corner sets the starting point); in the Help sheet, from its own
    // first control, where focus already is.
    if (!(await page.$('[role="dialog"]'))) {
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await page.mouse.click(2, 2);
    }
    const stops = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const s = await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        const cs = getComputedStyle(e);
        const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow && cs.boxShadow !== "none");
        const b = e.getBoundingClientRect();
        const pts = [[b.left + 2, b.top + 2], [b.right - 2, b.top + 2], [b.left + 2, b.bottom - 2], [b.right - 2, b.bottom - 2], [b.left + b.width / 2, b.top + b.height / 2]];
        const hidden = b.bottom < 0 || b.top > innerHeight || pts.every(([x, y]) => { const t = document.elementFromPoint(x, y); return !t || !(t === e || e.contains(t)); });
        return { hidden, el: `${e.tagName.toLowerCase()}${e.className ? "." + String(e.className).split(" ")[0] : ""} "${(e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 30)}"`, ring, outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}` };
      });
      if (!s) break;
      if (stops.length && s.el === stops[0].el) break;
      stops.push(s);
    }
    const tabbable = report.screens[name][390].tabbables.length;
    report.screens[name][kbLabel] = { stops: stops.length, tabbable, allReached: stops.length >= tabbable, noRing: stops.filter((s) => !s.ring).map((s) => s.el), focusHidden: stops.filter((s) => s.hidden).map((s) => s.el), order: stops.map((s) => s.el) };
    await context.close();
  }
  // Zoom 200% (a 195 x 422 CSS px viewport at DPR 2) and text-only 200% (default font size 32px).
  {
    const { page, context } = await open({ width: 195, height: 422, dsf: 2 });
    await go(page);
    report.screens[name].zoom200 = await page.evaluate(OVERLAP);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(EVID, "zoom", `${name}-zoom200.png`) });
    await context.close();
  }
  {
    const { page, context } = await open();
    const cdp = await page.createCDPSession();
    const sizes = async () => page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width > 0).map((e) => parseFloat(getComputedStyle(e).fontSize)));
    await go(page);
    const before = await sizes();
    await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
    await new Promise((r) => setTimeout(r, 300));
    const after = await sizes();
    const grew = after.filter((s, i) => before[i] !== undefined && s > before[i] * 1.5).length;
    const t = await page.evaluate(OVERLAP);
    report.screens[name].textOnly200 = { textElements: before.length, grewToAbout2x: grew, ...t };
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(EVID, "zoom", `${name}-text200.png`) });
    await context.close();
  }
  console.log(`${name}: axe 390 [${axeSummary[`${name}-390`].join("; ")}] 320 [${axeSummary[`${name}-320`].join("; ")}]`);
}

// Help sheet: Escape closes it and returns focus to Help; double Escape still exits.
{
  const { page, context } = await open();
  await toHome(page);
  await page.focus(".btn-help");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="dialog"]');
  const inside = await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement));
  // Tab 30 times: focus stays in the sheet (modal), and Escape is the way out.
  let escaped = false;
  for (let i = 0; i < 30; i++) { await page.keyboard.press("Tab"); if (!(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement)))) escaped = true; }
  await page.keyboard.press("Escape");
  const after = await page.evaluate(() => ({ open: !!document.querySelector('[role="dialog"]'), focus: document.activeElement?.className }));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 500));
  report.helpSheetKeyboard = { focusMovesIn: inside, tabStaysInside: !escaped, escapeCloses: !after.open, focusReturnsTo: after.focus, doubleEscapeExitsTo: page.url() };
  await context.close();
}
// Quick exit by the Exit button, from an answer.
{
  const { page, context } = await open();
  await toHome(page);
  await ask(page, S5);
  await tap(page, ".app-header .btn-exit");
  await new Promise((r) => setTimeout(r, 500));
  report.quickExit = { url: page.url(), historyLength: await page.evaluate(() => history.length) };
  await context.close();
}
// prefers-reduced-motion: running animations and transitions on the splash, the sparkle screen and while loading.
for (const reduce of [false, true]) {
  const { page, context } = await open({ reduce, queryDelay: 1500 });
  const count = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").map((a) => `${a.constructor.name}:${a.animationName ?? a.transitionProperty ?? ""}@${a.effect?.target?.className ?? ""}`));
  const splash = await count();
  await toHome(page);
  await page.type("#chat-input", "Am I okay?");
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 400));
  const loading = await count();
  await page.waitForSelector(".reply-card--clarify", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 200));
  const sparkle = await count();
  report[reduce ? "reducedMotion" : "defaultMotion"] = { splash, loading, clarifyWithSparkle: sparkle };
  await context.close();
}
fs.writeFileSync(path.join(EVID, "a11y-checks.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ helpSheet: report.helpSheetKeyboard, quickExit: report.quickExit, motion: { default: report.defaultMotion, reduced: report.reducedMotion } }, null, 1));
await browser.close();
