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
    subtitle: "Periods, puberty, clinics",
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
    subtitle: "Methods, condoms, fertility",
  },
  // KB-S3 to S7: PEP, symptoms, cure, HPV vaccine, PrEP.
  {
    label: "STIs and HIV",
    topicClass: "sti",
    subtitle: "Symptoms, treatment, PEP, PrEP",
  },
];
