"""Tests for fresh_test_run.py with SYNTHETIC data only (no fresh question,
label or lock file is read).

Run: .venv/Scripts/python.exe -I -m unittest discover -s research/eval/tests -t research/eval/tests
"""

import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fresh_test_run as ft  # noqa: E402

IDS = ["KB-C1", "KB-C2", "KB-S1", "KB-G1"]
CLASSES = ["contraception", "contraception", "sti", "general"]


def q(group, a, b):
    return {"source_row": 1, "group": group, "arm_a": {"outcome": a}, "arm_b": {"outcome": b}}


class Arms(unittest.TestCase):
    def test_acceptable_ids_are_mapped_to_the_arm_base(self):
        self.assertEqual(ft.arm_acceptable(["KB-C18", "KB-C4"], {"KB-C4", "KB-C5"}), ["KB-C4"])
        self.assertEqual(ft.arm_acceptable(["KB-C18"], {"KB-C4"}), [])

    def test_v4_routing(self):
        self.assertEqual(ft.route_v4("held", "sti", 0.9), "held")
        self.assertEqual(ft.route_v4("retrieve", "vague", 0.9), "clarify")
        self.assertEqual(ft.route_v4("retrieve", "out_of_scope", 0.9), "v4_abstain")
        self.assertEqual(ft.route_v4("retrieve", "sti", 0.44), "v4_abstain")
        self.assertEqual(ft.route_v4("retrieve", "sti", 0.47), "retrieve_unscoped")
        self.assertEqual(ft.route_v4("retrieve", "sti", 0.5), "retrieve_scoped")

    def test_retrieval_scoped_and_unscoped(self):
        scores = np.array([0.80, 0.85, 0.90, 0.70])
        scoped = ft.retrieve(scores, IDS, CLASSES, "retrieve_scoped", "contraception")
        self.assertEqual(scoped["entry"], "KB-C2")
        self.assertAlmostEqual(scoped["s1"], 0.90)
        self.assertAlmostEqual(scoped["margin"], 0.05)
        self.assertEqual(scoped["agree"], 1.0)
        unscoped = ft.retrieve(scores, IDS, CLASSES, "retrieve_unscoped", "contraception")
        self.assertEqual((unscoped["entry"], unscoped["agree"]), ("KB-S1", 0.0))

    def test_gates(self):
        self.assertTrue(ft.gate_a({"s1": 0.8439}))
        self.assertFalse(ft.gate_a({"s1": 0.8438}))
        frozen = {"params": {"logistic": {"constant": 0}, "with_v4": True}}
        self.assertFalse(ft.gate_b({"s1": 1.0, "margin": 1.0, "agree": 1.0}, frozen))

    def test_the_four_outcomes(self):
        self.assertEqual(ft.outcome("KB-C1", ["KB-C1"]), "correct_answer")
        self.assertEqual(ft.outcome("KB-C2", ["KB-C1"]), "wrong_answer")
        self.assertEqual(ft.outcome("KB-C2", []), "wrong_answer")
        self.assertEqual(ft.outcome(None, []), "correct_abstain")
        self.assertEqual(ft.outcome(None, ["KB-C1"]), "missed_answer")


