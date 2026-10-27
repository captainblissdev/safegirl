import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createQueryClient, type HttpResponse } from "./api/client";
import { handleQueryOffline } from "./offline/offlinePipeline";
import type { QueryResponse } from "./types";

/**
 * The ask bar runs the whole pipeline every time: a mocked gateway
 * records every request the query client sends, and answers with the
 * same rules as the gateway (the offline pipeline, which the gateway's
 * parity test keeps identical for Safety Net, help, held and vague) or
 * with a canned knowledge-base answer. Synthetic queries only, from the
 * gateway's shared test lists.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

const require = createRequire(import.meta.url);
const { HELP_POSITIVE } =
  require("../../gateway/test/fixtures/helpCases.js") as {
    HELP_POSITIVE: string[];
  };
const { HELD_A } = require("../../gateway/test/fixtures/heldCases.js") as {
  HELD_A: string[];
};
const { POSITIVE } = require("../../gateway/test/fixtures/safetyCases.js") as {
  POSITIVE: [string, string][];
};

const ANSWER_QUERY = "what is PrEP";
const ANSWER: QueryResponse = {
  outcome: "grounded_answer",
  kind: "answer-unscoped",
  matchedQuestion: "Can I take PrEP to prevent HIV? I'm a teenager.",
  message: "a knowledge-base answer",
  source: "WHO",
  generationInvoked: true,
};

/** A mocked gateway: records each request, answers each one alone. */
function mockGateway() {
  const requests: { url: string; body: string; headers: unknown }[] = [];
  const fetch = (url: string, init: RequestInit): Promise<HttpResponse> => {
    const body = typeof init.body === "string" ? init.body : "";
    requests.push({ url, body, headers: init.headers });
    const { text } = JSON.parse(body) as { text: string };
    const reply: QueryResponse =
      text === ANSWER_QUERY ? ANSWER : { ...handleQueryOffline(text) };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(reply),
    });
  };
  const submit = createQueryClient({
    fetch,
    getToken: () => Promise.resolve("token"),
    isOnline: () => true,
    offline: () => {
      throw new Error("the offline fallback must not run");
    },
    isNetworkError: () => false,
  });
  return { requests, submit };
}

const bodyOf = (request: { body: string }) =>
  JSON.parse(request.body) as Record<string, unknown>;

async function main() {
  console.log(
    "Test 1: after a clarify reply, a distress phrase still gets its reply",
  );
  {
    const { requests, submit } = mockGateway();
    const first = await submit("Am I okay?");
    assert(first.kind === "vague", "the first message gets the clarify reply");
    const help = await submit(HELP_POSITIVE[0]);
    assert(
      help.kind === "help",
      `"${HELP_POSITIVE[0]}" (help list) then gets the help reply`,
    );
    const [distress] = POSITIVE[0];
    const referral = await submit(distress);
    assert(
      referral.kind === "referral" && referral.outcome === "referral",
      `"${distress}" (Safety Net list) gets the referral`,
    );
    assert(
      requests.every((request) => request.url === "/api/query"),
      "each one went to the gateway",
    );
  }

  console.log(
    "\nTest 2: after an answer, a held-topic query gets the held reply",
  );
  {
    const { submit } = mockGateway();
    const answer = await submit(ANSWER_QUERY);
    assert(answer.kind === "answer-unscoped", "an answer first");
    const held = await submit(HELD_A[0]);
    assert(
      held.kind === "held-topic" && held.heldTopicGroup === "A",
      `"${HELD_A[0]}" then gets the held reply (group A)`,
    );
  }

  console.log("\nTest 3: no topic, scope or class is ever sent");
  {
    const { requests, submit } = mockGateway();
    for (const text of [
      "Am I okay?",
      ANSWER_QUERY,
      HELD_A[0],
      "is my period normal",
    ]) {
      await submit(text);
    }
    assert(
      requests.every(
        (request) =>
          JSON.stringify(Object.keys(bodyOf(request))) === '["text"]',
      ),
      "every request body is exactly { text }",
    );
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    assert(
      app.includes("submitQuery(text, { signal: request.signal })") &&
        app.includes(
          "submitEntry(entryId, text, { signal: request.signal })",
        ) &&
        !/topic|class/i.test(
          app.slice(
            app.indexOf("const handleSend"),
            app.indexOf("const cancelPending"),
          ),
        ),
      "App sends text alone to /api/query; a tapped Topic list row sends only its entry id to /api/entry; the topic's class is never sent",
    );
    const client = readFileSync(
      new URL("./api/client.ts", import.meta.url),
      "utf8",
    );
    assert(
      client.includes("body: JSON.stringify(request.payload),") &&
        client.includes('path: "/api/query", payload: { text }') &&
        client.includes('{ path: "/api/entry", payload: { id }, text }'),
      "the client sends { text } to /api/query and { id } to /api/entry, nothing else",
    );
  }

  console.log("\nTest 4: a request never carries the previous query or reply");
  {
    const { requests, submit } = mockGateway();
    const sequence = ["Am I okay?", ANSWER_QUERY, HELP_POSITIVE[0], HELD_A[0]];
    const replies: string[] = [];
    for (const text of sequence) {
      replies.push((await submit(text)).message);
    }
    for (let i = 1; i < requests.length; i++) {
      const body = requests[i].body;
      assert(
        !body.includes(JSON.stringify(sequence[i - 1]).slice(1, -1)) &&
          !body.includes(replies[i - 1].slice(0, 30)),
        `request ${i + 1} holds neither the previous query nor its reply`,
      );
    }
  }

  console.log("\nTest 5: the ask bar sends once, then clears");
  {
    const chat = readFileSync(
      new URL("./components/ChatInterface.tsx", import.meta.url),
      "utf8",
    );
    assert(
      /const trimmed = draft\.trim\(\);\s*if \(!trimmed \|\| isLoading\) return;\s*onSend\(trimmed\);\s*setDraft\(""\);/.test(
        chat,
      ),
      "Enter or the button: nothing while empty or loading; sent text is cleared",
    );
    const bar = readFileSync(
      new URL("./components/AskBar.tsx", import.meta.url),
      "utf8",
    );
    assert(
      bar.includes('if (event.key === "Enter") {') &&
        bar.includes("disabled={disabled || !value.trim()}"),
      "Enter submits; the button is disabled while empty or loading",
    );
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    assert(
      /const handleSend = async \(\s*text: string,\s*via: AnswerVia = "typed",\s*entryId: string \| null = null,\s*\) => \{[\s\S]{0,200}if \(pendingRef\.current\) return;/.test(
        app,
      ),
      "one request at a time, from every screen (the Topic list's too)",
    );
    assert(
      !bar.includes("maxLength"),
      "no character limit in the interface (unchanged; the gateway takes up to a 10 kB body)",
    );
  }

  console.log("\nAll ask flow tests passed.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
