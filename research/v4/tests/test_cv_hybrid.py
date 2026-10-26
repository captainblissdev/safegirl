"""Unit tests for cv_hybrid.py: the scaler sees training rows only, and
the feature matrix has the expected width."""

import unittest

import numpy as np

from tests.support import load

hy = load("cv_hybrid")

# 3 training rows, 2 test rows; embeddings of width 4, rule columns of 6.
TRAIN = (np.ones((3, 4)), np.array([[0, 1, 0, 2, 0, 0], [0, 3, 0, 0, 0, 1], [0, 2, 1, 1, 0, 0]], float))
TEST = (np.full((2, 4), 0.5), np.array([[9, 9, 9, 9, 9, 1], [0, 0, 0, 0, 0, 0]], float))


class Design(unittest.TestCase):
    def test_scaler_fitted_on_training_rows_only(self):
        _, _, scaler = hy.design(TRAIN, TEST)
        np.testing.assert_allclose(scaler.mean_, TRAIN[1].mean(axis=0))
        np.testing.assert_allclose(scaler.var_, TRAIN[1].var(axis=0))
        self.assertEqual(scaler.n_samples_seen_, 3)

    def test_changing_test_rows_does_not_move_the_training_matrix(self):
        a, _, _ = hy.design(TRAIN, TEST)
        b, _, _ = hy.design(TRAIN, (TEST[0], TEST[1] * 100))
        np.testing.assert_array_equal(a, b)

    def test_embeddings_unscaled_rules_scaled(self):
        X_train, X_test, scaler = hy.design(TRAIN, TEST)
        np.testing.assert_array_equal(X_train[:, :4], TRAIN[0])
        np.testing.assert_array_equal(X_test[:, :4], TEST[0])
        np.testing.assert_allclose(X_train[:, 4:].mean(axis=0), 0, atol=1e-12)
        np.testing.assert_allclose(X_test[:, 4:], scaler.transform(TEST[1]))

    def test_width(self):
        X_train, X_test, _ = hy.design(TRAIN, TEST)
        self.assertEqual(X_train.shape, (3, 4 + 6))
        self.assertEqual(X_test.shape, (2, 4 + 6))


class RuleFeatures(unittest.TestCase):
    def test_six_columns_in_order(self):
        f = hy.rule_features("can I get pregnant after taking the pill late")
        self.assertEqual(len(f), len(hy.KEYWORD_CLASSES) + 1)
        self.assertEqual(f, [0.0, 0.0, 1.0, 1.0, 0.0, 0.0])

    def test_vague_flag(self):
        self.assertEqual(hy.rule_features("Am I okay?")[-1], 1.0)

    def test_real_width_with_e5(self):
        # multilingual-e5-small gives 384 dimensions; 384 + 5 + 1.
        emb = (np.zeros((2, 384)), np.array([hy.rule_features("hmm"), hy.rule_features("what is PrEP")]))
        X, _, _ = hy.design(emb, emb)
        self.assertEqual(X.shape[1], 390)


if __name__ == "__main__":
    unittest.main()
