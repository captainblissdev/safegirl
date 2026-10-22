import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { contactNote, telHref, telName } from "../content/telHref";
import type { Topic } from "../content/topics";
import {
  ANONYMOUS_LINE,
  GBV_HELP_SHEET_NOTE,
  SOURCES_LINE,
} from "../content/uiText";
import { trapTab } from "../focusTrap";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
} from "../offline/helpContent";
import { CloseIcon, PhoneIcon } from "./Icons";
import TopicChoices from "./TopicChoices";

/**
 * The Help sheet, opened from the header's Help button on every screen.
 *
 * A modal dialog (role="dialog", aria-modal, labelled by its h1). It is
 * shown as a page under the app header (AppShell hides the screen behind
 * it), so the header's Exit stays visible and is the only Exit. When it
 * opens, focus moves to its close button; Tab stays inside it; Escape or
 * the close button closes it, and App returns focus to the Help button.
 * Every number and tap-to-call link comes from the helpline constants;
 * none is typed here.
 *
 * The GBV helpline note rests on Cindy's phone check, recorded in
 * docs/decision-log.md ("Quick exit"). The Childline note is the
 * SUPPORT_SECTIONS constant, word for word.
 */

interface Props {
  onClose: () => void;
  /**
   * A topic button: App closes the sheet and opens the Topic list for
   * that class.
   */
  onTopic: (topic: Topic) => void;
}

export default function HelpSheet({ onClose, onTopic }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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

  const [emergencyA, emergencyB] = EMERGENCY_NUMBERS;

  return (
    <div
      ref={sheetRef}
      className="help-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-sheet-title"
      onKeyDown={onKeyDown}
    >
      <div className="help-sheet-head">
        <h1 id="help-sheet-title">Help</h1>
        <button
          ref={closeRef}
          className="btn-close"
          type="button"
          onClick={onClose}
          aria-label="Close help"
        >
          <CloseIcon size={20} />
        </button>
      </div>

      <section className="help-card help-card--how" aria-labelledby="help-how">
        <h2 id="help-how">How SafeGirl works</h2>
        <p>
          SafeGirl finds the closest answer it has and shows you its source.{" "}
          {SOURCES_LINE} If it has no good answer, it says so. It can&apos;t
          diagnose you; a nurse or clinic can.
        </p>
        <p>
          To leave quickly, tap Exit or press Escape twice. SafeGirl then opens
          Google in this tab. This does not clear your browser history.
        </p>
      </section>

      <section
        className="help-card help-card--tips"
        aria-labelledby="help-tips"
      >
        <h2 id="help-tips">Tips for asking</h2>
        <ul className="help-tips">
          <li>Use full words, not short forms.</li>
          <li>Ask about one thing at a time.</li>
          <li>
            If the answer doesn&apos;t fit, try different words or pick a topic
            below.
          </li>
        </ul>
      </section>

      <section className="help-talk" aria-labelledby="help-talk">
        <h2 id="help-talk">Need to talk to someone?</h2>
        <ul className="help-calls">
          <li>
            <a
              className="help-call help-call--main"
              href={telHref(GBV_HELPLINE)}
            >
              <span className="help-call-icon">
                <PhoneIcon size={20} />
              </span>
              <span className="help-call-text">
                <span className="help-call-title">Call {GBV_HELPLINE}</span>
                <span className="help-call-note">{GBV_HELP_SHEET_NOTE}</span>
              </span>
            </a>
          </li>
          <li>
            <a
              className="help-call help-call--second"
              href={telHref(CHILDLINE_KENYA)}
            >
              <span className="help-call-icon">
                <PhoneIcon size={20} />
              </span>
              <span className="help-call-text">
                <span className="help-call-title">Call {CHILDLINE_KENYA}</span>
                <span className="help-call-note">
                  {contactNote(CHILDLINE_KENYA)}
                </span>
              </span>
            </a>
          </li>
        </ul>
        <p className="help-emergency">
          In immediate danger? Call{" "}
          <a href={telHref(emergencyA)} aria-label={telName(emergencyA)}>
            {emergencyA}
          </a>{" "}
          or{" "}
          <a href={telHref(emergencyB)} aria-label={telName(emergencyB)}>
            {emergencyB}
          </a>
          .
        </p>
      </section>

      <section className="help-topics" aria-labelledby="help-topics">
        <h2 id="help-topics">Topics</h2>
        <TopicChoices variant="pills" onTopic={onTopic} />
      </section>

      <p className="help-footer">{ANONYMOUS_LINE}</p>
    </div>
  );
}
