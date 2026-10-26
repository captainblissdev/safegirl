"""Unit tests for check_paraphrases.py, on small synthetic fixtures."""

import io
import tempfile
import unittest
from pathlib import Path

from tests.support import (
    SEED_HEADER,
    fake_embed,
    fake_rules,
    load,
    make_repo,
    seed,
    write_csv,
)

check_paraphrases = load("check_paraphrases")
HEADER = ["seed_id", "paraphrase_id", "class", "text"]
NOTE = "held-topic phrasing, label is topic only"

SEEDS = [
    seed("S-A", "Lantern meadow orchid pebble?", cls="sti", source="KB-S1"),
    seed("S-B", "Saffron tundra velvet willow?", cls="general", source="Doc, p. 3"),
    seed("S-H", "Cobalt dahlia ember juniper?", cls="pregnancy", source="Doc, p. 4", notes=NOTE),
]
WORDS = {
    "S-A": [("sti", w) for w in ("apricot birch canyon", "delta ermine falcon", "glacier hollow iris", "jade kelp lynx")],
    "S-B": [("general", w) for w in ("maple nectar oasis", "pine quartz raven", "sable thistle umber", "violet walnut xylem")],
}


def paraphrases(overrides=None):
    rows = []
    for sid, items in WORDS.items():
        for k, (cls, words) in enumerate(items, 1):
            rows.append([sid, f"{sid}-P{k}", cls, f"Question about {words} here?"])
    for index, row in (overrides or {}).items():
        rows[index] = row
    return rows


class ParaphraseCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = make_repo(self.tmp.name)
        self.seeds = Path(self.tmp.name) / "seeds.csv"
        write_csv(self.seeds, SEED_HEADER, SEEDS)
        self.file = Path(self.tmp.name) / "para.csv"
        self.markers = Path(self.tmp.name) / "markers.txt"
        self.markers.write_text("# test markers\nsasa\nniko poa\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def run_check(self, rows, header=HEADER, sealed=None, markers=True):
        write_csv(self.file, header, rows)
        return check_paraphrases.check_file(
            self.file, [self.seeds], self.root, fake_embed, fake_rules, sealed,
            self.markers if markers else Path(self.tmp.name) / "absent.txt",
        )

    def failures(self, rows, **kwargs):
        return "\n".join(self.run_check(rows, **kwargs).failures)


class Structure(ParaphraseCase):
    def test_a_clean_file_passes(self):
        report = self.run_check(paraphrases())
        self.assertEqual(report.failures, [])
        self.assertIn("paraphrases: 8; seeds: 3 (1 with the held-topic override)", "\n".join(report.info))

    def test_columns_must_match(self):
        self.assertIn("schema: columns must be exactly", self.failures([], header=["seed_id", "text"]))

    def test_exactly_four_per_seed_and_none_for_the_override(self):
        rows = paraphrases()[:-1] + [["S-H", "S-H-P1", "pregnancy", "Question about yarrow zinnia amber here?"]]
        failures = self.failures(rows)
        self.assertIn("count: S-B has 3 paraphrases, expected 4", failures)
        self.assertIn("count: S-H has 1 paraphrases, expected 0 (held-topic override: none allowed)", failures)

    def test_seed_class_length_and_identity(self):
        failures = self.failures(paraphrases({
            0: ["S-X", "S-X-P1", "sti", "Question about bronze cedar dune here?"],
            1: ["S-A", "S-A-P2", "general", "Question about delta ermine falcon here?"],
            2: ["S-A", "S-A-P3", "sti", "Too short"],
            3: ["S-A", "S-A-P4", "sti", "lantern, MEADOW orchid pebble"],
        }))
        self.assertIn("S-X-P1: seed_id S-X is not in the --seeds files", failures)
        self.assertIn("S-A-P2: class general differs from its seed's sti", failures)
        self.assertIn("S-A-P3: under 10 characters", failures)
        self.assertIn("S-A-P4: identical to its seed", failures)

    def test_duplicates(self):
        rows = paraphrases({5: ["S-B", "S-A-P1", "general", "Question about apricot birch canyon here?"]})
        failures = self.failures(rows)
        self.assertIn("duplicate paraphrase_id S-A-P1 (2 rows)", failures)
        self.assertIn("exact duplicate text S-A-P1, S-A-P1", failures)
        self.assertIn("S-A-P1: id does not start with its seed_id", failures)

    def test_markers_fail_and_a_missing_list_warns(self):
        rows = paraphrases({0: ["S-A", "S-A-P1", "sti", "Sasa, question about apricot birch here?"],
                            1: ["S-A", "S-A-P2", "sti", "Niko poa but delta ermine falcon?"]})
        failures = self.failures(rows)
        self.assertIn("S-A-P1: Swahili/Sheng marker (1 found)", failures)
        self.assertIn("S-A-P2: Swahili/Sheng marker (1 found)", failures)
        report = self.run_check(rows, markers=False)
        self.assertNotIn("marker", "\n".join(report.failures))
        self.assertIn("the marker check did not run", "\n".join(report.warnings))


class NearDuplicatesAndRules(ParaphraseCase):
    def test_protected_and_training_pools(self):
        failures = self.failures(paraphrases({
            0: ["S-A", "S-A-P1", "sti", "Romeo quebec papa dr04 secret?"],
            1: ["S-A", "S-A-P2", "sti", "Yankee xray whiskey victor uniform?"],
            2: ["S-A", "S-A-P3", "sti", "Dune copper bronze amber zulu?"],
            3: ["S-A", "S-A-P4", "sti", "Echo delta charlie bravo alpha?"],
            4: ["S-B", "S-B-P1", "general", "Thyme pine cedar basil walnut?"],
        }))
        self.assertIn("DR-04: S-A-P1 ~ DR-04 row 1", failures)
        self.assertNotIn("Secret dr04", failures)
        self.assertIn("relevance_validation.csv: S-A-P2 ~ relevance_validation V01", failures)
        self.assertIn("development set: S-A-P3 ~ development set Q01", failures)
        self.assertIn("V3 training pool: S-A-P4 ~ V3 seed SEED-STI-01", failures)
        self.assertIn("V1 paraphrases: S-B-P1 ~ V1 paraphrase SEED-GEN-01-P1", failures)

    def test_other_seeds_but_not_its_own(self):
        own = paraphrases({0: ["S-A", "S-A-P1", "sti", "pebble orchid meadow lantern"]})
        self.assertNotIn("other seed", self.failures(own))
        other = paraphrases({4: ["S-B", "S-B-P1", "general", "pebble orchid meadow lantern"]})
        self.assertIn("other seed: S-B-P1 ~ S-A", self.failures(other))

    def test_sealed_ids_and_scores_only(self):
        sealed = [("Z-7", "Opal sunrise trellis quartz amber?")]
        rows = paraphrases({0: ["S-A", "S-A-P1", "sti", "amber quartz trellis sunrise opal"]})
        report = self.run_check(rows, sealed=sealed)
        printed = "\n".join(report.failures + report.info)
        self.assertIn("sealed: S-A-P1 ~ sealed Z-7 (cosine 1.000", printed)
        self.assertIn("sealed set: 1 items compared", printed)
        self.assertNotIn("Opal sunrise", printed)

    def test_held_topic_and_safety_net_fail_with_no_override(self):
        rows = paraphrases({0: ["S-A", "S-A-P1", "sti", "Question heldword apricot birch?"],
                            1: ["S-A", "S-A-P2", "sti", "Question alarmword delta ermine?"]})
        failures = self.failures(rows)
        self.assertIn("held topic: S-A-P1 matches held-topic group A", failures)
        self.assertIn("Safety Net: S-A-P2 is flagged (abuse)", failures)

    def test_main_prints_no_text_and_sets_the_exit_status(self):
        write_csv(self.file, HEADER, paraphrases({0: ["S-A", "S-A-P1", "sti", "Romeo quebec papa dr04 secret?"]}))
        out = io.StringIO()
        code = check_paraphrases.main([str(self.file), "--seeds", str(self.seeds)], fake_embed, fake_rules,
                                      self.root, out, self.markers)
        self.assertEqual(code, 1)
        printed = out.getvalue()
        self.assertIn("DR-04 row 1", printed)
        for text in ("Romeo quebec", "apricot", "delta ermine"):
            self.assertNotIn(text, printed)
        write_csv(self.file, HEADER, paraphrases())
        code = check_paraphrases.main([str(self.file), "--seeds", str(self.seeds)], fake_embed, fake_rules,
                                      self.root, io.StringIO(), self.markers)
        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main()
