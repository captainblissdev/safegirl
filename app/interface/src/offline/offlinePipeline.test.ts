import { handleQueryOffline } from "./pipeline";
import { handleQueryOffline as handleShippedOffline } from "./offlinePipeline";
import { PLACEHOLDER_EXAMPLES } from "../content/uiText";
import {
  ABUSE_REFERRAL_MESSAGE,
  HELD_TOPIC_MESSAGES,
  SIGNPOSTING_MESSAGE,
  VAGUE_QUERY_MESSAGE,
} from "./helpContent";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`  PASS: ${message}`);
}

console.log("Test 1: normal query (contraception) offline");
const r1 = handleQueryOffline(
  "Can I get birth control even though I'm a teenager?",
);

assert(r1.outcome === "grounded_answer", "outcome is grounded_answer");
assert(
  r1.category === "contraception",
  `category is contraception (got ${r1.category})`,
);
assert(r1.generationInvoked === false, "generationInvoked is false offline");
console.log("  message:", r1.message);

console.log("\nTest 2: flagged query (GBV language) offline");
const r2 = handleQueryOffline("He forced me and I didn't consent");

assert(r2.outcome === "referral", "outcome is referral");
assert(r2.generationInvoked === false, "generationInvoked is false");
console.log("  message:", r2.message);

console.log(
  "\nTest 3: pregnancy query offline -- must not leak HELD abortion content",
);
const r3 = handleQueryOffline(
  "Do I have to pay for antenatal checkups as a teenager?",
);

assert(r3.outcome === "grounded_answer", "outcome is grounded_answer");
assert(
  r3.category === "pregnancy",
  `category is pregnancy (got ${r3.category})`,
);
assert(
  !r3.message.toLowerCase().includes("abortion"),
  "HELD content never leaks through offline either",
);
console.log("  message:", r3.message);

console.log("\nTest 4: general/youth-friendly query offline");
const r4 = handleQueryOffline(
  "What does youth-friendly mean at a health clinic?",
);

assert(r4.outcome === "grounded_answer", "outcome is grounded_answer");
assert(r4.category === "general", `category is general (got ${r4.category})`);
console.log("  message:", r4.message);

// Tests 5 to 8 run the pipeline the app uses offline
// (offlinePipeline.ts, imported by api/client.ts); tests 1 to 4 above
// run pipeline.ts.

console.log("\nTest 5: shipped offline pipeline, 'Help' gets the help reply");
const r5 = handleShippedOffline("Help");

assert(r5.outcome === "signposting", "outcome is signposting");
assert(r5.kind === "help", "kind is help");
assert(r5.message === SIGNPOSTING_MESSAGE, "the signposting message");

console.log(
  "\nTest 6: shipped offline pipeline, vague queries get the question",
);
for (const query of [
  "Am I okay?",
  "Is this normal?",
  "I feel strange",
  "Can I ask you something?",
  "I'm worried",
  "What should I do?",
  "Do I have it?",
  "hmm",
]) {
  const response = handleShippedOffline(query);
  assert(
    response.outcome === "clarification" &&
      response.kind === "vague" &&
      response.message === VAGUE_QUERY_MESSAGE,
    `"${query}" gets the clarifying question`,
  );
}

console.log("\nTest 7: shipped offline pipeline, the Safety Net still wins");
const r7 = handleShippedOffline("someone touched me");

assert(r7.outcome === "referral", "outcome is referral");
assert(r7.kind === "referral", "kind is referral");
assert(r7.message === ABUSE_REFERRAL_MESSAGE, "the abuse referral message");

console.log(
  "\nTest 8: shipped offline pipeline, a health question still gets an answer",
);
const r8 = handleShippedOffline("what is PrEP");

assert(r8.outcome === "grounded_answer", "outcome is grounded_answer");
assert(r8.kind === undefined, "no kind on a general limited-mode answer");

console.log("\nTest 9: shipped offline pipeline, held topics get the signpost");
for (const [query, group] of [
  ["the condom broke last night", "A"],
  ["plan b?", "A"],
  ["where can I get an abortion", "B"],
  ["my period is late this month", "C"],
] as const) {
  const response = handleShippedOffline(query);
  assert(
    response.outcome === "held" &&
      response.kind === "held-topic" &&
      response.heldTopicGroup === group &&
      response.message === HELD_TOPIC_MESSAGES[group],
    `"${query}" gets the group ${group} signpost`,
  );
}

console.log(
  "\nTest 10: shipped offline pipeline, the Safety Net beats a held topic",
);
const r10 = handleShippedOffline("he forced me and the condom broke");
assert(r10.outcome === "referral", "outcome is referral");

console.log(
  "\nTest 11: shipped offline pipeline, Home's examples get their own topic",
);
{
  // The offline pipeline gives a general answer per category (it has no
  // knowledge-base retrieval), so the check is that each example reaches
  // the category of the entry it is the question of, and that no rule
  // intercepts it. Retrieval of the entry itself is checked in the
  // gateway (app/gateway/test/homeExamples.test.js).
  const expected: Record<string, string> = {
    "Can STIs be cured, and can they harm me if I leave them?": "sti",
    "What can I do about period pain?": "general",
    "Which birth control methods can a teenager use?": "contraception",
    "Can I take PrEP to prevent HIV? I'm a teenager.": "sti",
    "How do I manage my period hygienically?": "general",
    "What warning signs in pregnancy mean I should go to hospital right away?":
      "pregnancy",
  };
  for (const example of PLACEHOLDER_EXAMPLES) {
    const response = handleShippedOffline(example);
    assert(
      response.outcome === "grounded_answer" &&
        response.category === expected[example],
      `"${example}" gets the ${expected[example]} answer`,
    );
  }
}

console.log("\nAll offline pipeline tests passed.");
