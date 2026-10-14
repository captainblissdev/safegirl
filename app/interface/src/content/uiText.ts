/**
 * Interface text that tests check or that more than one component uses.
 */

/** Shown above an answer that came from the offline pipeline. */
export const LIMITED_MODE_NOTICE =
  "Limited mode: I can't reach the full service right now, so this answer is general.";

/** A topic chip and the example question it puts in the input box. */
export interface TopicExample {
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
    label: "Contraception",
    question: "Which birth control methods can a teenager use?",
    evalId: "Q01",
  },
  { label: "STI", question: "can chlamydia be cured", evalId: "Q05" },
  {
    label: "Pregnancy",
    question: "what are the danger signs in pregnancy",
    evalId: "Q09",
  },
  {
    label: "General",
    question: "is it normal for my period to be irregular",
    evalId: "Q11",
  },
];
