import { useEffect, useRef, useState } from "react";
import type { ChatTurn, Screen } from "./types";
import { QueryCancelledError, submitQuery } from "./api/client";
import { answerDetails, isDetailsEnabled } from "./details";
import AppHeader from "./components/AppHeader";
import Disclaimer from "./components/Disclaimer";
import ChatInterface from "./components/ChatInterface";
import ChatSidebar from "./components/ChatSidebar";
import ReferralScreen from "./components/ReferralScreen";
import SessionEnd from "./components/SessionEnd";
import SupportContent from "./components/SupportContent";
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
  const [screen, setScreen] = useState<Screen>("disclaimer");
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
    setScreen("disclaimer");
  };

  return (
    // The playful background is left off the referral screen, which stays
    // calm; the help dialog has its own plain panel.
    <div
      className={
        screen === "referral" ? "app-shell" : "app-shell app-shell--playful"
      }
    >
      <AppHeader />

      {isOffline && (
        <div className="offline-banner" role="status">
          You&apos;re offline — answers come from information stored on this
          device and may be more limited.
        </div>
      )}

      {screen === "disclaimer" && (
        <Disclaimer onContinue={() => setScreen("chat")} />
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
    </div>
  );
}
