"""Unit tests for cv_selection.py: the rule's three steps."""

import unittest

from tests.support import load

sel = load("cv_selection")


def cand(f1, cw, simplicity):
    return {"setting": "x", "simplicity": simplicity, "summary": {"macro_f1_mean": f1, "confident_wrong": cw}}


class Rule(unittest.TestCase):
    def test_clear_macro_f1_winner(self):
        winner, steps = sel.select({"a": cand(0.90, 0.2, 0), "b": cand(0.88, 0.0, 1)})
        self.assertEqual((winner, steps["decided_by"], steps["tied"]), ("a", "macro-F1", ["a"]))

    def test_tie_window_is_inclusive_and_confident_wrong_decides(self):
        winner, steps = sel.select({"a": cand(0.90, 0.2, 0), "b": cand(0.89, 0.1, 1)})
        self.assertEqual(sorted(steps["tied"]), ["a", "b"])
        self.assertEqual((winner, steps["decided_by"]), ("b", "confident-wrong"))

    def test_simpler_model_last(self):
        winner, steps = sel.select({"hybrid": cand(0.90, 0.1, 1), "lr": cand(0.895, 0.1, 0),
                                    "bert": cand(0.90, 0.1, 2)})
        self.assertEqual((winner, steps["decided_by"]), ("lr", "simpler model"))

    def test_real_results(self):
        winner, steps = sel.select(sel.best_settings())
        self.assertEqual(winner, "hybrid")
        self.assertEqual(sel.best_settings()["LR on e5 (no V1)"]["setting"], "lr_e5_base_C10")


if __name__ == "__main__":
    unittest.main()
