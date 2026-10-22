import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { Topic } from "../content/topics";
import { splitReply } from "../replySplit";
import {
  BACK_TO_QUESTIONS,
  CALL_CARD_HEADING,
  CLARIFY_FALLBACK,
  CLARIFY_MORE_WORDS,
  CLARIFY_PICK_LABEL,
  NO_ANSWER_RETRY,
  PERSON_MESSAGE,
  QUICK_EXIT_HINT,
  REPLY_PILLS,
} from "../content/uiText";
import CallButtons, { EmergencyButtons, EmergencyLine } from "./CallButtons";
import DangerLine from "./DangerLine";
import {
  HeartIcon,
  HeroSparkle,
  InfoIcon,
  PeopleIcon,
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
    <main className="screen chat-screen reply-screen clarify-screen">
      {/* Her message as a chat bubble: plain text (React escapes it). */}
      <h2 className="sr-only">You asked</h2>
      <p className="ask-bubble">{asked}</p>
      <section className="reply-card reply-card--clarify">
        <span className="reply-decor" aria-hidden="true">
          <Sparkle size={22} />
        </span>
        <Pill icon={<QuestionIcon size={16} />} label={REPLY_PILLS.clarify} />
        <h1 ref={headingRef} tabIndex={-1} className="reply-title">
          {text}
        </h1>
        <p className="clarify-pick">{CLARIFY_PICK_LABEL}</p>
        <TopicChoices variant="grid" onTopic={onTopic} />
      </section>
      <div className="clarify-more">
        <p className="clarify-more-words">{CLARIFY_MORE_WORDS}</p>
        <p className="reply-note">{CLARIFY_FALLBACK}</p>
      </div>
      <div className="screen-bottom">
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
  const { first, rest } = splitReply(text);
  return (
    <main className="screen chat-screen reply-screen">
      <section className="reply-card reply-card--held">
        <Pill icon={<InfoIcon size={16} />} label={REPLY_PILLS.held} />
        <h1 ref={headingRef} tabIndex={-1} className="reply-title">
          {first}
        </h1>
        {rest !== null && <p className="reply-body">{rest}</p>}
      </section>
      {/* The call buttons, in their own card. No footer line here: the
          card carries the GBV call button. */}
      <section className="call-card" aria-labelledby="call-card-title">
        <h2 id="call-card-title" className="call-card-title">
          {CALL_CARD_HEADING}
        </h2>
        <CallButtons surface="held" />
      </section>
      <button className="reply-link" type="button" onClick={onAskDifferent}>
        Ask a different question
      </button>
      <div className="screen-bottom">{askBar}</div>
    </main>
  );
}

/**
 * The help reply and the referral: a dark card with the reply (its first
 * sentence as the h1), the call buttons under it, the emergency line in
 * a pink card, and "Back to questions". No ask bar and no footer line;
 * the header shows "Quick exit" and no Help button (App, AppHeader).
 */
export function SupportReply({
  id,
  text,
  variant,
  onBack,
}: {
  id: string;
  text: string;
  variant: "help" | "referral";
  /** "Back to questions": Home (as "Continue chat" did). */
  onBack: () => void;
}) {
  const headingRef = useFocusOnArrival(id);
  const { first, rest } = splitReply(text);
  return (
    <main className="screen chat-screen reply-screen support-screen">
      <section className="support-hero surface-dark">
        <span className="hero-decor" aria-hidden="true">
          <span className="support-circle" />
          <span className="hero-sparkle">
            <HeroSparkle size={24} />
          </span>
        </span>
        <Pill icon={<HeartIcon size={16} />} label={REPLY_PILLS[variant]} />
        <h1 ref={headingRef} tabIndex={-1} className="support-title">
          {first}
        </h1>
        {rest !== null && <p className="support-body">{rest}</p>}
      </section>
      <CallButtons surface="support" />
      <div className="emergency-card">
        <EmergencyLine lead />
        <EmergencyButtons />
      </div>
      <div className="support-bottom">
        <p className="support-exit-hint">{QUICK_EXIT_HINT}</p>
        <button className="btn-back-questions" type="button" onClick={onBack}>
          {BACK_TO_QUESTIONS}
        </button>
      </div>
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
      <div className="screen-bottom">
        <DangerLine />
        {askBar}
      </div>
    </main>
  );
}

/**
 * Talk to a person: shown instead of a vague or abstain reply once the
 * loop limit is reached (loopLimit.ts). Her question is not shown. "See
 * who can help" opens the Help sheet, which holds the helplines.
 */
export function PersonReply({
  id,
  askBar,
  onTopic,
  onOpenHelp,
}: {
  id: string;
  askBar: ReactNode;
  onTopic: (topic: Topic) => void;
  onOpenHelp: () => void;
}) {
  const headingRef = useFocusOnArrival(id);
  return (
    <main className="screen chat-screen reply-screen">
      <section className="reply-card reply-card--noanswer reply-card--person">
        <Pill icon={<PeopleIcon size={16} />} label={REPLY_PILLS.person} />
        <h1 ref={headingRef} tabIndex={-1} className="reply-title">
          {PERSON_MESSAGE}
        </h1>
        <button className="btn-see-help" type="button" onClick={onOpenHelp}>
          See who can help
        </button>
        <TopicChoices variant="pills" onTopic={onTopic} />
      </section>
      <div className="screen-bottom">
        <DangerLine />
        {askBar}
      </div>
    </main>
  );
}
