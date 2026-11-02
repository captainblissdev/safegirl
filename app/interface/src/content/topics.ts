/**
 * The four topics the interface offers, and the classifier class each
 * one maps to. The one place this mapping is written; import it, never
 * copy it. See docs/design/ui-class-mapping.md (added in a later step).
 */

export type TopicClass = "general" | "pregnancy" | "contraception" | "sti";

export interface Topic {
  /** The label shown on buttons and tiles. */
  label: string;
  /** The classifier class (and knowledge-base category) behind it. */
  topicClass: TopicClass;
  /**
   * The Home tile's subtitle: only what the knowledge base covers for
   * this class today, nothing more.
   */
  subtitle: string;
}

export const TOPICS: readonly Topic[] = [
  // KB-G1 to G7: clinic confidentiality, youth services, periods,
  // period pain and hygiene, puberty.
  {
    label: "Periods and health",
    topicClass: "general",
    subtitle: "Puberty, cramps, clinics",
  },
  // KB-P1, P5 to P7: first visit, school, warning signs, iron and food.
  {
    label: "Pregnancy",
    topicClass: "pregnancy",
    subtitle: "Warning signs, food, school",
  },
  // KB-C1 to C5: getting it as a teenager, methods, condoms, fertility.
  {
    label: "Contraception",
    topicClass: "contraception",
    subtitle: "Methods and condoms",
  },
  // KB-S3 to S7: PEP, symptoms, cure, HPV vaccine, PrEP.
  {
    label: "STIs and HIV",
    topicClass: "sti",
    subtitle: "Symptoms, treatment, prevention",
  },
];

/**
 * Presentation only: labelled groups on a Topic list, by entry id. It
 * changes no knowledge-base file, id or question text, and nothing the
 * pipeline sees. Only STIs and HIV is grouped for now; every other topic
 * stays one list until the clinician decides.
 */
export interface TopicGroup {
  label: string;
  /** Entry ids in the group; the list keeps its own order inside it. */
  ids: readonly string[];
}

export const TOPIC_GROUPS: Partial<Record<TopicClass, readonly TopicGroup[]>> =
  {
    sti: [
      // KB-S3 (after possible HIV exposure) and KB-S4 (symptoms).
      { label: "Something worrying me", ids: ["KB-S3", "KB-S4"] },
      // KB-S5 (cure), KB-S6 (HPV vaccine), KB-S7 (PrEP).
      { label: "I want to learn", ids: ["KB-S5", "KB-S6", "KB-S7"] },
    ],
  };

/** One list on a Topic list page: a group's label, or none. */
export interface QuestionGroup<T> {
  label: string | null;
  items: T[];
}

/**
 * A topic's questions, split into its labelled groups (groups in the
 * order above, questions in list order inside each). The groups apply
 * only when they hold exactly the list's questions; otherwise (no groups,
 * or a list that has changed) the list stays one unlabelled group, so a
 * question is never hidden or moved by stale metadata.
 */
export function groupQuestions<T extends { id: string }>(
  topicClass: TopicClass,
  questions: readonly T[],
): QuestionGroup<T>[] {
  const groups = TOPIC_GROUPS[topicClass];
  const whole = [{ label: null, items: [...questions] }];
  if (!groups) return whole;
  const grouped = groups.flatMap((group) => group.ids);
  const ids = questions.map((item) => item.id);
  const exact =
    grouped.length === ids.length &&
    new Set(grouped).size === grouped.length &&
    ids.every((id) => grouped.includes(id));
  if (!exact) return whole;
  return groups.map((group) => ({
    label: group.label,
    items: questions.filter((item) => group.ids.includes(item.id)),
  }));
}
