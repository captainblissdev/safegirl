import { readFileSync } from "node:fs";
import { LOOP_LIMIT, nextLoopCount, reachesLoopLimit } from "./loopLimit";
import { announcementFor, replyViewOf } from "./replyView";
import { PERSON_MESSAGE, REPLY_PILLS } from "./content/uiText";
import type { ChatTurn, ReplyKind } from "./types";

/**
 * Tests for the loop limit (loopLimit.ts) and how App applies it: the
 * count of consecutive vague or abstain replies, what resets it, and the
 * Talk to a person screen it leads to.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

/** Run replies through the counter as App does; the screen of each. */
function screensFor(kinds: (ReplyKind | "reset")[]): string[] {
  let count = 0;
  return kinds.map((kind, i) => {
    if (kind === "reset") {
      count = 0;
      return "reset";
    }
    count = nextLoopCount(count, kind);
    const turn: ChatTurn = {
      id: String(i),
      role: "assistant",
      text: "t",
      kind,
      matchedQuestion: kind.startsWith("answer") ? "q" : null,
      loopLimited: reachesLoopLimit(count),
    };
    return replyViewOf(turn) ?? "none";
  });
}

console.log("Test 1: the limit is one constant, 3");
{
  assert(LOOP_LIMIT === 3, "LOOP_LIMIT is 3");
}

console.log(
  "\nTest 2: the 1st and 2nd vague or abstain show their screens; the 3rd a person",
);
{
  assert(
    JSON.stringify(screensFor(["vague", "vague", "vague"])) ===
      JSON.stringify(["clarify", "clarify", "person"]),
    "vague, vague, vague: clarify, clarify, Talk to a person",
  );
  assert(
    JSON.stringify(screensFor(["abstain", "abstain", "abstain"])) ===
      JSON.stringify(["noAnswer", "noAnswer", "person"]),
    "abstain three times: no answer, no answer, Talk to a person",
  );
  assert(
    JSON.stringify(screensFor(["vague", "abstain", "vague"])) ===
      JSON.stringify(["clarify", "noAnswer", "person"]),
    "vague and abstain count together",
  );
  assert(
    JSON.stringify(screensFor(["vague", "vague", "vague", "abstain"])) ===
      JSON.stringify(["clarify", "clarify", "person", "person"]),
    "at or above the limit, the next vague or abstain shows it again",
  );
}

console.log("\nTest 3: any other reply kind resets the count");
{
  for (const kind of [
    "answer-scoped",
    "answer-unscoped",
    "help",
    "held-topic",
    "referral",
  ] as const) {
    const screens = screensFor(["vague", "vague", kind, "vague", "vague"]);
    assert(
      screens[3] === "clarify" && screens[4] === "clarify",
      `${kind} resets it: the next two vague replies show clarify`,
    );
    assert(nextLoopCount(5, kind) === 0, `${kind}: count back to 0`);
  }
  assert(
    nextLoopCount(2, undefined) === 0,
    "a reply with no kind (limited mode) resets it",
  );
  assert(
    JSON.stringify(screensFor(["vague", "vague", "reset", "vague"])) ===
      JSON.stringify(["clarify", "clarify", "reset", "clarify"]),
    "after a reset, the next vague reply shows clarify",
  );
}

console.log("\nTest 4: help, held and referral are never replaced or counted");
{
  for (const kind of ["help", "held-topic"] as const) {
    const turn: ChatTurn = {
      id: "x",
      role: "assistant",
      text: "t",
      kind,
      loopLimited: true,
    };
    assert(
      replyViewOf(turn) !== "person",
      `${kind}: never the person screen, even if marked`,
    );
  }
  const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  const referralAt = app.indexOf('if (response.outcome === "referral") {');
  const countAt = app.indexOf(
    "loopCountRef.current = nextLoopCount(loopCountRef.current, response.kind);",
  );
  assert(
    countAt > -1 && countAt < referralAt,
    "the count updates before the referral branch, which shows the referral as before (the count goes to 0)",
  );
  assert(
    app.includes("loopLimited: reachesLoopLimit(loopCountRef.current),"),
    "only the reply turn is marked; nothing delays or blocks the request",
  );
}

console.log(
  "\nTest 5: Topic list, Ask a different question, new session and Exit reset it",
);
{
  const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  const body = (name: string) => {
    const at = app.indexOf(`const ${name} = `);
    return app.slice(at, app.indexOf("\n  };", at));
  };
  assert(
    body("openTopic").includes("loopCountRef.current = 0;"),
    "opening a Topic list (from Home, a reply or the Help sheet)",
  );
  assert(
    body("handleNewChat").includes("loopCountRef.current = 0;") &&
      app.includes("onHome={handleNewChat}"),
    '"Ask a different question" (and Back to home, New chat)',
  );
  assert(
    body("handleStartNew").includes("loopCountRef.current = 0;"),
    "a new session",
  );
  const exit = app.slice(
    app.indexOf("clearState: () => {"),
    app.indexOf("getSessionStorage:"),
  );
  assert(exit.includes("loopCountRef.current = 0;"), "quick exit");
}

console.log("\nTest 6: the count lives in memory only");
{
  for (const file of ["./App.tsx", "./loopLimit.ts", "./replyView.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert(
      !/(localStorage|sessionStorage)\s*[.[]|setItem\(/.test(source),
      `${file} writes nothing to localStorage or sessionStorage`,
    );
  }
  const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  assert(
    app.includes("const loopCountRef = useRef(0);"),
    "App keeps the count in a ref",
  );
}

console.log("\nTest 7: the screen's copy and announcement");
{
  assert(
    PERSON_MESSAGE ===
      "I'm having trouble finding what you need. A nurse or counsellor at a health facility can help, and you do not have to give a reason.",
    "the message, one constant",
  );
  assert(REPLY_PILLS.person === "Let's find a person", "the pill label");
  assert(
    announcementFor("person") === "New reply: Let's find a person.",
    "announced once by name",
  );
}

console.log("\nAll loop limit tests passed.");
