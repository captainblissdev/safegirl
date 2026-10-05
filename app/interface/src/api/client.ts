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
 * - 401: the token is refreshed and the request retried once. A second
 *   401 throws AuthError; it never falls back to the offline pipeline,
 *   so an authentication problem is never disguised as offline mode.
 * - sign-in failing for any other reason (for example the Anonymous
 *   provider is disabled): AuthError, with no fallback.
 * - 503 and other non-OK statuses: the offline pipeline answers, as
 *   before authentication was added.
 */

export const AUTH_ERROR_MESSAGES = {
  signInFailed:
    "We couldn't start a secure session. Please refresh the page and try again.",
  sessionRejected:
    "Your secure session couldn't be confirmed. Please refresh the page and try again.",
} as const;

/** Authentication failed in a way the offline pipeline must not hide. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** The parts of a fetch Response this client uses. */
export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export interface QueryClientDeps {
  fetch: (url: string, init: RequestInit) => Promise<HttpResponse>;
  /** ID token for the current session; true forces a refresh. */
  getToken: (forceRefresh: boolean) => Promise<string>;
  isOnline: () => boolean;
  offline: (text: string) => QueryResponse;
  /** True when a sign-in/token error means Firebase was unreachable. */
  isNetworkError: (error: unknown) => boolean;
}

/** Marker: no token because the network is down; answer offline. */
const OFFLINE = Symbol("offline");

export function createQueryClient(
  deps: QueryClientDeps,
): (text: string) => Promise<QueryResponse> {
  async function tokenOrOffline(
    forceRefresh: boolean,
  ): Promise<string | typeof OFFLINE> {
    try {
      return await deps.getToken(forceRefresh);
    } catch (error) {
      if (deps.isNetworkError(error)) {
        return OFFLINE;
      }
      throw new AuthError(AUTH_ERROR_MESSAGES.signInFailed);
    }
  }

  /** POST the query; null means the request itself failed (network). */
  async function post(
    text: string,
    token: string,
  ): Promise<HttpResponse | null> {
    try {
      return await deps.fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
    } catch {
      return null;
    }
  }

  return async function submitQuery(text: string): Promise<QueryResponse> {
    if (!deps.isOnline()) {
      return deps.offline(text);
    }

    const token = await tokenOrOffline(false);
    if (token === OFFLINE) {
      return deps.offline(text);
    }

    let response = await post(text, token);
    if (response === null) {
      return deps.offline(text);
    }

    if (response.status === 401) {
      const freshToken = await tokenOrOffline(true);
      if (freshToken === OFFLINE) {
        return deps.offline(text);
      }

      response = await post(text, freshToken);
      if (response === null) {
        return deps.offline(text);
      }

      if (response.status === 401) {
        throw new AuthError(AUTH_ERROR_MESSAGES.sessionRejected);
      }
    }

    // Unchanged from before authentication: other non-OK statuses
    // (including 503) and an unreadable body use the offline pipeline.
    if (!response.ok) {
      return deps.offline(text);
    }

    try {
      return (await response.json()) as QueryResponse;
    } catch {
      return deps.offline(text);
    }
  };
}

export const submitQuery = createQueryClient({
  fetch: (url, init) => fetch(url, init),
  getToken: (forceRefresh) => getIdToken(forceRefresh),
  isOnline: () => navigator.onLine,
  offline: handleQueryOffline,
  isNetworkError,
});
