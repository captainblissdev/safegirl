"""Tests for v3_comparison.py on hand-computed cases and synthetic inputs
built from training seeds. Nothing here reads the sealed set."""

import csv
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import numpy as np

from tests.support import load

vc = load("v3_comparison")
cv = vc.cv


def write_inputs(folder, rows):
    """rows: [(id, text, topic_label, route)]."""
    texts, labels = Path(folder) / "texts.csv", Path(folder) / "labels.csv"
    with open(texts, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "text"])
        w.writerows((i, t) for i, t, _, _ in rows)
    with open(labels, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "topic_label", "route", "ambiguous"])
        w.writerows((i, c, r, "0") for i, _, c, r in rows)
    return texts, labels


def training_rows(n, prefix, min_len=1):
    data = cv.load_data()
    pool = [x for x in data["seeds"] + data["paraphrases"] if len(x["text"]) >= min_len][:n]
    return [(f"{prefix}-{i:03d}", x["text"], x["cls"], "none") for i, x in enumerate(pool, 1)]


class Rules(unittest.TestCase):
    V4_CLASSES = ["contraception", "general", "out_of_scope", "pregnancy", "sti", "vague"]

    def test_restricted_argmax_over_four(self):
        # six-class argmax is out_of_scope (0.5); among the topics sti wins
        p = [0.05, 0.1, 0.5, 0.05, 0.2, 0.1]
        cls, conf = vc.restricted(p, self.V4_CLASSES)
        self.assertEqual(cls, "sti")
        self.assertAlmostEqual(conf, 0.2 / (0.05 + 0.1 + 0.05 + 0.2))

    def test_restricted_keeps_a_topic_argmax(self):
        cls, conf = vc.restricted([0.7, 0.1, 0.05, 0.05, 0.05, 0.05], self.V4_CLASSES)
        self.assertEqual(cls, "contraception")
        self.assertAlmostEqual(conf, 0.7 / 0.9)

    def test_v3_abstain_rule(self):
        self.assertEqual(vc.v3_kind("", 0.34), "abstain")
        self.assertEqual(vc.v3_kind("", 0.35), "answer", "exactly 0.35 is not below it")
        self.assertEqual(vc.v3_kind("", 0.99), "answer")
        self.assertEqual(vc.v3_kind("held_C", 0.99), "held")
        self.assertEqual(vc.v3_kind("referral", 0.1), "referral")
        self.assertEqual(vc.v3_kind("vague_rule", 0.9), "ask")


class Metrics(unittest.TestCase):
    TRUE = ["sti", "sti", "pregnancy", "pregnancy", "general", "contraception"]
    PRED = ["sti", "out_of_scope", "pregnancy", "general", "general", "contraception"]
    CONF = [0.9, 0.8, 0.7, 0.6, 0.95, 0.4]

    def test_block_by_hand(self):
        b = vc.block(self.TRUE, self.PRED, self.CONF, cols=cv.CLASSES)
        self.assertAlmostEqual(b["accuracy"], 4 / 6)
        # sti: P 1, R .5 -> 2/3; pregnancy: P 1, R .5 -> 2/3; general: P .5, R 1 -> 2/3; contraception: 1
        self.assertAlmostEqual(b["macro_f1"], (2 / 3 * 3 + 1) / 4)
        self.assertAlmostEqual(b["per_class"]["sti"]["recall"], 0.5)
        self.assertAlmostEqual(b["per_class"]["general"]["precision"], 0.5)
        # wrong with confidence > 0.5: items 2 (0.8) and 4 (0.6)
        self.assertAlmostEqual(b["confident_wrong"], 2 / 6)
        self.assertEqual(b["confusion"]["matrix"][vc.TOPICS.index("sti")][cv.CLASSES.index("out_of_scope")], 1)
        self.assertEqual(len(b["confusion"]["cols"]), 6)

    def test_vectorised_macro_equals_block(self):
        index = {c: i for i, c in enumerate(cv.CLASSES)}
        self.assertAlmostEqual(vc.macro_f1_topics([index[x] for x in self.TRUE], [index[x] for x in self.PRED]),
                               vc.block(self.TRUE, self.PRED, self.CONF, cols=cv.CLASSES)["macro_f1"])
        rng = np.random.default_rng(1)
        for _ in range(20):
            t, p = rng.integers(0, 4, 40), rng.integers(0, 6, 40)
            tl, pl = [cv.CLASSES[i] for i in t], [cv.CLASSES[i] for i in p]
            self.assertAlmostEqual(vc.macro_f1_topics(t, p), vc.block(tl, pl, [0.9] * 40, cols=cv.CLASSES)["macro_f1"])

    def test_mcnemar(self):
        r = vc.mcnemar([1, 1, 0, 1, 0, 1, 1], [0, 0, 0, 1, 1, 0, 0])
        # a right, b wrong: items 0, 1, 5, 6 -> 4; a wrong, b right: item 4 -> 1
        self.assertEqual((r["a_right_b_wrong"], r["a_wrong_b_right"]), (4, 1))
        self.assertAlmostEqual(r["p_exact"], 2 * (1 + 5) / 32)

    def test_bootstrap_deterministic(self):
        t = ["sti", "pregnancy", "general", "contraception"] * 6
        a = ["sti", "pregnancy", "general", "contraception"] * 6
        b = ["sti", "general", "general", "general"] * 6
        first = vc.paired_bootstrap(t, a, b, n_boot=300)
        self.assertEqual(first, vc.paired_bootstrap(t, a, b, n_boot=300))
        self.assertEqual(vc.paired_bootstrap(t, a, a, n_boot=100), (0.0, 0.0, 0.0))
        self.assertLessEqual(first[1], first[0])
        self.assertGreaterEqual(first[2], first[0])


