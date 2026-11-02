import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { contactNote, telHref, telName } from "../content/telHref";
import {
  ANONYMOUS_LINE,
  GBV_HELP_SHEET_NOTE,
  HELP_CALLS_NOTE,
  HELP_LEAVE_TEXT,
  HELP_LEAVE_TITLE,
  HOME_GET_HELP,
  QUICK_EXIT_LABEL,
  SOURCES_LINE,
} from "../content/uiText";
import { trapTab } from "../focusTrap";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
} from "../offline/helpContent";
import Flowers from "./Flowers";
import { ChevronRightIcon, CloseIcon, PhoneIcon } from "./Icons";

/**
 * The Help sheet ("Get help"), opened from the header's Help button, the
 * band's "Get help" on Home and the Topic list, and a few reply screens.
 *
 * A modal dialog (role="dialog", aria-modal, labelled by its h1), shown
 * as the whole page (App hides its header and the screen behind it while
 * it is open). Its band has the title, a Quick exit pill (quickExit.ts,
 * Google in this tab) and a round close button. When it opens, focus
 * moves to the close button; Tab stays inside it; one Escape or the close
 * button closes it, and App returns focus to the control that opened it.
 *
 * Every number and tap-to-call link comes from the helpline constants;
 * none is typed here. The GBV note's facts rest on Cindy's phone check,
 * recorded in docs/decision-log.md ("Quick exit"). The Childline note is
 * the SUPPORT_SECTIONS constant, word for word (the Childline wording
 * decision in docs/decision-log.md).
 */

interface Props {
  onClose: () => void;
  /** Quick exit (quickExit.ts). */
  onExit: () => void;
}

export default function HelpSheet({ onClose, onExit }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // "How SafeGirl works": closed when the sheet opens. React state only.
  const [isHowOpen, setIsHowOpen] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (sheetRef.current) {
      trapTab(event.nativeEvent, sheetRef.current);
    }
  };

  const lines = [
    { number: GBV_HELPLINE, note: GBV_HELP_SHEET_NOTE },
    { number: CHILDLINE_KENYA, note: contactNote(CHILDLINE_KENYA) },
  ];

  return (
    <div
      ref={sheetRef}
      className="help-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-sheet-title"
      onKeyDown={onKeyDown}
    >
      <div className="home-band help-band surface-dark">
        <h1 id="help-sheet-title" className="help-title">
          {HOME_GET_HELP}
        </h1>
        <Flowers className="help-flowers" single />
        <div className="help-band-actions">
          <button className="btn-help-exit" type="button" onClick={onExit}>
            {QUICK_EXIT_LABEL}
          </button>
          <button
            ref={closeRef}
            className="btn-help-close"
            type="button"
            onClick={onClose}
            aria-label="Close help"
          >
            <CloseIcon size={20} />
          </button>
        </div>
      </div>

      <div className="help-body">
        <section className="help-danger" aria-labelledby="help-danger-title">
          <h2 id="help-danger-title" className="help-section-title">
            In immediate danger?
          </h2>
          <div className="help-danger-calls">
            {EMERGENCY_NUMBERS.map((number) => (
              <a
                key={number}
                className="help-danger-call"
                href={telHref(number)}
                aria-label={telName(number, `Call ${number}`)}
              >
                <PhoneIcon size={20} />
                <span>Call {number}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="help-talk" aria-labelledby="help-talk-title">
          <h2 id="help-talk-title" className="help-section-title">
            Need to talk to someone?
          </h2>
          <ul className="help-lines">
            {lines.map(({ number, note }) => (
              <li key={number} className="help-line">
                <span className="help-line-icon" aria-hidden="true">
                  <PhoneIcon size={20} />
                </span>
                <span className="help-line-text">
                  <span className="help-line-number">{number}</span>
                  <span className="help-line-note">{note}</span>
                </span>
                <a
                  className="help-line-call"
                  href={telHref(number)}
                  aria-label={telName(number, `Call ${number}`)}
                >
                  Call
                </a>
              </li>
            ))}
          </ul>
          <p className="help-calls-note">{HELP_CALLS_NOTE}</p>
        </section>

        <section className="help-leave" aria-labelledby="help-leave-title">
          <h2 id="help-leave-title" className="help-leave-title">
            {HELP_LEAVE_TITLE}
          </h2>
          <p>{HELP_LEAVE_TEXT}</p>
        </section>

        <section className="help-how">
          <h2 className="help-how-heading">
            <button
              className="help-how-toggle"
              type="button"
              aria-expanded={isHowOpen}
              aria-controls="help-how-body"
              onClick={() => setIsHowOpen((open) => !open)}
            >
              <span>How SafeGirl works</span>
              <ChevronRightIcon size={18} />
            </button>
          </h2>
          <div id="help-how-body" className="help-how-body" hidden={!isHowOpen}>
            <p>
              SafeGirl finds the closest answer it has and shows you its source.
            </p>
            <p>{SOURCES_LINE} If it has no good answer, it says so.</p>
            <p>It can&apos;t diagnose you; a nurse or clinic can.</p>
            <h3 className="help-tips-title">Tips for asking</h3>
            <ul className="help-tips">
              <li>Use full words, not short forms.</li>
              <li>Ask about one thing at a time.</li>
              <li>
                If the answer doesn&apos;t fit, try different words or pick a
                topic on the home screen.
              </li>
            </ul>
          </div>
        </section>

        <p className="help-footer">{ANONYMOUS_LINE}</p>
      </div>
    </div>
  );
}
