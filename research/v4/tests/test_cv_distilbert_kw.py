"""Unit tests for cv_distilbert_kw.py: the head width, the scaler's
training-only fit, and the feature order shared with the e5 hybrid."""

import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from tests.support import load

kw = load("cv_distilbert_kw")
hy = load("cv_hybrid")
cv = kw.cv


class Head(unittest.TestCase):
    def test_774_inputs_and_six_outputs(self):
        import torch
        from transformers import DistilBertConfig, DistilBertForSequenceClassification

        torch.manual_seed(0)
        config = DistilBertConfig(vocab_size=50, dim=768, n_layers=1, n_heads=12, hidden_dim=32,
                                  max_position_embeddings=16, num_labels=6)
        model = kw.kw_model(DistilBertForSequenceClassification(config))
        self.assertEqual(model.classifier.in_features, 774)
        self.assertEqual(model.classifier.out_features, 6)
        self.assertEqual(model.pre_classifier.in_features, 768)
        ids = torch.randint(0, 50, (2, 8))
        out = model(ids, torch.ones_like(ids), torch.zeros(2, 6))
        self.assertEqual(tuple(out.shape), (2, 6))


class Scaler(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = cv.load_data()
        cls.inputs = {k: kw.fold_inputs(cls.data, k) for k in cv.FOLDS}

    def test_fitted_on_training_rows_only(self):
        for k, inputs in self.inputs.items():
            raw = np.array([kw.rule_features(x["text"]) for x in inputs["train"]])
            np.testing.assert_allclose(inputs["scaler"].mean_, raw.mean(axis=0))
            np.testing.assert_allclose(inputs["scaler"].var_, raw.var(axis=0))
            self.assertEqual(inputs["scaler"].n_samples_seen_, len(inputs["train"]))

    def test_held_out_and_inner_folds_never_in_scaler_data(self):
        for k, inputs in self.inputs.items():
            self.assertFalse({x["fold"] for x in inputs["train"]} & {k, kw.cvd.inner_fold(k)})
            # the val and test features are transformed, never fitted:
            # refitting on train + val + test would move the mean
            rows = inputs["train"] + inputs["val"] + inputs["test"]
            everything = np.array([kw.rule_features(x["text"]) for x in rows]).mean(axis=0)
            self.assertFalse(np.allclose(inputs["scaler"].mean_, everything))
            self.assertEqual(inputs["test_feats"].shape, (len(inputs["test"]), 6))
            self.assertEqual(inputs["val_feats"].shape, (len(inputs["val"]), 6))


class FeatureOrder(unittest.TestCase):
    def test_same_order_as_the_e5_hybrid(self):
        self.assertEqual(kw.RULE_COLUMNS, ("gbv", "sti", "contraception", "pregnancy", "general", "vague"))
        self.assertEqual(kw.RULE_COLUMNS[:5], tuple(hy.KEYWORD_CLASSES))
        self.assertEqual(Path(kw.hy.__file__).resolve(), Path(hy.__file__).resolve(), "features from cv_hybrid.py")

    def test_features_match_the_e5_hybrid(self):
        inputs = kw.fold_inputs(cv.load_data(), 1)
        sample = inputs["test"][:25]
        raw = np.array([hy.rule_features(x["text"]) for x in sample])
        self.assertEqual([list(kw.rule_features(x["text"])) for x in sample], raw.tolist())
        np.testing.assert_allclose(inputs["test_feats"][:25], inputs["scaler"].transform(raw), rtol=1e-6, atol=1e-6)


class LearningRate(unittest.TestCase):
    def write(self, tmp, means):
        for t, m in means.items():
            (Path(tmp) / f"cv_distilbert_lr{t}.json").write_text(json.dumps({"macro_f1_mean": m}), encoding="utf-8")

    def test_best_mean_macro_f1(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.write(tmp, {"5e-6": 0.6, "1e-5": 0.7, "2e-5": 0.8, "3e-5": 0.75})
            self.assertEqual(kw.choose_lr(Path(tmp))[0], "2e-5")

    def test_tie_goes_to_the_lower_rate(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.write(tmp, {"5e-6": 0.6, "1e-5": 0.7, "2e-5": 0.8, "3e-5": 0.8})
            self.assertEqual(kw.choose_lr(Path(tmp))[0], "2e-5")


if __name__ == "__main__":
    unittest.main()
