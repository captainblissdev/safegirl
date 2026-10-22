/**
 * Shared frontend types matching the current backend response shape
 * returned by app/gateway/src/responseOrchestrator.js.
 */

// "signposting": a generic help request answered with help information,
// without classification or retrieval. Displayed like a normal answer.
// "clarification": a vague query (short, no health term) answered with a
// clarifying question, without classification or retrieval. Displayed
// like a normal answer.
// "held": a held topic (one the knowledge base does not cover safely
// yet) answered with a neutral signpost, without classification or
// retrieval. Displayed like a normal answer.
export type QueryOutcome =
  "grounded_answer" | "referral" | "signposting" | "clarification" | "held";

/**
 * What kind of reply the gateway sent (REPLY_KINDS in
 * app/gateway/src/responseOrchestrator.js):
 * - "answer-scoped": a knowledge-base answer within the predicted category.
 * - "answer-unscoped": a knowledge-base answer found less surely (all
 *   categories searched, or keyword fallback).
 * - "abstain": no answer; the standard no-answer message.
 * - "help": a generic help request; the signposting message.
 * - "held-topic": a topic the knowledge base does not cover safely yet; a
 *   neutral signpost (outcome "held"; heldTopicGroup says which group).
 * - "vague": a short query with no health term; a clarifying question.
 * - "referral": the Safety Net flagged the query.
 */
export type ReplyKind =
  | "answer-scoped"
  | "answer-unscoped"
  | "abstain"
  | "help"
  | "held-topic"
  | "vague"
  | "referral";

export interface QueryResponse {
  outcome: QueryOutcome;
  message: string;

  // Set on every gateway response. The offline pipeline sets it on its
  // referral, help and vague replies and leaves it out of its general
  // limited-mode answers, which come from no knowledge-base entry.
  kind?: ReplyKind;
  // The "User question" of the knowledge-base entry the answer came
  // from, verbatim; null when no entry was served.
  matchedQuestion?: string | null;
  // On held-topic replies: the matched group, "A" (after sex or
  // contraception failure), "B" (pregnancy decisions) or "C" (possible
  // pregnancy and testing).
  heldTopicGroup?: "A" | "B" | "C";

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
  // From the response, as sent: the reply kind, the matched knowledge-base
  // question and the entry's source. The answer screen uses them.
  kind?: ReplyKind;
  matchedQuestion?: string | null;
  source?: string | null;
  // The loop limit (loopLimit.ts) was reached on this vague or abstain
  // reply: the Talk to a person screen shows instead of it.
  loopLimited?: boolean;
  // How the question was asked (interface state only, never sent): typed
  // in an ask bar, or tapped on a Topic list or related-question row.
  via?: AnswerVia;
}

/** How a question reached the pipeline: typed, or a tapped question row. */
export type AnswerVia = "typed" | "tapped";

/** A knowledge-base answer: shown on the answer screen. */
export function isAnswerTurn(turn: ChatTurn | undefined): boolean {
  return (
    turn?.role === "assistant" &&
    (turn.kind === "answer-scoped" || turn.kind === "answer-unscoped") &&
    typeof turn.matchedQuestion === "string" &&
    turn.matchedQuestion !== ""
  );
}

// "splash" is the once-per-session privacy and safety disclaimer (FR-05).
// "topic" is the Topic list: the knowledge-base questions of one class.
export type Screen = "splash" | "chat" | "topic" | "referral" | "sessionEnd";
