/**
 * Referral / Escalation screen.
 *
 * Satisfies FR-04.
 *
 * Critical safety property:
 * This screen never receives or displays a generated answer.
 * The backend ResponseOrchestrator skips generation when the
 * SafetyNet flags a query, so only the referral message is passed here.
 *
 * The current message is the placeholder returned by
 * responseOrchestrator.js and is not yet finalized (R1/R2/R8).
 */

interface Props {
  message: string;
  onContinueChat: () => void;
}

export default function ReferralScreen({
  message,
  onContinueChat,
}: Props) {
  return (
    <main className="screen">
      <section
        className="card card--referral"
        aria-labelledby="referral-title"
      >
        <div className="referral-icon" aria-hidden="true">
          &#9825;
        </div>

        <h2 id="referral-title">We hear you.</h2>
        <h2>We want to help.</h2>

        <div className="referral-box" role="alert">
          {message}
        </div>
      </section>

      <button
        className="btn-outline"
        type="button"
        onClick={onContinueChat}
      >
        Continue chat
      </button>
    </main>
  );
}