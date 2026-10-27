"""Tests for check_kb_vs_sealed.py on fake data: a tiny KB and a fake
embedder. Only ids and scores may be printed, never sealed text or the
sealed path."""

import importlib.util
import io
import re
import tempfile
import unittest
from pathlib import Path

import numpy as np

SCRIPT = Path(__file__).resolve().parents[1] / "check_kb_vs_sealed.py"
spec = importlib.util.spec_from_file_location("check_kb_vs_sealed", SCRIPT)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


def fake_embed(texts):
    """Bag of words in 64 hashed dimensions: same words, cosine 1."""
    out = np.zeros((len(texts), 64))
    for i, text in enumerate(texts):
        for word in re.findall(r"\w+", text.lower()):
            out[i, sum(map(ord, word)) % 64] += 1
    return out / np.linalg.norm(out, axis=1, keepdims=True)


SEALED_TEXT = "Ember lantern orchid quartz?"


class Guard(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.kb = root / "kb"
        self.kb.mkdir()
        (self.kb / "sti.md").write_text(
            "# STIs\n\n## KB-S1\n- **User question:** quartz orchid lantern ember\n"
            "- **Status:** approved\n\n## KB-S2\n- **User question:** Velvet tundra?\n"
            "- **Status:** pending\n\n---\n\n## HELD\n\n### KB-S9\n- **User question:** Mango cobalt?\n",
            encoding="utf-8",
        )
        self.sealed = root / "private-dir-q7" / "held.csv"
        self.sealed.parent.mkdir()
        self.sealed.write_text(f"id,text\nZ-1,{SEALED_TEXT}\nZ-2,mango cobalt\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def run_guard(self, path=None):
        out = io.StringIO()
        code = guard.main(["--sealed", str(path or self.sealed)], fake_embed, self.kb, out)
        return code, out.getvalue()

    def assert_private(self, printed):
        for secret in (SEALED_TEXT, "mango cobalt", "private-dir-q7", "held.csv"):
            self.assertNotIn(secret, printed)

    def test_reports_ids_and_cosine_only(self):
        code, printed = self.run_guard()
        self.assertEqual(code, 1)
        self.assertIn("KB-S1 ~ sealed Z-1 (cosine 1.000)", printed)
        self.assertIn("pairs: 2", printed)
        self.assert_private(printed)

    def test_held_and_pending_questions_are_compared_too(self):
        _, printed = self.run_guard()
        self.assertIn("3 KB questions compared", printed)
        self.assertIn("KB-S9 ~ sealed Z-2", printed)
        self.assertNotIn("KB-S2 ~", printed)

    def test_no_pair_exits_zero(self):
        self.sealed.write_text("id,text\nZ-3,Saffron willow?\n", encoding="utf-8")
        code, printed = self.run_guard()
        self.assertEqual(code, 0)
        self.assertIn("pairs: 0", printed)

    def test_unusable_sealed_files_stop_without_the_path(self):
        code, printed = self.run_guard(self.sealed.with_name("missing.csv"))
        self.assertEqual(code, 2)
        self.assertIn("was not found", printed)
        self.assert_private(printed)
        self.sealed.write_text(f"id,query\nZ-1,{SEALED_TEXT}\n", encoding="utf-8")
        code, printed = self.run_guard()
        self.assertEqual(code, 2)
        self.assertIn("exactly the columns id,text", printed)
        self.assert_private(printed)


if __name__ == "__main__":
    unittest.main()
