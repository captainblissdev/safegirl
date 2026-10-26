"""V4 CV: hybrid logistic regression on [e5 embedding, keyword hit
counts, vague-rule flag].

Run from the repository root (CPU, .venv):

    .venv/Scripts/python.exe -I research/v4/cv_hybrid.py

Fixed in docs/decision-log.md, "V4 pre-registration: clarification 2
(2026-10-26)", item 4. The features of each text are:

- its e5 embedding ("query: ", normalized; the step 1 cache in
  research/v4/cache/), left as it is;
- the frozen keyword baseline's hit count for each of its classes
  (explain_baseline, in KEYWORD_CLASSES order);
- the vague-rule flag (vague_rule.is_vague, 0/1).

A StandardScaler is fitted on the keyword and flag columns of each
fold's training rows only, then applied to that fold's held-out seeds.
Grid: L2, C in {0.1, 1, 10}, class_weight balanced, max_iter 2000,
seed 42. The training set is without the V1 restore paraphrases (the
step 1 ablation); evaluation is on the held-out seeds only.

Writes research/v4/results/cv_hybrid_C<C>.json and _oof.csv for each C.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
GRID_C = (0.1, 1, 10)
SEED = 42
KEYWORD_CLASSES = ("gbv", "sti", "contraception", "pregnancy", "general")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cv = _load("cv_common", HERE / "cv_common.py")
lr_e5 = _load("cv_lr_e5", HERE / "cv_lr_e5.py")
vague = _load("vague_rule", HERE / "vague_rule.py")
baseline = _load("baseline_classifier", HERE.parents[1] / "research" / "experiments" / "baseline_classifier.py")


def rule_features(text: str) -> list[float]:
    """Keyword hit counts per baseline class, then the vague flag."""
    scores = baseline.explain_baseline(text)["scores"]
    assert set(scores) == set(KEYWORD_CLASSES), sorted(scores)
    return [float(scores[c]) for c in KEYWORD_CLASSES] + [float(vague.is_vague(text))]


def features(rows, vec, rules):
    """(embedding matrix, rule matrix) for rows, from {text: vector} and
    {text: rule features}."""
    return (np.array([vec[x["text"]] for x in rows]), np.array([rules[x["text"]] for x in rows]))


def design(train, test):
    """Stack each embedding with its scaled rule columns. The scaler is
    fitted on train's rule columns only. train and test are
    (embedding, rule) pairs; returns (X_train, X_test, scaler)."""
    scaler = StandardScaler().fit(train[1])
    return (np.hstack([train[0], scaler.transform(train[1])]),
            np.hstack([test[0], scaler.transform(test[1])]), scaler)


def run(data, vec, rules, C):
    oof = []
    for fold in cv.FOLDS:
        train = cv.train_rows(data, fold)
        evals = cv.eval_rows(data, fold)
        X_train, X_test, _ = design(features(train, vec, rules), features(evals, vec, rules))
        model = LogisticRegression(C=C, class_weight="balanced", max_iter=2000, random_state=SEED)
        model.fit(X_train, [x["cls"] for x in train])
        for s, p in zip(evals, model.predict_proba(X_test)):
            i = int(np.argmax(p))
            oof.append({"seed_id": s["seed_id"], "fold": fold, "true": s["cls"],
                        "pred": str(model.classes_[i]), "confidence": float(p[i])})
    return oof


def main():
    data = cv.load_data()
    texts = [x["text"] for x in data["seeds"] + data["paraphrases"]]
    vec = lr_e5.embed_all(texts)
    rules = {t: rule_features(t) for t in set(texts)}
    width = len(next(iter(vec.values()))) + len(KEYWORD_CLASSES) + 1
    for C in GRID_C:
        name = f"hybrid_C{C:g}"
        config = {"model": "LogisticRegression",
                  "features": ["multilingual-e5-small, 'query: ', normalized (unscaled)",
                               f"keyword hit counts {list(KEYWORD_CLASSES)} (scaled)", "vague-rule flag (scaled)"],
                  "feature_width": width, "scaler": "StandardScaler on rule columns, fitted on each fold's training rows",
                  "penalty": "l2 (sklearn default)", "C": C, "class_weight": "balanced", "max_iter": 2000,
                  "random_state": SEED, "training_set": "without V1 restore paraphrases"}
        s = cv.write_results(name, run(data, vec, rules, C), config)
        print(f"{name}: macro-F1 {s['macro_f1_mean']:.4f} +/- {s['macro_f1_sd']:.4f}; "
              f"sti {s['sti_recall']:.3f}; pregnancy {s['pregnancy_recall']:.3f}; "
              f"confident-wrong {s['confident_wrong']:.3f}; ECE {s['ece']:.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
