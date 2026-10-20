import { useEffect, useRef } from "react";
import { HeartIcon } from "./Icons";
import SupportContent from "./SupportContent";

/**
 * Referral / Escalation screen.
 *
 * Satisfies FR-04.
 *
 * Critical safety property:
 * This screen never receives or displays a generated answer.
 * The backend ResponseOrchestrator skips generation when the
 * SafetyNet flags a query, so only the referral message is passed here.
 * The support options come from offline/helpContent.ts, the same module
 * as the referral messages.
 *
 * The referral wording is interim and not clinically reviewed.
 */

interface Props {
  message: string;
  onContinueChat: () => void;
}

export default function ReferralScreen({ message, onContinueChat }: Props) {
  // Focus moves to the heading when the referral appears.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="screen">
      <section className="card card--referral" aria-labelledby="referral-title">
        <span className="icon-circle icon-circle--large">
          <HeartIcon size={32} />
        </span>

        <h2 ref={headingRef} tabIndex={-1} id="referral-title">
          We hear you.
          <br />
          We want to help.
        </h2>

        <div className="referral-box" role="alert">
          {message}
        </div>

        <section
          className="support-panel"
          aria-labelledby="referral-support-title"
        >
          <h3 id="referral-support-title">Support options</h3>
          <SupportContent />
        </section>
      </section>

      <button className="btn-outline" type="button" onClick={onContinueChat}>
        Continue chat
      </button>
    </main>
  );
}
