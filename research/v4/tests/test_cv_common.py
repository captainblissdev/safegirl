"""Unit tests for cv_common.py: metrics on hand-computed cases, and the
frozen data the CV runs use."""

import csv
import json
import tempfile
import unittest
from pathlib import Path

from tests.support import load

cv = load("cv_common")

# true a a b b / pred a b b b, labels (a, b):
#   a: tp 1, fp 0, fn 1 -> P 1, R 0.5, F1 2/3
#   b: tp 2, fp 1, fn 0 -> P 2/3, R 1, F1 0.8
TRUE = ["a", "a", "b", "b"]
PRED = ["a", "b", "b", "b"]
CONF = [0.9, 0.8, 0.4, 0.6]
LABELS = ("a", "b")


class Metrics(unittest.TestCase):
    def test_confusion(self):
        self.assertEqual(cv.confusion(TRUE, PRED, LABELS), [[1, 1], [0, 2]])

    def test_per_class_precision_and_recall(self):
        pc = cv.per_class(TRUE, PRED, LABELS)
        self.assertAlmostEqual(pc["a"]["precision"], 1.0)
        self.assertAlmostEqual(pc["a"]["recall"], 0.5)
        self.assertAlmostEqual(pc["a"]["f1"], 2 / 3)
        self.assertAlmostEqual(pc["b"]["precision"], 2 / 3)
        self.assertAlmostEqual(pc["b"]["recall"], 1.0)
        self.assertAlmostEqual(pc["b"]["f1"], 0.8)
        self.assertEqual((pc["a"]["support"], pc["b"]["support"]), (2, 2))

    def test_macro_f1(self):
        self.assertAlmostEqual(cv.macro_f1(TRUE, PRED, LABELS), (2 / 3 + 0.8) / 2)

    def test_a_class_never_seen_counts_as_zero(self):
        self.assertAlmostEqual(cv.macro_f1(TRUE, PRED, ("a", "b", "c")), (2 / 3 + 0.8) / 3)

    def test_confident_wrong(self):
        # The one wrong item has confidence 0.8 > 0.5.
        self.assertAlmostEqual(cv.confident_wrong(TRUE, PRED, CONF), 0.25)
        self.assertAlmostEqual(cv.confident_wrong(TRUE, PRED, [0.9, 0.5, 0.4, 0.6]), 0.0, msg="0.5 is not above 0.5")
        self.assertAlmostEqual(cv.confident_wrong(TRUE, PRED, None), 0.25, msg="no confidence: error rate")

    def test_ece(self):
        # Bins 9, 8, 4, 6, one item each: |1-.9| + |0-.8| + |1-.4| + |1-.6| = 1.9, / 4
        self.assertAlmostEqual(cv.ece(TRUE, PRED, CONF), 0.475)
        # A confidence of 1.0 goes in the last bin with 0.95.
        self.assertAlmostEqual(cv.ece(["a", "a"], ["a", "b"], [1.0, 0.95]), abs(0.5 - 0.975))
        self.assertIsNone(cv.ece(TRUE, PRED, None))

    def test_summarise_and_write_results(self):
        oof = []
        for fold in cv.FOLDS:
            oof += [{"seed_id": f"S{fold}a", "fold": fold, "true": "sti", "pred": "sti", "confidence": 0.9},
                    {"seed_id": f"S{fold}b", "fold": fold, "true": "general", "pred": "sti" if fold == 1 else "general",
                     "confidence": 0.7}]
        s = cv.summarise(oof)
        # Fold 1: sti F1 2/3, general F1 0 -> over 6 classes = (2/3)/6; folds 2-5: 2/6.
        self.assertAlmostEqual(s["per_fold_macro_f1"]["1"], (2 / 3) / 6)
        self.assertAlmostEqual(s["per_fold_macro_f1"]["2"], 2 / 6)
        self.assertAlmostEqual(s["confident_wrong"], 0.1)
        self.assertAlmostEqual(s["sti_recall"], 1.0)
        with tempfile.TemporaryDirectory() as tmp:
            cv.write_results("unit", oof, {"x": 1}, out_dir=Path(tmp))
            summary = json.loads((Path(tmp) / "cv_unit.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["candidate"], "unit")
            self.assertIn("python", summary["environment"])
            self.assertEqual(summary["environment"]["fold_file_sha256"], cv.FOLD_SHA256)
            with open(Path(tmp) / "cv_unit_oof.csv", encoding="utf-8", newline="") as f:
                rows = list(csv.DictReader(f))
            self.assertEqual(list(rows[0].keys()), ["seed_id", "fold", "true", "pred", "confidence"])
            self.assertEqual(len(rows), 10)

    def test_no_confidence_is_flagged(self):
        oof = [{"seed_id": f"S{f}", "fold": f, "true": "sti", "pred": "general", "confidence": None} for f in cv.FOLDS]
        s = cv.summarise(oof, has_confidence=False)
        self.assertTrue(s["confident_wrong_is_plain_error_rate"])
        self.assertAlmostEqual(s["confident_wrong"], 1.0)
        self.assertIsNone(s["ece"])


class FrozenData(unittest.TestCase):
    """The real data: 380 seeds, every seed in a fold, 1,239 paraphrases."""

    @classmethod
    def setUpClass(cls):
        cls.data = cv.load_data()

    def test_counts_and_folds(self):
        self.assertEqual(len(self.data["seeds"]), 380)
        self.assertEqual(len(self.data["paraphrases"]), 1239)
        self.assertEqual({s["fold"] for s in self.data["seeds"]}, set(cv.FOLDS))
        self.assertEqual(cv.sha256(cv.FOLD_FILE), cv.FOLD_SHA256)

    def test_paraphrases_follow_their_seed_and_exclusions_are_dropped(self):
        fold = {s["seed_id"]: s["fold"] for s in self.data["seeds"]}
        self.assertTrue(all(p["fold"] == fold[p["seed_id"]] for p in self.data["paraphrases"]))
        ids = {p["id"] for p in self.data["paraphrases"]}
        for excluded in ("SEED-PREG-19-P2", "SEED-PREG-21-P3", "SEED-STI-29-P1"):
            self.assertNotIn(excluded, ids)

    def test_train_and_eval_rows_never_overlap(self):
        for f in cv.FOLDS:
            train = cv.train_rows(self.data, f)
            evals = cv.eval_rows(self.data, f)
            self.assertTrue(evals and all(x["fold"] == f for x in evals))
            self.assertFalse({x["seed_id"] for x in train} & {x["seed_id"] for x in evals})
            self.assertTrue(all(x["id"] == x["seed_id"] for x in evals), "seeds only")

    def test_v1_restore_candidates_take_their_seed_fold(self):
        v1 = cv.load_v1_restore(self.data)
        fold = {s["seed_id"]: s["fold"] for s in self.data["seeds"]}
        self.assertTrue(v1 and all(p["fold"] == fold[p["seed_id"]] for p in v1))
        ids = {p["id"] for p in v1}
        self.assertNotIn("SEED-CONTRA-12-P4", ids)
        self.assertNotIn("SEED-CONTRA-01-P4", ids)

    def test_a_changed_fold_file_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            changed = Path(tmp) / "folds.csv"
            changed.write_bytes(cv.FOLD_FILE.read_bytes() + b"\n")
            with self.assertRaisesRegex(AssertionError, "frozen sha256"):
                cv.load_data(fold_file=changed)


if __name__ == "__main__":
    unittest.main()
