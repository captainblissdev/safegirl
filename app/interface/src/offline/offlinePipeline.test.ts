import { handleQueryOffline } from "./pipeline";

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

console.log("\nAll offline pipeline tests passed.");
