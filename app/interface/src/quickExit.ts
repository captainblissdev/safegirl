/**
 * Quick exit: leave SafeGirl at once, for someone who needs to hide what
 * they are reading.
 *
 * On Exit (the header button, or Escape pressed twice within
 * DOUBLE_ESCAPE_WINDOW_MS with no panel open), the app clears its in-memory chat and screen
 * state and sessionStorage, then calls location.replace(EXIT_URL), so the
 * SafeGirl page is replaced in the tab instead of being added to the
 * tab's back history. There is no confirmation and no animation.
 * window.close() is not used: browsers and the installed PWA often
 * ignore it.
 *
 * LIMIT: this does not remove the visit from the browser's own history,
 * and it does not remove SafeGirl from the phone's app switcher or the
 * list of recent apps. The interface must never claim that it does.
 */

/** Where Exit sends the user. The one place this address is written. */
export const EXIT_URL = "https://www.google.com";

/** Escape pressed twice within this many milliseconds triggers Exit. */
export const DOUBLE_ESCAPE_WINDOW_MS = 1000;

export interface QuickExitDeps {
  /** Clears the in-memory chat and screen state. */
  clearState: () => void;
  /** Returns sessionStorage; may throw or return null when it is blocked. */
  getSessionStorage: () => Pick<Storage, "clear"> | null;
  /** Replaces the current page (location.replace). */
  replace: (url: string) => void;
}

/**
 * Clear the state and sessionStorage, then replace the page with
 * EXIT_URL. Blocked or failing storage never stops the exit.
 */
export function quickExit({
  clearState,
  getSessionStorage,
  replace,
}: QuickExitDeps): void {
  try {
    clearState();
  } catch {
    // Leaving matters more than tidying up.
  }
  try {
    getSessionStorage()?.clear();
  } catch {
    // Storage can be blocked (private mode, site settings).
  }
  replace(EXIT_URL);
}

/**
 * A key handler that calls onExit when Escape is pressed twice within
 * DOUBLE_ESCAPE_WINDOW_MS. Any other key, or a slower second press,
 * starts over. An Escape pressed while a panel or sheet is open closes
 * that panel and does not count: isPanelOpen is read at the moment of
 * the key press, before the panel has closed. Returns true when it
 * triggered Exit.
 */
export function createDoubleEscapeHandler(
  onExit: () => void,
  now: () => number = () => Date.now(),
  isPanelOpen: () => boolean = () => false,
): (key: string) => boolean {
  let lastEscape: number | null = null;

  return (key: string) => {
    if (key !== "Escape" || isPanelOpen()) {
      lastEscape = null;
      return false;
    }

    const time = now();
    if (lastEscape !== null && time - lastEscape <= DOUBLE_ESCAPE_WINDOW_MS) {
      lastEscape = null;
      onExit();
      return true;
    }

    lastEscape = time;
    return false;
  };
}
