"""Unit tests for cv_distilbert.py: the inner/held-out split and the
class weights. No torch or transformers needed."""

import unittest

from tests.support import load

cvd = load("cv_distilbert")
cv = cvd.cv


class InnerFold(unittest.TestCase):
    def test_next_fold_wrapping(self):
        self.assertEqual([cvd.inner_fold(k) for k in cv.FOLDS], [2, 3, 4, 5, 1])

    def test_never_the_held_out_fold(self):
        for k in cv.FOLDS:
            self.assertIn(cvd.inner_fold(k), cv.FOLDS)
            self.assertNotEqual(cvd.inner_fold(k), k)

    def test_each_fold_validates_once(self):
        self.assertEqual(sorted(cvd.inner_fold(k) for k in cv.FOLDS), list(cv.FOLDS))


class Split(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = cv.load_data()

    def test_held_out_fold_only_in_test(self):
        for k in cv.FOLDS:
            train, val, test = cvd.split(self.data, k)
            self.assertFalse(any(x["fold"] == k for x in train + val))
            self.assertTrue(test and all(x["fold"] == k for x in test))
            held = {x["seed_id"] for x in test}
            self.assertFalse(held & {x["seed_id"] for x in train + val})

    def test_inner_fold_is_validation_seeds_only(self):
        for k in cv.FOLDS:
            inner = cvd.inner_fold(k)
            train, val, _ = cvd.split(self.data, k)
            self.assertFalse(any(x["fold"] == inner for x in train))
            self.assertTrue(val and all(x["fold"] == inner for x in val))
            self.assertTrue(all(x["id"] == x["seed_id"] for x in val), "seeds only")
            self.assertEqual(len(val), sum(1 for s in self.data["seeds"] if s["fold"] == inner))

    def test_train_is_the_other_three_folds_without_v1(self):
        v1 = {x["id"] for x in cv.load_v1_restore(self.data)}
        for k in cv.FOLDS:
            train, _, _ = cvd.split(self.data, k)
            rest = set(cv.FOLDS) - {k, cvd.inner_fold(k)}
            self.assertEqual({x["fold"] for x in train}, rest)
            expected = [x for x in self.data["seeds"] + self.data["paraphrases"] if x["fold"] in rest]
            self.assertEqual(len(train), len(expected))
            self.assertFalse({x["id"] for x in train} & v1)
            self.assertFalse({x["id"] for x in train} & self.data["excluded"])


class ClassWeights(unittest.TestCase):
    def test_balanced_formula(self):
        # 6 rows, 2 classes: a x4 -> 6/(2*4) = 0.75, b x2 -> 6/(2*2) = 1.5
        self.assertEqual(cvd.balanced_weights(list("aaaabb"), ("a", "b")), [0.75, 1.5])

    def test_order_follows_classes(self):
        self.assertEqual(cvd.balanced_weights(list("aaaabb"), ("b", "a")), [1.5, 0.75])

    def test_equal_classes_weigh_one(self):
        self.assertEqual(cvd.balanced_weights(list("abcabc"), ("a", "b", "c")), [1.0, 1.0, 1.0])

    def test_missing_class_is_refused(self):
        with self.assertRaisesRegex(AssertionError, "no training rows"):
            cvd.balanced_weights(list("aab"), ("a", "b", "c"))

    def test_weighted_counts_are_equal_on_real_folds(self):
        data = cv.load_data()
        for k in cv.FOLDS:
            labels = [x["cls"] for x in cvd.split(data, k)[0]]
            w = cvd.balanced_weights(labels)
            per_class = [w[i] * labels.count(c) for i, c in enumerate(cv.CLASSES)]
            for v in per_class:
                self.assertAlmostEqual(v, len(labels) / len(cv.CLASSES))


if __name__ == "__main__":
    unittest.main()
