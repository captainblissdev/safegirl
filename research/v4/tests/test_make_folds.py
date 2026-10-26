"""Unit tests for make_folds.py, on synthetic seeds."""

import csv
import io
import random
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from tests.support import SEED_HEADER, load, seed, write_csv

make_folds = load("make_folds")

CLASSES = ["contraception", "sti", "pregnancy", "general", "out_of_scope", "vague"]
STYLES = ["formal", "colloquial", "symptom_only", "euphemism", "myth_or_worry", "short_or_misspelt"]


def synthetic_seeds(n=137):
    rng = random.Random(1)
    return [
        {"seed_id": f"V4-{i:03d}", "primary_class": rng.choice(CLASSES), "style": rng.choice(STYLES)}
        for i in range(n)
    ]


class AssignFolds(unittest.TestCase):
    def setUp(self):
        self.seeds = synthetic_seeds()
        self.folds = make_folds.assign_folds(self.seeds)

    def test_every_seed_in_exactly_one_fold(self):
        self.assertEqual(sorted(self.folds), sorted(s["seed_id"] for s in self.seeds))
        self.assertTrue(all(f in range(1, 6) for f in self.folds.values()))

    def test_no_seed_appears_in_two_folds_in_the_written_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "folds.csv"
            make_folds.write_assignment(path, self.seeds, self.folds)
            with open(path, encoding="utf-8", newline="") as f:
                rows = list(csv.DictReader(f))
        ids = Counter(row["seed_id"] for row in rows)
        self.assertEqual(max(ids.values()), 1)
        self.assertEqual(len(rows), len(self.seeds))

    def test_each_class_x_style_stratum_is_spread_evenly(self):
        by_stratum = {}
        for s in self.seeds:
            key = (s["primary_class"], s["style"])
            by_stratum.setdefault(key, [0] * 5)[self.folds[s["seed_id"]] - 1] += 1
        for key, counts in by_stratum.items():
            self.assertLessEqual(max(counts) - min(counts), 1, key)
        sizes = Counter(self.folds.values())
        self.assertLessEqual(max(sizes.values()) - min(sizes.values()), 1)

    def test_deterministic_and_independent_of_row_order(self):
        shuffled = list(self.seeds)
        random.Random(7).shuffle(shuffled)
        self.assertEqual(make_folds.assign_folds(shuffled), self.folds)
        self.assertNotEqual(make_folds.assign_folds(self.seeds, random_seed=1), self.folds)

    def test_duplicate_seed_id_fails(self):
        with self.assertRaisesRegex(ValueError, "duplicate seed_id"):
            make_folds.assign_folds(self.seeds + [dict(self.seeds[0])])


class Paraphrases(unittest.TestCase):
    def test_every_paraphrase_is_in_its_seeds_fold(self):
        seeds = synthetic_seeds(40)
        folds = make_folds.assign_folds(seeds)
        paraphrases = [
            {"seed_id": s["seed_id"], "paraphrase_id": f"{s['seed_id']}-P{k}", "text": "x"}
            for s in seeds
            for k in range(1, 5)
        ]
        by_example = make_folds.fold_of_examples(folds, paraphrases)
        for p in paraphrases:
            self.assertEqual(by_example[p["paraphrase_id"]], folds[p["seed_id"]])
        # A seed and all its paraphrases share one fold.
        for s in seeds:
            group = {folds[s["seed_id"]]} | {
                by_example[f"{s['seed_id']}-P{k}"] for k in range(1, 5)
            }
            self.assertEqual(len(group), 1)

    def test_a_paraphrase_of_an_unknown_seed_fails(self):
        folds = make_folds.assign_folds(synthetic_seeds(10))
        with self.assertRaisesRegex(ValueError, "V4-999"):
            make_folds.fold_of_examples(folds, [{"seed_id": "V4-999", "paraphrase_id": "V4-999-P1", "text": "x"}])


