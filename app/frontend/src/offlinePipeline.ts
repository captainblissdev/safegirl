import type { QueryResponse } from "./types";

// These CommonJS modules are shared with the backend rule-based pipeline.
// @ts-expect-error The backend modules do not have TypeScript declarations yet.
import * as safetyNet from "../../backend/src/safetyNet";
// @ts-expect-error The backend modules do not have TypeScript declarations yet.
import * as classifier from "../../backend/src/classifier";

const { checkSafety } = safetyNet;
const { classify } = classifier;

const OFFLINE_ANSWERS: Record<string, string> = {
  contraception:
    "You can ask a youth-friendly health worker about contraception, including which methods are available and any costs or requirements.",
  sti:
    "A health worker can provide confidential STI information and testing. Seek care promptly if you have symptoms or think you may have been exposed.",
  pregnancy:
    "A health worker can provide confidential pregnancy information and care. You can ask questions about testing and your options.",
  general:
    "Youth-friendly health services should provide respectful, confidential information and care. Ask a health worker what services are available.",
};

export function handleQueryOffline(queryText: string): QueryResponse {
  const safety = checkSafety(queryText);
  const classification = classify(queryText);

  if (safety.flagged) {
    return {
      outcome: "referral",
      message:
        "We hear you. Please reach out to a trusted adult, health worker, or local support service as soon as you can.",
      generationInvoked: false,
    };
  }

  return {
    outcome: "grounded_answer",
    message: OFFLINE_ANSWERS[classification.label] || OFFLINE_ANSWERS.general,
    category: classification.label,
    generated: false,
    generationInvoked: false,
    note: "Offline mode: answer provided from locally bundled guidance.",
  };
}
