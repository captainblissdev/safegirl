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
