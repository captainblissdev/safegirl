"""Tests for the round 2 one-shot script's checks and scoring
(gate_refit/round2_run.py). Temporary dummy files only; no model is
loaded and the real round 2 files are never read."""

import argparse
import csv
import os
import shutil
import stat
import tempfile
import unittest
from pathlib import Path

from tests.support import V4, load

r2 = load("gate_refit/round2_run")
GATE = V4 / "gate_refit" / "frozen" / "gate_g.json"


def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


class Files(unittest.TestCase):
    """A temporary folder with dummy questions, a read-only label file, the
    real frozen gate (copied) and an absent lock."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.q = self.tmp / "q.csv"
        write_csv(self.q, ["r2_id", "source_row", "source_item_id", "text_sha256", "question_text"],
                  [["T-01", 1, "X1", "h", "dummy one"], ["T-02", 2, "X2", "h", "dummy two"]])
        self.lab = self.tmp / "labels.csv"
        write_csv(self.lab, ["item_id", "question_text", "best_entry_id", "acceptable_entry_ids", "none_fits", "notes"],
                  [["T-01", "dummy one", "KB-C1", "KB-C2", "no", "unsure maybe"], ["T-02", "dummy two", "", "", "yes", "offtopic"]])
        os.chmod(self.lab, stat.S_IREAD)
        for name in ("gate_g.json", "gate_g.sha256"):
            shutil.copy(GATE.parent / name, self.tmp / name)
        self.args = argparse.Namespace(questions=self.q, labels=self.lab, gate=self.tmp / "gate_g.json",
                                       lock=self.tmp / "run.lock", out=self.tmp / "out", dry_run=True,
                                       expect_labels_sha256=None, expect_questions_sha256=None)
        self.expected = {"labels": r2.sha256(self.lab), "questions": r2.sha256(self.q)}

    def tearDown(self):
        os.chmod(self.lab, stat.S_IREAD | stat.S_IWRITE)
        shutil.rmtree(self.tmp)


class Preflight(Files):
    def test_passes(self):
        self.assertEqual(r2.preflight(self.args, self.expected, r2.ROUTING_ID, r2.ROUTING_ID), [])

    def assertAborts(self, fragment, routing=r2.ROUTING_ID, gate_routing=r2.ROUTING_ID, expected=None):
        with self.assertRaises(r2.CheckFailed) as cm:
            r2.preflight(self.args, expected or self.expected, routing, gate_routing)
        self.assertIn(fragment, str(cm.exception))

    def test_wrong_label_hash(self):
        self.assertAborts("label file SHA-256", expected={**self.expected, "labels": "0" * 64})

    def test_writable_label_file(self):
        os.chmod(self.lab, stat.S_IREAD | stat.S_IWRITE)
        self.assertAborts("not read-only")

    def test_wrong_questions_hash(self):
        self.assertAborts("questions file SHA-256", expected={**self.expected, "questions": "0" * 64})

    def test_wrong_gate_hash(self):
        with open(self.args.gate, "ab") as f:
            f.write(b" ")
        self.assertAborts("gate_g.json SHA-256")

    def test_existing_lock(self):
        self.args.lock.write_text("{}", encoding="utf-8")
        self.assertAborts("lock file exists")

    def test_routing_mismatch(self):
        self.assertAborts("routing id", routing="1" * 64)
        self.assertAborts("frozen gate routing", gate_routing="1" * 64)

    def test_lock_refuses_second(self):
        r2.take_lock(self.args.lock, {"x": 1})
        with self.assertRaises(r2.CheckFailed):
            r2.take_lock(self.args.lock, {"x": 2})


class DryRunGuard(Files):
    def test_overrides_need_dry_run(self):
        self.args.dry_run, self.args.expect_labels_sha256 = False, "a" * 64
        with self.assertRaises(r2.CheckFailed):
            r2.dry_run_guard(self.args)

    def test_dry_run_needs_both_hashes(self):
        self.args.expect_labels_sha256 = "a" * 64
        with self.assertRaises(r2.CheckFailed):
            r2.dry_run_guard(self.args)

    def test_dry_run_refuses_real_paths(self):
        self.args.expect_labels_sha256 = self.args.expect_questions_sha256 = "a" * 64
        r2.dry_run_guard(self.args)
        self.args.lock = r2.REAL_LOCK
        with self.assertRaises(r2.CheckFailed):
            r2.dry_run_guard(self.args)
        self.args.lock, self.args.out = self.tmp / "run.lock", r2.REAL_OUT
        with self.assertRaises(r2.CheckFailed):
            r2.dry_run_guard(self.args)


class Inputs(Files):
    def test_load_items(self):
        items = {i["id"]: i for i in r2.load_items(self.q, self.lab)}
        self.assertEqual(items["T-01"]["acceptable"], ["KB-C1", "KB-C2"])
        self.assertEqual((items["T-01"]["tag"], items["T-02"]["tag"]), ("unsure", "offtopic"))
        self.assertFalse(items["T-02"]["acceptable"] or items["T-02"]["should_ask"])

    def test_unlabelled_question_aborts(self):
        write_csv(self.q, ["r2_id", "source_row", "source_item_id", "text_sha256", "question_text"],
                  [["T-09", 9, "X9", "h", "dummy"]])
        with self.assertRaises(r2.CheckFailed):
            r2.load_items(self.q, self.lab)


class LoggedHashes(unittest.TestCase):
    def test_reads_the_decision_log(self):
        h = r2.logged_hashes(r2.DECISION_LOG.read_text(encoding="utf-8"))
        self.assertEqual(h["questions"], r2.REAL_QUESTIONS_SHA256)
        self.assertEqual(h["labels"], "c111d8824603f9713fe3e8862becf69d6785e275732e885ec70f63153467bfb7")


class Scoring(unittest.TestCase):
    def test_outcome(self):
        self.assertEqual(r2.outcome("KB-C1", ["KB-C1"]), "correct_answer")
        self.assertEqual(r2.outcome("KB-C9", ["KB-C1"]), "wrong_answer")
        self.assertEqual(r2.outcome(None, ["KB-C1"]), "missed_answer")
        # A correct entry outside the arm's base leaves no acceptable entry.
        self.assertEqual(r2.outcome(None, []), "correct_abstain")
        self.assertEqual(r2.outcome("KB-C1", []), "wrong_answer")

    def test_mcnemar(self):
        self.assertIsNone(r2.mcnemar_exact(0, 0))
        self.assertAlmostEqual(r2.mcnemar_exact(0, 6), 0.03125)
        self.assertEqual(r2.mcnemar_exact(3, 3), 1.0)

    def item(self, i, tag, a, b, c):
        rec = {"id": f"T-{i}", "tag": tag}
        for arm, o in zip("ABC", (a, b, c)):
            rec[f"{arm}_outcome"] = o
            rec[f"{arm}_kind"] = "served" if o in ("correct_answer", "wrong_answer") else "gate_abstain"
        return rec

    def test_conditions(self):
        per_item = [self.item(1, "", "correct_answer", "correct_answer", "correct_answer"),
                    self.item(2, "", "wrong_answer", "correct_answer", "missed_answer"),
                    self.item(3, "offtopic", "wrong_answer", "correct_abstain", "correct_abstain"),
                    self.item(4, "unsure", "missed_answer", "correct_answer", "missed_answer")]
        res = r2.analyse(per_item, tests_pass=True)
        self.assertEqual(res["counts"]["B"]["correct_answer"], 3)
        self.assertTrue(all(v == "PASS" for v in res["conditions"].values()))
        self.assertEqual(res["verdict"], "B replaces A")
        self.assertEqual(res["condition_3_items"], {"n": 1, "A": 0, "B": 1})
        res = r2.analyse(per_item, tests_pass=False)
        self.assertEqual(res["conditions"]["5 safety, held-topic and help tests pass"], "FAIL")
        self.assertNotEqual(res["verdict"], "B replaces A")


if __name__ == "__main__":
    unittest.main()
