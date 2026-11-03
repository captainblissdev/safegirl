import { useEffect, useRef, useState, type RefObject } from "react";
import { CLARIFY_PLACEHOLDER, LIMITED_MODE_NOTICE } from "../content/uiText";
import { formatDetails } from "../details";
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
import type { AnswerVia, ChatTurn } from "../types";
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
  /** Typed in the ask bar ("typed"), or a related question tapped. */
  onSend: (text: string, via?: AnswerVia) => void;
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
  /**
   * Text the ask input starts with (a splash chip's starter phrase):
   * editable, never sent on its own. Empty by default.
   */
  initialDraft?: string;
  /** Called once the input has taken initialDraft, so App can clear it. */
  onInitialDraftUsed?: () => void;
  /** Home's Quick exit (quickExit.ts). */
  onExit?: () => void;
  /** Home's "Clear and leave" (clearAndLeave.ts). */
  onClearAndLeave?: () => void;
  /** Whether the Help sheet is open (Home's "Get help"). */
  isHelpOpen?: boolean;
  /** Home's "Get help", so App can return focus to it. */
  homeHelpButtonRef?: RefObject<HTMLButtonElement>;
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
  initialDraft = "",
  onInitialDraftUsed = () => undefined,
  onExit = () => undefined,
  onClearAndLeave = () => undefined,
  isHelpOpen = false,
  homeHelpButtonRef,
}: Props) {
  const [draft, setDraft] = useState(initialDraft);
  // The starter phrase is used once: App clears it after this first render,
  // so a later chat starts empty. Nothing is sent.
  useEffect(() => {
    if (initialDraft !== "") {
      onInitialDraftUsed();
    }
  }, [initialDraft, onInitialDraftUsed]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Home is the empty state: before the first question of this chat.
  const isHome = turns.length === 0;

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
      variant={ownScreen ? "pill" : "bar"}
      value={draft}
      onChange={setDraft}
      onSubmit={handleSend}
      disabled={isLoading}
      placeholder={
        view === "clarify"
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
        <Home
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleSend}
          isLoading={isLoading}
          onTopic={onTopic}
          onOpenHelp={onOpenHelp}
          isHelpOpen={isHelpOpen}
          helpButtonRef={homeHelpButtonRef}
          onExit={onExit}
          onClearAndLeave={onClearAndLeave}
        />
      </main>
    );
  }

  if (lastTurn && view === "answer") {
    return (
      <AnswerView
        key={lastTurn.id}
        turn={lastTurn}
        onSend={(question) => onSend(question, "tapped")}
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
        group={lastTurn.heldTopicGroup}
        askBar={askBar}
        onAskDifferent={onHome}
        onFillAsk={(question) => {
          setDraft(question);
          inputRef.current?.focus();
        }}
        band={{
          onOpenHelp,
          isHelpOpen,
          helpButtonRef: homeHelpButtonRef,
          onExit,
        }}
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
