/**
 * Follow-up context: development-set check (needs ml_service on :8001 with
 * V4 and the 62-entry base, as scripts/demo.ps1 -Part ml -Kb 62 starts it).
 *
 * Runs every item of test/fixtures/followUps.json through the real
 * pipeline twice, without and with the previous answer's question, with
 * V4 triage, gate (g) and KB-62 on and generation off. Prints counts and
 * one line per item (ids, entry ids, reply kinds and the resolved
 * question). The set is synthetic and non-blind: the rule was chosen on
 * it, so these counts are development evidence, not a test result.
 *
 * Run: node scripts/follow-up-eval.js
 */

process.env.V4_TRIAGE_ENABLED = "true";
process.env.GATE_G_ENABLED = "true";
process.env.KB_SET = "kb62";
delete process.env.GENERATION_ENABLED;
delete process.env.GEMINI_API_KEY;

const { createHandleQuery } = require("../src/backend");
const { createClassifierClient } = require("../src/classifierClient");
const { gateGFromEnv } = require("../src/gateG");
const { loadKnowledgeBase } = require("../src/retrievalModule");
const set = require("../test/fixtures/followUps.json");

const entries = Object.values(loadKnowledgeBase()).flat();
const questionOf = Object.fromEntries(entries.map((e) => [e.kbId, e.question]));
const idOf = Object.fromEntries(entries.map((e) => [e.question, e.kbId]));
const outcome = (r) =>
  r.kind && r.kind.startsWith("answer") ? idOf[r.matchedQuestion] : r.kind;

async function main() {
  const handleQuery = createHandleQuery({
    classifierClient: createClassifierClient(),
    gateG: gateGFromEnv(),
    followUp: true,
  });
  const tally = {
    followUps: { n: 0, without: 0, with: 0, wrongWithout: 0, wrongWith: 0 },
    negatives: { n: 0, without: 0, with: 0, answeredWith: 0 },
  };
  for (const item of set.items) {
    const without = outcome(await handleQuery(item.text));
    const response = await handleQuery(item.text, {
      previousQuestion: questionOf[item.prev],
    });
    const withContext = outcome(response);
    const isNegative = item.id.startsWith("NEG");
    const t = isNegative ? tally.negatives : tally.followUps;
    t.n += 1;
    t.without += item.expect.includes(without) ? 1 : 0;
    t.with += item.expect.includes(withContext) ? 1 : 0;
    const isEntry = (o) => typeof o === "string" && o.startsWith("KB-");
    if (!isNegative) {
      t.wrongWithout +=
        isEntry(without) && !item.expect.includes(without) ? 1 : 0;
      t.wrongWith +=
        isEntry(withContext) && !item.expect.includes(withContext) ? 1 : 0;
    } else if (isEntry(withContext) && !item.expect.includes(withContext)) {
      t.answeredWith += 1;
    }
    console.log(
      `${item.id.padEnd(7)} without=${without} with=${withContext}` +
        (response.followUp
          ? `  [${response.followUp.mode}] ${response.followUp.resolvedQuestion}`
          : ""),
    );
  }
  console.log(JSON.stringify(tally, null, 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
