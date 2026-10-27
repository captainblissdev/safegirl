"""Tests for triage_sim.py and triage_sim.js, on seeds, their paraphrases
and the 58-question dev set only. Assertions compare ids and kinds,
never text."""

import csv
import json
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

from tests.support import V4, load

ts = load("triage_sim")
cv = load("cv_common")
DEV_SET = cv.REPO / "resources" / "eval" / "retrieval_eval_set.csv"
PARITY = V4 / "tests" / "triage_parity.js"

# id -> (upstream_fired, v4_kind, baseline_kind), one per branch
FIXTURES = {
    "DEV-Q44": ("referral", "referral", "referral"),
    "DEV-Q31": ("help", "help", "help"),
    "SEED-CONTRA-09": ("held_A", "held", "held"),
    "SEED-PREG-14": ("held_B", "held", "held"),
    "SEED-PREG-11": ("held_C", "held", "held"),
    "SEED-V4-VAG-007": ("vague_rule", "ask", "ask"),
    "SEED-CONTRA-43-P1": ("", "abstain", "abstain"),  # V4 top probability below 0.45
    "SEED-V4-VAG-005": ("", "ask", "abstain"),  # V4 vague class; baseline zero hits
    "SEED-V4-OOS-001": ("", "abstain", "abstain"),  # out_of_scope for both
    "SEED-V4-PREG-002": ("", "answer", "answer"),  # topic class for both
}


def dev_items():
    with open(DEV_SET, encoding="utf-8-sig", newline="") as f:
        return [(f"DEV-{r['id']}", r["query"]) for r in csv.DictReader(f)]


def texts():
    data = cv.load_data()
    out = {x["id"]: x["text"] for x in data["seeds"] + data["paraphrases"]}
    out.update(dev_items())
    return out


class Decide(unittest.TestCase):
    def test_upstream_kinds_apply_to_both(self):
        for fired, kind in (("referral", "referral"), ("help", "help"), ("held_A", "held"), ("held_B", "held"),
                            ("held_C", "held"), ("vague_rule", "ask")):
            self.assertEqual(ts.decide(fired, "sti", 0.99, "sti"), (kind, kind))

    def test_v4_table(self):
        self.assertEqual(ts.classifier_kind("sti", 0.44), "abstain")
        self.assertEqual(ts.classifier_kind("vague", 0.44), "abstain", "the threshold comes first")
        self.assertEqual(ts.classifier_kind("sti", 0.45), "answer", "exactly t_act is not below it")
        self.assertEqual(ts.classifier_kind("vague", 0.9), "ask")
        self.assertEqual(ts.classifier_kind("out_of_scope", 0.9), "abstain")
        for topic in ("contraception", "sti", "pregnancy", "general"):
            self.assertEqual(ts.classifier_kind(topic, 0.9), "answer")

    def test_baseline_table(self):
        self.assertEqual(ts.classifier_kind("out_of_scope"), "abstain")
        self.assertEqual(ts.classifier_kind("vague"), "ask")
        self.assertEqual(ts.classifier_kind("general"), "answer")
        with self.assertRaises(ValueError):
            ts.classifier_kind("gbv")

    def test_pinned_threshold(self):
        self.assertEqual(ts.T_ACT, 0.45)


class Simulator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = texts()
        rows = ts.simulate([(i, cls.text[i]) for i in FIXTURES])
        cls.rows = {r["id"]: r for r in rows}

    def test_one_fixture_per_branch(self):
        for item_id, expected in FIXTURES.items():
            r = self.rows[item_id]
            self.assertEqual((r["upstream_fired"], r["v4_kind"], r["baseline_kind"]), expected, item_id)

    def test_abstain_fixture_is_below_t_act(self):
        r = self.rows["SEED-CONTRA-43-P1"]
        self.assertLess(float(r["v4_confidence"]), ts.T_ACT)
        self.assertNotEqual(r["v4_class"], "out_of_scope")

    def test_duplicate_ids_refused(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            ts.simulate([("a", "x"), ("a", "y")], model=object())

    def test_no_text_in_console_or_output(self):
        ids = list(FIXTURES)
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / "in.csv", Path(tmp) / "out.csv"
            with open(src, "w", encoding="utf-8", newline="") as f:
                w = csv.writer(f)
                w.writerow(["id", "text"])
                w.writerows((i, self.text[i]) for i in ids)
            console = StringIO()
            with redirect_stdout(console):
                ts.main([str(src), "--out", str(out)])
            written = out.read_text(encoding="utf-8")
            with open(out, encoding="utf-8", newline="") as f:
                header = next(csv.reader(f))
        self.assertEqual(header[:4], ["id", "v4_kind", "baseline_kind", "upstream_fired"])
        leaks = [i for i in ids if self.text[i] in console.getvalue() or self.text[i] in written]
        self.assertEqual(leaks, [])


class ParityWithBackend(unittest.TestCase):
    def run_parity(self, items):
        done = subprocess.run(["node", str(PARITY)], input=json.dumps([{"id": i, "text": t} for i, t in items]),
                              capture_output=True, text=True, encoding="utf-8", check=True)
        return json.loads(done.stdout)

    def test_every_dev_query(self):
        result = self.run_parity(dev_items())
        self.assertEqual(result["compared"], 58)
        self.assertEqual(result["mismatches"], [])
        self.assertEqual(result["classifierMismatches"], [])

    def test_every_seed_and_paraphrase(self):
        data = cv.load_data()
        result = self.run_parity([(x["id"], x["text"]) for x in data["seeds"] + data["paraphrases"]])
        self.assertEqual(result["compared"], 1619)
        self.assertEqual(result["mismatches"], [])
        self.assertEqual(result["classifierMismatches"], [])


if __name__ == "__main__":
    unittest.main()
