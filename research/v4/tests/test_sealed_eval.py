"""Tests for sealed_eval.py on hand-computed cases and synthetic inputs
built from training seeds. Nothing here reads the sealed set."""

import csv
import io
import json
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import numpy as np

from tests.support import load

se = load("sealed_eval")
cv = se.cv


def write_inputs(folder, rows, labels=None, ambiguous=None):
    """rows: [(id, text, topic_label, route)]; ambiguous, if given, is one
    value per row for an extra ambiguous column. Returns (texts, labels)
    paths."""
    texts, lab = Path(folder) / "texts.csv", Path(folder) / "labels.csv"
    with open(texts, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "text"])
        w.writerows((i, t) for i, t, _, _ in rows)
    with open(lab, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        label_rows = labels or [(i, c, r) for i, _, c, r in rows]
        if ambiguous is None:
            w.writerow(["id", "topic_label", "route"])
            w.writerows(label_rows)
        else:
            w.writerow(["id", "topic_label", "route", "ambiguous"])
            w.writerows((*row, a) for row, a in zip(label_rows, ambiguous))
    return texts, lab


def training_rows(n, prefix, min_len=1):
    """n (id, text, class, "none") rows from the V4 training seeds and
    their paraphrases, never the sealed set."""
    data = cv.load_data()
    pool = [x for x in data["seeds"] + data["paraphrases"] if len(x["text"]) >= min_len][:n]
    return [(f"{prefix}-{i:03d}", x["text"], x["cls"], "none") for i, x in enumerate(pool, 1)]


class ExpectedKinds(unittest.TestCase):
    def test_table(self):
        self.assertEqual(se.expected_kinds("sti", "held"), {"held"})
        self.assertEqual(se.expected_kinds("vague", "safety"), {"referral"})
        self.assertEqual(se.expected_kinds("vague", "none"), {"ask", "help"})
        self.assertEqual(se.expected_kinds("out_of_scope", "none"), {"abstain"})
        for topic in ("contraception", "sti", "pregnancy", "general"):
            self.assertEqual(se.expected_kinds(topic, "none"), {"answer"})
        with self.assertRaises(ValueError):
            se.expected_kinds("ambiguous", "none")


class McNemar(unittest.TestCase):
    def test_known_tables(self):
        # b=1, c=6: n=7, 2 * (C(7,0) + C(7,1)) / 2^7 = 16/128
        self.assertAlmostEqual(se.mcnemar_exact(1, 6), 0.125)
        self.assertAlmostEqual(se.mcnemar_exact(6, 1), 0.125)
        # b=0, c=5: 2 * 1/32
        self.assertAlmostEqual(se.mcnemar_exact(0, 5), 0.0625)
        self.assertEqual(se.mcnemar_exact(0, 0), 1.0)
        self.assertEqual(se.mcnemar_exact(10, 10), 1.0, "capped at 1")


class Metrics(unittest.TestCase):
    TRUE = ["sti", "sti", "pregnancy", "pregnancy", "vague", "general"]
    PRED = ["sti", "pregnancy", "pregnancy", "pregnancy", "general", "general"]

    def codes(self, labels):
        return [cv.CLASSES.index(x) for x in labels]

    def test_vectorised_macro_f1_equals_cv_common(self):
        self.assertAlmostEqual(se.macro_f1_codes(self.codes(self.TRUE), self.codes(self.PRED)),
                               cv.macro_f1(self.TRUE, self.PRED))
        rng = np.random.default_rng(0)
        for _ in range(20):
            t, p = rng.integers(0, 6, 50), rng.integers(0, 6, 50)
            self.assertAlmostEqual(se.macro_f1_codes(t, p),
                                   cv.macro_f1([cv.CLASSES[i] for i in t], [cv.CLASSES[i] for i in p]))

    def test_hand_macro_f1(self):
        # sti: P 1, R .5 -> 2/3; pregnancy: P 2/3, R 1 -> .8; general: P .5, R 1 -> 2/3;
        # vague: 0; contraception and out_of_scope: 0. Sum 2/3 + .8 + 2/3 over 6.
        self.assertAlmostEqual(cv.macro_f1(self.TRUE, self.PRED), (2 / 3 + 0.8 + 2 / 3) / 6)

    def test_classifier_block(self):
        b = se.classifier_block(self.TRUE, self.PRED, [0.9, 0.6, 0.8, 0.7, 0.4, 0.95])
        self.assertAlmostEqual(b["sti_recall"], 0.5)
        self.assertAlmostEqual(b["pregnancy_recall"], 1.0)
        # wrong with confidence > 0.5: item 2 (0.6); item 5 (0.4) is not
        self.assertAlmostEqual(b["confident_wrong"], 1 / 6)
        self.assertIn("ece", b)
        self.assertNotIn("ece", se.classifier_block(self.TRUE, self.PRED))

    def test_reply_block(self):
        items = [{"v4_correct": a, "m1_correct": b, "m2_correct": c} for a, b, c in
                 [(1, 1, 0), (1, 0, 0), (0, 1, 1), (1, 1, 1)]]
        r = se.reply_block(items)
        self.assertEqual(r["correct_rate"], {"v4": 0.75, "m1": 0.75, "m2": 0.5})
        self.assertEqual((r["mcnemar"]["v4_vs_m1"]["v4_right_other_wrong"],
                          r["mcnemar"]["v4_vs_m1"]["v4_wrong_other_right"]), (1, 1))
        self.assertEqual((r["mcnemar"]["v4_vs_m2"]["v4_right_other_wrong"],
                          r["mcnemar"]["v4_vs_m2"]["v4_wrong_other_right"]), (2, 1))


class Bootstrap(unittest.TestCase):
    GOLD = ["sti", "pregnancy", "general", "vague", "out_of_scope", "contraception"] * 5
    A = ["sti", "pregnancy", "general", "vague", "out_of_scope", "contraception"] * 5
    B = ["sti", "general", "general", "general", "general", "contraception"] * 5

    def test_deterministic_with_seed_42(self):
        first = se.paired_bootstrap(self.GOLD, self.A, self.B, n_boot=500)
        second = se.paired_bootstrap(self.GOLD, self.A, self.B, n_boot=500)
        self.assertEqual(first, second)
        self.assertAlmostEqual(first[0], cv.macro_f1(self.GOLD, self.A) - cv.macro_f1(self.GOLD, self.B))
        self.assertLessEqual(first[1], first[0])
        self.assertGreaterEqual(first[2], first[0])

    def test_identical_predictions_give_zero(self):
        self.assertEqual(se.paired_bootstrap(self.GOLD, self.A, self.A, n_boot=200), (0.0, 0.0, 0.0))

    def test_defaults_are_pinned(self):
        self.assertEqual((se.BOOTSTRAP, se.BOOTSTRAP_SEED), (10_000, 42))


class Gate(unittest.TestCase):
    def aggregates(self, v4=(0.80, 0.9, 0.9), m2=(0.70, 0.8, 0.8), ci=(0.02, 0.15), rates=(0.8, 0.7, 0.6)):
        block = lambda f, s, p: {"macro_f1": f, "sti_recall": s, "pregnancy_recall": p}
        return {"classifier": {"all": {"v4": block(*v4), "m2": block(*m2)}}, "bootstrap": {"ci95": list(ci)},
                "reply_kind": {"all": {"correct_rate": dict(zip(("v4", "m1", "m2"), rates))}}}

    def test_all_pass(self):
        g = se.gate(self.aggregates(), "")
        self.assertTrue(g["overall"])

    def test_each_condition_can_fail(self):
        cases = [self.aggregates(v4=(0.74, 0.9, 0.9)),  # gain 0.04
                 self.aggregates(ci=(-0.01, 0.2)),  # interval includes 0
                 self.aggregates(v4=(0.8, 0.7, 0.9)),  # sti recall lower than M2's
                 self.aggregates(rates=(0.7, 0.8, 0.6))]  # reply rate lower than M1's
        for agg in cases:
            self.assertFalse(se.gate(agg, "")["overall"])
        g = se.gate(self.aggregates(), " app/x.js | 2 +-")
        self.assertFalse(g["conditions"]["4 app/ unchanged since the frozen model's commit"]["pass"])
        self.assertFalse(g["overall"])


class Lock(unittest.TestCase):
    def test_second_run_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            texts, labels = write_inputs(tmp, [("X1", "some text here", "sti", "none")])
            lock = se.acquire_lock(labels, texts)
            record = json.loads(lock.read_text(encoding="utf-8"))
            self.assertEqual(set(record), {"timestamp_utc", "frozen_model_sha256", "labels_sha256", "texts_sha256",
                                           "script_sha256"})
            self.assertEqual(record["frozen_model_sha256"], se.sha256(se.FROZEN))
            with self.assertRaises(FileExistsError):
                se.acquire_lock(labels, texts)
            checks, _, _ = se.prerun_checks(texts, labels, dry_run=False, clean=True)
            self.assertIn(("no previous run (no lock next to the labels file)", False, ""), checks)


class PrerunChecks(unittest.TestCase):
    ROWS = [("X1", "first text", "sti", "none"), ("X2", "second text", "vague", "held"),
            ("X3", "third text", "out_of_scope", "safety")]

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.frozen = self.dir / "model.json"
        self.sidecar = self.dir / "model.sha256"
        shutil.copy(se.FROZEN, self.frozen)
        shutil.copy(se.SIDECAR, self.sidecar)
        self.log = self.dir / "log.md"
        shutil.copy(se.DECISION_LOG, self.log)
        self.texts, self.labels = write_inputs(self.dir, self.ROWS)

    def tearDown(self):
        self.tmp.cleanup()

    def checks(self, dry_run=True, **kw):
        args = dict(frozen=self.frozen, sidecar=self.sidecar, log=self.log, clean=True)
        args.update(kw)
        return {name: ok for name, ok, _ in se.prerun_checks(self.texts, self.labels, dry_run=dry_run, **args)[0]}

    def test_good_inputs_pass_in_a_dry_run(self):
        result = self.checks()
        self.assertTrue(all(result.values()), [k for k, v in result.items() if not v])

    def test_hash_mismatch_fails(self):
        self.sidecar.write_text("0" * 64 + "  model.json\n", encoding="utf-8")
        self.assertFalse(self.checks()["frozen model sha256 equals its sidecar"])

    def test_missing_title_fails(self):
        text = self.log.read_text(encoding="utf-8")
        self.log.write_text(text.replace(se.REQUIRED_TITLES[6], "## something else"), encoding="utf-8")
        result = self.checks()
        self.assertFalse(next(v for k, v in result.items() if k.startswith("decision-log entries")))

    def test_dirty_tree_fails(self):
        self.assertFalse(self.checks(clean=False)["git status clean for research/v4 and app"])

    def test_bad_inputs_fail(self):
        write_inputs(self.dir, self.ROWS, labels=[("X1", "sti", "none"), ("X2", "ambiguous", "none"),
                                                  ("X9", "general", "maybe")])
        result = self.checks()
        self.assertFalse(result["same ids in both files, no duplicates"])
        self.assertFalse(result["topic_label filled and one of the six classes"])
        self.assertFalse(result["route is none, held or safety"])

    def test_real_run_needs_205_items(self):
        self.assertFalse(self.checks(dry_run=False)["205 items"])

    def test_inputs_inside_the_repo_fail(self):
        result = {n: ok for n, ok, _ in se.prerun_checks(se.FROZEN, se.SIDECAR, dry_run=True, frozen=self.frozen,
                                                         sidecar=self.sidecar, log=self.log, clean=True)[0]}
        self.assertFalse(result["input files are outside the repository"])


class AmbiguousColumn(unittest.TestCase):
    ROWS = [("X1", "first text", "sti", "none"), ("X2", "second text", "vague", "held"),
            ("X3", "third text", "out_of_scope", "safety")]

    def check(self, ambiguous):
        with tempfile.TemporaryDirectory() as tmp:
            texts, labels = write_inputs(tmp, self.ROWS, ambiguous=ambiguous)
            checks, _, read = se.prerun_checks(texts, labels, dry_run=True, clean=True)
        name = "ambiguous is 0 or 1 (0 when the column is absent)"
        return next((ok, detail) for n, ok, detail in checks if n == name), read

    def test_absent_column_flags_nothing(self):
        (ok, detail), read = self.check(None)
        self.assertTrue(ok)
        self.assertEqual(detail, "0 flagged")
        self.assertEqual([a for _, _, _, a in read], ["0", "0", "0"])

    def test_present_column(self):
        (ok, detail), read = self.check(["0", "1", "0"])
        self.assertTrue(ok)
        self.assertEqual(detail, "1 flagged")
        self.assertEqual([a for _, _, _, a in read], ["0", "1", "0"])

    def test_bad_values_fail(self):
        for bad in (["0", "yes", "0"], ["0", "", "1"], ["2", "0", "0"], ["true", "0", "0"]):
            (ok, _), _ = self.check(bad)
            self.assertFalse(ok, bad)


class CheckOnly(unittest.TestCase):
    """Without --confirm-final (and without --dry-run) the script prints
    the checklist and stops: no lock, no outputs, nothing computed."""

    def run_main(self, rows, extra=()):
        with tempfile.TemporaryDirectory() as tmp:
            texts, labels = write_inputs(tmp, rows)
            console = io.StringIO()
            with mock.patch.object(se, "git_clean", return_value=True), \
                    mock.patch.object(se, "run", side_effect=AssertionError("computed")) as run, \
                    redirect_stdout(console):
                code = se.main(["--texts", str(texts), "--labels", str(labels), *extra])
            left = sorted(p.name for p in Path(tmp).iterdir())
        return code, console.getvalue(), left, run

    def test_all_checks_pass_then_stops(self):
        code, out, left, run = self.run_main(training_rows(se.EXPECTED_N, "CHK"))
        self.assertEqual(code, 3)
        self.assertIn("Pre-run checks:", out)
        self.assertNotIn("[FAIL]", out)
        self.assertIn("CHECK ONLY", out)
        self.assertEqual(left, ["labels.csv", "texts.csv"], "no lock and no outputs")
        run.assert_not_called()

    def test_failed_check_stops_even_with_confirm(self):
        code, out, left, run = self.run_main(training_rows(3, "CHK"), extra=("--confirm-final",))
        self.assertEqual(code, 2)
        self.assertIn("[FAIL] 205 items", out)
        self.assertEqual(left, ["labels.csv", "texts.csv"])
        run.assert_not_called()


class NoTextInOutputs(unittest.TestCase):
    """A dry run on 12 real training seeds: nothing printed or written
    contains their text, and nothing is written in the repository."""

    def test_dry_run_outputs(self):
        data = cv.load_data()
        by_class = {}
        for s in data["seeds"]:
            if len(s["text"]) >= 20 and len(by_class.setdefault(s["cls"], [])) < 2:
                by_class[s["cls"]].append(s)
        seeds = [s for group in by_class.values() for s in group]
        rows = [(f"DRY-{i:02d}", s["text"], s["cls"], "none") for i, s in enumerate(seeds)]
        flags = ["1" if i < 2 else "0" for i in range(len(rows))]
        repo_results = se.RESULTS / "sealed_result.json"
        existed = repo_results.exists()
        with tempfile.TemporaryDirectory() as tmp:
            texts, labels = write_inputs(tmp, rows, ambiguous=flags)
            console = io.StringIO()
            with redirect_stdout(console):
                result = se.run(se.read_texts(texts), se.read_labels(labels), labels, texts, dry_run=True)
                print(se.markdown(result, True))
            outputs = [p.read_text(encoding="utf-8") for p in Path(tmp).iterdir()
                       if p.name not in ("texts.csv", "labels.csv")]
            self.assertEqual(len(outputs), 3, "aggregates .json and .md, and per-item predictions")
        everything = console.getvalue() + "".join(outputs)
        self.assertEqual([i for i, t, _, _ in rows if t in everything], [])
        self.assertEqual(repo_results.exists(), existed, "a dry run writes nothing in the repository")
        a = result["aggregates"]
        self.assertEqual(a["counts"]["items"], len(rows))
        self.assertTrue(result["dry_run"])
        # the gate uses all items; the flagged two are left out only descriptively
        self.assertEqual(a["counts"]["ambiguous"], 2)
        self.assertEqual(a["classifier"]["all"]["v4"]["n"], len(rows))
        self.assertEqual(a["descriptive_without_ambiguous"]["n"], len(rows) - 2)
        self.assertEqual(a["descriptive_without_ambiguous"]["classifier"]["v4"]["n"], len(rows) - 2)
        self.assertIn("## Descriptive: without the items flagged ambiguous (n = 10; 2 flagged)",
                      se.markdown(result, True))


if __name__ == "__main__":
    unittest.main()
