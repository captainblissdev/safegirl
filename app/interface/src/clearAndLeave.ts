import { clearSplashSeen } from "./splashSession";

/**
 * Home's "Clear and leave": unlike Quick exit, it stays on SafeGirl. It
 * clears every piece of session state App holds (the chat, the topic,
 * the Help sheet, a pending reply), forgets that the splash was seen and
 * returns to the splash. Nothing else in browser storage is touched.
 */
export function clearAndLeave({
  clearState,
  getSessionStorage,
}: {
  /** Clears App's state and shows the splash. */
  clearState: () => void;
  /** sessionStorage; may throw or return null when blocked. */
  getSessionStorage: () => Pick<Storage, "removeItem"> | null;
}): void {
  clearState();
  clearSplashSeen(getSessionStorage);
}
