"""Inference for the frozen V4 candidate, from its JSON only.

    from v4_infer import load
    model = load()                      # checks the sidecar hash first
    label, proba = model.predict("Can I get pregnant on the pill?")

The model parameters (classes, scaler, coefficients, intercepts) come
only from research/v4/frozen/v4_hybrid_c10.json; nothing is pickled or
refitted. load() refuses the file if its sha256 differs from the hash in
the sidecar v4_hybrid_c10.sha256, or if any feature source (the keyword
baseline, vague_rule.py and the gateway files it reads) or the local
embedding weights differ from the hashes recorded in the JSON.

The features are the e5 embedding of "query: " + text (normalized), the
frozen baseline's keyword hit counts in the recorded order, and the
vague-rule flag; the 6 rule columns are scaled with the recorded mean
and scale. Probabilities are the softmax of coef . x + intercept, as in
scikit-learn's multinomial logistic regression.

This module is research code: it is not wired into ml_service or the
gateway (integration happens only after the sealed gate).
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
FROZEN = HERE / "frozen" / "v4_hybrid_c10.json"


class FrozenModelError(RuntimeError):
    pass


def _sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FrozenHybrid:
    def __init__(self, spec: dict, root: Path = REPO, embed=None):
        self.spec = spec
        self.classes = list(spec["classes"])
        self.coef = np.array(spec["coef"], dtype=np.float64)
        self.intercept = np.array(spec["intercept"], dtype=np.float64)
        self.mean = np.array(spec["scaler"]["mean"], dtype=np.float64)
        self.scale = np.array(spec["scaler"]["scale"], dtype=np.float64)
        self.keyword_classes = list(spec["features"]["keyword_classes"])
        self.t_act = spec["t_act"]
        widths = spec["features"]["widths"]
        if self.coef.shape != (len(self.classes), spec["features"]["total"]) or \
                spec["features"]["total"] != widths["embedding"] + widths["keyword"] + widths["vague"]:
            raise FrozenModelError("coefficient shape does not match the recorded feature widths")
        self._baseline = _load_module("v4_baseline", root / "research" / "experiments" / "baseline_classifier.py")
        self._vague = _load_module("v4_vague", root / "research" / "v4" / "vague_rule.py")
        self._embed = embed

    # ----------------------------------------------------------- features

    def rule_features(self, text: str) -> np.ndarray:
        scores = self._baseline.explain_baseline(text)["scores"]
        return np.array([float(scores[c]) for c in self.keyword_classes] + [float(self._vague.is_vague(text))])

    def embed(self, texts):
        if self._embed is None:
            from sentence_transformers import SentenceTransformer

            e = self.spec["embedding"]
            st = SentenceTransformer(e["model"], revision=e["revision"])
            self._embed = lambda ts: st.encode([e["prefix"] + t for t in ts], normalize_embeddings=e["normalize"])
        return np.asarray(self._embed(list(texts)), dtype=np.float64)

    # ---------------------------------------------------------- inference

    def proba_from_features(self, embedding, rules) -> np.ndarray:
        """Probabilities in self.classes order, for rows of embeddings and
        unscaled rule features."""
        embedding = np.atleast_2d(np.asarray(embedding, dtype=np.float64))
        rules = np.atleast_2d(np.asarray(rules, dtype=np.float64))
        x = np.hstack([embedding, (rules - self.mean) / self.scale])
        z = x @ self.coef.T + self.intercept
        z -= z.max(axis=1, keepdims=True)
        e = np.exp(z)
        return e / e.sum(axis=1, keepdims=True)

    def predict_proba(self, texts) -> np.ndarray:
        texts = list(texts)
        return self.proba_from_features(self.embed(texts), [self.rule_features(t) for t in texts])

    def predict(self, text: str):
        """(predicted class, {class: probability})."""
        p = self.predict_proba([text])[0]
        return self.classes[int(np.argmax(p))], dict(zip(self.classes, p.tolist()))


def load(path: Path = FROZEN, sidecar: Path | None = None, root: Path = REPO, embed=None,
         check_embedding_weights: bool = True) -> FrozenHybrid:
    path = Path(path)
    sidecar = Path(sidecar) if sidecar else path.with_suffix(".sha256")
    if not sidecar.exists():
        raise FrozenModelError(f"no sidecar hash file {sidecar.name}")
    expected = sidecar.read_text(encoding="utf-8").split()[0]
    actual = _sha256(path)
    if actual != expected:
        raise FrozenModelError(f"{path.name} sha256 {actual} does not match the sidecar {expected}")
    spec = json.loads(path.read_bytes())
    for rel_path, digest in spec["feature_code_sha256"].items():
        if _sha256(root / rel_path) != digest:
            raise FrozenModelError(f"feature source {rel_path} has changed since the model was frozen")
    if check_embedding_weights and embed is None and spec["embedding"]["weights_sha256"]:
        from huggingface_hub import try_to_load_from_cache

        e = spec["embedding"]
        weights = try_to_load_from_cache(e["model"], e["weights_file"], revision=e["revision"])
        if not isinstance(weights, str) or _sha256(weights) != e["weights_sha256"]:
            raise FrozenModelError("the local embedding weights do not match the frozen model's")
    return FrozenHybrid(spec, root=root, embed=embed)
