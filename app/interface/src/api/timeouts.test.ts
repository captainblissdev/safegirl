import { SELF_HARM_REFERRAL_MESSAGE } from "../offline/helpContent";
import { handleQueryOffline } from "../offline/offlinePipeline";
import type { QueryResponse } from "../types";
import {
  QUERY_TIMEOUT_MS,
  QueryCancelledError,
  SIGN_IN_TIMEOUT_MS,
  createQueryClient,
  type HttpResponse,
  type QueryClientDeps,
  type Timers,
} from "./client";

/**
 * Timeout and cancellation tests for createQueryClient, with fake timers:
 * no real waiting, no Firebase, no network.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

/** Let pending promise callbacks run. */
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** Fake setTimeout/clearTimeout driven by advance(ms). */
class FakeTimers implements Timers {
  private now = 0;
  private nextId = 1;
  private queue: { id: number; at: number; callback: () => void }[] = [];

  setTimeout = (callback: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.queue.push({ id, at: this.now + ms, callback });
    return id;
  };

  clearTimeout = (id: unknown): void => {
    this.queue = this.queue.filter((timer) => timer.id !== id);
  };

  get pending(): number {
    return this.queue.length;
  }

  async advance(ms: number): Promise<void> {
    // Work already resolved happens "now", before any timer fires.
    await flush();
    const target = this.now + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at);
      const next = this.queue[0];
      if (next === undefined || next.at > target) break;
      this.queue.shift();
      this.now = next.at;
      next.callback();
      await flush();
    }
    this.now = target;
    await flush();
  }
}

const ONLINE_ANSWER: QueryResponse = {
  outcome: "grounded_answer",
  message: "online answer",
  generationInvoked: false,
};

const never = <T>() => new Promise<T>(() => undefined);

/** A fetch that never answers, but rejects when its signal aborts. */
const hangingFetch: QueryClientDeps["fetch"] = (_url, init) =>
  new Promise<HttpResponse>((_resolve, reject) => {
    init.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    );
  });

const answeringFetch: QueryClientDeps["fetch"] = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(ONLINE_ANSWER),
  });

function setup(overrides: Partial<QueryClientDeps>) {
  const timers = new FakeTimers();
  const calls = { fetch: 0, offline: [] as string[] };
  const deps: QueryClientDeps = {
    fetch: answeringFetch,
    getToken: () => Promise.resolve("token"),
    isOnline: () => true,
    offline: handleQueryOffline,
    isNetworkError: () => false,
    timers,
    ...overrides,
  };
  const fetch = deps.fetch;
  const offline = deps.offline;
  const submit = createQueryClient({
    ...deps,
    fetch: (url, init) => {
      calls.fetch++;
      return fetch(url, init);
    },
    offline: (text) => {
      calls.offline.push(text);
      return offline(text);
    },
  });
  return { submit, timers, calls };
}

/** Track a promise's state without awaiting it. */
function track<T>(promise: Promise<T>) {
  const state: { settled: boolean; value?: T; error?: unknown } = {
    settled: false,
  };
  promise.then(
    (value) => Object.assign(state, { settled: true, value }),
    (error: unknown) => Object.assign(state, { settled: true, error }),
  );
  return state;
}

console.log("Test 1: the timeouts are 20 s for the query and 10 s for sign-in");
assert(QUERY_TIMEOUT_MS === 20_000, "QUERY_TIMEOUT_MS is 20000");
assert(SIGN_IN_TIMEOUT_MS === 10_000, "SIGN_IN_TIMEOUT_MS is 10000");

