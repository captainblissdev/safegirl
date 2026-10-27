"""Tests for freeze_hybrid.py and v4_infer.py. The model is fitted once,
exported to a temporary folder and loaded back through v4_infer, so the
tests do not depend on the committed frozen file."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from tests.support import load

fz = load("freeze_hybrid")
inf = load("v4_infer")
cv = fz.cv


def write_frozen(folder, spec_bytes, sidecar_hash=None):
    path = Path(folder) / "model.json"
    path.write_bytes(spec_bytes)
    digest = sidecar_hash or hashlib.sha256(spec_bytes).hexdigest()
    (Path(folder) / "model.sha256").write_text(f"{digest}  model.json\n", encoding="utf-8")
    return path


class FreezeAndInfer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = cv.load_data()
        texts = [x["text"] for x in cls.data["seeds"] + cls.data["paraphrases"]]
        cls.vec = fz.hy.lr_e5.embed_all(texts)
        cls.rules = {t: fz.hy.rule_features(t) for t in set(texts)}
        cls.model, cls.scaler, cls.train = fz.fit(cls.data, cls.vec, cls.rules)
        cls.spec = fz.export(cls.model, cls.scaler, cls.train)
        cls.blob = fz.serialise(cls.spec)
        cls.tmp = tempfile.TemporaryDirectory()
        cls.path = write_frozen(cls.tmp.name, cls.blob)
        cls.frozen = inf.load(cls.path, embed=lambda ts: [cls.vec[t] for t in ts])
        # 60 training texts spread across the rows
        cls.sample = cls.train[:: len(cls.train) // 60][:60]

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_rows_and_widths(self):
        self.assertEqual(self.spec["rows"]["seeds"], 380)
        self.assertEqual(self.spec["rows"]["paraphrases"], 1239)
        self.assertEqual(self.spec["features"]["total"], 384 + 5 + 1)
        self.assertEqual(np.array(self.spec["coef"]).shape, (6, 390))
        self.assertEqual(sorted(self.spec["classes"]), sorted(cv.CLASSES))
        self.assertEqual(self.spec["t_act"], 0.45)

    def test_no_seed_text_in_the_export(self):
        # No string value equals a seed; longer seeds (where a substring
        # match means something) appear nowhere in the file. A very short
        # seed can occur inside an ordinary word, so it is checked as a
        # whole value only. Failures name the seed id, never its text.
        def strings(obj):
            if isinstance(obj, str):
                yield obj
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    yield k
                    yield from strings(v)
            elif isinstance(obj, list):
                for v in obj:
                    yield from strings(v)

        values = set(strings(json.loads(self.blob)))
        text = self.blob.decode("utf-8")
        leaks = [x["seed_id"] for x in self.data["seeds"]
                 if x["text"] in values or (len(x["text"]) >= 20 and x["text"] in text)]
        self.assertEqual(leaks, [])

    def test_probabilities_match_sklearn(self):
        self.assertGreaterEqual(len(self.sample), 30)
        texts = [x["text"] for x in self.sample]
        emb, raw = fz.hy.features(self.sample, self.vec, self.rules)
        expected = self.model.predict_proba(np.hstack([emb, self.scaler.transform(raw)]))
        got = self.frozen.predict_proba(texts)
        np.testing.assert_allclose(got, expected, rtol=0, atol=1e-9)
        self.assertEqual(self.frozen.classes, [str(c) for c in self.model.classes_])

    def test_probabilities_sum_to_one(self):
        p = self.frozen.predict_proba([x["text"] for x in self.sample])
        np.testing.assert_allclose(p.sum(axis=1), 1.0, rtol=0, atol=1e-12)
        label, proba = self.frozen.predict(self.sample[0]["text"])
        self.assertIn(label, cv.CLASSES)
        self.assertAlmostEqual(sum(proba.values()), 1.0, places=12)

    def test_rule_features_match_the_cv_hybrid(self):
        for x in self.sample:
            self.assertEqual(self.frozen.rule_features(x["text"]).tolist(), list(self.rules[x["text"]]))

    def test_refuses_a_hash_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_frozen(tmp, self.blob, sidecar_hash="0" * 64)
            with self.assertRaisesRegex(inf.FrozenModelError, "does not match the sidecar"):
                inf.load(path, embed=lambda ts: [])

    def test_refuses_an_edited_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_frozen(tmp, self.blob)
            path.write_bytes(self.blob.replace(b'"t_act": 0.45', b'"t_act": 0.40'))
            with self.assertRaisesRegex(inf.FrozenModelError, "does not match the sidecar"):
                inf.load(path, embed=lambda ts: [])

    def test_refuses_a_missing_sidecar(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "model.json"
            path.write_bytes(self.blob)
            with self.assertRaisesRegex(inf.FrozenModelError, "no sidecar"):
                inf.load(path, embed=lambda ts: [])

    def test_refuses_changed_feature_code(self):
        spec = json.loads(self.blob)
        spec["feature_code_sha256"]["research/v4/vague_rule.py"] = "0" * 64
        with tempfile.TemporaryDirectory() as tmp:
            path = write_frozen(tmp, fz.serialise(spec))
            with self.assertRaisesRegex(inf.FrozenModelError, "vague_rule.py has changed"):
                inf.load(path, embed=lambda ts: [])

    def test_refit_is_byte_identical(self):
        model, scaler, train = fz.fit(self.data, self.vec, self.rules)
        self.assertEqual(fz.serialise(fz.export(model, scaler, train)), self.blob)

    def test_end_to_end_with_the_real_embedder(self):
        real = inf.load(self.path)
        texts = [x["text"] for x in self.sample[:3]]
        np.testing.assert_allclose(real.predict_proba(texts), self.frozen.predict_proba(texts), rtol=0, atol=1e-4)


if __name__ == "__main__":
    unittest.main()
