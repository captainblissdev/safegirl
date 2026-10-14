import { useRef, useState } from "react";
import { LIMITED_MODE_NOTICE, TOPIC_EXAMPLES } from "../content/uiText";
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
}

export default function ChatInterface({ turns, onSend, isLoading }: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
            </div>
          ),
        )}

        {isLoading && (
          <div className="bot-bubble bot-bubble--loading" role="status">
            Thinking…
          </div>
        )}
      </section>

      <div
        className="category-chips"
        role="group"
        aria-label="Example questions by topic"
      >
        {TOPIC_EXAMPLES.map((example) => (
          <button
            key={example.label}
            className="chip"
            type="button"
            onClick={() => {
              setDraft(example.question);
              inputRef.current?.focus();
            }}
            disabled={isLoading}
          >
            {example.label}
          </button>
        ))}
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
          placeholder="Type a question…"
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
          &rarr;
        </button>
      </div>
    </main>
  );
}
