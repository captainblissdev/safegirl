import kbData from "../../src/offline/Kbdata.json";
import { checkSafety } from "../../../frontend/src/offline/safetyNet";
import { classify } from "../../../frontend/src/offline/classifier";

interface QueryResponse {
  outcome: "grounded_answer" | "referral";
  message: string;
  category?: string;
  generated?: boolean;
  note?: string;
  source?: string;
  safetyNotes?: string;
  generationInvoked: boolean;
}

/**
 * Fully offline version of the backend pipeline
 * (backend.js + retrievalModule.js + generationModule.js +
 * responseOrchestrator.js) combined into a browser-side fallback.
 *
 * The pipeline runs without a network connection by using:
 * 1. The local SafetyNet for safety detection.
 * 2. The client-side keyword classifier.
 * 3. The bundled knowledge base for retrieval.
 * 4. The retrieved knowledge-base answer as the response.
 *
 * This is a constrained offline mode. It does not perform live
 * generative-model calls. If real Gemini generation is introduced
 * later, generation will require network connectivity.
 *
 * NFR-vii: The application should provide useful SRH information
 * during loss of connectivity while clearly distinguishing offline
 * responses from live-generated responses.
 */

interface KbEntry {
  kbId: string;
  intent: string | null;
  question: string | null;
  answer: string | null;
  source: string | null;
  safetyNotes: string | null;
}

type KbCategory = keyof typeof kbData;

/**
 * Tokenize text for the interim keyword-overlap retrieval method.
 *
 * The implementation intentionally remains simple and deterministic
 * so that offline retrieval behaves consistently with the current
 * prototype architecture.
 */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

/**
 * Retrieve the knowledge-base entry with the greatest token overlap
 * with the user's query.
 *
 * This is the same interim retrieval concept currently used by the
 * backend. It is not semantic/vector retrieval.
 */
function retrieveOffline(
  category: string,
  queryText: string
): KbEntry | null {
  if (!(category in kbData)) {
    return null;
  }

  const entries = kbData[category as KbCategory] || [];

  if (entries.length === 0) {
    return null;
  }

  const queryTokens = tokenize(queryText);

  let best: KbEntry | null = null;
  let bestScore = -1;

  for (const entry of entries) {
    const entryText = `${entry.question || ""} ${entry.answer || ""}`;
    const entryTokens = new Set(tokenize(entryText));

    const score = queryTokens.filter((token) =>
      entryTokens.has(token)
    ).length;

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best;
}

/**
 * Execute the complete SafeGirl pipeline locally.
 *
 * Safety detection is performed before retrieval. Flagged queries
 * never receive a knowledge-base answer through the normal offline
 * path.
 */
export function handleQueryOffline(queryText: string): QueryResponse {
  const safety = checkSafety(queryText);
  const classification = classify(queryText);

  if (safety.flagged) {
    return {
      outcome: "referral",
      message:
        "We hear you. We want to help. Please reach out to a trusted " +
        "adult, health worker, or local support service as soon as you " +
        "can. [Referral/escalation content pending authoritative sourcing " +
        "— R1/R2/R8, not yet finalized.]",
      generationInvoked: false,
    };
  }

  const retrieved = retrieveOffline(
    classification.label,
    queryText
  );

  if (!retrieved) {
    return {
      outcome: "grounded_answer",
      message:
        "I don't have offline information for that yet. Please try " +
        "again when you have a connection.",
      category: classification.label,
      generated: false,
      generationInvoked: false,
      note: "Offline mode: no matching local knowledge-base entry was available.",
    };
  }

  return {
    outcome: "grounded_answer",
    message: retrieved.answer || "",
    category: classification.label,
    generated: false,
    generationInvoked: false,
    note:
      "Offline mode: answer provided from the locally stored " +
      "knowledge base, not live-generated.",
    source: retrieved.source || undefined,
    safetyNotes: retrieved.safetyNotes || undefined,
  };
}