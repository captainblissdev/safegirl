import type { QueryResponse } from "../types";
import { classify } from "./classifier";
import { checkSafety } from "./safetyNet";
import {
  HELD_TOPIC_MESSAGES,
  referralMessage,
  SIGNPOSTING_MESSAGE,
  VAGUE_QUERY_MESSAGE,
} from "./helpContent";
import {
  isGenericHelpRequest,
  isVagueQuery,
  matchHeldTopic,
} from "./queryRules";

const OFFLINE_ANSWERS: Record<string, string> = {
  contraception:
    "You can ask a youth-friendly health worker about contraception, including which methods are available and any costs or requirements.",
  sti: "A health worker can provide confidential STI information and testing. Seek care promptly if you have symptoms or think you may have been exposed.",
  pregnancy:
    "A health worker can provide confidential pregnancy information and care. You can ask questions about testing and your options.",
  general:
    "Youth-friendly health services should provide respectful, confidential information and care. Ask a health worker what services are available.",
};

/**
 * The offline pipeline, in the gateway's order: Safety Net, help rule,
 * held-topic rule, vague-query rule, then the keyword classifier and a
 * general answer for its category. The rules are ports of the gateway's
 * (offline/queryRules.ts), so "Help", held topics and vague queries get
 * the same reply offline as online.
 */
export function handleQueryOffline(queryText: string): QueryResponse {
  const safety = checkSafety(queryText);

  // A flagged query gets the referral without being classified, as in
  // the gateway: the Safety Net never reads the classifier's result.
  if (safety.flagged) {
    return {
      outcome: "referral",
      kind: "referral",
      matchedQuestion: null,
      message: referralMessage(safety.category),
      generationInvoked: false,
    };
  }

  // A generic help request gets the help information.
  if (isGenericHelpRequest(queryText)) {
    return {
      outcome: "signposting",
      kind: "help",
      matchedQuestion: null,
      message: SIGNPOSTING_MESSAGE,
      category: null,
      answerFound: false,
      generated: false,
      generationInvoked: false,
      note: "Offline mode: generic help request, help information returned.",
    };
  }

  // A held topic gets its group's neutral signpost.
  const heldGroup = matchHeldTopic(queryText);
  if (heldGroup) {
    return {
      outcome: "held",
      kind: "held-topic",
      heldTopicGroup: heldGroup,
      matchedQuestion: null,
      message: HELD_TOPIC_MESSAGES[heldGroup],
      category: null,
      answerFound: false,
      generated: false,
      generationInvoked: false,
      note: "Offline mode: held topic, signpost returned.",
    };
  }

  // A short query naming no health topic gets a clarifying question.
  if (isVagueQuery(queryText)) {
    return {
      outcome: "clarification",
      kind: "vague",
      matchedQuestion: null,
      message: VAGUE_QUERY_MESSAGE,
      category: null,
      answerFound: false,
      generated: false,
      generationInvoked: false,
      note: "Offline mode: vague query, clarifying question returned.",
    };
  }

  const classification = classify(queryText);

  return {
    outcome: "grounded_answer",
    message: OFFLINE_ANSWERS[classification.label] || OFFLINE_ANSWERS.general,
    category: classification.label,
    generated: false,
    generationInvoked: false,
    note: "Offline mode: answer provided from locally bundled guidance.",
  };
}
