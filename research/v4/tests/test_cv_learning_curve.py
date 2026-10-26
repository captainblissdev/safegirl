"""Unit tests for cv_learning_curve.py: stratified, nested, seed-level
subsampling that never touches the held-out fold."""

import unittest
from collections import Counter

from tests.support import load

lc = load("cv_learning_curve")
cv = lc.cv


class Subsample(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = cv.load_data()
        cls.cls_of = {s["seed_id"]: s["cls"] for s in cls.data["seeds"]}

    def test_keep_count(self):
        self.assertEqual([lc.keep_count(s, 10) for s in lc.SIZES], [2, 4, 6, 8, 10])
        self.assertEqual(lc.keep_count(0.2, 2), 1, "at least one seed")
        self.assertEqual(lc.keep_count(0.2, 13), 3)

    def test_stratified_by_class(self):
        for k in cv.FOLDS:
            available = Counter(s["cls"] for s in self.data["seeds"] if s["fold"] != k)
            for size in lc.SIZES:
                _, kept = lc.subsample(self.data, k, size)
                got = Counter(self.cls_of[sid] for sid in kept)
                self.assertEqual(got, {c: lc.keep_count(size, n) for c, n in available.items()})

    def test_nested_and_full(self):
        for k in cv.FOLDS:
            sets = [lc.subsample(self.data, k, s)[1] for s in lc.SIZES]
            for small, big in zip(sets, sets[1:]):
                self.assertLess(small, big)
            full, _ = lc.subsample(self.data, k, 1.0)
            self.assertEqual(full, cv.train_rows(self.data, k), "100% is the full training set, same order")

    def test_paraphrases_follow_their_seeds_and_held_out_untouched(self):
        for k in cv.FOLDS:
            train, kept = lc.subsample(self.data, k, 0.4)
            self.assertTrue(all(x["seed_id"] in kept for x in train))
            self.assertFalse(any(x["fold"] == k for x in train))
            para = [p for p in self.data["paraphrases"] if p["seed_id"] in kept]
            self.assertEqual(sum(1 for x in train if x["id"] != x["seed_id"]), len(para))

    def test_deterministic(self):
        a = lc.subsample(self.data, 2, 0.6)[1]
        b = lc.subsample(self.data, 2, 0.6)[1]
        self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main()
