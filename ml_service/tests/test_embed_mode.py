"""Tests for the retrieval embedding mode (RETRIEVAL_EMBED_MODE).

No model is downloaded or loaded: SentenceTransformer is replaced by a
fake that records what it is asked to embed, and the classifier load is
skipped.

Run from ml_service/:
    ../.venv/Scripts/python.exe -m unittest discover -s tests -t .
"""

import importlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np

ML_SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_SERVICE))

import retrieval  # noqa: E402

ENTRIES = [
    {"id": "KB-S1", "class": "sti", "title": "Alpha question?",
     "content": "Alpha answer.\n\nConditions: alpha caveat", "source": "S."},
    {"id": "KB-G1", "class": "general", "title": "Bravo question?",
     "content": "Bravo answer.", "source": "S."},
]


class FakeSentenceTransformer:
    """Records every batch it embeds; returns fixed unit vectors."""

    batches = []

    def __init__(self, name):
        self.name = name

    def encode(self, texts, convert_to_numpy=True, normalize_embeddings=True):
        if isinstance(texts, str):  # a single query
            return np.array([1.0, 0.0, 0.0, 0.0])
        FakeSentenceTransformer.batches.append(list(texts))
        out = np.zeros((len(texts), 4))
        for i in range(len(texts)):
            out[i, i % 4] = 1.0
        return out


def write_kb(directory):
    path = Path(directory) / "kb.json"
    path.write_text(json.dumps(ENTRIES), encoding="utf-8")
    return path


class RetrieverModes(unittest.TestCase):
    def setUp(self):
        FakeSentenceTransformer.batches = []
        patcher = mock.patch.object(retrieval, "SentenceTransformer", FakeSentenceTransformer)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.kb = write_kb(self.tmp.name)

    def test_default_is_full(self):
        self.assertEqual(retrieval.DEFAULT_EMBED_MODE, "full")
        self.assertEqual(retrieval.EMBED_MODES, ("question", "full"))

    def test_full_mode_embeds_question_and_content(self):
        r = retrieval.KnowledgeBaseRetriever(self.kb, "full")
        self.assertEqual(r.embed_mode, "full")
        self.assertEqual(FakeSentenceTransformer.batches[0], [
            "passage: Alpha question?. Alpha answer.\n\nConditions: alpha caveat",
            "passage: Bravo question?. Bravo answer.",
        ])

    def test_question_mode_embeds_the_question_only(self):
        r = retrieval.KnowledgeBaseRetriever(self.kb, "question")
        self.assertEqual(r.embed_mode, "question")
        self.assertEqual(FakeSentenceTransformer.batches[0],
                         ["passage: Alpha question?", "passage: Bravo question?"])

    def test_both_modes_retrieve_the_same_entries_and_content(self):
        for mode in retrieval.EMBED_MODES:
            r = retrieval.KnowledgeBaseRetriever(self.kb, mode)
            results = r.retrieve(query="Alpha question?", top_k=2)
            self.assertEqual({x["id"] for x in results}, {"KB-S1", "KB-G1"}, mode)
            by_id = {x["id"]: x for x in results}
            self.assertEqual(by_id["KB-S1"]["content"], ENTRIES[0]["content"], mode)

    def test_unknown_mode_is_refused(self):
        with self.assertRaisesRegex(ValueError, "Unknown embed mode 'answer'"):
            retrieval.KnowledgeBaseRetriever(self.kb, "answer")
        self.assertEqual(FakeSentenceTransformer.batches, [], "nothing is embedded")


class ServiceFlag(unittest.TestCase):
    """The service reads the flag, reports it, and refuses an unknown one."""

    def load_app(self, mode):
        env = {k: v for k, v in os.environ.items() if k != "RETRIEVAL_EMBED_MODE"}
        if mode is not None:
            env["RETRIEVAL_EMBED_MODE"] = mode
        with mock.patch.dict(os.environ, env, clear=True):
            sys.modules.pop("app", None)
            module = importlib.import_module("app")
        return module

    def client(self, module):
        from fastapi.testclient import TestClient

        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        patches = [
            mock.patch.object(retrieval, "SentenceTransformer", FakeSentenceTransformer),
            mock.patch.object(module, "KB_PATH", write_kb(tmp.name)),
            mock.patch.object(module, "load_model", lambda: None),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        client = TestClient(module.app)
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    def test_unset_means_full(self):
        self.assertEqual(self.load_app(None).RETRIEVAL_EMBED_MODE, "full")

    def test_health_reports_the_mode(self):
        for mode in ("full", "question"):
            module = self.load_app(mode)
            health = self.client(module).get("/health").json()
            self.assertEqual(health["embed_mode"], mode)
            self.assertEqual(health["retriever"], "ok")

    def test_unknown_mode_stops_the_retriever_loading(self):
        module = self.load_app("answer")
        client = self.client(module)
        health = client.get("/health").json()
        self.assertEqual(health["retriever"], "not_loaded")
        self.assertIsNone(health["embed_mode"])
        response = client.post("/retrieve", json={"query": "Alpha question?"})
        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
