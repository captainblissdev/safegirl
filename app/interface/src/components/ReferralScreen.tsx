import {
  BACK_TO_QUESTIONS,
  HELP_CALLS_NOTE,
  HOME_CLEAR_LEAVE,
  QUICK_EXIT_HINT,
  REFERRAL_DANGER_TITLE,
  REFERRAL_TALK_TITLE,
  REPLY_PILLS,
  TRUSTED_MESSAGE_LABEL,
  TRUSTED_MESSAGE_NOTE,
} from "../content/uiText";
import { useFocusOnArrival } from "../focusOnArrival";
import { splitReply } from "../replySplit";
import { TRUSTED_MESSAGE_HREF } from "../trustedMessage";
import BandTopbar from "./BandTopbar";
import { DangerCalls, HelplineCards } from "./HelpCalls";
import { HeartIcon } from "./Icons";
import { Pill } from "./ReplyViews";

/**
 * Referral / Escalation screen.
 *
 * Satisfies FR-04.
 *
 * Critical safety property:
 * This screen never receives or displays a generated answer.
 * The backend ResponseOrchestrator skips generation when the
 * SafetyNet flags a query, so only the referral message is passed here.
 * The call buttons come from offline/helpContent.ts, the same module as
 * the referral messages (HelpCalls.tsx, shared with the Help sheet).
 *
 * Layout (RF1): a flat purple band with the logo and Quick exit (no
 * "Get help"), the "We hear you" pill and the message's first sentence
 * as the h1; the rest of the message, unchanged; the emergency numbers
 * first, then the GBV helpline and Childline Kenya; "Message someone I
 * trust" (trustedMessage.ts); "Back to questions" and "Clear and leave".
 * The same layout serves both messages (self-harm and abuse). No
 * decoration and no motion.
 *
 * The h1 takes focus when it appears. The question she typed is never
 * shown here. The referral wording is interim and not clinically
 * reviewed.
 */

interface Props {
  message: string;
  onContinueChat: () => void;
  /** Quick exit (quickExit.ts). */
  onExit: () => void;
  /** Home's "Clear and leave" (clearAndLeave.ts). */
  onClearAndLeave: () => void;
}

export default function ReferralScreen({
  message,
  onContinueChat,
  onExit,
  onClearAndLeave,
}: Props) {
  const headingRef = useFocusOnArrival(message);
  const { first, rest } = splitReply(message);
  return (
    <main className="screen referral-screen">
      <div className="home-band referral-band surface-dark">
        <BandTopbar onExit={onExit} />
        <div className="referral-hero">
          <Pill icon={<HeartIcon size={16} />} label={REPLY_PILLS.referral} />
          <h1 ref={headingRef} tabIndex={-1} className="referral-title">
            {first}
          </h1>
        </div>
      </div>

      <div className="referral-body">
        {rest !== null && <p className="referral-text">{rest}</p>}

        <section
          className="referral-danger"
          aria-labelledby="referral-danger-title"
        >
          <h2 id="referral-danger-title" className="help-section-title">
            {REFERRAL_DANGER_TITLE}
          </h2>
          <DangerCalls />
        </section>

        <section
          className="referral-talk"
          aria-labelledby="referral-talk-title"
        >
          <h2 id="referral-talk-title" className="help-section-title">
            {REFERRAL_TALK_TITLE}
          </h2>
          <HelplineCards />
          <p className="help-calls-note">{HELP_CALLS_NOTE}</p>
        </section>

        <a className="referral-trust" href={TRUSTED_MESSAGE_HREF}>
          <span className="referral-trust-label">{TRUSTED_MESSAGE_LABEL}</span>
          <span className="referral-trust-note">{TRUSTED_MESSAGE_NOTE}</span>
        </a>

        <div className="referral-bottom">
          <p className="referral-exit-hint">{QUICK_EXIT_HINT}</p>
          <div className="referral-actions">
            <button
              className="btn-referral-text"
              type="button"
              onClick={onContinueChat}
            >
              {BACK_TO_QUESTIONS}
            </button>
            <button
              className="btn-referral-text"
              type="button"
              onClick={onClearAndLeave}
            >
              {HOME_CLEAR_LEAVE}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
