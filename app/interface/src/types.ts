/**
 * Shared frontend types matching the current backend response shape
 * returned by app/gateway/src/responseOrchestrator.js.
 */

// "signposting": a generic help request answered with help information,
// without classification or retrieval. Displayed like a normal answer.
export type QueryOutcome = "grounded_answer" | "referral" | "signposting";

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
  // How the answer was retrieved; "none" for signposting and null on
  // referrals (no retrieval in either case).
  retrievalScope?:
    "scoped" | "unscoped" | "abstained" | "local" | "none" | null;

  generationInvoked: boolean;

  // Set by the client, never by the gateway: true when the online request
  // failed and the answer came from the offline pipeline.
  limitedMode?: boolean;
}

/**
 * A single exchange in the current session's in-memory chat log.
 *
 * Conversation content is not persisted to browser storage or
 * Firestore. The state is cleared when the page is refreshed or
 * when the user starts a new session.
 */
import type { AnswerDetails } from "./details";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  outcome?: QueryOutcome;
  // The answer came from the offline pipeline because the online request
  // failed; the chat shows the limited-mode notice above it.
  limitedMode?: boolean;
  // False when the gateway found no knowledge-base answer and sent its
  // standard no-answer message.
  answerFound?: boolean;
  // How the answer was produced, for the demo details view.
  details?: AnswerDetails;
}

export type Screen = "disclaimer" | "chat" | "referral" | "sessionEnd";
