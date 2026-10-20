import { useEffect, useRef, useState } from "react";
import {
  LIMITED_MODE_NOTICE,
  PLACEHOLDER_EXAMPLES,
  PLACEHOLDER_ROTATE_MS,
  TOPIC_EXAMPLES,
  offersFollowUps,
  suggestionsFor,
} from "../content/uiText";
import { formatDetails } from "../details";
import {
  prefersReducedMotion,
  startPlaceholderRotation,
} from "../placeholderRotation";
import AskBar from "./AskBar";
import DangerLine from "./DangerLine";
import Home from "./Home";
import { FlowerIcon, PillIcon, ShieldIcon, SproutIcon } from "./Icons";

/** Each topic chip's icon; its colour comes from .chip--<topic> in CSS. */
const TOPIC_ICONS = {
  contraception: PillIcon,
  sti: ShieldIcon,
  pregnancy: SproutIcon,
  periods: FlowerIcon,
} as const;
import type { ChatTurn } from "../types";
import type { Topic } from "../content/topics";

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
  /** A Home topic tile: opens the Topic list (App). */
  onTopic?: (topic: Topic) => void;
}

export default function ChatInterface({
  turns,
  onSend,
  isLoading,
  showDetails = false,
  onTopic = () => undefined,
}: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Home is the empty state: before the first question of this chat.
  const isHome = turns.length === 0;
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Rotate Home's placeholder, unless the device asks for reduced motion.
  // When Home goes away, the next Home starts from the first example again.
  useEffect(() => {
    if (!isHome) return undefined;
    const stop = startPlaceholderRotation({
      count: PLACEHOLDER_EXAMPLES.length,
      intervalMs: PLACEHOLDER_ROTATE_MS,
      reducedMotion: prefersReducedMotion(),
      onChange: setPlaceholderIndex,
      setInterval: (callback, ms) => window.setInterval(callback, ms),
      clearInterval: (handle) => window.clearInterval(handle as number),
    });
    return () => {
      stop();
      setPlaceholderIndex(0);
    };
  }, [isHome]);

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
    !isLoading && offersFollowUps(lastTurn)
      ? suggestionsFor(lastTurn?.details?.category, lastQuestion)
      : [];

  const handleSend = () => {
    const trimmed = draft.trim();

    if (!trimmed || isLoading) return;

    onSend(trimmed);
    setDraft("");
  };

  const askBar = (
    <AskBar
      variant={isHome ? "hero" : "bar"}
      value={draft}
      onChange={setDraft}
      onSubmit={handleSend}
      disabled={isLoading}
      placeholder={
        isHome
          ? PLACEHOLDER_EXAMPLES[placeholderIndex]
          : "Ask about your body or health…"
      }
      inputRef={inputRef}
    />
  );

  if (isHome) {
    return (
      <main className="screen chat-screen home-screen">
        <Home askBar={askBar} onTopic={onTopic} />
      </main>
    );
  }

  return (
    <main className="screen chat-screen">
      <section
        className="chat-log"
        aria-live="polite"
        aria-label="Conversation"
      >
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
          // Screen readers hear "Thinking…"; the dots are decoration.
          <div
            className="bot-bubble bot-bubble--loading"
            role="status"
            aria-live="polite"
          >
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="sr-only">Thinking…</span>
          </div>
        )}
      </section>

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

      {/* The footer line sits directly above the ask bar. */}
      <DangerLine />

      {askBar}
    </main>
  );
}
