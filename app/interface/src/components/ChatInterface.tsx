import { useEffect, useRef, useState } from "react";
import {
  LIMITED_MODE_NOTICE,
  PLACEHOLDER_EXAMPLES,
  PLACEHOLDER_ROTATE_MS,
} from "../content/uiText";
import { formatDetails } from "../details";
import {
  prefersReducedMotion,
  startPlaceholderRotation,
} from "../placeholderRotation";
import AnswerView from "./AnswerView";
import AskBar from "./AskBar";
import DangerLine from "./DangerLine";
import Home from "./Home";
import { isAnswerTurn, type ChatTurn } from "../types";
import type { Topic } from "../content/topics";

/**
 * Chat interface.
 *
 * Satisfies FR-01 by sending user queries to the backend for classification
 * and FR-03 by displaying responses returned from retrieval and generation.
 *
 * It shows the latest exchange only (App keeps no history). A
 * knowledge-base answer gets the answer screen (AnswerView); the other
 * reply kinds are shown as a reply under the question. The category used
 * by the system always comes from the backend.
 */

interface Props {
  turns: ChatTurn[];
  onSend: (text: string) => void;
  isLoading: boolean;
  /** Show the demo details line under each answer. */
  showDetails?: boolean;
  /** A Home topic tile: opens the Topic list (App). */
  onTopic?: (topic: Topic) => void;
  /** The answer screen's back link: "Back to <topic>" or "Back to home". */
  back?: { label: string; onBack: () => void };
}

export default function ChatInterface({
  turns,
  onSend,
  isLoading,
  showDetails = false,
  onTopic = () => undefined,
  back = { label: "Back to home", onBack: () => undefined },
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

  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : undefined;
  const showAnswer = !isLoading && isAnswerTurn(lastTurn);

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
          : showAnswer
            ? "Ask something else…"
            : "Ask about your body or health…"
      }
      inputRef={inputRef}
      label={showAnswer ? "Ask something else" : undefined}
    />
  );

  if (isHome) {
    return (
      <main className="screen chat-screen home-screen">
        <Home askBar={askBar} onTopic={onTopic} />
      </main>
    );
  }

  if (showAnswer && lastTurn) {
    return (
      <AnswerView
        key={lastTurn.id}
        turn={lastTurn}
        onSend={onSend}
        back={back}
        askBar={askBar}
      />
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

      {/* The footer line sits directly above the ask bar. */}
      <DangerLine />

      {askBar}
    </main>
  );
}
