import type { QueryResponse } from "./types";
import { handleQueryOffline } from "./offlinePipeline";

/**
 * Calls the real backend when online and falls back to the fully
 * client-side pipeline when network connectivity is unavailable.
 *
 * No auth header is sent because Firebase Anonymous Auth (IR-01)
 * has not yet been integrated.
 *
 * No conversation ID is sent because SafeGirl does not maintain
 * a server-side conversation session (FR-06).
 */
export async function submitQuery(text: string): Promise<QueryResponse> {
  if (!navigator.onLine) {
    return handleQueryOffline(text);
  }

  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));

      throw new Error(
        body.error || `Request failed: ${response.status}`
      );
    }

    return response.json();
  } catch (err) {
    /*
     * A failed fetch can indicate intermittent connectivity even when
     * navigator.onLine still reports true. Fall back to the local
     * pipeline so the core information service remains usable.
     *
     * Note: HTTP responses such as 4xx/5xx also reach this block.
     * This is acceptable during scaffolding, but can be refined later
     * to distinguish network failures from backend failures.
     */
    return handleQueryOffline(text);
  }
}