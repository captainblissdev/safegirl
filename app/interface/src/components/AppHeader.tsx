import type { RefObject } from "react";
import { QUICK_EXIT_LABEL } from "../content/uiText";
import { ShieldHeartMark } from "./Icons";

interface Props {
  /** Quick exit (quickExit.ts). */
  onExit: () => void;
  /** Opens the Help sheet. */
  onOpenHelp: () => void;
  /** Whether the Help sheet is open (for aria-expanded). */
  isHelpOpen: boolean;
  /** The Help button, so App can return focus to it when the sheet closes. */
  helpButtonRef: RefObject<HTMLButtonElement>;
  /**
   * The help and referral screens: no Help button (the screen is the
   * help), and the exit button reads "Quick exit". Same behaviour.
   */
  support?: boolean;
}

/**
 * Header shown on every screen (AppShell): the gradient logo mark and the
 * "SafeGirl" wordmark, a Help button that opens the Help sheet, and an
 * Exit button. Exit is always visible and never in a menu.
 */
export default function AppHeader({
  onExit,
  onOpenHelp,
  isHelpOpen,
  helpButtonRef,
  support = false,
}: Props) {
  return (
    <header className="app-header">
      <span className="brand">
        <ShieldHeartMark variant="header" size={36} />
        <span className="wordmark">
          Safe<span className="wordmark-girl">Girl</span>
        </span>
      </span>

      <div className="header-actions">
        {!support && (
          <button
            ref={helpButtonRef}
            className="btn-help"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isHelpOpen}
            onClick={onOpenHelp}
          >
            Help
          </button>
        )}

        <button className="btn-exit" type="button" onClick={onExit}>
          {support ? QUICK_EXIT_LABEL : "Exit"}
        </button>
      </div>
    </header>
  );
}
