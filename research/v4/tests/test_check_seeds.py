"""Unit tests for check_seeds.py, on small synthetic fixtures."""

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

check_seeds = load("check_seeds")


class CheckerCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = make_repo(self.tmp.name)
        self.file = Path(self.tmp.name) / "seeds.csv"

    def tearDown(self):
        self.tmp.cleanup()

    def run_check(self, rows, header=SEED_HEADER, test_items=False):
        write_csv(self.file, header, rows)
        report = check_seeds.check_file(
            self.file, self.root, fake_embed, fake_rules, test_items
        )
        return report

    def failures(self, rows, **kwargs):
        return "\n".join(self.run_check(rows, **kwargs).failures)


GOOD = [
    seed("V4-1", "Lantern meadow orchid pebble river?"),
    seed("V4-2", "Saffron tundra velvet willow yarrow?", cls="general", source="WHO FP Handbook 2022, p. 12"),
    seed("V4-3", "Weather tomorrow somewhere far?", cls="out_of_scope", source="design rule", style="colloquial"),
    seed("V4-4", "hmm ok", cls="vague", source="design rule", style="short_or_misspelt"),
]


class Schema(CheckerCase):
    def test_a_clean_file_passes(self):
        report = self.run_check(GOOD)
        self.assertEqual(report.failures, [])

    def test_columns_must_match(self):
        failures = self.failures([r[:-1] for r in GOOD], header=SEED_HEADER[:-1])
        self.assertIn("schema: columns must be exactly", failures)
        self.assertIn("'notes'", failures)

    def test_allowed_values(self):
        failures = self.failures(
            [
                seed("V4-1", "Lantern meadow orchid?", cls="gbv"),
                seed("V4-2", "Saffron tundra velvet?", style="poetic"),
                seed("V4-3", "Cobalt dahlia ember?", boundary="sti_vs_weather"),
            ]
        )
        self.assertIn("primary_class 'gbv'", failures)
        self.assertIn("style 'poetic'", failures)
        self.assertIn("boundary 'sti_vs_weather'", failures)

    def test_a_valid_boundary_passes(self):
        report = self.run_check([seed("V4-1", "Lantern meadow orchid?", boundary="pregnancy_vs_general")])
        self.assertEqual(report.failures, [])

    def test_duplicate_and_empty_seed_id(self):
        failures = self.failures(
            [
                seed("V4-1", "Lantern meadow orchid?"),
                seed("V4-1", "Saffron tundra velvet?"),
                seed("", "Cobalt dahlia ember?"),
            ]
        )
        self.assertIn("duplicate seed_id V4-1 (2 rows)", failures)
        self.assertIn("empty seed_id", failures)

    def test_sources(self):
        failures = self.failures(
            [
                seed("V4-1", "Lantern meadow orchid?", source=""),
                seed("V4-2", "Saffron tundra velvet?", source="KB-S99"),
                seed("V4-3", "Cobalt dahlia ember?", source="KB-S9"),  # held, not active
                seed("V4-4", "Juniper kestrel lotus?", source="a leaflet"),
                seed("V4-5", "Marigold nectar opal?", source="design rule"),
                seed("V4-6", "Weather far away?", cls="out_of_scope", source="KB-S1"),
            ]
        )
        self.assertIn("V4-1: missing source", failures)
        self.assertIn("KB-S99 is not an active KB entry", failures)
        self.assertIn("KB-S9 is not an active KB entry", failures)
        self.assertIn("'a leaflet' is neither a KB id nor a document with a page", failures)
        self.assertIn("V4-5: 'design rule' is only for out_of_scope and vague", failures)
        self.assertIn("V4-6: source for out_of_scope must be 'design rule'", failures)

    def test_secondary_class_only_on_test_items(self):
        rows = [seed("V4-1", "Lantern meadow orchid?", secondary="general")]
        self.assertIn("secondary_class set on a training seed", self.failures(rows))
        self.assertEqual(self.run_check(rows, test_items=True).failures, [])
        rows = [seed("V4-1", "Lantern meadow orchid?", secondary="sti")]
        self.assertIn("secondary_class 'sti' invalid", self.failures(rows, test_items=True))


