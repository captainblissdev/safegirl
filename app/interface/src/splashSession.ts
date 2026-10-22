/**
 * The splash is the once-per-session privacy and safety disclaimer
 * (FR-05). Once it is dismissed, a flag in sessionStorage keeps it from
 * showing again in this tab's session. Every storage access is wrapped:
 * if storage is blocked, the splash simply shows on every load, and the
 * app still works.
 */

import type { Screen } from "./types";

export const SPLASH_SEEN_KEY = "safegirl.splashSeen";

type SessionStore = Pick<Storage, "getItem" | "setItem">;

/** sessionStorage, or null when the browser blocks it. */
export function browserSessionStorage(): SessionStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** True when the splash was already dismissed in this session. */
export function hasSeenSplash(getStore: () => SessionStore | null): boolean {
  try {
    return getStore()?.getItem(SPLASH_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remember that the splash was dismissed; never throws. */
export function markSplashSeen(getStore: () => SessionStore | null): void {
  try {
    getStore()?.setItem(SPLASH_SEEN_KEY, "1");
  } catch {
    // Blocked storage: the splash shows again next load.
  }
}

/** The first screen: the splash unless it was dismissed this session. */
export function startScreen(getStore: () => SessionStore | null): Screen {
  return hasSeenSplash(getStore) ? "chat" : "splash";
}

/** Dismiss the splash: remember it, and go to home. */
export function continueFromSplash(
  getStore: () => SessionStore | null,
): Screen {
  markSplashSeen(getStore);
  return "chat";
}
