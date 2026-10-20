/**
 * Synthetic held-topic cases, written for the tests (not taken from any
 * evaluation set). Shared by heldTopics.test.js and the offline parity
 * test (offlineSafetyParity.test.js).
 */

const HELD_A = [
  "where can I buy P2",
  "is postinor safe",
  "how late can I take the morning after pill",
  "what is plan b",
  "the condom broke last night",
  "he broke the condom",
  "our condoms slipped off",
  "I forgot to take my pill yesterday",
  "I missed two pills this week",
  "he pulled out in time",
  "is withdrawal a good method",
  "we had unprotected sex",
  "we did it without a condom",
  "can pre-cum cause pregnancy",
];

const HELD_B = [
  "my pregnancy test came back positive",
  "I have a positive pregnancy test",
  "this is an unwanted pregnancy",
  "I don't want to be pregnant anymore",
  "where can I get an abortion",
  "are abortions safe",
  "can I terminate it",
  "how do I get rid of the pregnancy",
];

const HELD_NONE = [
  "I missed my period",
  "how do I get rid of period cramps",
  "I don't want to get pregnant, which method is best",
  "Which birth control methods can a teenager use?",
  "Do I need a condom if I am on the pill?",
  "what is PrEP",
  "is my HIV test positive forever",
  "Am I okay?",
];

module.exports = { HELD_A, HELD_B, HELD_NONE };
