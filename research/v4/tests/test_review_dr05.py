"""Unit tests for review_dr05.py, on a small synthetic repository."""

import csv
import io
import tempfile
import unittest
from pathlib import Path

import numpy as np

from tests.support import SEED_HEADER, fake_embed, load, make_repo, seed, write_csv

review = load("review_dr05")


def distinct_embed(texts):
    """Orthogonal vectors by position: identical texts get cosine 0."""
    out = np.zeros((len(texts), len(texts)))
    np.fill_diagonal(out, 1.0)
    return out


class Pool(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = make_repo(self.tmp.name)
        v4 = self.root / "research" / "v4"
        write_csv(v4 / "v3_pool_exclusions.csv", ["item_id", "kind", "file", "reason", "evidence"],
                  [["SEED-STI-01-P1", "reviewed paraphrase", "x", "near DR-04", "test"]])
        write_csv(v4 / "seeds_v4_batch1.csv", SEED_HEADER, [
            seed("SEED-V4-GEN-001", "Kilo lima mike november oscar?", cls="general", source="Doc, p. 1"),
            seed("SEED-V4-OOS-001", "Raven sable thistle umber?", cls="out_of_scope", source="design rule"),
        ])
        write_csv(v4 / "seeds_v4_batch2.csv", SEED_HEADER, [
            seed("SEED-V4-VAG-001", "thistle umber raven sable", cls="vague", source="design rule"),
        ])
        write_csv(self.root / "resources" / "reviewed" / "v4" / "v4_batch1_paraphrases.csv",
                  ["seed_id", "paraphrase_id", "class", "text"],
                  [["SEED-V4-GEN-001", "SEED-V4-GEN-001-P1", "general", "Walnut basil cedar pine thyme?"]])

    def tearDown(self):
        self.tmp.cleanup()

    def test_pool_tags_classes_and_exclusions(self):
        pool = review.build_pool(self.root)
        tags = {(p["tag"], p["id"]): p["class"] for p in pool}
        self.assertEqual(tags[("v3", "SEED-STI-01")], "sti")
        self.assertNotIn(("v3", "SEED-STI-01-P1"), tags, "excluded V3 paraphrase")
        self.assertEqual(tags[("v4_seed", "SEED-V4-OOS-001")], "out_of_scope")
        self.assertEqual(tags[("v4_seed", "SEED-V4-VAG-001")], "vague")
        self.assertEqual(tags[("v4_para", "SEED-V4-GEN-001-P1")], "general")
        self.assertEqual(tags[("v1_cand", "SEED-GEN-01-P1")], "general")
        self.assertFalse(any(p["tag"] == "v3" and p["id"].startswith("SEED-V4") for p in pool),
                         "the V3 pool does not read reviewed/v4/")

    def test_only_cross_class_pairs_at_the_limit(self):
        pairs = review.find_pairs(review.build_pool(self.root), fake_embed)
        found = {(p["id_a"], p["id_b"]) for p in pairs}
        # out_of_scope vs vague, same words: reported.
        self.assertIn(("SEED-V4-OOS-001", "SEED-V4-VAG-001"), found)
        # V3 general seed vs V4 general seed, identical text: same class, not reported.
        self.assertFalse(any({p["id_a"], p["id_b"]} == {"SEED-GEN-01", "SEED-V4-GEN-001"} for p in pairs))
        # V4 general paraphrase vs V1 general candidate, same words: same class, not reported.
        self.assertFalse(any("SEED-GEN-01-P1" in (p["id_a"], p["id_b"]) for p in pairs))
        self.assertTrue(all(p["class_a"] != p["class_b"] and p["cosine"] >= 0.93 for p in pairs))

    def test_exact_duplicates_across_classes_are_reported_whatever_the_cosine(self):
        pool = [
            {"id": "A", "class": "sti", "tag": "v3", "text": "Same words here?"},
            {"id": "B", "class": "general", "tag": "v4_seed", "text": "same words, HERE"},
            {"id": "C", "class": "sti", "tag": "v1_cand", "text": "Same words here?"},
        ]
        pairs = review.find_pairs(pool, distinct_embed)
        self.assertEqual([(p["id_a"], p["id_b"]) for p in pairs], [("A", "B"), ("C", "B")])
        self.assertEqual({p["cosine"] for p in pairs}, {0.0})

    def test_report_has_ids_and_scores_only(self):
        out_csv = Path(self.tmp.name) / "report.csv"
        printed = io.StringIO()
        code = review.main(["--out", str(out_csv)], fake_embed, self.root, printed)
        self.assertEqual(code, 0)
        with open(out_csv, encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(list(rows[0].keys()), review.COLUMNS)
        text = out_csv.read_text(encoding="utf-8") + printed.getvalue()
        for words in ("raven", "thistle", "Kilo lima", "Walnut"):
            self.assertNotIn(words.lower(), text.lower())
        self.assertIn("out_of_scope / vague: 1", printed.getvalue())
        self.assertIn("v4_seed / v4_seed: 1", printed.getvalue())


if __name__ == "__main__":
    unittest.main()
