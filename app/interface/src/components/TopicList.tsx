import { useEffect, useRef, useState } from "react";
import { questionsFor } from "../content/kbQuestions";
import {
  TOPIC_LIST_FOOTNOTE,
  TOPIC_LIST_HINT,
  TOPIC_LIST_PLACEHOLDER,
} from "../content/uiText";
import type { Topic } from "../content/topics";
import AskBar from "./AskBar";
import DangerLine from "./DangerLine";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
import { TOPIC_ICONS } from "./topicIcons";

/**
 * Topic list: the knowledge-base questions of one class, opened from a
 * Home tile or a Help sheet topic button.
 *
 * There is one path to an answer: tapping a question, or asking in the
 * ask bar, hands the exact text to onAsk, which runs the full pipeline
 * (Safety Net, help, held topics, vague rule, classifier, retrieval,
 * gate). Nothing here returns an answer, and nothing is scoped to the
 * topic. Focus moves to the h1 when the screen opens.
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
}

export default function TopicList({
  topic,
  onAsk,
  onBack,
  focusQuestionId = null,
}: Props) {
  const questions = questionsFor(topic.topicClass);
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
    <main className="screen topic-screen">
      <button className="back-link" type="button" onClick={onBack}>
        <ChevronLeftIcon size={20} /> All topics
      </button>

      <div className={`topic-head topic-head--${topic.topicClass}`}>
        <span className="topic-head-icon">
          <Icon size={28} />
        </span>
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="topic-title">
            {topic.label}
          </h1>
          <p className="topic-hint">{TOPIC_LIST_HINT}</p>
        </div>
      </div>

      {/* The count, for screen readers only. */}
      <p className="sr-only topic-count">
        {questions.length} {questions.length === 1 ? "question" : "questions"}
      </p>
      <ul className="topic-questions" aria-label={`${topic.label} questions`}>
        {questions.map((item) => (
          <li key={item.id}>
            <button
              className="topic-question"
              type="button"
              data-question={item.id}
              onClick={() => onAsk(item.question, item.id)}
            >
              <span>{item.question}</span>
              <span className="topic-question-go" aria-hidden="true">
                <ChevronRightIcon size={16} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="topic-footnote">{TOPIC_LIST_FOOTNOTE}</p>

      <div className="screen-bottom">
        <DangerLine />
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
      </div>
    </main>
  );
}
