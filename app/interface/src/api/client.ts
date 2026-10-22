import type { QueryResponse } from "../types";
import { handleQueryOffline } from "../offline/offlinePipeline";
import { getIdToken, isNetworkError } from "../auth/session";

/**
 * Calls the gateway when online, with the anonymous session's ID token,
 * and falls back to the fully client-side pipeline when the network is
 * unavailable.
 *
 * No conversation ID is sent because SafeGirl does not maintain a
 * server-side conversation session (FR-06).
 *
 * Outcomes:
 * - offline, a failed request, or sign-in that cannot reach Firebase:
 *   the offline pipeline answers.
 * - no reply within QUERY_TIMEOUT_MS, or no sign-in within
 *   SIGN_IN_TIMEOUT_MS: the offline pipeline answers.
 * - 401: the token is refreshed and the request retried once. A second
 *   401 throws AuthError; it never falls back to the offline pipeline,
 *   so an authentication problem is never disguised as offline mode.
 * - sign-in failing for any other reason (for example the Anonymous
 *   provider is disabled): AuthError, with no fallback.
 * - 503 and other non-OK statuses: the offline pipeline answers, as
 *   before authentication was added.
 * - the caller aborts options.signal (for example "New chat" while a
 *   query is in flight): QueryCancelledError, with no answer and no
 *   fallback.
 *
 * Every answer from the offline pipeline is marked limitedMode: true, so
 * the chat can say the answer is general rather than pass it off as the
 * full service's answer. The offline pipeline runs its Safety Net first.
 *
 * submitEntry() is for a question tapped in the Topic list: it posts the
 * entry id to /api/entry, and the gateway returns that entry directly.
 * It falls back exactly as submitQuery() does, with the question's text;
 * if the gateway does not know the entry (404 or 400, for example a list
 * newer than the gateway's knowledge base), the text goes through the
 * full pipeline instead, as a typed question would.
 */

export const AUTH_ERROR_MESSAGES = {
  signInFailed:
    "We couldn't start a secure session. Please refresh the page and try again.",
  sessionRejected:
    "Your secure session couldn't be confirmed. Please refresh the page and try again.",
} as const;

/**
 * How long to wait for /api/query, per attempt, including reading the
 * reply. On timeout the offline pipeline answers in limited mode.
 */
export const QUERY_TIMEOUT_MS = 20_000;

/**
 * How long to wait for anonymous sign-in (or a token refresh). On timeout
 * the offline pipeline answers in limited mode. Firebase sign-in cannot be
 * aborted, so it is raced against this timer instead.
 */
export const SIGN_IN_TIMEOUT_MS = 10_000;

/** Authentication failed in a way the offline pipeline must not hide. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** The caller cancelled the request; no answer should be shown. */
export class QueryCancelledError extends Error {
  constructor() {
    super("The request was cancelled.");
    this.name = "QueryCancelledError";
  }
}

/** The parts of a fetch Response this client uses. */
export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/** Timer functions, injectable so tests can use fake timers. */
export interface Timers {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

const REAL_TIMERS: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (id) =>
    globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
};

export interface QueryClientDeps {
  fetch: (url: string, init: RequestInit) => Promise<HttpResponse>;
  /** ID token for the current session; true forces a refresh. */
  getToken: (forceRefresh: boolean) => Promise<string>;
  isOnline: () => boolean;
  offline: (text: string) => QueryResponse;
  /** True when a sign-in/token error means Firebase was unreachable. */
  isNetworkError: (error: unknown) => boolean;
  /** Defaults to the real setTimeout and clearTimeout. */
  timers?: Timers;
}

export interface SubmitOptions {
  /** Aborting it cancels the request: see QueryCancelledError. */
  signal?: AbortSignal;
}

/** Marker: no token because the network is down or too slow. */
const OFFLINE = Symbol("offline");

/** One request attempt; null means a network failure or a timeout. */
type Attempt =
  | { status: number; ok: false }
  | { status: number; ok: true; body: unknown; readable: boolean }
  | null;

/** What to post, and the question's text for every fallback. */
interface GatewayRequest {
  path: "/api/query" | "/api/entry";
  payload: Record<string, string>;
  text: string;
}

export interface QueryClient {
  submitQuery: (
    text: string,
    options?: SubmitOptions,
  ) => Promise<QueryResponse>;
  submitEntry: (
    id: string,
    text: string,
    options?: SubmitOptions,
  ) => Promise<QueryResponse>;
}

export function createQueryClient(
  deps: QueryClientDeps,
): (text: string, options?: SubmitOptions) => Promise<QueryResponse> {
  return createClient(deps).submitQuery;
}