class V3AndV4Together(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        write_csv(self.dir / "b1.csv", SEED_HEADER,
                  [seed(f"V4-A{i}", f"Question a{i}?", style=STYLES[i % 6]) for i in range(10)])
        write_csv(self.dir / "b2.csv", SEED_HEADER,
                  [seed(f"V4-B{i}", f"Question b{i}?", cls="vague", style="colloquial",
                        source="design rule") for i in range(5)])
        write_csv(self.dir / "v3.csv", ["seed_id", "class", "text"],
                  [[f"SEED-STI-{i:02d}", "sti", f"V3 question {i}?"] for i in range(1, 8)]
                  + [[f"SEED-GEN-{i:02d}", "general", f"V3 general {i}?"] for i in range(1, 4)])
        write_csv(self.dir / "v3_para.csv", ["seed_id", "paraphrase_id", "class", "text"],
                  [["SEED-STI-01", "SEED-STI-01-P1", "sti", "x"]])
        self.out = self.dir / "folds.csv"

    def tearDown(self):
        self.tmp.cleanup()

    def run_main(self, extra=()):
        out = io.StringIO()
        code = make_folds.main(
            [str(self.dir / "b1.csv"), str(self.dir / "b2.csv"), "--v3-seeds", str(self.dir / "v3.csv"),
             "--out", str(self.out), *extra], out)
        return code, out.getvalue()

    def rows(self):
        with open(self.out, encoding="utf-8", newline="") as f:
            return list(csv.DictReader(f))

    def test_several_seed_files_and_the_v3_seeds(self):
        code, printed = self.run_main(["--paraphrases", str(self.dir / "v3_para.csv")])
        self.assertEqual(code, 0, printed)
        self.assertIn("25 seeds (v4 15, v3 10)", printed)
        rows = self.rows()
        self.assertEqual(list(rows[0].keys()), make_folds.COLUMNS)
        self.assertEqual(len(rows), 25)
        self.assertEqual(Counter(r["source"] for r in rows), Counter({"v4": 15, "v3": 10}))
        v3 = [r for r in rows if r["source"] == "v3"]
        self.assertTrue(all(r["style"] == "v3_unlabelled" for r in v3))
        self.assertEqual(Counter(r["primary_class"] for r in v3), Counter({"sti": 7, "general": 3}))
        # Every V3 seed is assigned, with or without paraphrases.
        self.assertEqual({r["seed_id"] for r in v3},
                         {f"SEED-STI-{i:02d}" for i in range(1, 8)} | {f"SEED-GEN-{i:02d}" for i in range(1, 4)})

    def test_stratified_by_class_and_style_and_deterministic(self):
        self.run_main()
        first = self.out.read_text(encoding="utf-8")
        rows = self.rows()
        strata = {}
        for r in rows:
            strata.setdefault((r["primary_class"], r["style"]), [0] * 5)[int(r["fold"]) - 1] += 1
        for key, counts in strata.items():
            self.assertLessEqual(max(counts) - min(counts), 1, key)
        self.run_main()
        self.assertEqual(self.out.read_text(encoding="utf-8"), first)

    def test_paraphrases_must_name_a_folded_seed(self):
        write_csv(self.dir / "bad.csv", ["seed_id", "paraphrase_id", "class", "text"],
                  [["SEED-STI-99", "SEED-STI-99-P1", "sti", "x"]])
        code, printed = self.run_main(["--paraphrases", str(self.dir / "bad.csv")])
        self.assertEqual(code, 1)
        self.assertIn("SEED-STI-99", printed)

    def test_a_seed_id_in_two_files_fails(self):
        write_csv(self.dir / "b2.csv", SEED_HEADER, [seed("V4-A1", "Duplicate?")])
        code, printed = self.run_main()
        self.assertEqual(code, 1)
        self.assertIn("duplicate seed_id", printed)


class CommandLine(unittest.TestCase):
    def test_writes_the_assignment_and_checks_paraphrases(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            write_csv(
                tmp / "seeds.csv",
                SEED_HEADER,
                [seed(f"V4-{i}", f"Question {i}?", style=STYLES[i % 6]) for i in range(12)],
            )
            write_csv(
                tmp / "para.csv",
                ["seed_id", "paraphrase_id", "class", "text"],
                [["V4-1", "V4-1-P1", "sti", "Another way?"]],
            )
            out = io.StringIO()
            code = make_folds.main(
                [str(tmp / "seeds.csv"), "--paraphrases", str(tmp / "para.csv"), "--out", str(tmp / "f.csv")],
                out,
            )
            self.assertEqual(code, 0, out.getvalue())
            self.assertIn("12 seeds", out.getvalue())
            self.assertEqual(len((tmp / "f.csv").read_text(encoding="utf-8").splitlines()), 13)

            write_csv(
                tmp / "bad.csv",
                ["seed_id", "paraphrase_id", "class", "text"],
                [["V4-77", "V4-77-P1", "sti", "Orphan?"]],
            )
            out = io.StringIO()
            code = make_folds.main(
                [str(tmp / "seeds.csv"), "--paraphrases", str(tmp / "bad.csv"), "--out", str(tmp / "g.csv")],
                out,
            )
            self.assertEqual(code, 1)
            self.assertFalse((tmp / "g.csv").exists())


if __name__ == "__main__":
    unittest.main()
