/**
 * Shared frontend types matching the current backend response shape
 * returned by app/backend/src/responseOrchestrator.js.
 */

export type QueryOutcome = "grounded_answer" | "referral";

export interface QueryResponse {
  outcome: QueryOutcome;
  message: string;

  // Present on grounded_answer responses.
  category?: string;
  generated?: boolean;
  note?: string;
  source?: string;
  safetyNotes?: string;

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

export type Screen =
  | "disclaimer"
  | "chat"
  | "referral"
  | "sessionEnd";