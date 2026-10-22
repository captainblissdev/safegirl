/**
 * The Childline Kenya (116) wording, changed by the project owner on 22
 * October 2026 (docs/decision-log.md, "Helpline 116 wording"): no reply
 * may say the line is "free for anyone under 18" any more.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const content = require("../src/content/helpContent");

const NEW_SENTENCE =
  "Childline Kenya, 116, is a free 24-hour helpline for children.";

describe("helpline 116 wording", () => {
  const replies = {
    help: content.SIGNPOSTING_MESSAGE,
    "no answer": content.NO_ANSWER_MESSAGE,
    "held A": content.HELD_TOPIC_MESSAGES.A,
    "held B": content.HELD_TOPIC_MESSAGES.B,
    "held C": content.HELD_TOPIC_MESSAGES.C,
    "self-harm referral": content.SELF_HARM_REFERRAL_MESSAGE,
    "abuse referral": content.ABUSE_REFERRAL_MESSAGE,
  };

  it('no reply says "free for anyone under 18"', () => {
    for (const [name, text] of Object.entries(replies)) {
      assert.ok(!/free for anyone under 18/i.test(text), name);
    }
  });

  it("help, no answer, held A and held B carry the new sentence, once", () => {
    for (const name of ["help", "no answer", "held A", "held B"]) {
      assert.equal(replies[name].split(NEW_SENTENCE).length, 2, name);
    }
  });

  it("the abuse referral keeps its parenthetical unchanged", () => {
    assert.ok(
      content.ABUSE_REFERRAL_MESSAGE.includes(
        "Childline Kenya 116 (for anyone under 18) can also help.",
      ),
    );
  });

  it("the helpline numbers and the verified flag are unchanged", () => {
    assert.equal(content.CHILDLINE_KENYA, "116");
    assert.equal(content.GBV_HELPLINE, "1195");
    assert.deepEqual([...content.EMERGENCY_NUMBERS], ["999", "112"]);
    assert.equal(content.HELP_CONTACTS_VERIFIED, false);
  });
});
