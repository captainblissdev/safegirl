import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { Topic } from "../content/topics";
import {
  CLARIFY_FALLBACK,
  NO_ANSWER_RETRY,
  REPLY_PILLS,
} from "../content/uiText";
import CallButtons, { EmergencyLine } from "./CallButtons";
import DangerLine from "./DangerLine";
import {
  HeartIcon,
  InfoIcon,
  QuestionIcon,
  SearchIcon,
  Sparkle,
} from "./Icons";
import TopicChoices from "./TopicChoices";

/**
 * The screens for the replies that are not knowledge-base answers:
 * clarify (vague), held topic, help (and the referral, via
 * SupportReply), and no answer.
 *
 * On each, the reply text, exactly as sent, is the only h1, and focus
 * moves to it when the reply arrives (App's polite live region names the
 * reply once; the text is in no live region). The question she typed is
 * shown back, as plain text, on the clarify and no-answer screens only;
 * never on the held, help or referral screens.
 */

/** Focus the h1 when a reply arrives. */
function useFocusOnArrival(key: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [key]);
  return ref;
}

/** "You asked" and her question, as plain text (React escapes it). */
function YouAsked({ text }: { text: string }) {
  return (
    <div className="you-asked">
      <p className="you-asked-label">You asked</p>
      <p className="you-asked-text">{text}</p>
    </div>
  );
}

function Pill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <p className="reply-pill">
      {icon} {label}
    </p>
  );
}

interface ReplyProps {
  /** The reply's id: focus moves to the h1 for each new reply. */
  id: string;
  /** The reply text, exactly as sent. */
  text: string;
  /** The ask bar ("Ask something else"). */
  askBar: ReactNode;
}

export function ClarifyReply({
  id,
  text,
  asked,
  askBar,
  onTopic,
}: ReplyProps & { asked: string; onTopic: (topic: Topic) => void }) {
  const headingRef = useFocusOnArrival(id);
  return (
    <main className="screen chat-screen reply-screen">
      <YouAsked text={asked} />
      <section className="reply-card reply-card--clarify">
        <span className="reply-decor" aria-hidden="true">
          <Sparkle size={22} />
        </span>
        <Pill icon={<QuestionIcon size={16} />} label={REPLY_PILLS.clarify} />
        <h1 ref={headingRef} tabIndex={-1} className="reply-title">
          {text}
        </h1>
        <TopicChoices variant="grid" onTopic={onTopic} />
      </section>
      <p className="reply-note">{CLARIFY_FALLBACK}</p>
      <div className="answer-dock">
        <DangerLine />
        {askBar}
      </div>
    </main>
  );
}

export function HeldReply({
  id,
  text,
  askBar,
  onAskDifferent,
}: ReplyProps & { onAskDifferent: () => void }) {
  const headingRef = useFocusOnArrival(id);
  return (
    <main className="screen chat-screen reply-screen">
      <section className="reply-card reply-card--held">
        <Pill icon={<InfoIcon size={16} />} label={REPLY_PILLS.held} />
        <h1 ref={headingRef} tabIndex={-1} className="reply-title">
          {text}
        </h1>
        <CallButtons surface="light" />
      </section>
      <button className="reply-link" type="button" onClick={onAskDifferent}>
        Ask a different question
      </button>
      <div className="answer-dock">
        <DangerLine callButtonAbove />
        {askBar}
      </div>
    </main>
  );
}

/**
 * The help reply and the referral: a dark card with the reply text, the
 * call buttons and the emergency line. Exit stays in the header.
 */
export function SupportReply({
  id,
  text,
  variant,
  children,
}: {
  id: string;
  text: string;
  variant: "help" | "referral";
  /** What follows the card (the ask bar, or "Continue chat"). */
  children: ReactNode;
}) {
  const headingRef = useFocusOnArrival(id);
  return (
    <main className="screen chat-screen reply-screen">
      <section className="reply-card reply-card--support surface-dark">
        <span className="reply-decor" aria-hidden="true">
          <Sparkle size={26} />
        </span>
        <Pill icon={<HeartIcon size={16} />} label={REPLY_PILLS[variant]} />
        <h1 ref={headingRef} tabIndex={-1} className="reply-title">
          {text}
        </h1>
        <CallButtons surface="dark" />
        <EmergencyLine />
      </section>
      {children}
    </main>
  );
}

export function NoAnswerReply({
  id,
  text,
  asked,
  askBar,
  onTopic,
}: ReplyProps & { asked: string; onTopic: (topic: Topic) => void }) {
  const headingRef = useFocusOnArrival(id);
  return (
    <main className="screen chat-screen reply-screen">
      <YouAsked text={asked} />
      <section className="reply-card reply-card--noanswer">
        <Pill icon={<SearchIcon size={16} />} label={REPLY_PILLS.noAnswer} />
        <h1 ref={headingRef} tabIndex={-1} className="reply-title">
          {text}
        </h1>
        <h2 className="reply-subtitle">Try a topic instead</h2>
        <TopicChoices variant="pills" onTopic={onTopic} />
      </section>
      <p className="reply-note">{NO_ANSWER_RETRY}</p>
      <div className="answer-dock">
        <DangerLine />
        {askBar}
      </div>
    </main>
  );
}
