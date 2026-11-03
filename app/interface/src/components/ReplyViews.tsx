import type { ComponentProps, ReactNode } from "react";
import type { Topic } from "../content/topics";
import { useFocusOnArrival } from "../focusOnArrival";
import { splitLastSentence, splitReply } from "../replySplit";
import {
  BACK_TO_QUESTIONS,
  CALL_CARD_HEADING,
  CLARIFY_FALLBACK,
  CLARIFY_MORE_WORDS,
  CLARIFY_PICK_LABEL,
  HELD_ASK_DIFFERENT,
  HELD_WONDER_QUESTIONS,
  HELD_WONDER_TITLE,
  NO_ANSWER_RETRY,
  PERSON_MESSAGE,
  QUICK_EXIT_HINT,
  REPLY_PILLS,
} from "../content/uiText";
import BandTopbar from "./BandTopbar";
import CallButtons, { EmergencyButtons, EmergencyLine } from "./CallButtons";
import DangerLine from "./DangerLine";
import { HelplineCards } from "./HelpCalls";
import HelplineButton from "./HelplineButton";
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

/** "You asked" and her question, as plain text (React escapes it). */
function YouAsked({ text }: { text: string }) {
  return (
    <div className="you-asked">
      <p className="you-asked-label">You asked</p>
      <p className="you-asked-text">{text}</p>
    </div>
  );
}

export function Pill({ icon, label }: { icon: ReactNode; label: string }) {
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

/**
 * The held-topic reply (H2-B), on Home's system: the band (logo, "Get
 * help", Quick exit, then the "Talk to a nurse" pill and the reply's
 * first sentence as the h1); the rest of the reply. Group C shows its
 * last sentence (heavy bleeding or severe pain), word for word, as a
 * callout and no call card; groups A and B, whose text names the GBV
 * helpline and Childline, keep the call card with the Help sheet's cards.
 * Then two related
 * questions (a tap fills the ask bar and sends nothing), "Ask a different
 * question" (Home), and the ask bar and the helpline, pinned. No source
 * badge and no entry id.
 */
export function HeldReply({
  id,
  text,
  group,
  askBar,
  onAskDifferent,
  onFillAsk,
  band,
}: ReplyProps & {
  /** The held-topic group, as sent. */
  group?: "A" | "B" | "C";
  onAskDifferent: () => void;
  /** Put a related question in the ask bar (it is not sent). */
  onFillAsk: (question: string) => void;
  /** The band's "Get help" and Quick exit (BandTopbar). */
  band: Omit<ComponentProps<typeof BandTopbar>, "onOpenHelp"> & {
    onOpenHelp: () => void;
  };
}) {
  const headingRef = useFocusOnArrival(id);
  const { first, rest } = splitReply(text);
  // Group C: the last sentence as a callout, if it splits off cleanly.
  const split = group === "C" && rest !== null ? splitLastSentence(rest) : null;
  const body = split ? split.head : rest;
  return (
    <main className="topic-page held-page">
      <section className="home-band held-band surface-dark">
        <BandTopbar {...band} />
        <div className="held-hero">
          <Pill icon={<InfoIcon size={16} />} label={REPLY_PILLS.held} />
          <h1 ref={headingRef} tabIndex={-1} className="held-title">
            {first}
          </h1>
        </div>
      </section>
      {body !== null && <p className="held-text">{body}</p>}
      {split ? (
        <p className="held-callout">{split.last}</p>
      ) : (
        group !== "C" && (
          <section className="held-calls" aria-labelledby="call-card-title">
            <h2 id="call-card-title" className="help-section-title">
              {CALL_CARD_HEADING}
            </h2>
            <HelplineCards />
          </section>
        )
      )}
      <section className="held-wonder" aria-labelledby="held-wonder-title">
        <h2 id="held-wonder-title" className="help-section-title">
          {HELD_WONDER_TITLE}
        </h2>
        <div className="home-chips">
          {HELD_WONDER_QUESTIONS.map((question) => (
            <button
              key={question}
              className="home-chip"
              type="button"
              onClick={() => onFillAsk(question)}
            >
              {question}
            </button>
          ))}
        </div>
      </section>
      <button className="held-different" type="button" onClick={onAskDifferent}>
        {HELD_ASK_DIFFERENT}
      </button>
      <footer className="topic-footer">
        {askBar}
        <HelplineButton className="home-helpline" />
      </footer>
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
