"""Tests for gate_candidates.py with SYNTHETIC items and features only.

Run: .venv/Scripts/python.exe -I -m unittest discover -s research/eval/tests -t research/eval/tests
"""

import math
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import gate_candidates as gc  # noqa: E402

IDS = ["KB-C1", "KB-C2", "KB-S1", "KB-G1"]
CLASSES = ["contraception", "contraception", "sti", "general"]


def feat(dense, kw=None, route="retrieve", v3=("contraception", 0.9), v4="contraception"):
    return {"route": route, "ids": IDS, "classes": CLASSES, "dense": np.array(dense, dtype=float),
            "kw": np.array(kw if kw is not None else [0.0] * 4, dtype=float),
            "v3_class": v3[0], "v3_conf": v3[1], "v4_class": v4, "v4_conf": 0.9}


def item(iid, expected="answer", acceptable=("KB-C1",)):
    return {"id": iid, "set": "dev", "text": "synthetic", "expected": expected,
            "acceptable": list(acceptable), "scored": True}


class Decision(unittest.TestCase):
    def test_scoped_takes_the_best_entry_of_the_v3_class(self):
        d = gc.decision(item("A"), feat([0.80, 0.85, 0.90, 0.70]))
        self.assertEqual(d["entry"], "KB-C2")
        self.assertAlmostEqual(d["s1"], 0.90)
        self.assertAlmostEqual(d["margin"], 0.05)
        self.assertEqual(d["agree"], 1.0)

    def test_unscoped_takes_the_overall_best(self):
        d = gc.decision(item("A"), feat([0.80, 0.85, 0.90, 0.70], v3=("contraception", 0.4)))
        self.assertEqual(d["entry"], "KB-S1")
        self.assertEqual(d["agree"], 0.0)

    def test_no_retrieval_below_the_abstain_threshold_or_after_a_rule(self):
        self.assertIsNone(gc.decision(item("A"), feat([0.9] * 4, v3=("sti", 0.3))))
        self.assertIsNone(gc.decision(item("A"), feat([0.9] * 4, route="held")))

    def test_hybrid_weight_can_change_the_top_entry(self):
        f = feat([0.86, 0.85, 0.80, 0.70], kw=[0.0, 1.0, 0.0, 0.0])
        self.assertEqual(gc.decision(item("A"), f, 0.0)["entry"], "KB-C1")
        self.assertEqual(gc.decision(item("A"), f, 0.05)["entry"], "KB-C2")


class Outcome(unittest.TestCase):
    def test_categories(self):
        self.assertEqual(gc.outcome(item("A"), "retrieve", "KB-C1"), (True, "correct_answer"))
        self.assertEqual(gc.outcome(item("A"), "retrieve", "KB-S1"), (False, "wrong_answer"))
        self.assertEqual(gc.outcome(item("A"), "retrieve", None), (False, "missed_answer"))
        off = item("B", expected="abstain", acceptable=())
        self.assertEqual(gc.outcome(off, "vague", None), (True, "correct_abstain"))
        self.assertEqual(gc.outcome(off, "retrieve", "KB-C1"), (False, "wrong_answer"))
        not_ref = item("C", expected="not_referral")
        self.assertTrue(gc.outcome(not_ref, "retrieve", "KB-G1")[0])
        self.assertFalse(gc.outcome(not_ref, "referral", None)[0])


class Threshold(unittest.TestCase):
    def test_separates_successes_from_failures(self):
        rows = [(0.80, False, True), (0.82, False, True), (0.88, True, False), (0.90, True, False)]
        self.assertAlmostEqual(gc.calibrate_threshold(rows), 0.85)

    def test_ties_go_to_fewer_wrong_answers(self):
        # Serving the 0.84 item or not gives the same successes; not serving
        # it avoids a wrong answer, so the threshold sits above it.
        rows = [(0.84, False, False), (0.90, True, False)]
        self.assertAlmostEqual(gc.calibrate_threshold(rows), 0.87)

    def test_everything_served_or_nothing(self):
        self.assertEqual(gc.calibrate_threshold([(0.8, True, False), (0.9, True, False)]), -math.inf)
        self.assertEqual(gc.calibrate_threshold([(0.8, False, True), (0.9, False, True)]), math.inf)


