/**
 * Client-side safety check used by the offline pipeline.
 *
 * This mirrors app/gateway/src/safetyNet.js so that queries flagged
 * offline follow the same safety path as queries processed online.
 *
 * The keyword list is intentionally duplicated for now. It must be
 * kept synchronized with the backend until the safety logic is moved
 * into a shared package.
 */

export const DISTRESS_KEYWORDS = [
  "rape",
  "raped",
  "forced",
  "forced sex",
  "forced sexual activity",
  "forced sexual intercourse",
  "i was forced",
  "forced me",
  "made me have sex",
  "made me do it",
  "didn't stop",
  "did not stop",
  "said no",
  "i said no",
  "didn't consent",
  "did not consent",
  "without my consent",
  "no consent",
  "assault",
  "sexual assault",
  "sexually assaulted",
  "sexual violence",
  "sexual abuse",
  "sexually abused",
  "unwanted sexual contact",
  "unwanted touching",
  "touched me",
  "someone touched me",
  "afraid to say no",
  "threatened",
  "threatened me",
  "coerced",
  "coerced into sex",
  "coercion",
  "against my will",
  "fgm",
  "circumcision",
  "abuse",
  "defilement",
];

export interface SafetyResult {
  flagged: boolean;
  matchedKeywords: string[];
}

/**
 * Checks whether a query contains language associated with
 * sexual violence, coercion, abuse, or distress.
 *
 * Word boundaries are used to reduce accidental partial matches.
 */
export function checkSafety(text: string): SafetyResult {
  const normalized = text.toLowerCase();

  const matchedKeywords = DISTRESS_KEYWORDS.filter((keyword) => {
    const escapedKeyword = keyword.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    return new RegExp(`\\b${escapedKeyword}\\b`).test(normalized);
  });

  return {
    flagged: matchedKeywords.length > 0,
    matchedKeywords,
  };
}