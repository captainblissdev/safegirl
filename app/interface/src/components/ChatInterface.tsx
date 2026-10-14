import { useRef, useState } from "react";
import {
  LIMITED_MODE_NOTICE,
  TOPIC_EXAMPLES,
  suggestionsFor,
} from "../content/uiText";
import { formatDetails } from "../details";
import {
  FlowerIcon,
  MascotHeart,
  PillIcon,
  SendIcon,
  ShieldIcon,
  SproutIcon,
} from "./Icons";

/** Each topic chip's icon; its colour comes from .chip--<topic> in CSS. */
const TOPIC_ICONS = {
  contraception: PillIcon,
  sti: ShieldIcon,
  pregnancy: SproutIcon,
  periods: FlowerIcon,
} as const;
import type { ChatTurn } from "../types";

/**
 * Chat interface.
 *
 * Satisfies FR-01 by sending user queries to the backend for classification
 * and FR-03 by displaying responses returned from retrieval and generation.
 *
 * Topic chips put an example question into the input box; they never send
 * it and never choose the category. The category used by the system always
 * comes from the backend.
 */

interface Props {
  turns: ChatTurn[];
  onSend: (text: string) => void;
  isLoading: boolean;
  /** Show the demo details line under each answer. */
  showDetails?: boolean;
}

export default function ChatInterface({
  turns,
  onSend,
  isLoading,
  showDetails = false,
}: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /** Put a question in the input box, ready to send or edit. */
  const fillInput = (question: string) => {
    setDraft(question);
    inputRef.current?.focus();
  };

  // Follow-ups appear under the latest answer only, once it has arrived.
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : undefined;
  const lastQuestion =
    [...turns].reverse().find((turn) => turn.role === "user")?.text ?? "";
  const suggestions =
    !isLoading && lastTurn?.role === "assistant"
      ? suggestionsFor(lastTurn.details?.category, lastQuestion)
      : [];

  const handleSend = () => {
    const trimmed = draft.trim();

    if (!trimmed || isLoading) return;

    onSend(trimmed);
    setDraft("");
  };

  return (
    <main className="screen chat-screen">
      <section
        className="chat-log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {turns.length === 0 && (
          <div className="greeting">
            <MascotHeart />
            <div className="bot-bubble">
              <p>
                <strong>Hi, I&apos;m here to help.</strong> Ask me a question
                about your body or your health.
              </p>
              <p className="scope-line">
                I can answer questions about contraception, STIs, pregnancy and
                periods. I&apos;m not a doctor or a counsellor.
              </p>
            </div>
          </div>
        )}

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="user-bubble">
              {turn.text}
            </div>
          ) : (
            <div key={turn.id} className="bot-turn">
              {turn.limitedMode && (
                <p className="limited-notice">{LIMITED_MODE_NOTICE}</p>
              )}
              <div className="bot-bubble">{turn.text}</div>
              {showDetails && turn.details && (
                <p className="answer-details">{formatDetails(turn.details)}</p>
              )}
              {turn === lastTurn && suggestions.length > 0 && (
                <div
                  className="suggestions"
                  role="group"
                  aria-labelledby={`suggest-${turn.id}`}
                >
                  <p id={`suggest-${turn.id}`} className="suggestions-label">
                    You could also ask:
                  </p>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.evalId}
                      className="suggestion"
                      type="button"
                      onClick={() => fillInput(suggestion.question)}
                    >
                      {suggestion.question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}

        {isLoading && (
          <div className="bot-bubble bot-bubble--loading" role="status">
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="sr-only">Thinking…</span>
          </div>
        )}
      </section>

      {turns.length === 0 && (
        <p className="chips-hint">Not sure where to start? Try one:</p>
      )}

      <div
        className="category-chips"
        role="group"
        aria-label="Example questions by topic"
      >
        {TOPIC_EXAMPLES.map((example) => {
          const Icon = TOPIC_ICONS[example.topic];
          return (
            <button
              key={example.label}
              className={`chip chip--${example.topic}`}
              type="button"
              onClick={() => fillInput(example.question)}
              disabled={isLoading}
            >
              <Icon size={18} />
              {example.label}
            </button>
          );
        })}
      </div>

      <div className="input-row">
        <label className="sr-only" htmlFor="chat-input">
          Ask a question
        </label>

        <input
          ref={inputRef}
          id="chat-input"
          type="text"
          value={draft}
          placeholder="Ask about your body or health…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSend();
            }
          }}
          disabled={isLoading}
          autoComplete="off"
        />

        <button
          className="btn-send"
          type="button"
          onClick={handleSend}
          disabled={isLoading || !draft.trim()}
          aria-label="Send question"
        >
          <SendIcon />
        </button>
      </div>
    </main>
  );
}
