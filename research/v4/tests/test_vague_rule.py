"""Parity of vague_rule.py with the gateway's isVagueQuery (Node)."""

import json
import subprocess
import unittest

from tests.support import load

vague = load("vague_rule")
cv = load("cv_common")

NODE = r"""
const path = require("path");
const { isVagueQuery } = require(path.join(process.argv[1], "app", "gateway", "src", "vagueQuery"));
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => process.stdout.write(JSON.stringify(JSON.parse(input).map(isVagueQuery))));
"""


def js_vague(texts):
    done = subprocess.run(["node", "-e", NODE, str(vague.REPO)], input=json.dumps(texts),
                          capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(done.stdout)


class Parity(unittest.TestCase):
    def test_every_seed_and_paraphrase(self):
        data = cv.load_data()
        items = data["seeds"] + data["paraphrases"] + cv.load_v1_restore(data)
        texts = [x["text"] for x in items]
        expected = js_vague(texts)
        got = [vague.is_vague(t) for t in texts]
        mismatches = [items[i]["id"] for i in range(len(texts)) if got[i] != expected[i]]
        self.assertEqual(mismatches, [])
        self.assertGreater(len(texts), 1600)
        self.assertGreater(sum(expected), 0, "some texts are vague")

    def test_edge_cases(self):
        cases = ["", "hmm", "Am I okay?", "Hi there, please help", "Hello can I ask something",
                 "what is PrEP", "I'm worried", "Can I ask you something?", "is this normal?",
                 "Do I have it?", "family planning", "my períod is late", "ARVs?", "   ",
                 "what's up", "IS MY PERIOD NORMAL", "i have stis", "clinic", "hey there hmm"]
        self.assertEqual([vague.is_vague(c) for c in cases], js_vague(cases))
        self.assertFalse(vague.is_vague(None))

    def test_lists_come_from_the_gateway(self):
        self.assertIn("would", vague.function_words())
        words, phrases = vague.health_terms()
        self.assertTrue(words and all(" " not in w for w in words))
        self.assertTrue(all(" " in p for p in phrases))


if __name__ == "__main__":
    unittest.main()
