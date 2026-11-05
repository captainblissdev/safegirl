import type { RefObject } from "react";
import { HOME_GET_HELP, QUICK_EXIT_LABEL } from "../content/uiText";
import { CloseIcon, ShieldHeartMark } from "./Icons";

/**
 * The top row of the gradient header band on Home, the Topic list and
 * the chat screens:
 * the logo tile and wordmark on the left; "Get help" (outlined, opens
 * the Help sheet) and Quick exit (solid white, quickExit.ts) on the
 * right. Below 360px wide the wordmark is hidden (CSS). Its classes keep
 * the home- prefix they were first written with. The referral screen
 * passes no onOpenHelp: it shows Quick exit only (RF1).
 */
interface Props {
  /** Opens the Help sheet; without it, there is no "Get help". */
  onOpenHelp?: () => void;
  /** Whether the Help sheet is open (for aria-expanded). */
  isHelpOpen?: boolean;
  /** "Get help", so App can return focus to it when the sheet closes. */
  helpButtonRef?: RefObject<HTMLButtonElement>;
  /** Quick exit (quickExit.ts). */
  onExit: () => void;
}

export default function BandTopbar({
  onOpenHelp,
  isHelpOpen = false,
  helpButtonRef,
  onExit,
}: Props) {
  return (
    <div className="home-topbar">
      <span className="home-brand">
        <ShieldHeartMark variant="splash" size={36} />
        <span className="home-wordmark">SafeGirl</span>
      </span>
      <div className="home-actions">
        {onOpenHelp && (
          <button
            ref={helpButtonRef}
            className="btn-home-help"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isHelpOpen}
            onClick={onOpenHelp}
          >
            {HOME_GET_HELP}
          </button>
        )}
        <button className="btn-home-exit" type="button" onClick={onExit}>
          <CloseIcon size={16} /> {QUICK_EXIT_LABEL}
        </button>
      </div>
    </div>
  );
}
