"""Tests for RETRIEVAL_EMBED_MODE (retrieval.py): "full", the default,
embeds exactly the text it did before the setting existed; "question"
embeds the entry's question only; an unknown mode is refused before
anything is loaded. No model is loaded.

    .venv/Scripts/python.exe -I -m unittest discover -s ml_service/tests -t ml_service
"""

import importlib.util
import unittest
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("retrieval_under_test", ML / "retrieval.py")
retrieval = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retrieval)

ENTRY = {"id": "KB-X1", "class": "sti", "title": "A question?", "content": "An answer.", "source": "s"}


class EmbedMode(unittest.TestCase):
    def test_default_is_full(self):
        self.assertEqual(retrieval.DEFAULT_EMBED_MODE, "full")
        self.assertEqual(retrieval.EMBED_MODES, ("question", "full"))

    def test_full_is_the_text_embedded_before(self):
        before = retrieval.PASSAGE_PREFIX + ENTRY["title"] + ". " + ENTRY["content"]
        self.assertEqual(retrieval.passage_text(ENTRY, "full"), before)

    def test_question_mode(self):
        self.assertEqual(retrieval.passage_text(ENTRY, "question"), "passage: A question?")

    def test_unknown_mode_refused(self):
        with self.assertRaises(ValueError):
            retrieval.KnowledgeBaseRetriever(ML / "knowledge_base.json", "answer")

    def test_app_reads_the_setting_with_full_as_default(self):
        source = (ML / "app.py").read_text(encoding="utf-8")
        self.assertIn('os.environ.get("RETRIEVAL_EMBED_MODE", DEFAULT_EMBED_MODE)', source)
        self.assertIn("KnowledgeBaseRetriever(KB_PATH, RETRIEVAL_EMBED_MODE)", source)


if __name__ == "__main__":
    unittest.main()
