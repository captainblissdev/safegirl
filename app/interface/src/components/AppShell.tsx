import type { ReactNode, RefObject } from "react";
import type { Topic } from "../content/topics";
import AppHeader from "./AppHeader";
import DangerLine from "./DangerLine";
import HelpSheet from "./HelpSheet";

interface Props {
  /** Quick exit (quickExit.ts), from the header's Exit button. */
  onExit: () => void;
  /** The Help sheet's state and actions (owned by App). */
  help: {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onTopic: (topic: Topic) => void;
    buttonRef: RefObject<HTMLButtonElement>;
  };
  /**
   * True when the screen renders the footer line itself (the chat screen,
   * above its ask bar; the splash, on its own surface); otherwise the
   * shell adds it last.
   */
  footerInContent?: boolean;
  /** The calm variant without the playful background (referral). */
  calm?: boolean;
  children: ReactNode;
}

/**
 * The frame of every screen: the header (logo, Help, Exit) first, then
 * the screen, then the footer line with the GBV helpline. Every screen in
 * App.tsx, the splash included, is rendered inside it, so none can lose
 * the header's Exit button or the footer line. The Help sheet opens over
 * any screen.
 */
export default function AppShell({
  onExit,
  help,
  footerInContent = false,
  calm = false,
  children,
}: Props) {
  return (
    <div className={calm ? "app-shell" : "app-shell app-shell--playful"}>
      <AppHeader
        onExit={onExit}
        onOpenHelp={help.onOpen}
        isHelpOpen={help.isOpen}
        helpButtonRef={help.buttonRef}
      />
      {children}
      {!footerInContent && (
        <footer className="app-footer">
          <DangerLine />
        </footer>
      )}
      {help.isOpen && (
        <HelpSheet
          onClose={help.onClose}
          onExit={onExit}
          onTopic={help.onTopic}
        />
      )}
    </div>
  );
}
