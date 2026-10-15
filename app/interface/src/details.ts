import type { QueryResponse } from "./types";

/**
 * The demo details view: a small line under each answer showing how it was
 * produced. Off by default; turned on with ?details=1 in the URL or
 * VITE_SHOW_DETAILS=true at build time. Never shown on the referral screen.
 */

export interface AnswerDetails {
  category?: string | null;
  predictedCategory?: string | null;
  confidence?: number | null;
  classifierSource?: string | null;
  retrievalScope?: string | null;
  source?: string | null;
}

/** True when ?details=1 is in the URL or VITE_SHOW_DETAILS is "true". */
export function isDetailsEnabled(
  search: string,
  envFlag: string | undefined,
): boolean {
  return (
    envFlag === "true" || new URLSearchParams(search).get("details") === "1"
  );
}

/** The fields of a response that the details line shows. */
export function answerDetails(response: QueryResponse): AnswerDetails {
  return {
    category: response.category,
    predictedCategory: response.predictedCategory,
    confidence: response.confidence,
    classifierSource: response.classifierSource,
    retrievalScope: response.retrievalScope,
    source: response.source,
  };
}

/** One line, with "none" for anything the response did not include. */
export function formatDetails(details: AnswerDetails): string {
  const show = (value: string | null | undefined) =>
    value === null || value === undefined || value === "" ? "none" : value;

  return [
    `category: ${show(details.category)}`,
    `predicted: ${show(details.predictedCategory)}`,
    `confidence: ${typeof details.confidence === "number" ? details.confidence.toFixed(2) : "none"}`,
    `classifier: ${show(details.classifierSource)}`,
    `retrieval: ${show(details.retrievalScope)}`,
    `source: ${show(details.source)}`,
  ].join(" · ");
}
