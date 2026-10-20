import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { telHref } from "../content/telHref";
import { TOPICS, type Topic } from "../content/topics";
import { SOURCES_LINE } from "../content/uiText";
import { trapTab } from "../focusTrap";
import {
  CHILDLINE_KENYA,
  EMERGENCY_NUMBERS,
  GBV_HELPLINE,
} from "../offline/helpContent";
import { CloseIcon } from "./Icons";

/**
 * The Help sheet, opened from the header's Help button on every screen.
 *
 * A modal dialog (role="dialog", aria-modal, labelled by its heading).
 * When it opens, focus moves to its close button; Tab stays inside it;
 * Escape or the close button closes it, and App returns focus to the
 * Help button. Every number and tap-to-call link comes from the helpline
 * constants; none is typed here.
 *
 * The GBV helpline wording rests on Cindy's phone check, recorded in
 * docs/decision-log.md ("Quick exit"). The Childline line says only what the
 * constants support, with no claim about cost or age.
 */

interface Props {
  onClose: () => void;
  /**
   * Quick exit. The sheet covers the header, so it carries its own Exit
   * button: leaving never needs the sheet closed first.
   */
  onExit: () => void;
  /**
   * A topic button: App closes the sheet and opens the Topic list for
   * that class.
   */
  onTopic: (topic: Topic) => void;
}

export default function HelpSheet({ onClose, onExit, onTopic }: Props) {
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
    <div className="sheet-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className="help-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-sheet-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="help-sheet-head">
          <h2 id="help-sheet-title">Help</h2>
          <button className="btn-exit" type="button" onClick={onExit}>
            Exit
          </button>
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

        <section aria-labelledby="help-how">
          <h3 id="help-how">How SafeGirl works</h3>
          <p>
            SafeGirl finds the closest answer it has and shows you its source.{" "}
            {SOURCES_LINE} If it has no good answer, it says so. It can&apos;t
            diagnose you; a nurse or clinic can.
          </p>
          <p>
            To leave quickly, tap Exit or press Escape twice. SafeGirl then
            opens Google in this tab. This does not clear your browser history.
          </p>
        </section>

        <section aria-labelledby="help-tips">
          <h3 id="help-tips">Tips for asking</h3>
          <ul className="help-tips">
            <li>Use full words, not short forms.</li>
            <li>Ask about one thing at a time.</li>
            <li>
              If the answer doesn&apos;t fit, try different words or pick a
              topic below.
            </li>
          </ul>
        </section>

        <section aria-labelledby="help-talk">
          <h3 id="help-talk">Need to talk to someone?</h3>
          <ul className="help-calls">
            <li>
              <a className="btn-call" href={telHref(GBV_HELPLINE)}>
                Call {GBV_HELPLINE}
              </a>
              <span>GBV helpline. Free, 24 hours, English and Kiswahili.</span>
            </li>
            <li>
              <a className="btn-call" href={telHref(CHILDLINE_KENYA)}>
                Call {CHILDLINE_KENYA}
              </a>
              <span>Childline Kenya, for children and young people.</span>
            </li>
          </ul>
          <p className="help-emergency">
            In immediate danger? Call{" "}
            <a href={telHref(emergencyA)}>{emergencyA}</a> or{" "}
            <a href={telHref(emergencyB)}>{emergencyB}</a>.
          </p>
        </section>

        <section aria-labelledby="help-topics">
          <h3 id="help-topics">Topics</h3>
          <div className="topic-buttons">
            {TOPICS.map((topic) => (
              <button
                key={topic.topicClass}
                className={`topic-button topic-button--${topic.topicClass}`}
                type="button"
                onClick={() => onTopic(topic)}
              >
                {topic.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
