import data from "./kbQuestions.json";
import type { TopicClass } from "./topics";

/**
 * The knowledge-base questions, by class, for the Topic list. Generated
 * from the knowledge base (app/gateway/scripts/build-kb-questions.js);
 * no answers. A question is always submitted through the full pipeline.
 */

export interface KbQuestion {
  id: string;
  topicClass: TopicClass;
  question: string;
}

export const KB_QUESTIONS = data.questions as readonly KbQuestion[];

/** The questions of one class, in knowledge-base order. */
export function questionsFor(topicClass: TopicClass): KbQuestion[] {
  return KB_QUESTIONS.filter((item) => item.topicClass === topicClass);
}