class Logistic(unittest.TestCase):
    def test_constant_model_for_one_class(self):
        model = gc.fit_logistic([[0.9, 0.1, 1.0], [0.8, 0.1, 1.0]], [1, 1])
        self.assertTrue(gc.logistic_serves(model, [0.1, 0.0, 0.0]))

    def test_learns_the_direction_of_the_score(self):
        x = [[s, 0.02, 1.0] for s in (0.80, 0.81, 0.82, 0.88, 0.89, 0.90)]
        model = gc.fit_logistic(x, [0, 0, 0, 1, 1, 1])
        self.assertFalse(gc.logistic_serves(model, [0.79, 0.02, 1.0]))
        self.assertTrue(gc.logistic_serves(model, [0.91, 0.02, 1.0]))


class LeaveOneOut(unittest.TestCase):
    def test_the_held_out_item_is_not_used_to_fit(self):
        items = [item(f"I{k}") for k in range(6)]
        feats = {"full": {}, "question": {}}
        for k, it in enumerate(items):
            # Higher scores serve the acceptable entry, lower ones a wrong one.
            good = k >= 3
            dense = [0.9 + k / 100, 0.7, 0.6, 0.5] if good else [0.6, 0.7, 0.8 + k / 100, 0.5]
            for mode in feats:
                feats[mode][it["id"]] = feat(dense, v3=("sti", 0.4))
        results = gc.loo("P1", items, feats)
        self.assertEqual([r["category"] for r in results],
                         ["missed_answer"] * 3 + ["correct_answer"] * 3)

    def test_p0_uses_the_fixed_gate(self):
        self.assertEqual(gc.fit("P0", [], {}), {"threshold": gc.GATE, "w": 0.0})


class Selection(unittest.TestCase):
    def s(self, score, wrong=0):
        return {"score": score, "wrong_answers_served": wrong}

    def test_within_one_item_the_simpler_pipeline_wins(self):
        sums = {"P0": self.s(52), "P1": self.s(51), "P2": self.s(53), "P3": self.s(50),
                "P4": self.s(50), "P5": self.s(50)}
        self.assertEqual(gc.select(sums), "P0")

    def test_a_clear_winner_is_chosen(self):
        sums = {"P0": self.s(52), "P1": self.s(51), "P2": self.s(53), "P3": self.s(57),
                "P4": self.s(54), "P5": self.s(55)}
        self.assertEqual(gc.select(sums), "P3")

    def test_same_level_goes_to_fewer_wrong_answers(self):
        sums = {"P0": self.s(40), "P1": self.s(55, wrong=9), "P2": self.s(55, wrong=7), "P3": self.s(40),
                "P4": self.s(40), "P5": self.s(40)}
        self.assertEqual(gc.select(sums), "P2")


class Other(unittest.TestCase):
    def test_bootstrap_is_seeded_and_zero_for_equal_outcomes(self):
        a = [1, 0, 1, 1, 0]
        self.assertEqual(gc.bootstrap_difference(a, a, n=200), [0.0, 0.0])
        self.assertEqual(gc.bootstrap_difference(a, [0] * 5, n=200), gc.bootstrap_difference(a, [0] * 5, n=200))

    def test_bm25_prefers_the_matching_entry(self):
        bm25 = gc.BM25(["implant arm rod", "period pad tampon", "condom pill"])
        scores = gc.normalised(bm25.scores("which pad for my period"))
        self.assertEqual(int(np.argmax(scores)), 1)
        self.assertEqual(scores.max(), 1.0)
        self.assertEqual(gc.normalised(bm25.scores("the of")).max(), 0.0)

    def test_gate_acceptable_reads_also_acceptable_notes(self):
        row = {"likely_entry": "KB-S1", "notes": "also acceptable: KB-S2;KB-S3; note"}
        self.assertEqual(gc.gate_acceptable(row), ["KB-S1", "KB-S2", "KB-S3"])


if __name__ == "__main__":
    unittest.main()