class LockAndChecks(unittest.TestCase):
    def test_second_run_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            texts, labels = write_inputs(tmp, [("X1", "some text here", "sti", "none")])
            lock = vc.acquire_lock(labels, texts)
            self.assertIn("v3_checkpoint_sha256", json.loads(lock.read_text(encoding="utf-8")))
            with self.assertRaises(FileExistsError):
                vc.acquire_lock(labels, texts)

    def run_main(self, rows, extra=()):
        with tempfile.TemporaryDirectory() as tmp:
            texts, labels = write_inputs(tmp, rows)
            console = io.StringIO()
            with mock.patch.object(vc.se, "git_clean", return_value=True), \
                    mock.patch.object(vc, "run", side_effect=AssertionError("computed")) as run, \
                    redirect_stdout(console):
                code = vc.main(["--texts", str(texts), "--labels", str(labels), *extra])
            left = sorted(p.name for p in Path(tmp).iterdir())
        return code, console.getvalue(), left, run

    def test_check_only_mode(self):
        code, out, left, run = self.run_main(training_rows(205, "CHK"))
        self.assertEqual(code, 3)
        self.assertNotIn("[FAIL]", out)
        self.assertIn("[PASS] V3 checkpoint sha256 is the one in the decision log", out)
        self.assertIn("CHECK ONLY", out)
        self.assertEqual(left, ["labels.csv", "texts.csv"])
        run.assert_not_called()

    def test_failed_check_stops(self):
        code, out, left, run = self.run_main(training_rows(3, "CHK"), extra=("--confirm-final",))
        self.assertEqual(code, 2)
        self.assertIn("[FAIL] 205 items", out)
        self.assertEqual(left, ["labels.csv", "texts.csv"])
        run.assert_not_called()

    def test_v3_hash_must_be_in_the_log(self):
        with tempfile.TemporaryDirectory() as tmp:
            texts, labels = write_inputs(tmp, [("X1", "some text here", "sti", "none")])
            log = Path(tmp) / "log.md"
            log.write_text(vc.se.DECISION_LOG.read_text(encoding="utf-8").replace(vc.sha256(vc.V3_WEIGHTS), "x"),
                           encoding="utf-8")
            checks, _, _ = vc.prerun_checks(texts, labels, dry_run=True, log=log, clean=True)
        self.assertFalse(dict((n, ok) for n, ok, _ in checks)["V3 checkpoint sha256 is the one in the decision log"])


class NoTextInOutputs(unittest.TestCase):
    """A dry run on real training seeds through both models: nothing
    printed or written contains their text, nothing lands in the repo."""

    def test_dry_run_outputs(self):
        data = cv.load_data()
        by_class = {}
        for s in data["seeds"]:
            if len(s["text"]) >= 20 and len(by_class.setdefault(s["cls"], [])) < 2:
                by_class[s["cls"]].append(s)
        rows = [(f"DRY-{i:02d}", s["text"], s["cls"], "none") for i, s in
                enumerate(s for group in by_class.values() for s in group)]
        repo_results = vc.RESULTS / "sealed_v3_comparison.json"
        existed = repo_results.exists()
        with tempfile.TemporaryDirectory() as tmp:
            texts, labels = write_inputs(tmp, rows)
            console = io.StringIO()
            with redirect_stdout(console):
                result = vc.run(vc.se.read_texts(texts), vc.se.read_labels(labels), labels, texts, dry_run=True)
                print(vc.markdown(result, True))
            outputs = [p.read_text(encoding="utf-8") for p in Path(tmp).iterdir()
                       if p.name not in ("texts.csv", "labels.csv")]
        self.assertEqual(len(outputs), 3)
        everything = console.getvalue() + "".join(outputs)
        self.assertEqual([i for i, t, _, _ in rows if t in everything], [])
        self.assertEqual(repo_results.exists(), existed)
        a = result["aggregates"]
        self.assertEqual(a["counts"]["four_class_items"], 8, "2 seeds in each of V3's four classes")
        self.assertEqual(a["four_classes"]["all"]["v3"]["n"], 8)
        self.assertEqual(a["reply_kind"]["all"]["n"], len(rows))


if __name__ == "__main__":
    unittest.main()