class Criteria(unittest.TestCase):
    OFF = "Not about reproductive health at all"

    def test_all_hold(self):
        per_q = [q("Pregnancy", "correct_answer", "correct_answer"),
                 q("Pregnancy", "missed_answer", "correct_answer"),
                 q(self.OFF, "wrong_answer", "correct_abstain")]
        counts, crit, verdict = ft.criteria(per_q, True, True)
        self.assertEqual((crit["a"]["arm_a"], crit["a"]["arm_b"]), (1, 2))
        self.assertEqual((crit["b"]["arm_a"], crit["b"]["arm_b"]), (1, 0))
        self.assertEqual((crit["c"]["questions"], crit["c"]["arm_a"], crit["c"]["arm_b"]), (1, 0, 1))
        self.assertTrue(all(crit[k]["holds"] for k in "abcd"))
        self.assertEqual(verdict, "the 62-entry base replaces the 21 in the demo")
        self.assertEqual(counts["arm_b"]["correct_answer"], 2)

    def test_each_criterion_can_fail(self):
        fewer_correct = [q("Pregnancy", "correct_answer", "missed_answer")]
        more_wrong = [q("Pregnancy", "missed_answer", "wrong_answer")]
        less_abstain = [q("Too vague to answer", "correct_abstain", "wrong_answer")]
        self.assertFalse(ft.criteria(fewer_correct, True, True)[1]["a"]["holds"])
        self.assertFalse(ft.criteria(more_wrong, True, True)[1]["b"]["holds"])
        self.assertFalse(ft.criteria(less_abstain, True, True)[1]["c"]["holds"])
        ok = [q("Pregnancy", "correct_answer", "correct_answer")]
        self.assertFalse(ft.criteria(ok, False, True)[1]["d"]["holds"])
        self.assertFalse(ft.criteria(ok, True, False)[1]["d"]["holds"])
        self.assertEqual(ft.criteria(ok, True, False)[2], "the demo stays on 21 entries")

    def test_mcnemar_and_paired_table(self):
        self.assertIsNone(ft.mcnemar_exact(0, 0))
        self.assertAlmostEqual(ft.mcnemar_exact(0, 5), 2 / 32)
        self.assertEqual(ft.mcnemar_exact(3, 3), 1.0)
        t = ft.paired([True, True, False, False], [True, False, True, True])
        self.assertEqual((t["both"], t["only_arm_a"], t["only_arm_b"], t["neither"]), (1, 1, 2, 0))


class Checks(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())

    def tearDown(self):
        import shutil
        shutil.rmtree(self.dir, ignore_errors=True)

    def test_the_lock_is_taken_once(self):
        lock = self.dir / ft.LOCK_NAME
        ft.take_lock(lock, {"synthetic": True})
        self.assertTrue(lock.exists())
        with self.assertRaises(ft.CheckFailed):
            ft.take_lock(lock, {"synthetic": True})

    def test_hash_and_sidecar_checks(self):
        f = self.dir / "frozen.json"
        f.write_text("{}", encoding="utf-8")
        digest = hashlib.sha256(b"{}").hexdigest()
        (self.dir / "frozen.sha256").write_text(f"{digest}  frozen.json\n", encoding="utf-8")
        ft.check_sidecar(f, digest, "synthetic")
        with self.assertRaises(ft.CheckFailed):
            ft.check_sidecar(f, "0" * 64, "synthetic")
        f.write_text("{ }", encoding="utf-8")
        with self.assertRaises(ft.CheckFailed):
            ft.check_sidecar(f, digest, "synthetic")
        with self.assertRaises(ft.CheckFailed):
            ft.check_hash("synthetic", "ab", "cd")

    def test_labels_must_match_the_fresh_rows_and_schema(self):
        fresh = [{"source_row": "3"}, {"source_row": "7"}]
        good = [{"source_row": "3", "group": "g", "acceptable_entry_ids": "KB-C1", "expected": "ANSWER",
                 "expected_class": "contraception", "notes": ""},
                {"source_row": "7", "group": "g", "acceptable_entry_ids": "", "expected": "NONE_FITS",
                 "expected_class": "none", "notes": ""}]
        ft.check_labels(good, ft.LABEL_COLUMNS, fresh)
        with self.assertRaises(ft.CheckFailed):
            ft.check_labels(good, ["source_row", "group"], fresh)
        with self.assertRaises(ft.CheckFailed):
            ft.check_labels(good[:1], ft.LABEL_COLUMNS, fresh)
        with self.assertRaises(ft.CheckFailed):
            ft.check_labels([good[0], dict(good[0])], ft.LABEL_COLUMNS, fresh)
        bad = [dict(good[0], expected="NONE_FITS"), good[1]]
        with self.assertRaises(ft.CheckFailed):
            ft.check_labels(bad, ft.LABEL_COLUMNS, fresh)

    def test_outputs_must_be_outside_the_repository(self):
        self.assertTrue(ft.inside_repo(ft.REPO / "research"))
        self.assertFalse(ft.inside_repo(self.dir))
        self.assertEqual(ft.main(["--labels", str(self.dir / "l.csv"), "--out", str(ft.REPO / "x")]), 2)


if __name__ == "__main__":
    unittest.main()
