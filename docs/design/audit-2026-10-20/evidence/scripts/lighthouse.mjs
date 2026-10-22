// Step 9 Lighthouse evidence, three runs each. usage: node step9_lh.mjs <outDir>
// Lighthouse 12.3.0 (performance, accessibility, best practices, SEO), mobile defaults
// (simulated throttling, mobile emulation). Lighthouse 11.7.1 for the PWA category,
// which 12 removed. Home: a navigation with the splash already seen this session.
// Answer: a user flow (navigate Home, time span while asking a synthetic question,
// snapshot of the answer screen). Firebase sign-in is answered locally.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { startFlow } from "lighthouse";
import lighthouse11 from "lh11";
const [OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://127.0.0.1:4173/";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const JWT = `${b64({ alg: "none" })}.${b64({ iat: now, exp: now + 3600, user_id: "a", sub: "a" })}.s`;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const S5 = "Can STIs be cured, and can they harm me if I leave them?";
const scores = [];

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.isInterceptResolutionHandled()) return;
    const u = new URL(req.url());
    if (!u.hostname.endsWith("googleapis.com")) return req.continue();
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: CORS, body: "" });
    const body = u.pathname.endsWith("accounts:signUp") ? { idToken: JWT, refreshToken: "r", expiresIn: "3600", localId: "a" } : { users: [{ localId: "a" }] };
    return req.respond({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
  });
  // The splash is seen once per session: mark it seen, so the navigation lands on Home.
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.evaluate(() => sessionStorage.setItem("safegirl.splashSeen", "1"));
  return page;
}
const pick = (lhr) => Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, v.score === null ? null : Math.round(v.score * 100)]));

for (let run = 1; run <= 3; run++) {
  // Home: navigation, Lighthouse 12.
  {
    const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
    const page = await newPage(browser);
    const flow = await startFlow(page, { name: `Home, run ${run}` });
    await flow.navigate(BASE, { stepName: "Home (navigation)", flags: { disableStorageReset: true } });
    const result = await flow.createFlowResult();
    fs.writeFileSync(path.join(OUT, `home-run${run}.report.json`), JSON.stringify(result, null, 1));
    fs.writeFileSync(path.join(OUT, `home-run${run}.report.html`), await flow.generateReport());
    const lhr = result.steps[0].lhr;
    scores.push({ page: "home", run, tool: `lighthouse ${lhr.lighthouseVersion}`, mode: "navigation", ...pick(lhr), lcp: lhr.audits["largest-contentful-paint"].displayValue, fcp: lhr.audits["first-contentful-paint"].displayValue, tbt: lhr.audits["total-blocking-time"].displayValue, cls: lhr.audits["cumulative-layout-shift"].displayValue, landed: lhr.finalDisplayedUrl });
    await browser.close();
  }
  // Answer: user flow, Lighthouse 12.
  {
    const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
    const page = await newPage(browser);
    const flow = await startFlow(page, { name: `Answer, run ${run}` });
    await flow.navigate(BASE, { stepName: "Home (navigation)", flags: { disableStorageReset: true } });
    await flow.startTimespan({ stepName: "Ask a question (time span)" });
    await page.waitForSelector("#chat-input");
    await page.type("#chat-input", S5);
    await page.keyboard.press("Enter");
    await page.waitForSelector(".answer-screen", { timeout: 60000 });
    await flow.endTimespan();
    await flow.snapshot({ stepName: "Answer screen (snapshot)" });
    const result = await flow.createFlowResult();
    fs.writeFileSync(path.join(OUT, `answer-flow-run${run}.report.json`), JSON.stringify(result, null, 1));
    fs.writeFileSync(path.join(OUT, `answer-flow-run${run}.report.html`), await flow.generateReport());
    const [, span, snap] = result.steps;
    scores.push({ page: "answer", run, tool: `lighthouse ${snap.lhr.lighthouseVersion}`, mode: "time span + snapshot", timespanPerformance: pick(span.lhr).performance, tbt: span.lhr.audits["total-blocking-time"]?.displayValue, cls: span.lhr.audits["cumulative-layout-shift"]?.displayValue, inp: span.lhr.audits["interaction-to-next-paint"]?.displayValue ?? null, ...Object.fromEntries(Object.entries(pick(snap.lhr)).filter(([k]) => k !== "performance")), snapshotPerformance: pick(snap.lhr).performance ?? null });
    await browser.close();
  }
  // Home: PWA category, Lighthouse 11.
  {
    const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
    const page = await newPage(browser);
    const result = await lighthouse11(BASE, { output: ["json", "html"], onlyCategories: ["pwa"], disableStorageReset: true }, undefined, page);
    fs.writeFileSync(path.join(OUT, `home-pwa-lh11-run${run}.report.json`), result.report[0]);
    fs.writeFileSync(path.join(OUT, `home-pwa-lh11-run${run}.report.html`), result.report[1]);
    const lhr = result.lhr;
    const pwaAudits = lhr.categories.pwa.auditRefs.map((r) => `${r.id}: ${lhr.audits[r.id].score === null ? "n/a" : lhr.audits[r.id].score}`);
    scores.push({ page: "home", run, tool: `lighthouse ${lhr.lighthouseVersion}`, mode: "navigation, PWA only", pwa: Math.round(lhr.categories.pwa.score * 100), pwaAudits });
    await browser.close();
  }
  console.log(JSON.stringify(scores.slice(-3)));
}
fs.writeFileSync(path.join(OUT, "scores.json"), JSON.stringify(scores, null, 1));
