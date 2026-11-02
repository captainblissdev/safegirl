import { createDoubleEscapeHandler } from "./quickExit";

/**
 * The Help sheet's keyboard and focus rules (HS1), kept here so they can
 * be tested without a browser.
 *
 * Escape: while the Help sheet is open, one Escape closes it, wherever
 * focus is, and never counts towards the double Escape that exits. While
 * it is closed, Escape pressed twice within DOUBLE_ESCAPE_WINDOW_MS exits,
 * as before (quickExit.ts). An Escape inside the sheet is closed by the
 * sheet itself, so it is not closed twice.
 */
export function createEscapeRouter({
  isHelpOpen,
  onCloseHelp,
  onExit,
  now = () => Date.now(),
}: {
  isHelpOpen: () => boolean;
  onCloseHelp: () => void;
  onExit: () => void;
  now?: () => number;
}): (key: string, inSheet: boolean) => "close-help" | "exit" | "none" {
  const doubleEscape = createDoubleEscapeHandler(onExit, now, isHelpOpen);
  return (key, inSheet) => {
    if (key === "Escape" && isHelpOpen()) {
      // Seen while the sheet is still open: it resets the double Escape.
      doubleEscape(key);
      if (!inSheet) onCloseHelp();
      return "close-help";
    }
    return doubleEscape(key) ? "exit" : "none";
  };
}

/**
 * Where focus goes when the Help sheet closes: the control that opened
 * it, if it is still on the page; otherwise the first fallback that is
 * (the band's "Get help", then the header's Help button). The header's
 * own button is replaced while the sheet is open, so it comes back as a
 * fallback.
 */
export function returnFocusTarget<T extends { isConnected: boolean }>(
  opener: T | null,
  ...fallbacks: (T | null)[]
): T | null {
  if (opener?.isConnected) return opener;
  return fallbacks.find((item) => item?.isConnected) ?? null;
}