export function createClient(deps: QueryClientDeps): QueryClient {
  const timers = deps.timers ?? REAL_TIMERS;

  /** Settles like promise, or rejects as soon as the signal aborts. */
  function unlessCancelled<T>(
    promise: Promise<T>,
    signal: AbortSignal | undefined,
  ): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(new QueryCancelledError());

    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(new QueryCancelledError());
      signal.addEventListener("abort", onAbort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener("abort", onAbort);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  /** A token, or OFFLINE if Firebase is unreachable or too slow. */
  function tokenOrOffline(
    forceRefresh: boolean,
    signal: AbortSignal | undefined,
  ): Promise<string | typeof OFFLINE> {
    const token = new Promise<string | typeof OFFLINE>((resolve, reject) => {
      const timer = timers.setTimeout(
        () => resolve(OFFLINE),
        SIGN_IN_TIMEOUT_MS,
      );
      deps.getToken(forceRefresh).then(
        (value) => {
          timers.clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          timers.clearTimeout(timer);
          if (deps.isNetworkError(error)) {
            resolve(OFFLINE);
          } else {
            reject(new AuthError(AUTH_ERROR_MESSAGES.signInFailed));
          }
        },
      );
    });
    return unlessCancelled(token, signal);
  }

  /** POST the request and read the reply, within QUERY_TIMEOUT_MS. */
  async function attempt(
    request: GatewayRequest,
    token: string,
    signal: AbortSignal | undefined,
  ): Promise<Attempt> {
    const controller = new AbortController();
    const onCancel = () => controller.abort();
    signal?.addEventListener("abort", onCancel, { once: true });
    const timer = timers.setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

    try {
      const response = await deps.fetch(request.path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request.payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { status: response.status, ok: false };
      }

      try {
        const body = await response.json();
        return { status: response.status, ok: true, body, readable: true };
      } catch {
        if (signal?.aborted) throw new QueryCancelledError();
        if (controller.signal.aborted) return null; // timed out
        return {
          status: response.status,
          ok: true,
          body: null,
          readable: false,
        };
      }
    } catch {
      if (signal?.aborted) throw new QueryCancelledError();
      return null; // network failure or timeout
    } finally {
      timers.clearTimeout(timer);
      signal?.removeEventListener("abort", onCancel);
    }
  }

  /** The offline pipeline's answer, marked as limited mode. */
  function fallback(text: string): QueryResponse {
    return { ...deps.offline(text), limitedMode: true };
  }

  async function run(
    request: GatewayRequest,
    signal: AbortSignal | undefined,
  ): Promise<QueryResponse> {
    const { text } = request;
    if (!deps.isOnline()) {
      return fallback(text);
    }

    const token = await tokenOrOffline(false, signal);
    if (token === OFFLINE) {
      return fallback(text);
    }

    let result = await attempt(request, token, signal);
    if (result === null) {
      return fallback(text);
    }

    if (result.status === 401) {
      const freshToken = await tokenOrOffline(true, signal);
      if (freshToken === OFFLINE) {
        return fallback(text);
      }

      result = await attempt(request, freshToken, signal);
      if (result === null) {
        return fallback(text);
      }

      if (result.status === 401) {
        throw new AuthError(AUTH_ERROR_MESSAGES.sessionRejected);
      }
    }

    // An entry the gateway does not know: ask the question as text.
    if (
      request.path === "/api/entry" &&
      (result.status === 404 || result.status === 400)
    ) {
      return run(queryRequest(text), signal);
    }

    // Unchanged from before authentication: other non-OK statuses
    // (including 503) and an unreadable body use the offline pipeline.
    if (!result.ok || !result.readable) {
      return fallback(text);
    }

    return result.body as QueryResponse;
  }

  function queryRequest(text: string): GatewayRequest {
    return { path: "/api/query", payload: { text }, text };
  }

  async function submit(
    request: GatewayRequest,
    options: SubmitOptions,
  ): Promise<QueryResponse> {
    if (options.signal?.aborted) {
      throw new QueryCancelledError();
    }

    const response = await run(request, options.signal);

    // A request cancelled while it was finishing is still cancelled: its
    // answer, and any limited-mode notice, must not be shown.
    if (options.signal?.aborted) {
      throw new QueryCancelledError();
    }
    return response;
  }

  return {
    submitQuery: (text, options = {}) => submit(queryRequest(text), options),
    submitEntry: (id, text, options = {}) =>
      submit({ path: "/api/entry", payload: { id }, text }, options),
  };
}

const client = createClient({
  fetch: (url, init) => fetch(url, init),
  getToken: (forceRefresh) => getIdToken(forceRefresh),
  isOnline: () => navigator.onLine,
  offline: handleQueryOffline,
  isNetworkError,
});

export const submitQuery = client.submitQuery;
export const submitEntry = client.submitEntry;
