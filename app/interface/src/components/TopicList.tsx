import { useEffect, useRef, useState, type RefObject } from "react";
import { questionsFor } from "../content/kbQuestions";
import {
  TOPIC_LIST_FOOTNOTE,
  TOPIC_LIST_HINT,
  TOPIC_LIST_PLACEHOLDER,
} from "../content/uiText";
import { groupQuestions, type Topic } from "../content/topics";
import AskBar from "./AskBar";
import BandTopbar from "./BandTopbar";
import Flowers from "./Flowers";
import HelplineButton from "./HelplineButton";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
import { TOPIC_ICONS } from "./topicIcons";

/**
 * Topic list: the knowledge-base questions of one class, opened from a
 * Home card or a Help sheet topic button (English only).
 *
 * There is one path to an answer: tapping a question, or asking in the
 * ask bar, hands the exact text to onAsk, which runs the full pipeline
 * (Safety Net, help, held topics, vague rule, classifier, retrieval,
 * gate). Nothing here returns an answer, and nothing is scoped to the
 * topic. Focus moves to the h1 when the screen opens.
 *
 * The page matches Home: the gradient band (logo, "Get help", Quick
 * exit, then "All topics", the topic's icon, title and hint, and the
 * flowers); the questions in white boxes, in labelled groups where
 * content/topics.ts gives them (presentation only); the footnote; and,
 * pinned at the bottom, the ask bar and the helpline. App hides its own
 * header here while the Help sheet is closed.
 */

interface Props {
  topic: Topic;
  /**
   * Submit text through the full pipeline (App's send handler). The row's
   * id is only for the answer screen's back link (focus returns to the
   * row); it is never sent.
   */
  onAsk: (text: string, questionId: string | null) => void;
  /** Back to Home ("All topics"). */
  onBack: () => void;
  /**
   * Coming back from an answer: focus this row (the one tapped) instead
   * of the h1.
   */
  focusQuestionId?: string | null;
  /** "Get help": opens the Help sheet. */
  onOpenHelp?: () => void;
  /** Whether the Help sheet is open (for aria-expanded). */
  isHelpOpen?: boolean;
  /** "Get help", so App can return focus to it when the sheet closes. */
  helpButtonRef?: RefObject<HTMLButtonElement>;
  /** Quick exit (quickExit.ts). */
  onExit?: () => void;
}

export default function TopicList({
  topic,
  onAsk,
  onBack,
  focusQuestionId = null,
  onOpenHelp = () => undefined,
  isHelpOpen = false,
  helpButtonRef,
  onExit = () => undefined,
}: Props) {
  const questions = questionsFor(topic.topicClass);
  const groups = groupQuestions(topic.topicClass, questions);
  const Icon = TOPIC_ICONS[topic.topicClass];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const row =
      focusQuestionId === null
        ? null
        : document.querySelector<HTMLElement>(
            `[data-question="${focusQuestionId}"]`,
          );
    (row ?? headingRef.current)?.focus();
  }, [focusQuestionId]);

  const ask = () => {
    const text = draft.trim();
    if (!text) return;
    onAsk(text, null);
  };

  return (
    <main className="topic-page">
      <section className="home-band topic-band surface-dark">
        <BandTopbar
          onOpenHelp={onOpenHelp}
          isHelpOpen={isHelpOpen}
          helpButtonRef={helpButtonRef}
          onExit={onExit}
        />
        <button className="topic-back" type="button" onClick={onBack}>
          <ChevronLeftIcon size={18} /> All topics
        </button>
        <div className="topic-band-head">
          <span className="topic-band-icon">
            <Icon size={26} />
          </span>
          <div className="topic-band-text">
            <h1 ref={headingRef} tabIndex={-1} className="topic-title">
              {topic.label}
            </h1>
            <p className="topic-hint">{TOPIC_LIST_HINT}</p>
          </div>
          <Flowers className="topic-flowers" />
        </div>
      </section>

      {/* The count, for screen readers only. */}
      <p className="sr-only topic-count">
        {questions.length} {questions.length === 1 ? "question" : "questions"}
      </p>
      {groups.map((group, index) =>
        group.label === null ? (
          <ul
            key="all"
            className="topic-list"
            aria-label={`${topic.label} questions`}
          >
            {group.items.map((item) => (
              <QuestionRow key={item.id} item={item} onAsk={onAsk} />
            ))}
          </ul>
        ) : (
          <section
            key={group.label}
            className="topic-group"
            aria-labelledby={`topic-group-${index}`}
          >
            <h2 id={`topic-group-${index}`} className="topic-group-label">
              {group.label}
            </h2>
            <ul className="topic-list">
              {group.items.map((item) => (
                <QuestionRow key={item.id} item={item} onAsk={onAsk} />
              ))}
            </ul>
          </section>
        ),
      )}

      <p className="topic-footnote">{TOPIC_LIST_FOOTNOTE}</p>

      <footer className="topic-footer">
        <AskBar
          variant="pill"
          label="Ask something else"
          value={draft}
          onChange={setDraft}
          onSubmit={ask}
          disabled={false}
          placeholder={TOPIC_LIST_PLACEHOLDER}
          inputRef={inputRef}
        />
        <HelplineButton className="home-helpline" />
      </footer>
    </main>
  );
}

/** One question: its exact text, with a round chevron. */
function QuestionRow({
  item,
  onAsk,
}: {
  item: { id: string; question: string };
  onAsk: Props["onAsk"];
}) {
  return (
    <li>
      <button
        className="topic-row"
        type="button"
        data-question={item.id}
        onClick={() => onAsk(item.question, item.id)}
      >
        <span className="topic-row-text">{item.question}</span>
        <span className="topic-row-go" aria-hidden="true">
          <ChevronRightIcon size={16} />
        </span>
      </button>
    </li>
  );
}