class Duplicates(CheckerCase):
    def test_exact_duplicate_inside_the_file(self):
        failures = self.failures(
            [seed("V4-1", "Lantern meadow orchid?"), seed("V4-2", "lantern, MEADOW orchid")]
        )
        self.assertIn("in-file: exact duplicate text V4-1, V4-2", failures)
        self.assertNotIn("near duplicate", failures)

    def test_near_duplicate_by_cosine(self):
        failures = self.failures(
            [seed("V4-1", "lantern meadow orchid pebble river"), seed("V4-2", "river pebble orchid meadow lantern")]
        )
        self.assertIn("in-file: near duplicate V4-1 ~ V4-2 (cosine 1.000, ratio <0.85)", failures)

    def test_near_duplicate_by_character_ratio(self):
        self.assertGreaterEqual(
            check_seeds.char_ratio("lantern meadow orchid pebbles", "lantern meadow orchid pebble"), 0.85
        )
        failures = self.failures(
            [seed("V4-1", "Lanternx meadowx orchidx pebblesx?"), seed("V4-2", "Lanterny meadowy orchidy pebblesy?")]
        )
        self.assertIn("in-file: near duplicate V4-1 ~ V4-2", failures)

    def test_v3_training_pool(self):
        failures = self.failures(
            [seed("V4-1", "Echo delta charlie bravo alpha?"), seed("V4-2", "Foxtrot golf hotel india juliet!")]
        )
        self.assertIn("V3 training pool: V4-1 ~ V3 seed SEED-STI-01", failures)
        self.assertIn("V3 training pool: V4-2 ~ V3 paraphrase SEED-STI-01-P1", failures)

    def test_deleted_v1_paraphrases(self):
        failures = self.failures([seed("V4-1", "Thyme pine cedar basil walnut?")])
        self.assertIn("V1 paraphrases: V4-1 ~ V1 paraphrase SEED-GEN-01-P1", failures)

    def test_dr04_reported_by_row_number_only(self):
        report = self.run_check([seed("V4-1", "Romeo quebec papa dr04 secret?")])
        failures = "\n".join(report.failures)
        self.assertIn("DR-04: V4-1 ~ DR-04 row 1", failures)
        out = io.StringIO()
        check_seeds.main([str(self.file)], fake_embed, fake_rules, self.root, out)
        printed = out.getvalue()
        self.assertIn("DR-04 row 1", printed)
        self.assertNotIn("Secret dr04 papa quebec romeo", printed)
        self.assertNotIn("Secret dr04 sierra tango", printed)

    def test_relevance_validation_and_development_set(self):
        failures = self.failures(
            [seed("V4-1", "Uniform victor whiskey xray yankee?"), seed("V4-2", "Zulu amber bronze copper dune")]
        )
        self.assertIn("relevance_validation.csv: V4-1 ~ relevance_validation V01", failures)
        self.assertIn("development set: V4-2 ~ development set Q01", failures)

    def test_unrelated_text_passes(self):
        self.assertEqual(self.run_check(GOOD).failures, [])


class RulesCountsAndOverlap(CheckerCase):
    def test_held_topic_fails_and_safety_net_warns(self):
        report = self.run_check(
            [seed("V4-1", "Lantern heldword orchid?"), seed("V4-2", "Saffron alarmword velvet?")]
        )
        self.assertIn("held topic: V4-1 matches held-topic group A", "\n".join(report.failures))
        self.assertIn("Safety Net: V4-2 is flagged (abuse)", "\n".join(report.warnings))

    def test_held_topic_override_note_turns_the_failure_into_a_warning(self):
        note = check_seeds.HELD_TOPIC_OVERRIDE
        self.assertEqual(note, "held-topic phrasing, label is topic only")
        report = self.run_check(
            [
                seed("V4-1", "Lantern heldword orchid?", cls="pregnancy", notes=f"probe; {note}"),
                seed("V4-2", "Saffron heldword velvet?", cls="pregnancy", notes="held-topic phrasing"),
                seed("V4-3", "Cobalt heldword dahlia?", notes="Held-topic phrasing, label is topic only"),
                seed("V4-4", "Juniper kestrel lotus?", notes=note),
            ]
        )
        failures = "\n".join(report.failures)
        warnings = "\n".join(report.warnings)
        self.assertIn("held topic: V4-1 matches held-topic group A; passed by its notes", warnings)
        self.assertNotIn("V4-1", failures)
        # Only the exact words count: partial or differently cased notes fail.
        self.assertIn("held topic: V4-2 matches held-topic group A (no held-topic", failures)
        self.assertIn("held topic: V4-3 matches held-topic group A (no held-topic", failures)
        # The note on an item the rule does not match changes nothing.
        self.assertNotIn("V4-4", failures + warnings)

    def test_counts_and_the_25_seed_warning(self):
        rows = [seed(f"V4-{i}", f"Unique{i} word{i} here{i}?") for i in range(25)]
        rows.append(seed("V4-x", "Saffron tundra velvet?", cls="general", style="euphemism", source="Doc, p. 3"))
        report = self.run_check(rows)
        warnings = "\n".join(report.warnings)
        self.assertNotIn("sti has", warnings)
        self.assertIn("general has 1 seeds (under 25)", warnings)
        self.assertIn("vague has 0 seeds (under 25)", warnings)
        info = "\n".join(report.info)
        self.assertRegex(info, r"sti\s+25")
        self.assertRegex(info, r"general\s+0\s+0\s+0\s+1\s+0\s+0")

    def test_train_overlap_lists_kb_questions_that_are_seeds(self):
        report = self.run_check([seed("V4-1", "Ember flint garnet hazel iris?")])
        info = "\n".join(report.info)
        self.assertIn("train overlap (V3 seeds): 1 KB question(s)", info)
        self.assertIn("KB-S1 ~ SEED-STI-01", info)
        self.assertIn("train overlap (this file): 1 KB question(s)", info)
        self.assertIn("KB-S2 ~ V4-1", info)
        # Overlap with a KB question is reported, not failed.
        self.assertEqual(report.failures, [])

    def test_exit_status(self):
        write_csv(self.file, SEED_HEADER, GOOD)
        self.assertEqual(check_seeds.main([str(self.file)], fake_embed, fake_rules, self.root, io.StringIO()), 0)
        write_csv(self.file, SEED_HEADER, GOOD + [seed("V4-9", "Lantern meadow orchid pebble river?")])
        self.assertEqual(check_seeds.main([str(self.file)], fake_embed, fake_rules, self.root, io.StringIO()), 1)
        missing = str(Path(self.tmp.name) / "none.csv")
        self.assertEqual(check_seeds.main([missing], fake_embed, fake_rules, self.root, io.StringIO()), 2)


