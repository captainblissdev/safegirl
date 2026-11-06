/**
 * Preloaded by `npm test` (node --require) so a V4_TRIAGE_ENABLED,
 * GATE_G_ENABLED, KB_SET, GENERATION_ENABLED or GEMINI_API_KEY left in the shell cannot change
 * the gateway tests or reach Gemini. Tests that need a flag pin it
 * through the classifier client's config or createGenerator's env
 * instead.
 */

delete process.env.V4_TRIAGE_ENABLED;
delete process.env.GATE_G_ENABLED;
delete process.env.KB_SET;
delete process.env.GENERATION_ENABLED;
delete process.env.GEMINI_API_KEY;
