import { useEffect, useRef, useState, type RefObject } from "react";
import { TOPICS, type Topic } from "../content/topics";
import {
  ASK_LABEL,
  ASK_SEND_NAME,
  greetingFor,
  HOME_CLEAR_LEAVE,
  HOME_CLEAR_LEAVE_SUB,
  HOME_EXAMPLE_QUESTIONS,
  HOME_GET_HELP,
  HOME_HEADLINE,
  HOME_QUESTION_PLACEHOLDER,
  HOME_SUPPORT_SUB,
  HOME_SUPPORT_TITLE,
  QUICK_EXIT_LABEL,
} from "../content/uiText";
import Flowers from "./Flowers";
import HelplineButton from "./HelplineButton";
import {
  ArrowUpIcon,
  ChevronRightIcon,
  CloseIcon,
  PeopleIcon,
  ShieldHeartMark,
} from "./Icons";
import { TOPIC_ICONS } from "./topicIcons";

/**
 * Home: the empty state of the chat (English only). One scrolling page:
 *
 * - the header band (the splash gradient): logo and wordmark, "Get help"
 *   (the Help sheet) and Quick exit (quickExit.ts, as everywhere);
 * - the greeting and the page's only h1, with the splash's flowers;
 * - the question card: a labelled textarea and a round Send button,
 *   disabled until there is text. Enter sends; Shift+Enter is a new line;
 * - "Try asking": two example questions. A tap fills the textarea and
 *   never sends. "Hide suggestions" is React state only, for this visit;
 * - "Or browse by topic": the four Topic lists (content/topics.ts);
 * - "Feelings and staying safe": the Help sheet;
 * - the helpline button and "Clear and leave" (clearAndLeave.ts).
 *
 * Nothing here is written to browser storage. App hides its own header
 * while Home shows (Home has its own band); it returns with the Help
 * sheet, whose Exit stays in view.
 */

/** Textarea growth limit: about five lines (CSS line height 24px). */
const MAX_TEXTAREA_PX = 5 * 24 + 24;

interface Props {
  /** The question being typed (owned by the chat, which sends it). */
  draft: string;
  onDraftChange: (value: string) => void;
  /** Send the draft (the chat's send handler: trims, ignores empty). */
  onSubmit: () => void;
  /** A reply is loading: the Send button and textarea are disabled. */
  isLoading: boolean;
  /** A topic card: opens the Topic list for that class. */
  onTopic: (topic: Topic) => void;
  /** "Get help" and the support row: open the Help sheet. */
  onOpenHelp: () => void;
  /** Whether the Help sheet is open (for aria-expanded). */
  isHelpOpen: boolean;
  /** "Get help", so App can return focus to it when the sheet closes. */
  helpButtonRef?: RefObject<HTMLButtonElement>;
  /** Quick exit (quickExit.ts). */
  onExit: () => void;
  /** "Clear and leave" (clearAndLeave.ts). */
  onClearAndLeave: () => void;
  /** The time the greeting is worded for; defaults to now (tests pass one). */
  now?: Date;
}

