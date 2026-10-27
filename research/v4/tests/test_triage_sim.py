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

# id -> (upstream_fired, v4_kind, M2 kind, M1 kind), one per branch
FIXTURES = {
    "DEV-Q44": ("referral", "referral", "referral", "referral"),
    "DEV-Q31": ("help", "help", "help", "help"),
    "SEED-CONTRA-09": ("held_A", "held", "held", "held"),
    "SEED-PREG-14": ("held_B", "held", "held", "held"),
    "SEED-PREG-11": ("held_C", "held", "held", "held"),
    "SEED-V4-VAG-007": ("vague_rule", "ask", "ask", "ask"),
    "SEED-CONTRA-43-P1": ("", "abstain", "abstain", "answer"),  # V4 below 0.45; no keyword hits
    "SEED-V4-VAG-005": ("", "ask", "abstain", "answer"),  # V4 vague class; no keyword hits
    "SEED-V4-OOS-001": ("", "abstain", "abstain", "answer"),  # out_of_scope; M1 no hits -> general
    "SEED-V4-PREG-002": ("", "answer", "answer", "answer"),  # topic class with keyword hits
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
            self.assertEqual(ts.decide(fired, "sti", 0.99, "sti", "sti"), (kind, kind, kind))

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

    def test_three_kinds_when_nothing_fires(self):
        self.assertEqual(ts.decide("", "vague", 0.9, "out_of_scope", "general"), ("ask", "abstain", "answer"))

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
            self.assertEqual((r["upstream_fired"], r["v4_kind"], r["baseline_kind"], r["baseline_m1_kind"]),
                             expected, item_id)

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
        self.assertEqual(header[:5], ["id", "v4_kind", "baseline_kind", "upstream_fired", "baseline_m1_kind"])
        leaks = [i for i in ids if self.text[i] in console.getvalue() or self.text[i] in written]
        self.assertEqual(leaks, [])


class BaselineM1(unittest.TestCase):
    """M1: the label as is, gbv -> general, no keyword hits -> general."""

    @classmethod
    def setUpClass(cls):
        cls.text = texts()
        cls.cb = load("cv_baseline")

    def test_topic_label_with_hits_is_kept(self):
        t = self.text["SEED-V4-PREG-002"]
        self.assertEqual(self.cb.baseline.classify_baseline(t), "pregnancy")
        self.assertEqual(self.cb.m1(t), "pregnancy")
        self.assertEqual(ts.classifier_kind(self.cb.m1(t)), "answer")

    def test_no_keyword_hits_is_general(self):
        for item_id in ("SEED-V4-OOS-001", "SEED-V4-VAG-005", "SEED-CONTRA-43-P1"):
            t = self.text[item_id]
            self.assertEqual(sum(self.cb.baseline.explain_baseline(t)["scores"].values()), 0, item_id)
            self.assertEqual((self.cb.m1(t), self.cb.m2(t)), ("general", "out_of_scope"), item_id)

    def test_gbv_is_general(self):
        # No seed or dev item reaches the classifier with a gbv label: all
        # three are caught upstream. The mapping itself is checked here.
        t = self.text["DEV-Q44"]
        self.assertEqual(self.cb.baseline.classify_baseline(t), "gbv")
        self.assertEqual(self.cb.m1(t), "general")
        self.assertEqual(ts.classifier_kind("general"), "answer")

    def test_m1_never_asks_or_abstains_after_upstream(self):
        for label in ("contraception", "sti", "pregnancy", "general"):
            self.assertEqual(ts.classifier_kind(label), "answer")


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
