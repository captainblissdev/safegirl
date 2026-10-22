import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { relatedQuestions } from "../content/kbQuestions";
import { ANSWER_DISCLAIMER, MATCH_HINT, MATCH_LABEL } from "../content/uiText";
import type { ChatTurn } from "../types";
import DangerLine from "./DangerLine";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "./Icons";

/**
 * The answer screen, for the answer-scoped and answer-unscoped reply
 * kinds. It shows the latest exchange only.
 *
 * The h1 is the knowledge-base question the answer belongs to, labelled
 * "The closest question I have": it is never presented as the question
 * the user asked. The answer text and its source are shown exactly as
 * the gateway returned them. There is no confidence, score or other
 * trust signal: similarity does not separate right answers from wrong
 * ones.
 *
 * Related questions are two other knowledge-base questions of the same
 * class; tapping one sends its exact text through the full pipeline, like
 * the ask bar. Focus moves to the h1 when the answer arrives.
 */

interface Props {
  turn: ChatTurn;
  /** Submit text through the full pipeline (App's send handler). */
  onSend: (text: string) => void;
  /** "Back to <topic>" or "Back to home". */
  back: { label: string; onBack: () => void };
  /** The ask bar, labelled "Ask something else". */
  askBar: ReactNode;
}

export default function AnswerView({ turn, onSend, back, askBar }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const matchedQuestion = turn.matchedQuestion ?? "";
  const related = relatedQuestions(matchedQuestion);

  useEffect(() => {
    headingRef.current?.focus();
  }, [turn.id]);

  return (
    <main className="screen chat-screen answer-screen">
      <button className="back-link" type="button" onClick={back.onBack}>
        <ChevronLeftIcon size={20} /> {back.label}
      </button>

      {turn.via === "tapped" ? (
        // She tapped this question: it heads the answer, with no banner.
        // (The answer's own question, from the response; for the one row
        // that is answered by another entry, that entry's question.)
        <h1 ref={headingRef} tabIndex={-1} className="tapped-question">
          {matchedQuestion}
        </h1>
      ) : (
        <>
          <h1 ref={headingRef} tabIndex={-1} className="closest">
            <span className="closest-label">{MATCH_LABEL}</span>
            <span className="closest-question">{matchedQuestion}</span>
          </h1>
          <p className="match-hint">{MATCH_HINT}</p>
        </>
      )}

      <article className="answer-card" aria-labelledby="answer-title">
        <h2 id="answer-title" className="answer-pill">
          <CheckIcon size={16} /> Answer
        </h2>
        <p className="answer-text">{turn.text}</p>
        <div className="answer-meta">
          {turn.source && (
            <p className="answer-source">
              <strong>Source:</strong> {turn.source}
            </p>
          )}
          <p className="answer-disclaimer">{ANSWER_DISCLAIMER}</p>
        </div>
      </article>

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title" className="related-title">
            Related questions
          </h2>
          <ul className="topic-questions topic-questions--related">
            {related.map((question) => (
              <li key={question}>
                <button
                  className="topic-question"
                  type="button"
                  onClick={() => onSend(question)}
                >
                  <span>{question}</span>
                  <span className="topic-question-go" aria-hidden="true">
                    <ChevronRightIcon size={16} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Not sticky and no panel: the end of the content, or the bottom
          of a short screen. */}
      <div className="screen-bottom">
        <DangerLine />
        {askBar}
      </div>
    </main>
  );
}
