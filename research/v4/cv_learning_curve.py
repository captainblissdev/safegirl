"""V4 learning curve for the CV winner (e5 hybrid, C 10), CV only.

Run from the repository root (CPU, .venv):

    .venv/Scripts/python.exe -I research/v4/cv_learning_curve.py

For each held-out fold and each size in SIZES, a share of the training
seeds of each class is kept and the hybrid C 10 is fitted on them and
on their paraphrases (a paraphrase follows its seed), then scored on the
held-out fold's seeds, as in cv_hybrid.py. The held-out fold is never
subsampled.

Subsampling is seed-level and stratified by class: in each fold the
training seeds of each class are sorted by id and shuffled once with
random.Random(SEED), classes in cv_common.CLASSES order. Each size keeps
the first round(size x n) of them (at least 1). The sizes are nested,
20% within 40% and so on, and 100% is exactly the cv_hybrid_C10 run,
which main() checks.

Trains nothing beyond these CV fits; nothing is frozen. Writes
research/v4/results/cv_learning_curve.json and .md. The PNG is drawn
from the JSON by plot_learning_curve.py.
"""

from __future__ import annotations

import importlib.util
import json
import math
import random
import statistics
import sys
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

HERE = Path(__file__).resolve().parent
SIZES = (0.2, 0.4, 0.6, 0.8, 1.0)
SEED = 20261026
C = 10


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


hy = _load("cv_hybrid", HERE / "cv_hybrid.py")
cv = hy.cv


def keep_count(size: float, n: int) -> int:
    return max(1, math.floor(size * n + 0.5))


def shuffled_training_seeds(data, held_out, seed=SEED):
    """{class: [seed ids in shuffled order]} for the training folds."""
    rng = random.Random(seed)
    out = {}
    for c in cv.CLASSES:
        ids = sorted(s["seed_id"] for s in data["seeds"] if s["fold"] != held_out and s["cls"] == c)
        rng.shuffle(ids)
        out[c] = ids
    return out


def subsample(data, held_out, size, order=None):
    """Training rows for one fold at one size: the kept seeds and their
    paraphrases, in cv_common.train_rows order."""
    order = order or shuffled_training_seeds(data, held_out)
    kept = {sid for ids in order.values() for sid in ids[:keep_count(size, len(ids))]}
    return [x for x in cv.train_rows(data, held_out) if x["seed_id"] in kept], kept


def fit_score(data, vec, rules, held_out, train):
    evals = cv.eval_rows(data, held_out)
    X_train, X_test, _ = hy.design(hy.features(train, vec, rules), hy.features(evals, vec, rules))
    model = LogisticRegression(C=C, class_weight="balanced", max_iter=2000, random_state=hy.SEED)
    model.fit(X_train, [x["cls"] for x in train])
    pred = [str(p) for p in model.predict(X_test)]
    return cv.macro_f1([s["cls"] for s in evals], pred)


def run(data, vec, rules):
    rows = []
    orders = {k: shuffled_training_seeds(data, k) for k in cv.FOLDS}
    for size in SIZES:
        per_fold, seeds_per_class, train_rows = {}, {c: [] for c in cv.CLASSES}, []
        for k in cv.FOLDS:
            train, kept = subsample(data, k, size, orders[k])
            per_fold[str(k)] = fit_score(data, vec, rules, k, train)
            cls_of = {s["seed_id"]: s["cls"] for s in data["seeds"]}
            for c in cv.CLASSES:
                seeds_per_class[c].append(sum(1 for sid in kept if cls_of[sid] == c))
            train_rows.append(len(train))
        values = list(per_fold.values())
        mean_per_class = {c: statistics.mean(v) for c, v in seeds_per_class.items()}
        rows.append({"size": size, "per_fold_macro_f1": per_fold, "macro_f1_mean": statistics.mean(values),
                     "macro_f1_sd": statistics.stdev(values), "mean_seeds_per_class": mean_per_class,
                     "mean_seeds_per_class_overall": statistics.mean(mean_per_class.values()),
                     "mean_training_rows": statistics.mean(train_rows)})
    return rows


def markdown(rows):
    lines = ["# V4 learning curve (e5 hybrid, C 10)", "",
             "Seed-level, class-stratified subsampling of the training folds (random seed "
             f"{SEED}, nested sizes); paraphrases follow their seeds; scored on the held-out fold seeds.", "",
             "| Training seeds | Mean seeds per class | Mean training rows | Macro-F1 mean +/- sd | "
             "Fold 1 | Fold 2 | Fold 3 | Fold 4 | Fold 5 |", "|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        f = r["per_fold_macro_f1"]
        lines.append(f"| {r['size']:.0%} | {r['mean_seeds_per_class_overall']:.1f} | {r['mean_training_rows']:.0f} | "
                     f"{r['macro_f1_mean']:.4f} +/- {r['macro_f1_sd']:.4f} | "
                     + " | ".join(f"{f[str(k)]:.4f}" for k in cv.FOLDS) + " |")
    lines += ["", "Mean seeds per class at each size:", "",
              "| Training seeds | " + " | ".join(cv.CLASSES) + " |", "|---" * (len(cv.CLASSES) + 1) + "|"]
    for r in rows:
        lines.append(f"| {r['size']:.0%} | " + " | ".join(f"{r['mean_seeds_per_class'][c]:.1f}"
                                                         for c in cv.CLASSES) + " |")
    return "\n".join(lines) + "\n"


def main():
    data = cv.load_data()
    texts = [x["text"] for x in data["seeds"] + data["paraphrases"]]
    vec = hy.lr_e5.embed_all(texts)
    rules = {t: hy.rule_features(t) for t in set(texts)}
    rows = run(data, vec, rules)
    full = json.loads((cv.RESULTS_DIR / "cv_hybrid_C10.json").read_text(encoding="utf-8"))["per_fold_macro_f1"]
    for k, v in rows[-1]["per_fold_macro_f1"].items():
        assert abs(v - full[k]) < 1e-12, f"100% fold {k} does not reproduce cv_hybrid_C10"
    out = {"model": "e5 hybrid, C 10, without V1 restore paraphrases", "seed": SEED, "sizes": list(SIZES),
           "subsampling": "seed-level, stratified by class, nested; paraphrases follow their seeds",
           "check": "the 100% row reproduces cv_hybrid_C10.json per fold", "rows": rows}
    (cv.RESULTS_DIR / "cv_learning_curve.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8",
                                                           newline="\n")
    md = markdown(rows)
    (cv.RESULTS_DIR / "cv_learning_curve.md").write_text(md, encoding="utf-8", newline="\n")
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
