import { useState, useEffect } from "react";
import type { ChatTurn, Screen } from "./types";
import { submitQuery } from "./api/client";
import Disclaimer from "./components/Disclaimer";
import ChatInterface from "./components/ChatInterface";
import ReferralScreen from "./components/ReferralScreen";
import SessionEnd from "./components/SessionEnd";
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
export default function App() {
  const [screen, setScreen] = useState<Screen>("disclaimer");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [referralMessage, setReferralMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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

    try {
      const response = await submitQuery(text);

      if (response.outcome === "referral") {
        setReferralMessage(response.message);
        setScreen("referral");
      } else {
        const botTurn: ChatTurn = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: response.message,
          outcome: response.outcome,
        };

        setTurns((prev) => [...prev, botTurn]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNew = () => {
    setTurns([]);
    setReferralMessage("");
    setError(null);
    setScreen("disclaimer");
  };

  return (
    <div className="app-shell">
      {isOffline && (
        <div className="offline-banner" role="status">
          You&apos;re offline — answers come from information stored on
          this device and may be more limited.
        </div>
      )}

      {screen === "disclaimer" && (
        <Disclaimer onContinue={() => setScreen("chat")} />
      )}

      {screen === "chat" && (
        <>
          <ChatInterface
            turns={turns}
            onSend={handleSend}
            isLoading={isLoading}
          />

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          <button
            className="link-button"
            type="button"
            onClick={() => setScreen("sessionEnd")}
          >
            End session
          </button>
        </>
      )}

      {screen === "referral" && (
        <ReferralScreen
          message={referralMessage}
          onContinueChat={() => setScreen("chat")}
        />
      )}

      {screen === "sessionEnd" && (
        <SessionEnd onStartNew={handleStartNew} />
      )}
    </div>
  );
}