"""Fit the V4 CV winner on all data and freeze it as JSON (no pickle).

Run from the repository root (CPU, .venv):

    .venv/Scripts/python.exe -I research/v4/freeze_hybrid.py            # fit and write
    .venv/Scripts/python.exe -I research/v4/freeze_hybrid.py --verify   # refit, compare bytes

The model is the e5 hybrid at C 10, chosen in docs/decision-log.md, "V4
CV selection (2026-10-26)", with t_act 0.45 from "V4 threshold rule
(2026-10-26)". It is fitted on all 380 seeds and their paraphrases (the
same exclusions as CV, no V1 restore paraphrases), with the CV settings:
a StandardScaler on the 6 rule columns fitted on these rows, L2,
class_weight balanced, max_iter 2000, seed 42.

The JSON holds everything research/v4/v4_infer.py needs, plus the
provenance: the classes in the model's order, the feature order and
widths, the scaler, the coefficients and intercepts, C, t_act, the
embedding model id, prefix, revision and weights hash, the sha256 of
the feature code and data files and of every training input, row
counts, versions and the git commit. It holds no seed text. The output
has no timestamp and fixed key order, and floats are written with
repr, so a refit at the same commit gives the same bytes; --verify
checks that.

Writes research/v4/frozen/v4_hybrid_c10.json and the sidecar
v4_hybrid_c10.sha256.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
import platform
import subprocess
import sys
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
FROZEN_DIR = HERE / "frozen"
FROZEN = FROZEN_DIR / "v4_hybrid_c10.json"
SIDECAR = FROZEN_DIR / "v4_hybrid_c10.sha256"
C = 10
T_ACT = 0.45
PREFIX = "query: "
EMBED_WIDTH = 384


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


hy = _load("cv_hybrid", HERE / "cv_hybrid.py")
cv = hy.cv
check_seeds = _load("check_seeds", HERE / "check_seeds.py")
REPO = cv.REPO
EMBED_MODEL = check_seeds.E5_MODEL

FEATURE_SOURCES = (
    "research/experiments/baseline_classifier.py",
    "research/v4/vague_rule.py",
    "app/gateway/src/vagueQuery.js",
    "app/gateway/src/content/healthTerms.json",
    "app/gateway/src/content/extraHealthTerms.json",
)


def rel(path: Path) -> str:
    return path.resolve().relative_to(REPO).as_posix()


def training_inputs(root=REPO):
    v4 = root / "research" / "v4"
    files = sorted(v4.glob("seeds_v4_batch*.csv")) + [root / "resources" / "seeds" / "seeds.csv"]
    files += sorted((root / "resources" / "reviewed").glob("*.csv"))
    files += sorted((root / "resources" / "reviewed" / "v4").glob("*.csv"))
    files += [v4 / "fold_assignment_v4.csv", v4 / "dr05_exclusions.csv", v4 / "v3_pool_exclusions.csv"]
    return files


def embedding_provenance():
    """Revision and weights sha256 from the local Hugging Face cache, or
    None where the code cannot read them."""
    try:
        from huggingface_hub import try_to_load_from_cache

        path = try_to_load_from_cache(EMBED_MODEL, "model.safetensors")
    except ImportError:
        path = None
    if not isinstance(path, str):
        return {"revision": None, "weights_file": None, "weights_sha256": None}
    path = Path(path)
    return {"revision": path.parent.name, "weights_file": "model.safetensors", "weights_sha256": cv.sha256(path)}


def fit(data, vec, rules):
    """(model, scaler, train rows) for the hybrid on every seed and paraphrase."""
    train = data["seeds"] + data["paraphrases"]
    emb, raw = hy.features(train, vec, rules)
    scaler = StandardScaler().fit(raw)
    X = np.hstack([emb, scaler.transform(raw)])
    model = LogisticRegression(C=C, class_weight="balanced", max_iter=2000, random_state=hy.SEED)
    model.fit(X, [x["cls"] for x in train])
    return model, scaler, train


def git_state(root=REPO):
    def git(*args):
        return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=True).stdout

    return {"commit": git("rev-parse", "HEAD").strip(),
            "tracked_changes": bool(git("status", "--porcelain", "--untracked-files=no").strip())}


def export(model, scaler, train):
    counts = {c: sum(1 for x in train if x["cls"] == c) for c in cv.CLASSES}
    versions = {p: importlib.metadata.version(p) for p in
                ("scikit-learn", "numpy", "torch", "transformers", "sentence-transformers", "huggingface_hub")}
    rule_names = [f"keyword:{c}" for c in hy.KEYWORD_CLASSES] + ["vague_flag"]
    return {
        "name": "v4_hybrid_c10",
        "model": "LogisticRegression (multinomial), L2",
        "classes": [str(c) for c in model.classes_],
        "features": {
            "order": ["e5 embedding", "keyword hit counts", "vague-rule flag"],
            "widths": {"embedding": EMBED_WIDTH, "keyword": len(hy.KEYWORD_CLASSES), "vague": 1},
            "total": EMBED_WIDTH + len(rule_names),
            "keyword_classes": list(hy.KEYWORD_CLASSES),
            "rule_columns": rule_names,
            "embedding_scaled": False,
        },
        "scaler": {"columns": rule_names, "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()},
        "coef": model.coef_.tolist(),
        "intercept": model.intercept_.tolist(),
        "C": C,
        "penalty": "l2",
        "class_weight": "balanced",
        "max_iter": 2000,
        "random_state": hy.SEED,
        "n_iter": [int(n) for n in model.n_iter_],
        "t_act": T_ACT,
        "embedding": {"model": EMBED_MODEL, "prefix": PREFIX, "normalize": True, **embedding_provenance()},
        "feature_code_sha256": {p: cv.sha256(REPO / p) for p in FEATURE_SOURCES},
        "training_inputs_sha256": {rel(p): cv.sha256(p) for p in training_inputs()},
        "rows": {"seeds": sum(1 for x in train if x["id"] == x["seed_id"]),
                 "paraphrases": sum(1 for x in train if x["id"] != x["seed_id"]),
                 "total": len(train), "per_class": counts, "v1_restore_paraphrases": 0},
        "versions": {"python": platform.python_version(), **versions},
        "git": git_state(),
        "decision_log": ["V4 CV selection (2026-10-26)", "V4 threshold rule (2026-10-26)"],
    }


def serialise(obj) -> bytes:
    return (json.dumps(obj, indent=1) + "\n").encode("utf-8")


def build():
    data = cv.load_data()
    texts = [x["text"] for x in data["seeds"] + data["paraphrases"]]
    vec = hy.lr_e5.embed_all(texts)
    rules = {t: hy.rule_features(t) for t in set(texts)}
    model, scaler, train = fit(data, vec, rules)
    assert len(model.classes_) == len(cv.CLASSES) and model.coef_.shape[1] == EMBED_WIDTH + 6
    return serialise(export(model, scaler, train))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--verify", action="store_true", help="refit and compare with the frozen file; write nothing")
    args = ap.parse_args(argv)
    blob = build()
    digest = hashlib.sha256(blob).hexdigest()
    if args.verify:
        same = FROZEN.read_bytes() == blob
        print(f"refit sha256 {digest}; frozen {cv.sha256(FROZEN)}; byte-identical: {same}")
        return 0 if same else 1
    FROZEN_DIR.mkdir(parents=True, exist_ok=True)
    FROZEN.write_bytes(blob)
    SIDECAR.write_text(f"{digest}  {FROZEN.name}\n", encoding="utf-8", newline="\n")
    print(f"wrote {rel(FROZEN)}, sha256 {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
