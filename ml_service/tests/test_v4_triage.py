"""V4 /triage behind V4_TRIAGE_ENABLED (V4 integration plan, step 3).

- The flag is on only when exactly "true": any other value behaves as
  off (/triage 404, /health as in the flag-off snapshot).
- With the flag on, /triage probabilities equal research/v4/v4_infer.py
  on synthetic queries (author-written strings and training seeds), to
  1e-6, and /health reports v4 "ok".
- V4 refuses to load, and /triage returns 503, when the sidecar or a
  feature file is tampered with (in a temporary copy, never the repo's
  frozen files), when the loaded e5 reports another revision, or when its
  weights differ from the frozen revision's. Captured logs never contain
  query text.
"""

import csv
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import torch
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests import support  # noqa: E402

LOGGER = "safegirl-classifier"
V4_FILES = ["research/v4/v4_infer.py", "research/v4/vague_rule.py", "research/v4/frozen/v4_hybrid_c10.json",
            "research/v4/frozen/v4_hybrid_c10.sha256", "research/experiments/baseline_classifier.py",
            "app/gateway/src/vagueQuery.js", "app/gateway/src/content/healthTerms.json",
            "app/gateway/src/content/extraHealthTerms.json"]


def seed_texts(n=20):
    """The first n V4 training seeds (synthetic, author-written)."""
    with open(support.REPO / "research" / "v4" / "seeds_v4_batch1.csv", encoding="utf-8-sig", newline="") as f:
        return [r["text"] for r in csv.DictReader(f)][:n]


def queries():
    return support.QUERIES + seed_texts()


def start(flag="true", skip_v3=True, patch=None):
    """Load the app with the flag; optionally skip V3 (not needed for
    /triage) and patch the module before startup. Returns (module, client)."""
    module = support.load_app(flag=flag)
    if skip_v3:
        module.load_model = lambda: None
    if patch:
        patch(module)
    client = TestClient(module.app)
    client.__enter__()
    return module, client


def mirror(tmp):
    """Copy the files V4 needs into a temporary repo layout; returns the
    copied v4_infer.py path."""
    root = Path(tmp)
    for rel in V4_FILES:
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(support.REPO / rel, root / rel)
    return root / "research" / "v4" / "v4_infer.py"


class FlagMustBeExactlyTrue(unittest.TestCase):
    def test_other_values_are_off(self):
        snapshot = json.loads(support.SNAPSHOT.read_text(encoding="utf-8"))
        health = next(s for s in snapshot if s["request"] == "GET /health")
        module, client = start(flag="True", skip_v3=False)
        try:
            self.assertFalse(module.V4_TRIAGE_ENABLED)
            self.assertEqual(client.post("/triage", json={"text": "how do condoms work"}).status_code, 404)
            r = client.get("/health")
            self.assertEqual((r.status_code, r.content.decode("utf-8")), (health["status"], health["body"]))
        finally:
            client.__exit__(None, None, None)


class TriageMatchesV4Infer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("v4_infer_ref", support.REPO / "research" / "v4" / "v4_infer.py")
        cls.v4_infer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.v4_infer)
        cls.reference = cls.v4_infer.load()
        cls.module, cls.client = start()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def test_health_reports_v4(self):
        self.assertEqual(self.client.get("/health").json()["v4"], "ok")

    def test_probabilities_equal_v4_infer(self):
        texts = queries()
        self.assertGreaterEqual(len(texts), 25)
        for text in texts:
            r = self.client.post("/triage", json={"text": text})
            self.assertEqual(r.status_code, 200)
            body = r.json()
            ref = self.reference.predict_proba([text.strip()])[0]
            got = np.array([body["scores"][c] for c in self.reference.classes])
            np.testing.assert_allclose(got, ref, rtol=0, atol=1e-6)
            self.assertEqual(body["label"], self.reference.classes[int(np.argmax(ref))])
            self.assertAlmostEqual(body["confidence"], float(np.max(ref)), delta=1e-6)
            self.assertEqual(body["model"], "v4")
            self.assertEqual(set(body["scores"]), {"contraception", "sti", "pregnancy", "general", "out_of_scope",
                                                   "vague"})

    def test_same_request_checks_as_classify(self):
        self.assertEqual(self.client.post("/triage", json={"text": "   "}).status_code, 400)
        self.assertEqual(self.client.post("/triage", json={"text": ""}).status_code, 422)
        self.assertEqual(self.client.post("/triage", json={"text": "a" * 2001}).status_code, 400)

    def test_inference_failure_is_503_and_logs_no_text(self):
        original = self.module.v4.predict_proba
        self.module.v4.predict_proba = lambda texts: (_ for _ in ()).throw(RuntimeError("boom"))
        text = "a synthetic query that must not be logged"
        try:
            with self.assertLogs(LOGGER, level="INFO") as logs:
                r = self.client.post("/triage", json={"text": text})
        finally:
            self.module.v4.predict_proba = original
        self.assertEqual(r.status_code, 503)
        self.assertFalse(any(text in line for line in logs.output))
        self.assertTrue(any("RuntimeError" in line for line in logs.output))


class V4RefusesToLoad(unittest.TestCase):
    """Each case: V4 unloaded, /health v4 not_loaded, /triage 503, the
    reason logged, and no query text in any captured log line."""

    def check_refused(self, patch, reason_part):
        text = "another synthetic query that must not be logged"
        with self.assertLogs(LOGGER, level="INFO") as logs:
            module, client = start(patch=patch)
            try:
                self.assertIsNone(module.v4)
                self.assertEqual(client.get("/health").json()["v4"], "not_loaded")
                self.assertEqual(client.post("/triage", json={"text": text}).status_code, 503)
            finally:
                client.__exit__(None, None, None)
        self.assertTrue(any("V4 triage not loaded" in line and reason_part in line for line in logs.output),
                        logs.output)
        self.assertFalse(any(text in line for line in logs.output))

    def test_tampered_sidecar(self):
        with tempfile.TemporaryDirectory() as tmp:
            infer = mirror(tmp)
            (infer.parent / "frozen" / "v4_hybrid_c10.sha256").write_text("0" * 64 + "  v4_hybrid_c10.json\n",
                                                                         encoding="utf-8")
            self.check_refused(lambda m: setattr(m, "V4_INFER_PATH", infer), "does not match the sidecar")

    def test_tampered_feature_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            infer = mirror(tmp)
            with open(infer.parent / "vague_rule.py", "a", encoding="utf-8") as f:
                f.write("\n# tampered\n")
            self.check_refused(lambda m: setattr(m, "V4_INFER_PATH", infer), "has changed")

    def test_wrong_e5_revision(self):
        def patch(module):
            original = module.load_retriever

            def wrapped():
                original()
                module.retriever.model[0].auto_model.config._commit_hash = "0" * 40
            module.load_retriever = wrapped

        self.check_refused(patch, "is not the frozen")

    def test_e5_weights_differ(self):
        def patch(module):
            original = module.load_retriever

            def wrapped():
                original()
                with torch.no_grad():
                    next(iter(module.retriever.model[0].auto_model.parameters())).add_(1e-3)
            module.load_retriever = wrapped

        self.check_refused(patch, "weights differ")


if __name__ == "__main__":
    unittest.main()
