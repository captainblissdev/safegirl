import { useEffect, useRef, useState } from "react";
import type { ChatTurn, Screen } from "./types";
import { QueryCancelledError, submitQuery } from "./api/client";
import { answerDetails, isDetailsEnabled } from "./details";
import AppShell from "./components/AppShell";
import Splash from "./components/Splash";
import ChatInterface from "./components/ChatInterface";
import ChatSidebar from "./components/ChatSidebar";
import ReferralScreen from "./components/ReferralScreen";
import SessionEnd from "./components/SessionEnd";
import SupportContent from "./components/SupportContent";
import { createDoubleEscapeHandler, quickExit } from "./quickExit";
import {
  browserSessionStorage,
  continueFromSplash,
  startScreen,
} from "./splashSession";
import "./App.css";

/**
 * Root component.
 *
 * Session state is maintained in memory only. Conversation content is
 * deliberately not written to browser storage.
 *
 * The application uses the normal backend pipeline when online and
 * falls back to the local offline pipeline when the device has no
 * network connection.
 */
// The demo details view: off unless ?details=1 or VITE_SHOW_DETAILS=true.
const SHOW_DETAILS = isDetailsEnabled(
  window.location.search,
  import.meta.env.VITE_SHOW_DETAILS,
);

export default function App() {
  // The splash (the once-per-session disclaimer) unless already seen.
  const [screen, setScreen] = useState<Screen>(() =>
    startScreen(browserSessionStorage),
  );
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [referralMessage, setReferralMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  // The query in flight, so leaving the chat can cancel it.
  const pendingRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const handleSend = async (text: string) => {
    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    setTurns((prev) => [...prev, userTurn]);
    setIsLoading(true);
    setError(null);

    const request = new AbortController();
    pendingRef.current = request;

    try {
      const response = await submitQuery(text, { signal: request.signal });

      if (response.outcome === "referral") {
        setReferralMessage(response.message);
        setScreen("referral");
      } else {
        const botTurn: ChatTurn = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: response.message,
          outcome: response.outcome,
          limitedMode: response.limitedMode === true,
          answerFound: response.answerFound,
          details: answerDetails(response),
        };

        setTurns((prev) => [...prev, botTurn]);
      }
    } catch (err) {
      // A cancelled query was superseded by "New chat" or the end of the
      // session: show nothing for it.
      if (err instanceof QueryCancelledError) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (pendingRef.current === request) {
        pendingRef.current = null;
        setIsLoading(false);
      }
    }
  };

  /** Cancel the query in flight, if any; its answer is never shown. */
  const cancelPending = () => {
    pendingRef.current?.abort();
    pendingRef.current = null;
    setIsLoading(false);
  };

  const handleNewChat = () => {
    cancelPending();
    setTurns([]);
    setError(null);
  };

  const handleEndSession = () => {
    cancelPending();
    setScreen("sessionEnd");
  };

  const handleStartNew = () => {
    cancelPending();
    setTurns([]);
    setReferralMessage("");
    setError(null);
    setScreen("splash");
  };

  const openHelp = () => setIsHelpOpen(true);

  /** Close the Help sheet and return focus to the Help button. */
  const closeHelp = () => {
    setIsHelpOpen(false);
    helpButtonRef.current?.focus();
  };

  /**
   * A topic button in the Help sheet. Until the Topic list exists
   * (redesign Step 5) it closes the sheet and focuses the ask bar. On the
   * splash there is no ask bar yet: the sheet just closes, so the splash
   * still has to be accepted first.
   */
  const handleHelpTopic = () => {
    setIsHelpOpen(false);
    const askBar = document.getElementById("chat-input");
    if (askBar) {
      askBar.focus();
    } else {
      helpButtonRef.current?.focus();
    }
  };

  /** Quick exit: clear everything, then leave (see quickExit.ts). */
  const handleExit = () =>
    quickExit({
      clearState: () => {
        cancelPending();
        setTurns([]);
        setReferralMessage("");
        setError(null);
        setIsHelpOpen(false);
        setScreen("splash");
      },
      getSessionStorage: () => window.sessionStorage,
      replace: (url) => window.location.replace(url),
    });

  // Escape pressed twice within a second also exits, on every screen. An
  // Escape that closes the Help sheet does not count (it is seen while the
  // sheet is still open).
  const exitRef = useRef(handleExit);
  const helpOpenRef = useRef(isHelpOpen);
  useEffect(() => {
    exitRef.current = handleExit;
    helpOpenRef.current = isHelpOpen;
  });
  useEffect(() => {
    const onEscape = createDoubleEscapeHandler(
      () => exitRef.current(),
      () => Date.now(),
      () => helpOpenRef.current,
    );
    const onKeyDown = (event: KeyboardEvent) => {
      onEscape(event.key);
    };
    // Capture phase: this runs before React's own handlers, so an Escape
    // that closes the Help sheet is seen while the sheet is still open.
    // (React re-renders at once after a key press, so a bubbling listener
    // would already see it closed and count the press.)
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // The splash is a full-bleed screen of its own: no app header and no
  // Help button, but its own Exit pill and the footer line. Double Escape
  // works here too (the keydown listener above is on every screen).
  if (screen === "splash") {
    return (
      <Splash
        onContinue={() => setScreen(continueFromSplash(browserSessionStorage))}
        onExit={handleExit}
      />
    );
  }

  return (
    // The playful background is left off the referral screen, which stays
    // calm. The chat screen puts the footer line above its ask bar.
    <AppShell
      onExit={handleExit}
      help={{
        isOpen: isHelpOpen,
        onOpen: openHelp,
        onClose: closeHelp,
        onTopic: handleHelpTopic,
        buttonRef: helpButtonRef,
      }}
      calm={screen === "referral"}
      footerInContent={screen === "chat"}
    >
      {isOffline && (
        <div className="offline-banner" role="status">
          You&apos;re offline — answers come from information stored on this
          device and may be more limited.
        </div>
      )}

      {screen === "chat" && (
        <div className="chat-layout">
          <ChatSidebar onNewChat={handleNewChat} />

          <div className="chat-column">
            <ChatInterface
              turns={turns}
              onSend={(text) => void handleSend(text)}
              isLoading={isLoading}
              showDetails={SHOW_DETAILS}
            />

            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}

            <button
              className="link-button"
              type="button"
              onClick={handleEndSession}
            >
              End session
            </button>
          </div>

          {/* Wide screens only (CSS): always-visible help options. */}
          <aside
            className="support-aside"
            aria-labelledby="support-aside-title"
          >
            <h2 id="support-aside-title">Need more support?</h2>
            <SupportContent />
          </aside>
        </div>
      )}

      {screen === "referral" && (
        <ReferralScreen
          message={referralMessage}
          onContinueChat={() => setScreen("chat")}
        />
      )}

      {screen === "sessionEnd" && <SessionEnd onStartNew={handleStartNew} />}
    </AppShell>
  );
}
