/**
 * SafeGirl Backend Integration Tests
 *
 * These tests verify the current end-to-end backend scaffold.
 *
 * The tests cover:
 * 1. Normal contraception query with real KB retrieval.
 * 2. Safety/GBV query and generation short-circuit.
 * 3. General youth-friendly query and category-scoped retrieval.
 * 4. Pregnancy query while ensuring HELD content is excluded.
 * 5. Input validation for an empty query.
 *
 * These tests validate the interim pipeline and do not represent
 * final evaluation of the DistilBERT classifier, semantic retrieval,
 * or Gemini generation.
 */

const assert = require("assert");
const { handleQuery } = require("../src/backend");

async function run() {
  /**
   * Test 1 — Normal contraception query
   *
   * Verifies that a clear query reaches the normal response path
   * and retrieves actual knowledge-base content.
   */
  console.log(
    "Test 1: normal query (contraception) — should retrieve real KB content",
  );

  const r1 = await handleQuery(
    "Do I have to pay for contraception at a government clinic?",
  );

  assert.strictEqual(r1.outcome, "grounded_answer");
  assert.strictEqual(r1.generationInvoked, true);
  assert.ok(r1.message, "expected a non-empty message from real KB content");

  console.log("  category:", r1.category);
  console.log("  message:", r1.message);
  console.log("  PASS\n");

  /**
   * Test 2 — Safety/GBV query
   *
   * Verifies that a flagged query returns referral guidance and
   * does not continue into the generation pipeline.
   */
  console.log(
    "Test 2: flagged query (GBV language) — should short-circuit to referral",
  );

  const r2 = await handleQuery(
    "He forced me and I didn't consent, I don't know what to do",
  );

  assert.strictEqual(r2.outcome, "referral");
  assert.strictEqual(r2.generationInvoked, false);

  // The classifier is still dispatched independently.
  assert.strictEqual(r2.classificationSkipped, false);

  console.log("  message:", r2.message);
  console.log("  PASS\n");

  /**
   * Test 3 — General youth-friendly query
   *
   * Verifies that a general query is routed to the general category
   * and can retrieve content from general.md.
   */
  console.log("Test 3: general/youth-friendly query — should hit general.md");

  const r3 = await handleQuery(
    "What does youth-friendly mean at a health clinic?",
  );

  assert.strictEqual(r3.outcome, "grounded_answer");
  assert.strictEqual(r3.category, "general");
  assert.ok(r3.message, "expected a response from general KB content");

  console.log("  message:", r3.message);
  console.log("  PASS\n");

  /**
   * Test 4 — Pregnancy query
   *
   * Verifies category routing to pregnancy.md and checks that
   * held content is not exposed through retrieval.
   */
  console.log(
    "Test 4: pregnancy query — should hit pregnancy.md, not the HELD abortion content",
  );

  const r4 = await handleQuery(
    "Do I have to get a pelvic exam right away at my first visit?",
  );

  assert.strictEqual(r4.outcome, "grounded_answer");
  assert.strictEqual(r4.category, "pregnancy");
  assert.ok(r4.message, "expected a response from pregnancy KB content");

  assert.ok(
    !r4.message.toLowerCase().includes("abortion"),
    "HELD content must never leak through",
  );

  console.log("  message:", r4.message);
  console.log("  PASS\n");

  /**
   * Test 5 — Empty query
   *
   * Verifies that invalid input is rejected before entering
   * the processing pipeline.
   */
  console.log("Test 5: empty query — should throw");

  try {
    await handleQuery("");

    assert.fail("expected TypeError for empty query");
  } catch (err) {
    assert.ok(err instanceof TypeError);
    console.log("  correctly threw:", err.message);
    console.log("  PASS\n");
  }

  console.log("All tests passed.");
}

run().catch((err) => {
  console.error("TEST FAILURE:", err);
  process.exit(1);
});
