import { useEffect, useRef, useState } from "react";
import {
  CLARIFY_PLACEHOLDER,
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
import {
  ClarifyReply,
  HeldReply,
  NoAnswerReply,
  PersonReply,
  SupportReply,
} from "./ReplyViews";
import { replyViewOf } from "../replyView";
import type { ChatTurn } from "../types";
import type { Topic } from "../content/topics";

/**
 * Chat interface.
 *
 * Satisfies FR-01 by sending user queries to the backend for classification
 * and FR-03 by displaying responses returned from retrieval and generation.
 *
 * It shows the latest exchange only (App keeps no history). Each reply
 * kind has its own screen: a knowledge-base answer (AnswerView), clarify,
 * held topic, help and no answer (ReplyViews). A reply with no kind (a
 * limited-mode answer from the offline pipeline) keeps the plain view.
 * The category used by the system always comes from the backend.
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
  /** "Ask a different question" on a held-topic reply: back to Home. */
  onHome?: () => void;
  /** "See who can help" on the Talk to a person screen: the Help sheet. */
  onOpenHelp?: () => void;
}

export default function ChatInterface({
  turns,
  onSend,
  isLoading,
  showDetails = false,
  onTopic = () => undefined,
  back = { label: "Back to home", onBack: () => undefined },
  onHome = () => undefined,
  onOpenHelp = () => undefined,
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
  // The reply's screen; while the next reply loads, the plain view.
  const view = isLoading ? null : replyViewOf(lastTurn);
  const asked = turns.find((turn) => turn.role === "user")?.text ?? "";
  const ownScreen = view !== null && view !== "plain";

  const handleSend = () => {
    const trimmed = draft.trim();

    if (!trimmed || isLoading) return;

    onSend(trimmed);
    setDraft("");
  };

  const askBar = (
    <AskBar
      variant={isHome ? "hero" : ownScreen ? "pill" : "bar"}
      value={draft}
      onChange={setDraft}
      onSubmit={handleSend}
      disabled={isLoading}
      placeholder={
        isHome
          ? PLACEHOLDER_EXAMPLES[placeholderIndex]
          : view === "clarify"
            ? CLARIFY_PLACEHOLDER
            : ownScreen
              ? "Ask something else…"
              : "Ask about your body or health…"
      }
      inputRef={inputRef}
      label={ownScreen ? "Ask something else" : undefined}
    />
  );

  if (isHome) {
    return (
      <main className="screen chat-screen home-screen">
        <Home askBar={askBar} onTopic={onTopic} />
      </main>
    );
  }

  if (lastTurn && view === "answer") {
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
  if (lastTurn && view === "clarify") {
    return (
      <ClarifyReply
        id={lastTurn.id}
        text={lastTurn.text}
        asked={asked}
        askBar={askBar}
        onTopic={onTopic}
      />
    );
  }
  if (lastTurn && view === "held") {
    return (
      <HeldReply
        id={lastTurn.id}
        text={lastTurn.text}
        askBar={askBar}
        onAskDifferent={onHome}
      />
    );
  }
  if (lastTurn && view === "help") {
    return (
      <SupportReply
        id={lastTurn.id}
        text={lastTurn.text}
        variant="help"
        onBack={onHome}
      />
    );
  }
  if (lastTurn && view === "person") {
    return (
      <PersonReply
        id={lastTurn.id}
        askBar={askBar}
        onTopic={onTopic}
        onOpenHelp={onOpenHelp}
      />
    );
  }
  if (lastTurn && view === "noAnswer") {
    return (
      <NoAnswerReply
        id={lastTurn.id}
        text={lastTurn.text}
        asked={asked}
        askBar={askBar}
        onTopic={onTopic}
      />
    );
  }

  // The plain view: while a reply loads, after an error, or for a reply
  // with no kind. Her question is not shown back here.
  const reply = lastTurn?.role === "assistant" ? lastTurn : undefined;

  return (
    <main className="screen chat-screen">
      <section className="chat-log" aria-label="Conversation">
        {reply ? (
          <div className="bot-turn">
            {reply.limitedMode && (
              <p className="limited-notice">{LIMITED_MODE_NOTICE}</p>
            )}
            <div className="bot-bubble">
              <PlainTitle id={reply.id} text={reply.text} />
            </div>
            {showDetails && reply.details && (
              <p className="answer-details">{formatDetails(reply.details)}</p>
            )}
          </div>
        ) : (
          <h1 className="sr-only">SafeGirl</h1>
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

/** The plain reply's text as its h1, focused when it arrives. */
function PlainTitle({ id, text }: { id: string; text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [id]);
  return (
    <h1 ref={ref} tabIndex={-1} className="plain-reply">
      {text}
    </h1>
  );
}
