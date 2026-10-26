"""Unit tests for cv_threshold.py on hand-computed cases."""

import unittest

from tests.support import load

th = load("cv_threshold")


def r(true, pred, conf):
    return {"true": true, "pred": pred, "confidence": conf}


# 10 items. Above 0.6: 4 right (sti x2, pregnancy x2). Between 0.4 and
# 0.6: one wrong sti prediction and one right general. Below 0.4: 4
# wrong.
OOF = ([r("sti", "sti", 0.9), r("sti", "sti", 0.8), r("pregnancy", "pregnancy", 0.7),
        r("pregnancy", "pregnancy", 0.65), r("general", "sti", 0.5), r("general", "general", 0.45)]
       + [r("vague", "general", 0.3)] * 4)


class Rows(unittest.TestCase):
    def test_coverage_accuracy_and_precision(self):
        row = th.row_at(OOF, 0.45)
        self.assertEqual((row["covered"], row["below"]), (6, 4))
        self.assertAlmostEqual(row["coverage"], 0.6)
        self.assertAlmostEqual(row["accuracy"], 5 / 6)
        self.assertAlmostEqual(row["sti_precision"], 2 / 3)
        self.assertAlmostEqual(row["pregnancy_precision"], 1.0)
        self.assertAlmostEqual(row["confident_wrong"], 1 / 10)

    def test_threshold_is_inclusive(self):
        self.assertEqual(th.row_at(OOF, 0.5)["covered"], 5)

    def test_no_covered_prediction_of_a_class_has_no_precision(self):
        row = th.row_at(OOF, 0.95)
        self.assertEqual(row["covered"], 0)
        self.assertIsNone(row["sti_precision"])
        self.assertFalse(th.qualifies(row))


class Rule(unittest.TestCase):
    def test_smallest_qualifying_t(self):
        table = [th.row_at(OOF, t) for t in th.GRID]
        # 0.30-0.50 fail (accuracy or sti precision); 0.55 covers the 4 right ones.
        self.assertEqual(th.choose(table), 0.55)

    def test_none_when_nothing_qualifies(self):
        bad = [r("sti", "general", 0.9)] * 3
        self.assertIsNone(th.choose([th.row_at(bad, t) for t in th.GRID]))

    def test_grid(self):
        self.assertEqual(th.GRID, (0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7))


if __name__ == "__main__":
    unittest.main()
