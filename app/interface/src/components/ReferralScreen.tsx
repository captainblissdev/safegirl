import DangerLine from "./DangerLine";
import { SupportReply } from "./ReplyViews";

/**
 * Referral / Escalation screen.
 *
 * Satisfies FR-04.
 *
 * Critical safety property:
 * This screen never receives or displays a generated answer.
 * The backend ResponseOrchestrator skips generation when the
 * SafetyNet flags a query, so only the referral message is passed here.
 * The call buttons and the emergency line are built from
 * offline/helpContent.ts, the same module as the referral messages.
 *
 * The referral message is the screen's h1 and takes focus when it
 * appears. The question she typed is never shown here.
 *
 * The referral wording is interim and not clinically reviewed.
 */

interface Props {
  message: string;
  onContinueChat: () => void;
}

export default function ReferralScreen({ message, onContinueChat }: Props) {
  return (
    <SupportReply id={message} text={message} variant="referral">
      <button className="btn-outline" type="button" onClick={onContinueChat}>
        Continue chat
      </button>
      <DangerLine callButtonAbove />
    </SupportReply>
  );
}
