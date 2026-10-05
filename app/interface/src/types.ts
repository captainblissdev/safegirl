/**
 * Shared frontend types matching the current backend response shape
 * returned by app/gateway/src/responseOrchestrator.js.
 */

export type QueryOutcome = "grounded_answer" | "referral";

export interface QueryResponse {
  outcome: QueryOutcome;
  message: string;

  // Present on grounded_answer responses.
  // Category of the knowledge-base entry actually served; null when no
  // entry was found. May differ from predictedCategory.
  category?: string | null;
  // False when no knowledge-base answer was available and the message is
  // the standard no-answer fallback.
  answerFound?: boolean;
  generated?: boolean;
  note?: string;
  source?: string;
  safetyNotes?: string;

  // Present on all gateway responses: which classifier ran and what it
  // predicted. confidence is null for the keyword fallback.
  predictedCategory?: string | null;
  classifierSource?: "distilbert" | "keyword_fallback" | null;
  confidence?: number | null;

  generationInvoked: boolean;
}

/**
 * A single exchange in the current session's in-memory chat log.
 *
 * Conversation content is not persisted to browser storage or
 * Firestore. The state is cleared when the page is refreshed or
 * when the user starts a new session.
 */
export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  outcome?: QueryOutcome;
}

export type Screen = "disclaimer" | "chat" | "referral" | "sessionEnd";
