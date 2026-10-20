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
}

export const TOPICS: readonly Topic[] = [
  { label: "Periods and health", topicClass: "general" },
  { label: "Pregnancy", topicClass: "pregnancy" },
  { label: "Contraception", topicClass: "contraception" },
  { label: "STIs and HIV", topicClass: "sti" },
];
