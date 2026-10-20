/**
 * Interface text that tests check or that more than one component uses.
 */

import type { ChatTurn } from "../types";

/**
 * Where the answers come from: the one place this line is written. Used
 * on the splash, in the Help sheet and on Home. "Most", because four of
 * the 21 knowledge-base entries cite other sources (KB-P5, KB-G6, KB-G3,
 * KB-G4; docs/decision-log.md, "Splash and Help sheet").
 */
export const SOURCES_LINE =
  "Most answers come from Kenyan Ministry of Health and WHO guidance.";

/**
 * Home's ask pill placeholder: examples shown one at a time, the first
 * one always, the rest in turn every PLACEHOLDER_ROTATE_MS unless the
 * device asks for reduced motion. Each is the exact text of a
 * knowledge-base question that the system answers with its own entry
 * (checked against the knowledge base and keyword retrieval by
 * app/gateway/test/homeExamples.test.js, and live on 20 October 2026).
 * None comes from the DR-04 or demo-risk sets. KB-P1 is left out: the
 * live pipeline answers it with another entry.
 */
export const PLACEHOLDER_EXAMPLES: readonly string[] = [
  "Can STIs be cured, and can they harm me if I leave them?",
  "What can I do about period pain?",
  "Which birth control methods can a teenager use?",
  "Can I take PrEP to prevent HIV? I'm a teenager.",
  "How do I manage my period hygienically?",
  "What warning signs in pregnancy mean I should go to hospital right away?",
];

export const PLACEHOLDER_ROTATE_MS = 6000;

/** Shown above an answer that came from the offline pipeline. */
export const LIMITED_MODE_NOTICE =
  "Limited mode: I can't reach the full service right now, so this answer is general.";

/** A topic chip and the example question it puts in the input box. */
export interface TopicExample {
  /** Picks the chip's icon and colour. */
  topic: "contraception" | "sti" | "pregnancy" | "periods";
  label: string;
  question: string;
  /** The query's id in resources/eval/retrieval_eval_set.csv. */
  evalId: string;
}

/**
 * One example per topic, copied verbatim from the "clear" group of the
 * retrieval development set, where each one gets a correct answer.
 * Tapping a chip only fills the input box: nothing is sent, and the
 * category is still decided by the backend.
 */
export const TOPIC_EXAMPLES: readonly TopicExample[] = [
  {
    topic: "contraception",
    label: "Contraception",
    question: "Which birth control methods can a teenager use?",
    evalId: "Q01",
  },
  {
    topic: "sti",
    label: "STI",
    question: "can chlamydia be cured",
    evalId: "Q05",
  },
  {
    topic: "pregnancy",
    label: "Pregnancy",
    question: "what are the danger signs in pregnancy",
    evalId: "Q09",
  },
  {
    // Was "General": the question is about periods, which the greeting's
    // scope line names (see docs/decision-log.md, 2026-10-14).
    topic: "periods",
    label: "Periods",
    question: "is it normal for my period to be irregular",
    evalId: "Q11",
  },
];

/** A follow-up question suggested after an answer. */
export interface Suggestion {
  question: string;
  /** The query's id in resources/eval/retrieval_eval_set.csv. */
  evalId: string;
}

/**
 * "You could also ask…" follow-ups, by the answer's category. Each is a
 * verbatim "clear" query from the retrieval development set on the same
 * topic, where each one gets a correct answer. Like the topic chips, a
 * suggestion only fills the input box.
 */
export const SUGGESTIONS: Readonly<Record<string, readonly Suggestion[]>> = {
  contraception: [
    {
      question: "Which birth control methods can a teenager use?",
      evalId: "Q01",
    },
    { question: "Do I need a condom if I am on the pill?", evalId: "Q02" },
    {
      question: "will the injection make me unable to have kids",
      evalId: "Q03",
    },
  ],
  sti: [
    { question: "what is PrEP", evalId: "Q07" },
    { question: "can chlamydia be cured", evalId: "Q05" },
    { question: "is the HPV vaccine free for girls my age", evalId: "Q06" },
  ],
  pregnancy: [
    { question: "what are the danger signs in pregnancy", evalId: "Q09" },
    { question: "can I go back to school after having a baby", evalId: "Q08" },
    { question: "should I take iron tablets when pregnant", evalId: "Q10" },
  ],
  general: [
    { question: "how do I deal with period cramps", evalId: "Q12" },
    // Q15 replaced Q14 ("when do girls get their first period"), which V3
    // misclassifies at 0.368, only 0.018 above the 0.35 no-answer cut-off.
    // Q15 is classified correctly at 0.531 (0.181 above 0.35) and gets KB-G7
    // both scoped and unscoped, so the 0.5 threshold cannot change its answer.
    {
      question: "what services can I get at a youth friendly clinic",
      evalId: "Q15",
    },
    { question: "is the clinic confidential", evalId: "Q16" },
  ],
};

/**
 * Whether "You could also ask" may follow this turn: only a real answer
 * from the full service. Never after a referral or an error (neither adds
 * an answer turn, so the last turn is the user's question), a limited-mode
 * answer, a no-answer reply, signposting, or an answer of unknown topic.
 */
export function offersFollowUps(turn: ChatTurn | undefined): boolean {
  return (
    turn?.role === "assistant" &&
    turn.outcome === "grounded_answer" &&
    turn.answerFound !== false &&
    turn.limitedMode !== true &&
    typeof turn.details?.category === "string" &&
    turn.details.category !== ""
  );
}

/**
 * Up to two follow-ups for an answer's category, leaving out the question
 * that was just asked. None when the category is unknown.
 */
export function suggestionsFor(
  category: string | null | undefined,
  asked: string,
): Suggestion[] {
  const askedKey = asked.trim().toLowerCase();
  return (SUGGESTIONS[category ?? ""] ?? [])
    .filter((s) => s.question.toLowerCase() !== askedKey)
    .slice(0, 2);
}
