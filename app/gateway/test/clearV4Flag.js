/**
 * Preloaded by `npm test` (node --require) so a V4_TRIAGE_ENABLED left in
 * the shell cannot change the gateway tests. Tests that need the flag pin
 * it through the classifier client's config instead.
 */

delete process.env.V4_TRIAGE_ENABLED;
