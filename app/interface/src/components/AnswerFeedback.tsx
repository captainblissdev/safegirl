import { useState } from "react";
import {
  FEEDBACK_ASK_AGAIN,
  FEEDBACK_NO,
  FEEDBACK_PERSON,
  FEEDBACK_QUESTION,
  FEEDBACK_SORRY,
  FEEDBACK_SORRY_RELATED,
  FEEDBACK_THANKS,
  FEEDBACK_YES,
} from "../content/uiText";

/**
 * "Did that help?" under a knowledge-base answer.
 *
 * "Yes, thanks" swaps the question for a short thank-you. "Not quite"
 * swaps it for a next step: ask it another way (focus goes to the ask
 * bar), the related questions below when there are any, or Talk to a
 * person. Either choice is announced politely.
 *
 * Nothing is sent, logged or stored: the choice lives in this
 * component's state and goes when the next answer arrives (AnswerView
 * is keyed by the turn). "Not quite" counts towards the loop limit
 * (onNotHelpful), like a reply that did not answer her.
 */

export type FeedbackState = "asking" | "helped" | "notHelped";

interface Props {
  /** Whether the answer screen lists related questions below. */
  hasRelated: boolean;
  /** "Ask it another way": focus the ask bar. */
  onAskAgain: () => void;
  /** "Talk to a person": the Talk to a person screen. */
  onTalkToPerson: () => void;
  /** "Not quite" was chosen (App counts it for the loop limit). */
  onNotHelpful: () => void;
}

export default function AnswerFeedback({
  hasRelated,
  onAskAgain,
  onTalkToPerson,
  onNotHelpful,
}: Props) {
  const [state, setState] = useState<FeedbackState>("asking");

  if (state === "helped") {
    return (
      <section className="answer-feedback answer-feedback--done">
        <p className="answer-feedback-note" role="status">
          {FEEDBACK_THANKS}
        </p>
      </section>
    );
  }

  if (state === "notHelped") {
    return (
      <section className="answer-feedback answer-feedback--next">
        <p className="answer-feedback-note" role="status">
          {hasRelated ? FEEDBACK_SORRY_RELATED : FEEDBACK_SORRY}
        </p>
        <div className="answer-feedback-actions">
          <button
            className="answer-feedback-btn answer-feedback-btn--primary"
            type="button"
            onClick={onAskAgain}
          >
            {FEEDBACK_ASK_AGAIN}
          </button>
          <button
            className="answer-feedback-btn"
            type="button"
            onClick={onTalkToPerson}
          >
            {FEEDBACK_PERSON}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="answer-feedback" aria-labelledby="feedback-title">
      <p id="feedback-title" className="answer-feedback-title">
        {FEEDBACK_QUESTION}
      </p>
      <div className="answer-feedback-actions">
        <button
          className="answer-feedback-btn"
          type="button"
          onClick={() => setState("helped")}
        >
          {FEEDBACK_YES}
        </button>
        <button
          className="answer-feedback-btn"
          type="button"
          onClick={() => {
            setState("notHelped");
            onNotHelpful();
          }}
        >
          {FEEDBACK_NO}
        </button>
      </div>
    </section>
  );
}
