"""V4 CV: the frozen keyword baseline under mappings M1 and M2.

Run from the repository root:

    .venv/Scripts/python.exe -I research/v4/cv_baseline.py

The baseline is research/experiments/baseline_classifier.py, unchanged.
It is not trained, so each fold just labels its held-out seeds. The two
mappings to the six V4 classes are fixed in docs/decision-log.md, "V4
pre-registration: clarification 2 (2026-10-26)":

- M1 raw: the baseline label as is, gbv -> general.
- M2 pipeline-style: the vague-query rule (vague_rule.py) first ->
  vague; else zero keyword hits -> out_of_scope; gbv -> general; else
  the baseline label.

The baseline has no probability: confident_wrong is its plain error rate
(flagged in the output) and ECE is not defined.

Writes research/v4/results/cv_baseline_m1.json, cv_baseline_m2.json and
their _oof.csv files.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cv = _load("cv_common", HERE / "cv_common.py")
vague = _load("vague_rule", HERE / "vague_rule.py")
baseline = _load("baseline_classifier", HERE.parents[1] / "research" / "experiments" / "baseline_classifier.py")


def m1(text: str) -> str:
    label = baseline.classify_baseline(text)
    return "general" if label == "gbv" else label


def m2(text: str) -> str:
    if vague.is_vague(text):
        return "vague"
    if sum(baseline.explain_baseline(text)["scores"].values()) == 0:
        return "out_of_scope"
    label = baseline.classify_baseline(text)
    return "general" if label == "gbv" else label


MAPPINGS = {"baseline_m1": m1, "baseline_m2": m2}


def run(data, mapping):
    oof = []
    for fold in cv.FOLDS:
        for s in cv.eval_rows(data, fold):
            oof.append({"seed_id": s["seed_id"], "fold": fold, "true": s["cls"],
                        "pred": mapping(s["text"]), "confidence": None})
    return oof


def main(out=sys.stdout):
    data = cv.load_data()
    for name, mapping in MAPPINGS.items():
        oof = run(data, mapping)
        s = cv.write_results(name, oof, {"model": "frozen keyword baseline", "mapping": name,
                                         "baseline_file": "research/experiments/baseline_classifier.py"},
                             has_confidence=False)
        print(f"{name}: macro-F1 {s['macro_f1_mean']:.4f} +/- {s['macro_f1_sd']:.4f}; "
              f"sti recall {s['sti_recall']:.3f}; pregnancy recall {s['pregnancy_recall']:.3f}; "
              f"error rate {s['confident_wrong']:.3f}", file=out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