export default function Home({
  draft,
  onDraftChange,
  onSubmit,
  isLoading,
  onTopic,
  onOpenHelp,
  isHelpOpen,
  helpButtonRef,
  onExit,
  onClearAndLeave,
  now,
}: Props) {
  // Focus moves to the h1 when Home appears (after the splash, or a new
  // chat). Coming back from a Topic list, App then focuses the card.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Suggestions shown or hidden: React state only, for this visit.
  const [showSuggestions, setShowSuggestions] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const greeting = greetingFor(now ?? new Date());
  const canSend = draft.trim() !== "" && !isLoading;

  // Grow the textarea with its text, up to about five lines.
  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [draft]);

  /** A suggestion: fills the textarea (replacing it); never sends. */
  const fillQuestion = (question: string) => {
    onDraftChange(question);
    textareaRef.current?.focus();
  };

  return (
    <div className="home">
      <section className="home-band surface-dark" aria-labelledby="home-title">
        <div className="home-topbar">
          <span className="home-brand">
            <ShieldHeartMark variant="splash" size={40} />
            <span className="home-wordmark">SafeGirl</span>
          </span>
          <div className="home-actions">
            <button
              ref={helpButtonRef}
              className="btn-home-help"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isHelpOpen}
              onClick={onOpenHelp}
            >
              {HOME_GET_HELP}
            </button>
            <button className="btn-home-exit" type="button" onClick={onExit}>
              <CloseIcon size={18} /> {QUICK_EXIT_LABEL}
            </button>
          </div>
        </div>

        <div className="home-head">
          <p className="home-greeting">{greeting}</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            id="home-title"
            className="home-headline"
          >
            {HOME_HEADLINE}
          </h1>
          <Flowers className="home-flowers" />
        </div>
      </section>

      <form
        className="home-ask"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="home-ask-label" htmlFor="chat-input">
          {ASK_LABEL}
        </label>
        <div className="home-ask-field">
          <textarea
            ref={textareaRef}
            id="chat-input"
            rows={1}
            value={draft}
            placeholder={HOME_QUESTION_PLACEHOLDER}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, as before; Shift+Enter starts a new line.
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                onSubmit();
              }
            }}
            disabled={isLoading}
            autoComplete="off"
          />
          <button
            className="btn-home-send"
            type="submit"
            disabled={!canSend}
            aria-label={ASK_SEND_NAME}
          >
            <ArrowUpIcon size={22} />
          </button>
        </div>
      </form>

      <section className="home-suggest" aria-labelledby="home-suggest-title">
        <div className="home-section-row">
          <h2 id="home-suggest-title" className="home-section-title">
            Try asking
          </h2>
          <button
            className="home-link"
            type="button"
            aria-expanded={showSuggestions}
            aria-controls="home-suggestions"
            onClick={() => setShowSuggestions((shown) => !shown)}
          >
            {showSuggestions ? "Hide suggestions" : "Show suggestions"}
          </button>
        </div>
        <div
          id="home-suggestions"
          className="home-chips"
          role="group"
          aria-label="Example questions"
          hidden={!showSuggestions}
        >
          {HOME_EXAMPLE_QUESTIONS.map((question) => (
            <button
              key={question}
              className="home-chip"
              type="button"
              onClick={() => fillQuestion(question)}
            >
              {question}
            </button>
          ))}
        </div>
      </section>

      <section className="home-topics" aria-labelledby="home-topics">
        <h2 className="home-section-title" id="home-topics">
          Or browse by topic
        </h2>
        <div
          className="home-topic-grid"
          role="group"
          aria-labelledby="home-topics"
        >
          {TOPICS.map((topic) => {
            const Icon = TOPIC_ICONS[topic.topicClass];
            return (
              <button
                key={topic.topicClass}
                className={`home-topic home-topic--${topic.topicClass}`}
                data-topic={topic.topicClass}
                type="button"
                onClick={() => onTopic(topic)}
              >
                <span className="home-topic-icon">
                  <Icon size={22} />
                </span>
                <span className="home-topic-label">{topic.label}</span>
                <span className="home-topic-sub">{topic.subtitle}</span>
              </button>
            );
          })}
        </div>
        <button
          className="home-support"
          type="button"
          aria-haspopup="dialog"
          onClick={onOpenHelp}
        >
          <span className="home-topic-icon">
            <PeopleIcon size={22} />
          </span>
          <span className="home-support-text">
            <span className="home-topic-label">{HOME_SUPPORT_TITLE}</span>
            <span className="home-topic-sub">{HOME_SUPPORT_SUB}</span>
          </span>
          <ChevronRightIcon size={20} />
        </button>
      </section>

      <footer className="home-footer">
        <HelplineButton className="home-helpline" />
        <button className="home-clear" type="button" onClick={onClearAndLeave}>
          <span className="home-clear-title">{HOME_CLEAR_LEAVE}</span>
          <span className="home-clear-sub">{HOME_CLEAR_LEAVE_SUB}</span>
        </button>
      </footer>
    </div>
  );
}
