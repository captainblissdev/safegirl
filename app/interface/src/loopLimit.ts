import type { ReplyKind } from "./types";

/**
 * The loop limit: a girl who keeps getting "Tell me a bit more" (vague)
 * or "No answer yet" (abstain) is pointed to a person instead of going
 * round in circles.
 *
 * App keeps one count, in memory only (never in localStorage or
 * sessionStorage), of consecutive vague or abstain replies. Any other
 * reply kind resets it, and so do opening a Topic list, "Ask a different
 * question" (Home), a new session and quick exit. On the LOOP_LIMIT-th
 * vague or abstain reply in a row, and on each one after it until the
 * count resets, the Talk to a person screen shows instead of the reply.
 *
 * Only vague and abstain replies are counted or replaced: Safety Net,
 * help, held-topic and referral replies are never replaced or delayed.
 */
export const LOOP_LIMIT = 3;

/** The count after a reply of this kind arrives. */
export function nextLoopCount(
  count: number,
  kind: ReplyKind | undefined,
): number {
  return kind === "vague" || kind === "abstain" ? count + 1 : 0;
}

/** True when a reply at this count shows the Talk to a person screen. */
export function reachesLoopLimit(count: number): boolean {
  return count >= LOOP_LIMIT;
}
