import { useState } from "react";
import type { ChatTurn } from "../types";

/**
 * Chat interface.
 *
 * Satisfies FR-01 by sending user queries to the backend for classification
 * and FR-03 by displaying responses returned from retrieval and generation.
 *
 * Category chips are display-only. They do not bypass classification.
 * The category used by the system always comes from the backend.
 */

const CATEGORIES = ["Contraception", "STI", "Pregnancy", "General"];

interface Props {
  turns: ChatTurn[];
  onSend: (text: string) => void;
  isLoading: boolean;
}

export default function ChatInterface({
  turns,
  onSend,
  isLoading,
}: Props) {
  const [draft, setDraft] = useState("");

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
              <strong>Hi, I&apos;m here to listen.</strong>
            </p>
            <p>
              Ask me anything about your body, your health, or what&apos;s on
              your mind.
            </p>
          </div>
        )}

        {turns.map((turn) => (
          <div
            key={turn.id}
            className={
              turn.role === "user" ? "user-bubble" : "bot-bubble"
            }
          >
            {turn.text}
          </div>
        ))}

        {isLoading && (
          <div
            className="bot-bubble bot-bubble--loading"
            role="status"
          >
            Thinking…
          </div>
        )}
      </section>

      <div className="category-chips" aria-hidden="true">
        {CATEGORIES.map((category) => (
          <span key={category} className="chip">
            {category}
          </span>
        ))}
      </div>

      <div className="input-row">
        <label className="sr-only" htmlFor="chat-input">
          Ask a question
        </label>

        <input
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