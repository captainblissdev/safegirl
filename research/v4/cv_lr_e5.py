"""V4 CV: logistic regression on e5 embeddings, with and without the V1
restore paraphrases.

Run from the repository root (CPU, .venv):

    .venv/Scripts/python.exe -I research/v4/cv_lr_e5.py

The grid is fixed in docs/decision-log.md, "V4 pre-registration:
clarification 2 (2026-10-26)": L2, C in {0.1, 1, 10}, class_weight
balanced, max_iter 2000, seed 42. Each fold trains on the other folds'
seeds and paraphrases (plus, for the "v1" set, the V1 restore
candidates of those folds) and scores its own seeds. Confidence is the
top predicted probability.

Every text is embedded with e5_embedder() from check_seeds.py ("query: "
prefix, normalized). Embeddings are cached in research/v4/cache/, keyed
by the sha256 of the text; that folder is excluded through
.git/info/exclude and never committed.

Writes research/v4/results/cv_lr_e5_<set>_C<C>.json and _oof.csv for each
run, and cv_lr_e5_grid.json with the table and the V1 ablation outcome.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

HERE = Path(__file__).resolve().parent
CACHE = HERE / "cache" / "e5_query.npz"
GRID_C = (0.1, 1, 10)
SEED = 42
TIE = 0.01


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cv = _load("cv_common", HERE / "cv_common.py")


def key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def embed_all(texts, cache=CACHE):
    """{text: vector}, embedding only the texts not already in the cache."""
    store = {}
    if cache.exists():
        with np.load(cache) as z:
            store = dict(zip(z["keys"].tolist(), z["vectors"]))
    todo = [t for t in dict.fromkeys(texts) if key(t) not in store]
    if todo:
        check_seeds = _load("check_seeds", HERE / "check_seeds.py")
        vectors = check_seeds.e5_embedder()(todo)
        store.update(zip((key(t) for t in todo), vectors))
        cache.parent.mkdir(parents=True, exist_ok=True)
        keys = sorted(store)
        np.savez(cache, keys=np.array(keys), vectors=np.array([store[k] for k in keys]))
    print(f"embeddings: {len(set(texts))} texts, {len(todo)} newly embedded", file=sys.stderr)
    return {t: store[key(t)] for t in texts}


def run(data, vec, C, extra=()):
    oof = []
    for fold in cv.FOLDS:
        train = cv.train_rows(data, fold, extra)
        evals = cv.eval_rows(data, fold)
        model = LogisticRegression(C=C, class_weight="balanced", max_iter=2000, random_state=SEED)
        model.fit(np.array([vec[x["text"]] for x in train]), [x["cls"] for x in train])
        proba = model.predict_proba(np.array([vec[x["text"]] for x in evals]))
        for s, p in zip(evals, proba):
            i = int(np.argmax(p))
            oof.append({"seed_id": s["seed_id"], "fold": fold, "true": s["cls"],
                        "pred": str(model.classes_[i]), "confidence": float(p[i])})
    return oof


def ablation(best):
    """V1 ablation: the set with the better best-of-grid CV macro-F1; ties
    go to the smaller set ("base"). Reported both with an exact
    comparison and with the 0.01 selection tie window."""
    gain = best["v1"] - best["base"]
    return {"best_macro_f1": best, "gain_with_v1": gain,
            "winner_exact": "v1" if gain > 0 else "base",
            "winner_tie_window_0.01": "v1" if gain > TIE else "base"}


def main():
    data = cv.load_data()
    v1 = cv.load_v1_restore(data)
    sets = {"base": (), "v1": v1}
    texts = [x["text"] for x in data["seeds"] + data["paraphrases"] + v1]
    vec = embed_all(texts)
    table, best = [], {}
    for set_name, extra in sets.items():
        for C in GRID_C:
            name = f"lr_e5_{set_name}_C{C:g}"
            config = {"model": "LogisticRegression", "features": "multilingual-e5-small, 'query: ', normalized",
                      "penalty": "l2 (sklearn default)", "C": C, "class_weight": "balanced", "max_iter": 2000,
                      "random_state": SEED, "training_set": set_name, "v1_rows": len(extra)}
            s = cv.write_results(name, run(data, vec, C, extra), config)
            row = {"candidate": name, "set": set_name, "C": C, "macro_f1_mean": s["macro_f1_mean"],
                   "macro_f1_sd": s["macro_f1_sd"], "sti_recall": s["sti_recall"],
                   "pregnancy_recall": s["pregnancy_recall"], "confident_wrong": s["confident_wrong"],
                   "ece": s["ece"]}
            table.append(row)
            best[set_name] = max(best.get(set_name, 0.0), s["macro_f1_mean"])
            print(f"{name}: macro-F1 {row['macro_f1_mean']:.4f} +/- {row['macro_f1_sd']:.4f}; "
                  f"sti {row['sti_recall']:.3f}; pregnancy {row['pregnancy_recall']:.3f}; "
                  f"confident-wrong {row['confident_wrong']:.3f}; ECE {row['ece']:.3f}")
    result = {"grid": table, "v1_ablation": ablation(best), "v1_rows": len(v1)}
    (cv.RESULTS_DIR / "cv_lr_e5_grid.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8",
                                                       newline="\n")
    print(json.dumps(result["v1_ablation"], indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