console.log(
  "\nTest 2: a query with no reply falls back after QUERY_TIMEOUT_MS",
);
{
  const { submit, timers, calls } = setup({ fetch: hangingFetch });
  const result = track(submit("what is PrEP"));

  await timers.advance(QUERY_TIMEOUT_MS - 1);
  assert(!result.settled, "still waiting 1 ms before the timeout");

  await timers.advance(1);
  assert(result.settled, "settled at the timeout");
  assert(result.value?.limitedMode === true, "marked as limited mode");
  assert(
    calls.offline.length === 1 && calls.offline[0] === "what is PrEP",
    "the offline pipeline answered",
  );
  assert(timers.pending === 0, "no timer left running");
}

console.log(
  "\nTest 3: a sign-in with no reply falls back after SIGN_IN_TIMEOUT_MS",
);
{
  const { submit, timers, calls } = setup({ getToken: () => never<string>() });
  const result = track(submit("what is PrEP"));

  await timers.advance(SIGN_IN_TIMEOUT_MS - 1);
  assert(!result.settled, "still waiting 1 ms before the timeout");

  await timers.advance(1);
  assert(result.settled, "settled at the timeout");
  assert(result.value?.limitedMode === true, "marked as limited mode");
  assert(calls.fetch === 0, "no query was sent without a token");
  assert(calls.offline.length === 1, "the offline pipeline answered");
}

console.log("\nTest 4: on a timeout the offline Safety Net still runs first");
{
  const { submit, timers } = setup({ fetch: hangingFetch });
  const result = track(submit("I want to kill myself"));

  await timers.advance(QUERY_TIMEOUT_MS);
  assert(result.value?.outcome === "referral", "the outcome is referral");
  assert(
    result.value?.message === SELF_HARM_REFERRAL_MESSAGE,
    "with the self-harm referral message",
  );
}

console.log("\nTest 5: a fast answer is unaffected by the timeouts");
{
  const { submit, timers, calls } = setup({});
  const result = await submit("what is PrEP");

  assert(result === ONLINE_ANSWER, "the gateway's answer is returned");
  assert(result.limitedMode !== true, "not marked as limited mode");
  assert(calls.offline.length === 0, "the offline pipeline was not used");
  assert(timers.pending === 0, "both timers were cleared");
}

console.log(
  "\nTest 6: cancelling during the query rejects, with no fallback or notice",
);
{
  const { submit, timers, calls } = setup({ fetch: hangingFetch });
  const controller = new AbortController();
  const result = track(submit("what is PrEP", { signal: controller.signal }));

  await timers.advance(1_000);
  controller.abort();
  await flush();

  assert(
    result.error instanceof QueryCancelledError,
    "rejects with QueryCancelledError",
  );
  assert(calls.offline.length === 0, "the offline pipeline was not used");
  assert(timers.pending === 0, "the query timer was cleared");
}

console.log("\nTest 7: cancelling during sign-in rejects, with no fallback");
{
  const { submit, timers, calls } = setup({ getToken: () => never<string>() });
  const controller = new AbortController();
  const result = track(submit("what is PrEP", { signal: controller.signal }));

  controller.abort();
  await flush();
  assert(
    result.error instanceof QueryCancelledError,
    "rejects with QueryCancelledError",
  );

  await timers.advance(SIGN_IN_TIMEOUT_MS);
  assert(calls.offline.length === 0, "the later timeout did not fall back");
}

console.log(
  "\nTest 8: a request cancelled before its answer arrives is still cancelled",
);
{
  let answer: (response: HttpResponse) => void = () => undefined;
  const { submit, calls } = setup({
    fetch: () =>
      new Promise<HttpResponse>((resolve) => {
        answer = resolve;
      }),
  });
  const controller = new AbortController();
  const result = track(submit("what is PrEP", { signal: controller.signal }));

  await flush();
  controller.abort();
  answer({
    ok: true,
    status: 200,
    json: () => Promise.resolve(ONLINE_ANSWER),
  });
  await flush();

  assert(
    result.error instanceof QueryCancelledError,
    "the superseded answer is not returned",
  );
  assert(calls.offline.length === 0, "no limited-mode fallback either");
}

console.log("\nAll timeout tests passed.");
