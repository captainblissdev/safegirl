"""Tests for the 62-entry set next to the default one: build_kb.py builds
both and leaves the default knowledge_base.json exactly as it was; the
62-entry file is the one kb/merge-60 served (SHA-256 1b53efad...), with
only approved entries; a missing status fails; the interface's generator
is current for both sets. No model is loaded.

    .venv/Scripts/python.exe -I -m unittest discover -s ml_service/tests -t ml_service
"""

import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
REPO = ML.parent
spec = importlib.util.spec_from_file_location("build_kb_under_test", ML / "build_kb.py")
build_kb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_kb)

KB62_SHA256 = "1b53efad82587063462d24efa9a436c2e20df007ad86b8623429b73a12885ff0"
PENDING = {"KB-C6", "KB-C14", "KB-S19", "KB-C22"}
GENERATOR = REPO / "app" / "interface" / "src" / "scripts" / "generate-kb-json.py"


class Kb62(unittest.TestCase):
    def test_default_unchanged(self):
        text = build_kb.serialize(build_kb.build_kb())
        self.assertEqual(text, build_kb.OUTPUT_PATH.read_text(encoding="utf-8"))
        self.assertEqual(len(json.loads(text)), 21)

    def test_kb62_is_the_served_62(self):
        text = build_kb.serialize(build_kb.build_kb(build_kb.KB62_SOURCE_DIR, with_status=True))
        self.assertEqual(text, build_kb.KB62_OUTPUT_PATH.read_text(encoding="utf-8"))
        self.assertEqual(hashlib.sha256(build_kb.KB62_OUTPUT_PATH.read_bytes()).hexdigest(), KB62_SHA256)
        ids = {e["id"] for e in json.loads(text)}
        self.assertEqual(len(ids), 62)
        self.assertFalse(ids & PENDING)
        self.assertFalse(any("_status" in e for e in json.loads(text)))

    def test_missing_status_fails_only_with_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sti.md"
            path.write_text("# STI\n\n## KB-S1\n\n- **User question:** q\n- **Answer:** a\n"
                            "- **Source:** s\n", encoding="utf-8")
            self.assertEqual(len(build_kb.parse_file(path, "sti")), 1)
            with self.assertRaises(build_kb.KBParseError):
                build_kb.parse_file(path, "sti", with_status=True)

    def test_interface_generator_current_for_both_sets(self):
        for extra in ([], ["--kb-set", "kb62"]):
            run = subprocess.run([sys.executable, "-I", str(GENERATOR), "--check", *extra],
                                 capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(run.returncode, 0, run.stderr)


if __name__ == "__main__":
    unittest.main()
