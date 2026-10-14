"""
Classifier and relevance analysis of the retrieval DEVELOPMENT set.

Reads the per-query inputs written by
  node research/eval/run_eval.js --analysis FILE --extra FILE
and writes Markdown tables (and, if matplotlib is installed, PNG figures)
to research/eval/results/. Analysis only: it changes no threshold, model,
KB or service.

Usage:
  python research/eval/analyze_classifier.py [INPUTS_CSV]

Standard library only; matplotlib is optional (figures are skipped without
it).
"""

import csv
import math
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "research" / "eval" / "results"
DEFAULT_INPUTS = RESULTS / "analysis_inputs_2026-10-14.csv"

CLASSES = ["contraception", "sti", "pregnancy", "general"]
BINS = [(0.30, 0.40), (0.40, 0.50), (0.50, 0.60), (0.60, 0.70),
        (0.70, 0.80), (0.80, 0.90), (0.90, 1.00)]


# ----------------------------------------------------------------- helpers

def load(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for key in ("ml_conf", *(f"p_{c}" for c in CLASSES),
                    "scoped_top1_score", "scoped_margin",
                    "unscoped_top1_score", "unscoped_margin"):
            r[key] = float(r[key]) if r.get(key) not in (None, "") else None
    return rows


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson score interval for a proportion k/n."""
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return (centre - half, centre + half)


def pct(x: float) -> str:
    return "n/a" if x != x else f"{100 * x:.1f}%"


def table(header: list[str], rows: list[list]) -> str:
    lines = ["| " + " | ".join(header) + " |",
             "|" + "|".join("---" for _ in header) + "|"]
    lines += ["| " + " | ".join(str(c) for c in row) + " |" for row in rows]
    return "\n".join(lines) + "\n"


def calibration_rows(rows: list[dict]) -> list[dict]:
    """Eval-set rows with a real, non-ambiguous expected class."""
    return [r for r in rows
            if r["source"] == "eval_set"
            and r["expected_class"] in CLASSES
            and "ambiguous" not in r["label_status"]]


# ----------------------------------------------------------------- part B

def part_b(rows: list[dict]) -> tuple[str, dict]:
    cal = calibration_rows(rows)
    n = len(cal)
    excluded = [r for r in rows if r["source"] == "eval_set"
                and r["expected_class"] in CLASSES and r not in cal]
    out = []
    say = out.append

    say("## B. Calibration and per-class errors\n")
    say(f"Rows: the {n} development-set queries with a real, non-ambiguous "
        f"`expected_class` (provisional labels). Excluded as ambiguous: "
        f"{', '.join(r['id'] for r in excluded)} (see `label_review.md`). "
        f"**n is small: every figure here is indicative only.**\n")

    # Accuracy with Wilson intervals, side by side.
    v3_ok = [r["ml_class"] == r["expected_class"] for r in cal]
    kw_ok = [r["kw_class"] == r["expected_class"] for r in cal]
    v3_k, kw_k = sum(v3_ok), sum(kw_ok)
    v3_lo, v3_hi = wilson(v3_k, n)
    kw_lo, kw_hi = wilson(kw_k, n)
    say("### Accuracy (95% Wilson interval)\n")
    say(table(["classifier", "correct", "n", "accuracy", "95% interval"], [
        ["DistilBERT V3 (ml_service)", v3_k, n, pct(v3_k / n), f"{pct(v3_lo)} to {pct(v3_hi)}"],
        ["frozen keyword baseline", kw_k, n, pct(kw_k / n), f"{pct(kw_lo)} to {pct(kw_hi)}"],
    ]))
    both = sum(a and b for a, b in zip(v3_ok, kw_ok))
    only_v3 = sum(a and not b for a, b in zip(v3_ok, kw_ok))
    only_kw = sum(b and not a for a, b in zip(v3_ok, kw_ok))
    neither = n - both - only_v3 - only_kw
    overlap = v3_lo <= kw_hi and kw_lo <= v3_hi
    discordant = only_v3 + only_kw
    # Exact two-sided McNemar test: binomial on the discordant pairs.
    tail = sum(math.comb(discordant, i) for i in range(min(only_v3, only_kw) + 1))
    p_mcnemar = min(1.0, 2 * tail / 2 ** discordant) if discordant else 1.0
    say(f"Paired on the same {n} queries: both right {both}, only V3 right "
        f"{only_v3}, only the baseline right {only_kw}, both wrong {neither}. "
        f"Exact McNemar test on the {discordant} discordant queries: "
        f"p = {p_mcnemar:.3f}. The two 95% intervals "
        f"{'overlap' if overlap else 'do not overlap, though only just'}. "
        f"With n = {n} on a development set, this is a strong hint, not a "
        f"measured difference.\n")
    kw_other = sorted({r["kw_class"] for r in cal} - set(CLASSES))
    if kw_other:
        say(f"The baseline can also output {', '.join(f'`{c}`' for c in kw_other)}; "
            f"such predictions count as wrong.\n")

    # Per-class precision and recall.
    say("### Per-class precision and recall\n")
    per_class = []
    for c in CLASSES:
        support = sum(r["expected_class"] == c for r in cal)
        cells = [c, support]
        for key in ("ml_class", "kw_class"):
            tp = sum(r[key] == c and r["expected_class"] == c for r in cal)
            predicted = sum(r[key] == c for r in cal)
            precision = tp / predicted if predicted else float("nan")
            recall = tp / support if support else float("nan")
            cells += [f"{pct(precision)} ({tp}/{predicted})", f"{pct(recall)} ({tp}/{support})"]
        per_class.append(cells)
    say(table(["class", "n", "V3 precision", "V3 recall",
               "baseline precision", "baseline recall"], per_class))

    # Confusion matrix (V3).
    say("### V3 confusion matrix (rows: expected, columns: predicted; counts)\n")
    say(table(["expected \\ predicted", *CLASSES], [
        [c, *(sum(r["expected_class"] == c and r["ml_class"] == p for r in cal)
              for p in CLASSES)] for c in CLASSES
    ]))

    # Reliability and ECE.
    say("### V3 reliability (confidence = top-1 softmax probability)\n")
    bins = []
    low = [r for r in cal if r["ml_conf"] < BINS[0][0]]
    if low:
        bins.append(("below 0.30", low))
    for lo, hi in BINS:
        members = [r for r in cal if lo <= r["ml_conf"] < hi or (hi == 1.0 and r["ml_conf"] == 1.0)]
        bins.append((f"{lo:.2f}-{hi:.2f}", members))
    ece = 0.0
    reliability = []
    for label, members in bins:
        if not members:
            reliability.append([label, 0, "-", "-", "-"])
            continue
        mean_conf = statistics.fmean(r["ml_conf"] for r in members)
        accuracy = statistics.fmean(r["ml_class"] == r["expected_class"] for r in members)
        ece += len(members) / n * abs(accuracy - mean_conf)
        reliability.append([label, len(members), f"{mean_conf:.3f}", pct(accuracy),
                            f"{accuracy - mean_conf:+.3f}"])
    say(table(["confidence bin", "n", "mean confidence", "accuracy",
               "accuracy minus confidence"], reliability))
    say(f"**Expected calibration error (ECE): {ece:.3f}** (weighted mean of "
        f"|accuracy - confidence| over the bins). With {n} queries spread over "
        f"{sum(1 for _, m in bins if m)} bins, most bins hold a handful of "
        f"queries, so the ECE is a rough indication only.\n")

    correct_conf = [r["ml_conf"] for r in cal if r["ml_class"] == r["expected_class"]]
    wrong_conf = [r["ml_conf"] for r in cal if r["ml_class"] != r["expected_class"]]
    say("### V3 confidence of correct and wrong predictions\n")
    say(table(["", "n", "median confidence", "min", "max"], [
        ["correct", len(correct_conf), f"{statistics.median(correct_conf):.3f}",
         f"{min(correct_conf):.3f}", f"{max(correct_conf):.3f}"],
        ["wrong", len(wrong_conf),
         f"{statistics.median(wrong_conf):.3f}" if wrong_conf else "-",
         f"{min(wrong_conf):.3f}" if wrong_conf else "-",
         f"{max(wrong_conf):.3f}" if wrong_conf else "-"],
    ]))

    wrong = sorted((r for r in cal if r["ml_class"] != r["expected_class"]),
                   key=lambda r: -r["ml_conf"])
    say("### Most confident wrong V3 predictions\n")
    say(table(["id", "query", "expected", "V3 predicted", "confidence", "baseline"], [
        [r["id"], r["query"], r["expected_class"], r["ml_class"],
         f"{r['ml_conf']:.3f}", r["kw_class"]] for r in wrong[:6]
    ]))

    headline = {
        "n": n, "v3": (v3_k, v3_lo, v3_hi), "kw": (kw_k, kw_lo, kw_hi), "ece": ece,
        "excluded": [r["id"] for r in excluded], "bins": bins, "p_mcnemar": p_mcnemar,
        "median_correct": statistics.median(correct_conf),
        "median_wrong": statistics.median(wrong_conf) if wrong_conf else None,
    }
    return "\n".join(out), headline


# ----------------------------------------------------------------- part C

NOT_ANSWER_GROUPS = {"off_topic", "gap", "held_topic", "missed_disclosure"}
SWEEP_CSV = RESULTS / "relevance_sweep_2026-10-14.csv"

SIGNALS = [
    ("unscoped_top1_score", "top-1 retrieval score (unscoped)"),
    ("unscoped_margin", "top-1/top-2 margin (unscoped)"),
    ("ml_conf", "classifier confidence (the current abstain signal)"),
    ("scoped_top1_score", "top-1 retrieval score (scoped to the predicted class)"),
    ("scoped_margin", "top-1/top-2 margin (scoped)"),
]
PRIMARY = 3  # the first three signals are the ones the analysis asks for


def relevance_sets(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    answer = [r for r in rows
              if r["source"] == "eval_set" and r["expected_behavior"] == "ANSWER"]
    not_answer = [r for r in rows if r["group"] in NOT_ANSWER_GROUPS]
    return answer, not_answer


def auc(pos: list[float], neg: list[float]) -> float:
    """P(a random should-answer row scores higher than a random should-not row); ties half."""
    wins = sum((p > q) + 0.5 * (p == q) for p in pos for q in neg)
    return wins / (len(pos) * len(neg))


def sweep(answer: list[dict], not_answer: list[dict], key: str) -> list[dict]:
    """Keep a row when its signal is >= the threshold; one step per observed value."""
    values = sorted({r[key] for r in answer + not_answer if r[key] is not None})
    points = []
    for t in values:
        kept_a = [r for r in answer if r[key] is not None and r[key] >= t]
        kept_n = [r for r in not_answer if r[key] is not None and r[key] >= t]
        points.append({
            "threshold": t,
            "answer_kept": len(kept_a) / len(answer),
            "not_answer_kept": len(kept_n) / len(not_answer),
            "kept_a": kept_a,
            "kept_n": kept_n,
        })
    return points


def best_point(points: list[dict], keep: float = 0.90) -> int | None:
    """The highest threshold that still keeps at least `keep` of should-answer rows."""
    ok = [i for i, p in enumerate(points) if p["answer_kept"] >= keep - 1e-12]
    return max(ok, key=lambda i: points[i]["threshold"]) if ok else None


def part_c(rows: list[dict]) -> tuple[str, dict, list[dict]]:
    answer, not_answer = relevance_sets(rows)
    out = []
    say = out.append
    sizes = {g: sum(r["group"] == g for r in not_answer) for g in sorted(NOT_ANSWER_GROUPS)}
    say("## C. Relevance signal\n")
    say(f"**Should answer:** the {len(answer)} development-set queries whose expected "
        f"behaviour is ANSWER. **Should not answer:** {len(not_answer)} queries ("
        + ", ".join(f"{g} {k}" for g, k in sizes.items())
        + "; the missed disclosures are the 10 queries in "
        "`holdout3_missed_pipeline.csv`). In neither set: help_seeking, the "
        "safety rows, Q19 (a held consent topic in the consent group) and Q53 "
        "(a gap query in the variant group). "
        f"**{len(answer)} against {len(not_answer)} queries is a small sample, so "
        "the result is indicative only.** Nothing here changes the gateway.\n")

    summary_rows, headline, sweep_rows = [], {}, []
    for key, label in SIGNALS:
        a = [r[key] for r in answer if r[key] is not None]
        b = [r[key] for r in not_answer if r[key] is not None]
        area = auc(a, b)
        summary_rows.append([
            label,
            f"{min(a):.3f} / {statistics.median(a):.3f} / {max(a):.3f}",
            f"{min(b):.3f} / {statistics.median(b):.3f} / {max(b):.3f}",
            f"{area:.3f}",
        ])
        points = sweep(answer, not_answer, key)
        for p in points:
            sweep_rows.append({
                "signal": key,
                "threshold": f"{p['threshold']:.4f}",
                "should_answer_kept": f"{p['answer_kept']:.3f}",
                "should_not_answer_kept": f"{p['not_answer_kept']:.3f}",
            })
        headline[key] = {"auc": area, "points": points, "best": best_point(points),
                         "label": label, "answer": a, "not_answer": b}

    say("### Distribution and separation\n")
    say(table(["signal", "should answer: min / median / max",
               "should not answer: min / median / max", "AUC"], summary_rows))
    say("AUC 0.5 means no separation; 1.0 means every should-answer query scores "
        "higher than every should-not-answer query. The last two rows are "
        "secondary: scoped retrieval depends on the predicted class, so it mixes "
        "the classifier and retrieval signals.\n")

    say("### Threshold sweep (keep a query when the signal is at or above the threshold)\n")
    say(f"The full sweep, one step per observed value, is in `{SWEEP_CSV.name}`. "
        "Below, for each of the three signals: the highest threshold that still "
        "keeps at least 90% of should-answer queries (**bold**), and its two "
        "neighbouring thresholds.\n")
    for key, _ in SIGNALS[:PRIMARY]:
        h = headline[key]
        points, best = h["points"], h["best"]
        say(f"#### {h['label']} (AUC {h['auc']:.3f})\n")
        if best is None:
            say("No threshold keeps 90% of should-answer queries.\n")
            continue
        picks = [i for i in (best - 1, best, best + 1) if 0 <= i < len(points)]
        say(table(["threshold", "should answer kept", "should not answer wrongly kept"], [
            [f"**{points[i]['threshold']:.4f}**" if i == best else f"{points[i]['threshold']:.4f}",
             f"{pct(points[i]['answer_kept'])} ({len(points[i]['kept_a'])}/{len(answer)})",
             f"{pct(points[i]['not_answer_kept'])} ({len(points[i]['kept_n'])}/{len(not_answer)})"]
            for i in picks
        ]))
        p = points[best]
        rejected_a = [r for r in answer if r not in p["kept_a"]]
        rejected_n = [r for r in not_answer if r not in p["kept_n"]]
        say(f"At **{p['threshold']:.4f}** it rejects {len(rejected_n)} of "
            f"{len(not_answer)} should-not-answer queries ("
            + (", ".join(r["id"] for r in rejected_n) or "none")
            + f"), still wrongly keeps {len(p['kept_n'])} ("
            + (", ".join(f"{r['id']} [{r['group']}]" for r in p["kept_n"]) or "none")
            + f"), and loses {len(rejected_a)} should-answer queries ("
            + (", ".join(f"{r['id']} \"{r['query']}\"" for r in rejected_a) or "none")
            + ").\n")
    return "\n".join(out), headline, sweep_rows


# ----------------------------------------------------------------- main

def main() -> None:
    inputs = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUTS
    rows = load(inputs)
    text_b, headline_b = part_b(rows)
    target = RESULTS / "classifier_calibration.md"
    target.write_text(
        "# Classifier calibration and per-class errors (development set)\n\n"
        f"Inputs: `{inputs.relative_to(ROOT).as_posix()}`. Labels: provisional "
        "(`resources/eval/retrieval_eval_set_expected_class_PROVISIONAL.csv`). "
        "Not the independent DR-04 test set.\n\n" + text_b,
        encoding="utf-8",
        newline="\n",
    )
    v3, kw = headline_b["v3"], headline_b["kw"]
    n = headline_b["n"]
    print(f"wrote {target.relative_to(ROOT)}")
    print(f"V3 {v3[0]}/{n} ({pct(v3[0]/n)}, {pct(v3[1])}-{pct(v3[2])}) | "
          f"baseline {kw[0]}/{n} ({pct(kw[0]/n)}, {pct(kw[1])}-{pct(kw[2])}) | "
          f"ECE {headline_b['ece']:.3f}")

    text_c, headline_c, sweep_rows = part_c(rows)
    target_c = RESULTS / "relevance_signal.md"
    target_c.write_text(
        "# Relevance signal: can the system tell when not to answer? "
        "(development set)\n\n"
        f"Inputs: `{inputs.relative_to(ROOT).as_posix()}`. Analysis only: no gate "
        "is implemented and no threshold is changed.\n\n" + text_c,
        encoding="utf-8",
        newline="\n",
    )
    with SWEEP_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["signal", "threshold", "should_answer_kept", "should_not_answer_kept"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(sweep_rows)
    print(f"wrote {target_c.relative_to(ROOT)} and {SWEEP_CSV.name}")
    for key, _ in SIGNALS:
        h = headline_c[key]
        b = h["points"][h["best"]] if h["best"] is not None else None
        print(f"{key:20s} AUC {h['auc']:.3f}" + (
            f" | best t={b['threshold']:.3f} keeps {pct(b['answer_kept'])} of should-answer, "
            f"wrongly keeps {pct(b['not_answer_kept'])} of should-not" if b else ""))


if __name__ == "__main__":
    main()