class Sealed(CheckerCase):
    """--sealed: ids and scores only, never the sealed text or path."""

    SEALED_TEXT = "Opal sunrise trellis quartz amber?"

    def setUp(self):
        super().setUp()
        self.sealed = Path(self.tmp.name) / "private-dir-x9" / "held-out.csv"
        write_csv(self.sealed, ["id", "text"], [["S-07", self.SEALED_TEXT], ["S-08", "Mango cobalt tidal?"]])

    def run_main(self, rows, sealed_path=None):
        write_csv(self.file, SEED_HEADER, rows)
        out = io.StringIO()
        code = check_seeds.main(
            [str(self.file), "--sealed", str(sealed_path or self.sealed)],
            fake_embed,
            fake_rules,
            self.root,
            out,
        )
        return code, out.getvalue()

    def assert_nothing_sealed_printed(self, printed):
        self.assertNotIn(self.SEALED_TEXT, printed)
        self.assertNotIn("Mango cobalt tidal", printed)
        self.assertNotIn("private-dir-x9", printed)
        self.assertNotIn("held-out", printed)

    def test_a_near_duplicate_fails_with_ids_and_score_only(self):
        code, printed = self.run_main(GOOD + [seed("V4-9", "amber quartz trellis sunrise opal")])
        self.assertEqual(code, 1)
        self.assertIn("sealed: V4-9 ~ sealed S-07 (cosine 1.000, ratio <0.85)", printed)
        self.assertNotIn("V4-1 ~ sealed", printed)
        self.assert_nothing_sealed_printed(printed)

    def test_character_ratio_also_counts(self):
        code, printed = self.run_main([seed("V4-9", "Opal sunrise trellis quartz ambers")])
        self.assertIn("sealed: V4-9 ~ sealed S-07", printed)
        self.assert_nothing_sealed_printed(printed)

    def test_no_match_passes_and_reports_only_the_count(self):
        code, printed = self.run_main(GOOD)
        self.assertEqual(code, 0, printed)
        self.assertIn("sealed set: 2 items compared", printed)
        self.assert_nothing_sealed_printed(printed)

    def test_unusable_sealed_files_stop_without_naming_the_path(self):
        missing = Path(self.tmp.name) / "private-dir-x9" / "held-out-missing.csv"
        code, printed = self.run_main(GOOD, missing)
        self.assertEqual(code, 2)
        self.assertIn("the sealed set file was not found", printed)
        self.assert_nothing_sealed_printed(printed)

        write_csv(self.sealed, ["id", "query"], [["S-07", self.SEALED_TEXT]])
        code, printed = self.run_main(GOOD)
        self.assertEqual(code, 2)
        self.assertIn("exactly the columns id,text", printed)
        self.assert_nothing_sealed_printed(printed)

        write_csv(self.sealed, ["id", "text"], [["S-07", self.SEALED_TEXT], ["S-07", "Mango cobalt tidal?"]])
        code, printed = self.run_main(GOOD)
        self.assertEqual(code, 2)
        self.assertIn("duplicate ids", printed)
        self.assert_nothing_sealed_printed(printed)

    def test_without_the_option_no_sealed_check_runs(self):
        report = self.run_check(GOOD)
        self.assertFalse(any("sealed" in line for line in report.info + report.failures))


class GatewayRules(unittest.TestCase):
    """The real held-topic rule and Safety Net, through Node."""

    def test_uses_the_gateway_rules(self):
        rules = check_seeds.gateway_rules(check_seeds.REPO)
        held, safe, plain = rules(
            ["Where can I buy P2 pills?", "my uncle touches me and I am scared", "What is chlamydia?"]
        )
        self.assertEqual(held["held"], "A")
        self.assertEqual(safe["safety"], "abuse")
        self.assertEqual(plain, {"held": None, "safety": None})


if __name__ == "__main__":
    unittest.main()
