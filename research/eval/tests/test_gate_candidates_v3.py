"""Tests for gate_candidates_v3.py with SYNTHETIC items and features only
(the reranker model is not loaded).

Run: .venv/Scripts/python.exe -I -m unittest discover -s research/eval/tests -t research/eval/tests
"""

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import gate_candidates_v3 as v3  # noqa: E402

IDS = ["KB-C1", "KB-C2", "KB-S1", "KB-G1"]
CLASSES = ["contraception", "contraception", "sti", "general"]


def feat(dense, rerank=None, route="retrieve", v3c=("contraception", 0.9), v4="contraception"):
    return {"route": route, "ids": IDS, "classes": CLASSES, "dense": np.array(dense, dtype=float),
            "kw": np.zeros(4), "v3_class": v3c[0], "v3_conf": v3c[1], "v4_class": v4, "v4_conf": 0.9,
            "rerank": rerank}


def item(iid, expected="answer", acceptable=("KB-C1",)):
    return {"id": iid, "set": "dev", "text": "synthetic", "expected": expected,
            "acceptable": list(acceptable), "scored": True}


class Candidates(unittest.TestCase):
    def test_scoped_items_rerank_only_their_class(self):
        f = feat([0.80, 0.85, 0.90, 0.70])
        self.assertEqual(v3.candidates(f), [1, 0])

    def test_unscoped_items_rerank_the_overall_top_k(self):
        f = feat([0.80, 0.85, 0.90, 0.70], v3c=("sti", 0.4))
        self.assertEqual(v3.candidates(f, top_k=3), [2, 1, 0])


class RerankDecision(unittest.TestCase):
    def test_the_reranked_top_entry_is_served(self):
        d = v3.rerank_decision(item("A"), feat([0.9, 0.8, 0.7, 0.6], rerank={0: -1.0, 1: 2.5}))
        self.assertEqual(d["entry"], "KB-C2")
        self.assertAlmostEqual(d["s1"], 2.5)
        self.assertAlmostEqual(d["margin"], 3.5)
        self.assertEqual(d["agree"], 1.0)

    def test_no_decision_without_rerank_scores(self):
        self.assertIsNone(v3.rerank_decision(item("A"), feat([0.9] * 4, rerank=None)))


class P6P7(unittest.TestCase):
    def setUp(self):
        self.items = [item(f"I{k}") for k in range(6)]
        self.feats = {"question": {}}
        for k, it in enumerate(self.items):
            good = k >= 3  # higher rerank scores serve the acceptable entry
            rerank = {0: 3.0 + k, 1: 0.0} if good else {0: -1.0, 1: 1.0 + k / 10}
            self.feats["question"][it["id"]] = feat([0.9, 0.8, 0.7, 0.6], rerank=rerank, v3c=("contraception", 0.9))

    def test_p6_threshold_separates_and_leave_one_out_scores(self):
        params = v3.fit_rerank("P6", self.items, self.feats)
        self.assertTrue(1.6 < params["threshold"] < 6.0)
        results = v3.loo("P6", self.items, self.feats)
        self.assertEqual([r["category"] for r in results], ["missed_answer"] * 3 + ["correct_answer"] * 3)

    def test_p7_logistic_gate_and_v4_off_fallback(self):
        params = v3.fit_rerank("P7", self.items, self.feats)
        self.assertTrue(params["with_v4"])
        off = v3.fit_rerank("P7", self.items, self.feats, with_v4=False)
        self.assertFalse(off["with_v4"])
        served, kind = v3.apply_rerank(params, self.items[5], self.feats)
        self.assertEqual((served, kind), ("KB-C1", "answer"))

    def test_routes_before_retrieval_are_kept(self):
        self.feats["question"]["I0"]["route"] = "held"
        self.assertEqual(v3.apply_rerank({"threshold": 0.0}, self.items[0], self.feats), (None, "held"))


class Selection(unittest.TestCase):
    def s(self, score, wrong=0):
        return {"score": score, "wrong_answers_served": wrong}

    def test_amended_complexity_order(self):
        base = {p: self.s(40) for p in v3.PIPELINES}
        self.assertEqual(v3.select({**base, "P3": self.s(57), "P6": self.s(56)}), "P6")
        self.assertEqual(v3.select({**base, "P3": self.s(57), "P7": self.s(57)}), "P3")
        self.assertEqual(v3.select({**base, "P4": self.s(55, wrong=8), "P6": self.s(55, wrong=6)}), "P6")

    def test_reranker_is_pinned_and_v16_counts_with_q13(self):
        self.assertEqual(len(v3.RERANKER["revision"]), 40)
        self.assertEqual(len(v3.RERANKER["weights_sha256"]), 64)
        self.assertEqual(v3.DUPLICATES, {"V16": "Q13"})


if __name__ == "__main__":
    unittest.main()
