import type { ReactNode } from "react";
import AppHeader from "./AppHeader";
import DangerLine from "./DangerLine";

interface Props {
  /** Quick exit (quickExit.ts), from the header's Exit button. */
  onExit: () => void;
  /**
   * True when the screen renders the footer line itself, directly above
   * its ask bar (the chat screen); otherwise the shell adds it last.
   */
  footerInContent?: boolean;
  /** The calm variant without the playful background (referral). */
  calm?: boolean;
  children: ReactNode;
}

/**
 * The frame of every screen: the header (logo, Help, Exit) first, then
 * the screen, then the footer line with the GBV helpline. Every
 * screen in App.tsx is rendered inside it, so none can lose the header's
 * Exit button or the footer line.
 */
export default function AppShell({
  onExit,
  footerInContent = false,
  calm = false,
  children,
}: Props) {
  return (
    <div className={calm ? "app-shell" : "app-shell app-shell--playful"}>
      <AppHeader onExit={onExit} />
      {children}
      {!footerInContent && (
        <footer className="app-footer">
          <DangerLine />
        </footer>
      )}
    </div>
  );
}
