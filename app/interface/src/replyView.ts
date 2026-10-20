import { REPLY_PILLS } from "./content/uiText";
import { isAnswerTurn, type ChatTurn } from "./types";

/**
 * Which screen shows a reply, from the reply kind the gateway (or the
 * offline pipeline) sent. A reply with no kind (a limited-mode answer
 * from the offline pipeline) keeps the plain reply view.
 */
export type ReplyView =
  "answer" | "clarify" | "held" | "help" | "noAnswer" | "plain";

export function replyViewOf(turn: ChatTurn | undefined): ReplyView | null {
  if (turn?.role !== "assistant") return null;
  if (isAnswerTurn(turn)) return "answer";
  switch (turn.kind) {
    case "vague":
      return "clarify";
    case "held-topic":
      return "held";
    case "help":
      return "help";
    case "abstain":
      return "noAnswer";
    default:
      return "plain";
  }
}

/**
 * What the polite live region says once when a reply arrives. Focus then
 * moves to the reply's h1, which reads the reply itself, so the region
 * only names the kind of reply: nothing is read twice.
 */
export function announcementFor(view: ReplyView | "referral" | null): string {
  switch (view) {
    case "answer":
      return "New answer.";
    case "clarify":
      return `New reply: ${REPLY_PILLS.clarify}.`;
    case "held":
      return `New reply: ${REPLY_PILLS.held}.`;
    case "help":
      return `New reply: ${REPLY_PILLS.help}.`;
    case "referral":
      return `New reply: ${REPLY_PILLS.referral}.`;
    case "noAnswer":
      return `New reply: ${REPLY_PILLS.noAnswer}.`;
    case "plain":
      return "New reply.";
    default:
      return "";
  }
}
