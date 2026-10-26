"""V4 threshold calibration on CV out-of-fold predictions only.

Run from the repository root:

    .venv/Scripts/python.exe -I research/v4/cv_threshold.py

The rule is docs/decision-log.md, "V4 threshold rule (2026-10-26)",
written before these numbers: on the pooled OOF predictions of the CV
winner (cv_hybrid_C10_oof.csv), t_act is the smallest t in 0.30, 0.35,
..., 0.70 such that the predictions with confidence >= t have accuracy
>= 0.90 and sti and pregnancy precision >= 0.90 each. If none qualifies,
t_act is None and nothing is relaxed. 0.35 and 0.50 are reference rows.

For every t the table gives: coverage (share of OOF items with
confidence >= t), accuracy, macro-F1 (six classes) and sti and pregnancy
precision on the covered items, the confident-wrong rate at t (items
wrong with confidence >= t, as a share of all items), and the number of
items below t. A class with no covered prediction has no precision
(None), which does not qualify.

Trains nothing. Writes research/v4/results/cv_threshold.json and .md.
"""

from __future__ import annotations

import csv
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OOF = HERE / "results" / "cv_hybrid_C10_oof.csv"
GRID = tuple(round(0.30 + 0.05 * i, 2) for i in range(9))
REFERENCE = (0.35, 0.50)
FLOOR = 0.90
GUARDED = ("sti", "pregnancy")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cv = _load("cv_common", HERE / "cv_common.py")


def read_oof(path=OOF):
    with open(path, encoding="utf-8", newline="") as f:
        return [{"true": r["true"], "pred": r["pred"], "confidence": float(r["confidence"])}
                for r in csv.DictReader(f)]


def precision(rows, cls):
    predicted = [r for r in rows if r["pred"] == cls]
    return sum(1 for r in predicted if r["true"] == cls) / len(predicted) if predicted else None


def row_at(oof, t):
    covered = [r for r in oof if r["confidence"] >= t]
    n = len(oof)
    true, pred = [r["true"] for r in covered], [r["pred"] for r in covered]
    return {"t": t, "coverage": len(covered) / n, "covered": len(covered), "below": n - len(covered),
            "accuracy": sum(1 for a, b in zip(true, pred) if a == b) / len(covered) if covered else None,
            "macro_f1": cv.macro_f1(true, pred) if covered else None,
            **{f"{c}_precision": precision(covered, c) for c in GUARDED},
            "confident_wrong": sum(1 for r in covered if r["true"] != r["pred"]) / n,
            "reference": t in REFERENCE}


def qualifies(row, floor=FLOOR):
    values = [row["accuracy"]] + [row[f"{c}_precision"] for c in GUARDED]
    return all(v is not None and v >= floor for v in values)


def choose(table):
    """The smallest qualifying t, or None."""
    for row in sorted(table, key=lambda r: r["t"]):
        if qualifies(row):
            return row["t"]
    return None


def fmt(v, digits=3):
    return "n/a" if v is None else f"{v:.{digits}f}"


def markdown(table, t_act, n):
    lines = ["# V4 threshold calibration", "",
             "Rule: docs/decision-log.md, \"V4 threshold rule (2026-10-26)\". Pooled out-of-fold predictions "
             f"of the e5 hybrid at C 10 ({n} held-out seeds). The sealed set is not used.", "",
             "| t | Coverage | Accuracy | Macro-F1 | STI precision | Pregnancy precision | Confident-wrong | "
             "Below t | Qualifies |", "|---|---|---|---|---|---|---|---|---|"]
    for r in table:
        label = f"{r['t']:.2f}" + (" (reference)" if r["reference"] else "")
        lines.append(f"| {label} | {fmt(r['coverage'])} | {fmt(r['accuracy'])} | {fmt(r['macro_f1'])} | "
                     f"{fmt(r['sti_precision'])} | {fmt(r['pregnancy_precision'])} | {fmt(r['confident_wrong'])} | "
                     f"{r['below']} | {'yes' if qualifies(r) else 'no'} |")
    lines += ["", f"t_act = **{t_act:.2f}** (the smallest qualifying t)." if t_act is not None else
              "**No t qualifies.** t_act is not set and the rule is not relaxed."]
    return "\n".join(lines) + "\n"


def main():
    oof = read_oof()
    table = [row_at(oof, t) for t in GRID]
    t_act = choose(table)
    out = {"rule": "docs/decision-log.md, V4 threshold rule (2026-10-26)", "oof_file": str(OOF.relative_to(cv.REPO)),
           "n": len(oof), "grid": list(GRID), "floor": FLOOR, "guarded_classes": list(GUARDED),
           "reference_thresholds": list(REFERENCE), "table": table, "t_act": t_act,
           "confident_wrong_definition": "wrong with confidence >= t, as a share of all items"}
    (cv.RESULTS_DIR / "cv_threshold.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8", newline="\n")
    md = markdown(table, t_act, len(oof))
    (cv.RESULTS_DIR / "cv_threshold.md").write_text(md, encoding="utf-8", newline="\n")
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
