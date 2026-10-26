"""V4 CV selection: apply the pre-registered rule to the step 1-3a
results. Trains nothing; reads research/v4/results/cv_*.json only.

Run from the repository root:

    .venv/Scripts/python.exe -I research/v4/cv_selection.py

The rule is docs/decision-log.md, "V4 pre-registration: clarification 2
(2026-10-26)", item 3: highest mean-over-folds macro-F1; candidates
within 0.01 of the best count as tied; among tied, the lowest
confident-wrong rate; if still tied, the simpler model (LR on e5 <
hybrid e5 < DistilBERT < DistilBERT + keyword). Each family enters at
its best setting by mean macro-F1; a tie between settings goes to the
lower C or lower lr. The baseline is M2, "the baseline" by step 1; M1
is listed for reference and is not a candidate.

The DistilBERT lr 2e-5 and 3e-5 runs (deviation 1) and DistilBERT +
keyword (deviation 2) are in docs/decision-log.md.

The paired per-fold comparison and the winner's details are reported
for the record and are not part of the rule.

Writes research/v4/results/cv_selection.json and cv_selection.md.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
TIE = 0.01
CLASSES = ("contraception", "sti", "pregnancy", "general", "out_of_scope", "vague")

# family -> its result files (settings, lowest C or lr first); simplicity
# rank for the last tie-break
CANDIDATES = {
    "baseline M2": {"files": ["baseline_m2"], "simplicity": None},
    "LR on e5 (no V1)": {"files": ["lr_e5_base_C0.1", "lr_e5_base_C1", "lr_e5_base_C10"], "simplicity": 0},
    "hybrid e5": {"files": ["hybrid_C0.1", "hybrid_C1", "hybrid_C10"], "simplicity": 1},
    "DistilBERT": {"files": ["distilbert_lr5e-6", "distilbert_lr1e-5", "distilbert_lr2e-5", "distilbert_lr3e-5"],
                   "simplicity": 2},
    "DistilBERT + keyword": {"files": ["distilbert_kw_lr3e-5"], "simplicity": 3},
}
# listed for reference only, not a candidate
REFERENCE = {"baseline M1": "baseline_m1"}


def read(name, results=RESULTS):
    return json.loads((results / f"cv_{name}.json").read_text(encoding="utf-8"))


def pick_best(runs):
    """The run with the highest mean macro-F1; runs are ordered lowest C
    or lr first, and a tie goes to the earlier (lower) one."""
    best = runs[0]
    for r in runs[1:]:
        if r["macro_f1_mean"] > best["macro_f1_mean"]:
            best = r
    return best


def best_settings(results=RESULTS):
    out = {}
    for cand, spec in CANDIDATES.items():
        best = pick_best([read(f, results) for f in spec["files"]])
        out[cand] = {"setting": best["candidate"], "summary": best, "simplicity": spec["simplicity"]}
    return out


def reference(results=RESULTS):
    return {name: {"setting": f, "summary": read(f, results), "simplicity": None} for name, f in REFERENCE.items()}


def select(best, tie=TIE):
    """The rule, step by step; returns (winner, steps)."""
    top = max(b["summary"]["macro_f1_mean"] for b in best.values())
    tied = [c for c, b in best.items() if b["summary"]["macro_f1_mean"] >= top - tie]
    steps = {"best_macro_f1": top, "tie_threshold": top - tie, "tied": tied,
             "confident_wrong_of_tied": {c: best[c]["summary"]["confident_wrong"] for c in tied}}
    if len(tied) > 1:
        low = min(steps["confident_wrong_of_tied"].values())
        tied = [c for c in tied if best[c]["summary"]["confident_wrong"] == low]
        steps["after_confident_wrong"] = tied
    if len(tied) > 1:
        ranked = [c for c in tied if best[c]["simplicity"] is not None]
        tied = [min(ranked, key=lambda c: best[c]["simplicity"])]
        steps["after_simpler_model"] = tied
    steps["decided_by"] = ("macro-F1" if "after_confident_wrong" not in steps
                           else "confident-wrong" if "after_simpler_model" not in steps else "simpler model")
    steps["winner"] = tied[0]
    return tied[0], steps


def paired(best, winner):
    w = best[winner]["summary"]["per_fold_macro_f1"]
    out = {}
    for cand, b in best.items():
        if cand == winner:
            continue
        diff = {f: w[f] - b["summary"]["per_fold_macro_f1"][f] for f in w}
        out[cand] = {"per_fold_diff": diff, "mean_diff": sum(diff.values()) / len(diff),
                     "folds_winner_ahead": sum(1 for d in diff.values() if d > 0), "folds": len(diff)}
    return out


def details(summary):
    labels, m = summary["confusion"]["labels"], summary["confusion"]["matrix"]
    off = [(labels[i], labels[j], m[i][j]) for i in range(len(labels)) for j in range(len(labels))
           if i != j and m[i][j]]
    off.sort(key=lambda x: (-x[2], x[0], x[1]))
    return {"per_class": {c: {k: summary["pooled_per_class"][c][k] for k in ("precision", "recall", "f1", "support")}
                          for c in labels},
            "confusion": summary["confusion"],
            "top_confusions": [{"true": t, "pred": p, "count": n} for t, p, n in off[:5]]}


def table_row(c, b):
    s = b["summary"]
    cw = f"{s['confident_wrong']:.3f}" + (" (plain error rate)" if s["confident_wrong_is_plain_error_rate"] else "")
    ece = "n/a" if s["ece"] is None else f"{s['ece']:.3f}"
    return (f"| {c} | {b['setting']} | {s['macro_f1_mean']:.4f} +/- {s['macro_f1_sd']:.4f} | "
            f"{s['sti_recall']:.3f} | {s['pregnancy_recall']:.3f} | {cw} | {ece} |")


def markdown(best, steps, pair, info, ref):
    winner = steps["winner"]
    lines = ["# V4 CV selection", "",
             "Rule: docs/decision-log.md, clarification 2, item 3. Held-out seeds only (380), "
             "folds research/v4/fold_assignment_v4.csv.", "",
             "| Candidate | Best setting | Mean macro-F1 +/- sd | STI recall | Pregnancy recall | "
             "Confident-wrong | ECE |", "|---|---|---|---|---|---|---|"]
    lines += [table_row(c, b) for c, b in best.items()]
    lines += [table_row(f"{c} (reference, not a candidate)", b) for c, b in ref.items()]
    lines += ["", "## Decision", "",
              f"1. Best mean macro-F1: {steps['best_macro_f1']:.4f} ({winner}).",
              f"2. Within 0.01 of it (>= {steps['tie_threshold']:.4f}): {', '.join(steps['tied'])}.",
              "3. Confident-wrong of those: " + ", ".join(f"{c} {v:.3f}" for c, v in
                                                          steps["confident_wrong_of_tied"].items()) + "."]
    if "after_confident_wrong" in steps:
        lines.append(f"4. Lowest confident-wrong: {', '.join(steps['after_confident_wrong'])}.")
    if "after_simpler_model" in steps:
        lines.append(f"5. Simpler model: {', '.join(steps['after_simpler_model'])}.")
    lines += [f"Winner: **{winner}, {best[winner]['setting']}** (decided by {steps['decided_by']}).", "",
              "## Paired per-fold comparison (for the record, not part of the rule)", "",
              f"Per-fold macro-F1 of {winner} minus each candidate.", "",
              "| Candidate | Fold 1 | Fold 2 | Fold 3 | Fold 4 | Fold 5 | Mean | Folds ahead |",
              "|---|---|---|---|---|---|---|---|"]
    for c, p in pair.items():
        d = p["per_fold_diff"]
        lines.append(f"| {c} | " + " | ".join(f"{d[f]:+.4f}" for f in sorted(d)) +
                     f" | {p['mean_diff']:+.4f} | {p['folds_winner_ahead']}/{p['folds']} |")
    lines += ["", f"## Winner's pooled out-of-fold details", "",
              "| Class | Precision | Recall | F1 | Support |", "|---|---|---|---|---|"]
    for c, v in info["per_class"].items():
        lines.append(f"| {c} | {v['precision']:.3f} | {v['recall']:.3f} | {v['f1']:.3f} | {v['support']} |")
    labels = info["confusion"]["labels"]
    lines += ["", "Confusion matrix (rows true, columns predicted):", "",
              "| true \\ pred | " + " | ".join(labels) + " |", "|---" * (len(labels) + 1) + "|"]
    for lab, row in zip(labels, info["confusion"]["matrix"]):
        lines.append(f"| {lab} | " + " | ".join(str(n) for n in row) + " |")
    lines += ["", "Most frequent confusions:", ""]
    lines += [f"- {x['true']} -> {x['pred']}: {x['count']}" for x in info["top_confusions"]]
    return "\n".join(lines) + "\n"


def main():
    best = best_settings()
    ref = reference()
    winner, steps = select(best)
    pair = paired(best, winner)
    info = details(best[winner]["summary"])
    keys = ("macro_f1_mean", "macro_f1_sd", "per_fold_macro_f1", "sti_recall", "pregnancy_recall",
            "confident_wrong", "confident_wrong_is_plain_error_rate", "ece")
    table = {c: {"setting": b["setting"], **{k: b["summary"][k] for k in keys}} for c, b in best.items()}
    out = {"rule": "docs/decision-log.md, clarification 2, item 3", "candidates": table,
           "settings_considered": {c: spec["files"] for c, spec in CANDIDATES.items()},
           "reference": {c: {"setting": b["setting"], **{k: b["summary"][k] for k in keys}} for c, b in ref.items()},
           "decision": steps, "paired_per_fold": pair, "winner_details": info}
    (RESULTS / "cv_selection.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8", newline="\n")
    md = markdown(best, steps, pair, info, ref)
    (RESULTS / "cv_selection.md").write_text(md, encoding="utf-8", newline="\n")
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
