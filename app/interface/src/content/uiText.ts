/**
 * Interface text that tests check or that more than one component uses.
 */

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
  ],
  pregnancy: [
    { question: "what are the danger signs in pregnancy", evalId: "Q09" },
    { question: "can I go back to school after having a baby", evalId: "Q08" },
    { question: "should I take iron tablets when pregnant", evalId: "Q10" },
  ],
  general: [
    { question: "how do I deal with period cramps", evalId: "Q12" },
    { question: "when do girls get their first period", evalId: "Q14" },
    { question: "is the clinic confidential", evalId: "Q16" },
  ],
};

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
