"""Chapter 5 figures, from results already saved in the repository.

Run from the repository root with any Python that has matplotlib
(tested with matplotlib 3.9.2, Python 3.12):

    python docs/figures/ch5/make_figures.py

Each figure is written to docs/figures/ch5/ as PNG (300 dpi) and SVG,
with a CSV of the exact numbers plotted. Nothing is re-run: every value
is read from a saved result file, listed in SOURCES and in MANIFEST.csv.
No question text is read or drawn; only counts, ids and scores.

Two kinds of source:
- files on this branch (research/v4/...), read from the working tree;
- the KB-62 and fresh-test results, which exist only on branch
  kb/merge-60. They are read with "git show" at the pinned commit
  KB_COMMIT, so the figures do not change if that branch moves.

At the end the script compares its values with the figures quoted in
the report (STATED) and prints every difference; it changes neither.
"""

from __future__ import annotations

import csv
import json
import subprocess
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
KB_COMMIT = "9ae43bbec4f57141440d6722e7bac1312583f551"  # kb/merge-60

SOURCES = {
    "sealed": "research/v4/results/sealed_result.json",
    "sealed_v3": "research/v4/results/sealed_v3_comparison.json",
    "frozen": "research/v4/frozen/v4_hybrid_c10.json",
    "oof_hybrid": "research/v4/results/cv_hybrid_C10_oof.csv",
    "cv_hybrid": "research/v4/results/cv_hybrid_C10.json",
    "cv_lr_e5": "research/v4/results/cv_lr_e5_base_C10.json",
    "cv_distilbert": "research/v4/results/cv_distilbert_lr3e-5.json",
    "cv_distilbert_kw": "research/v4/results/cv_distilbert_kw_lr3e-5.json",
    "cv_m2": "research/v4/results/cv_baseline_m2.json",
    "cv_m1": "research/v4/results/cv_baseline_m1.json",
    "k5_full": f"{KB_COMMIT[:7]}:research/v4/results/k5_full_relabelled.json",
    "k5_question": f"{KB_COMMIT[:7]}:research/v4/results/k5_question_relabelled.json",
    "k5_base21": f"{KB_COMMIT[:7]}:research/v4/results/k5_baseline21_relabelled.json",
    "fresh": f"{KB_COMMIT[:7]}:research/eval/fresh_test/fresh_test_aggregate.json",
}

CLASSES = ("contraception", "sti", "pregnancy", "general", "out_of_scope", "vague")
CLASS_LABELS = ("contra-\nception", "STI", "preg-\nnancy", "general", "out of\nscope", "vague")

# Figures quoted in the report, checked against the saved values.
STATED = {
    "sealed V4 macro-F1": 0.8572,
    "sealed V4 reply kind": 0.8195,
    "sealed M2 macro-F1": 0.5864,
    "sealed M2 reply kind": 0.6146,
    "sealed M1 macro-F1": 0.5099,
    "sealed M1 reply kind": 0.7610,
    "four-class items": 156,
    "four-class V3 macro-F1": 0.5984,
    "four-class V4 as is macro-F1": 0.8810,
    "four-class V4 restricted macro-F1": 0.8727,
    "CV hybrid mean": 0.8835,
    "CV LR on e5 mean": 0.8606,
    "CV DistilBERT mean": 0.7883,
    "CV DistilBERT + keyword mean": 0.7866,
    "CV M2 mean": 0.6194,
    "CV M1 mean": 0.5166,
    "gate items": 40,
    "gate threshold": 0.8439,
    "dev 21 entries correct": 28,
    "dev 62 entries correct": 25,
    "dev questions": 35,
    "fresh questions": 82,
    "fresh 21 correct": 17,
    "fresh 62 correct": 24,
    "fresh 21 wrong served": 21,
    "fresh 62 wrong served": 29,
    "fresh 21 correct abstain/ask": 38,
    "fresh 62 correct abstain/ask": 21,
    "fresh 21 missed": 6,
    "fresh 62 missed": 8,
}

GREYS = ("#000000", "#7a7a7a", "#c8c8c8", "#ffffff")
HATCHES = ("", "///", "...", "xx")

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10,
    "axes.labelsize": 10.5,
    "axes.titlesize": 10.5,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 10,
    "axes.edgecolor": "black",
    "axes.linewidth": 0.8,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "hatch.linewidth": 0.6,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "savefig.facecolor": "white",
    "svg.fonttype": "none",
    "svg.hashsalt": "safegirl-ch5",
})

WIDTH = 6.5  # inches: the printed width, so 10 pt here is 10 pt on paper
manifest: list[dict] = []
computed: dict[str, float] = {}


# ---------------------------------------------------------------- reading


def read_text(key: str) -> str:
    src = SOURCES[key]
    if ":" in src:
        path = src.split(":", 1)[1]
        return subprocess.run(["git", "show", f"{KB_COMMIT}:{path}"], cwd=REPO, check=True,
                              capture_output=True, text=True, encoding="utf-8").stdout
    return (REPO / src).read_text(encoding="utf-8")


def read_json(key: str) -> dict:
    return json.loads(read_text(key))


def f1(precision: float, recall: float) -> float:
    return 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)


# ---------------------------------------------------------------- writing


def save(fig, name: str, rows: list[dict], sources: list[str], values: str) -> None:
    fig.savefig(HERE / f"{name}.png", dpi=300, bbox_inches="tight", metadata={"Software": None})
    fig.savefig(HERE / f"{name}.svg", bbox_inches="tight", metadata={"Date": None})
    plt.close(fig)
    with open(HERE / f"{name}.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    manifest.append({"figure": name, "source": "; ".join(SOURCES[s] for s in sources), "values": values})


def bar_labels(ax, bars, fmt="{:.3f}", pad=0.012) -> None:
    for b in bars:
        h = b.get_height()
        ax.text(b.get_x() + b.get_width() / 2, h + pad, fmt.format(h), ha="center", va="bottom", fontsize=10)


# ---------------------------------------------------------------- F1


def f1_confusion() -> None:
    v4 = read_json("sealed")["aggregates"]["classifier"]["all"]["v4"]
    labels, counts = v4["confusion"]["labels"], np.array(v4["confusion"]["matrix"])
    assert tuple(labels) == CLASSES
    norm = counts / counts.sum(axis=1, keepdims=True)

    fig, axes = plt.subplots(1, 2, figsize=(WIDTH, 3.9), constrained_layout=True)
    for ax, data, fmt, panel in ((axes[0], counts, "{:d}", "(a) Counts"),
                                 (axes[1], norm, "{:.2f}", "(b) Row-normalised")):
        vmax = data.max() if data is counts else 1.0
        ax.imshow(data, cmap="Greys", vmin=0, vmax=vmax)
        for i in range(6):
            for j in range(6):
                v = data[i, j]
                ax.text(j, i, fmt.format(int(v)) if data is counts else fmt.format(v), ha="center",
                        va="center", fontsize=10, color="white" if v > 0.55 * vmax else "black")
        ax.set_xticks(range(6), CLASS_LABELS, rotation=90)
        ax.set_yticks(range(6), CLASS_LABELS if ax is axes[0] else [""] * 6)
        ax.set_xlabel("Predicted class")
        ax.set_title(panel, loc="left")
        for side in ("top", "right"):
            ax.spines[side].set_visible(True)
    axes[0].set_ylabel("Expert label (true class)")

    rows = [{"true": t, "pred": p, "count": int(counts[i, j]), "row_normalised": round(float(norm[i, j]), 6)}
            for i, t in enumerate(CLASSES) for j, p in enumerate(CLASSES)]
    save(fig, "f1_v4_confusion", rows, ["sealed"],
         f"V4 sealed confusion, n={int(counts.sum())}, 6x6 counts and row shares")


# ---------------------------------------------------------------- F2


def f2_model_comparison() -> None:
    agg = read_json("sealed")["aggregates"]
    clf, rk = agg["classifier"]["all"], agg["reply_kind"]["all"]["correct_rate"]
    v3agg = read_json("sealed_v3")["aggregates"]
    four = v3agg["four_classes"]["all"]
    models = (("M1", "m1"), ("M2", "m2"), ("V4", "v4"))
    macro = [clf[k]["macro_f1"] for _, k in models]
    reply = [rk[k] for _, k in models]
    for (name, k), m, r in zip(models, macro, reply):
        computed[f"sealed {name} macro-F1"] = m
        computed[f"sealed {name} reply kind"] = r
    four_vals = [four["v3"]["macro_f1"], four["v4_as_is"]["macro_f1"], four["v4_restricted"]["macro_f1"]]
    computed["four-class items"] = v3agg["counts"]["four_class_items"]
    computed["four-class V3 macro-F1"] = four_vals[0]
    computed["four-class V4 as is macro-F1"] = four_vals[1]
    computed["four-class V4 restricted macro-F1"] = four_vals[2]

    fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 3.6), width_ratios=(3, 2), constrained_layout=True)
    x, w = np.arange(3), 0.38
    b1 = a.bar(x - w / 2, macro, w, color=GREYS[1], edgecolor="black", hatch=HATCHES[0], label="Macro-F1")
    b2 = a.bar(x + w / 2, reply, w, color=GREYS[3], edgecolor="black", hatch=HATCHES[1], label="Correct reply kind")
    bar_labels(a, list(b1) + list(b2), "{:.2f}")
    a.set_xticks(x, [m for m, _ in models])
    a.set_ylim(0, 1.12)
    a.set_ylabel("Score (proportion, 0 to 1)")
    a.set_xlabel(f"Model (sealed test, n = {clf['v4']['n']}, six classes)")
    a.set_title("(a) Six classes", loc="left")
    a.legend(loc="upper left", frameon=False, ncols=2)

    names = ("V3", "V4\nas is", "V4\nrestricted")
    bb = b.bar(np.arange(3), four_vals, 0.6, color=(GREYS[2], GREYS[1], GREYS[1]), edgecolor="black",
               hatch=(HATCHES[2], HATCHES[0], HATCHES[1]))
    bar_labels(b, bb, "{:.2f}")
    b.set_xticks(np.arange(3), names)
    b.set_ylim(0, 1.12)
    b.set_ylabel("Macro-F1 (0 to 1)")
    b.set_xlabel(f"Model (topic items, n = {computed['four-class items']})")
    b.set_title("(b) Four topic classes", loc="left")

    rows = [{"panel": "a_six_class", "model": n, "metric": "macro_f1", "value": m, "n": clf["v4"]["n"]}
            for (n, _), m in zip(models, macro)]
    rows += [{"panel": "a_six_class", "model": n, "metric": "reply_kind_correct_rate", "value": r,
              "n": agg["reply_kind"]["all"]["n"]} for (n, _), r in zip(models, reply)]
    rows += [{"panel": "b_four_class", "model": n.replace("\n", " "), "metric": "macro_f1", "value": v,
              "n": computed["four-class items"]} for n, v in zip(names, four_vals)]
    save(fig, "f2_model_comparison", rows, ["sealed", "sealed_v3"],
         "macro-F1 and reply-kind rate for M1, M2, V4 (n=205); four-class macro-F1 for V3, V4 (n=156)")


# ---------------------------------------------------------------- F3


def f3_per_class_f1() -> None:
    clf = read_json("sealed")["aggregates"]["classifier"]["all"]
    models = (("M1", "m1"), ("M2", "m2"), ("V4", "v4"))
    scores = {n: [f1(clf[k]["per_class"][c]["precision"], clf[k]["per_class"][c]["recall"]) for c in CLASSES]
              for n, k in models}

    fig, ax = plt.subplots(figsize=(WIDTH, 3.4), constrained_layout=True)
    x, w = np.arange(6), 0.27
    styles = ((GREYS[3], HATCHES[1]), (GREYS[2], HATCHES[2]), (GREYS[1], HATCHES[0]))
    for i, ((n, _), (color, hatch)) in enumerate(zip(models, styles)):
        ax.bar(x + (i - 1) * w, scores[n], w, color=color, edgecolor="black", hatch=hatch, label=n)
        for j, v in enumerate(scores[n]):
            if v == 0:  # a zero bar has no height; mark it so it is not read as missing
                ax.text(j + (i - 1) * w, 0.01, "0", ha="center", va="bottom", fontsize=10)
    ax.set_xticks(x, [f"{lbl}\n(n={clf['v4']['per_class'][c]['support']})" for lbl, c in zip(CLASS_LABELS, CLASSES)])
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("F1 (0 to 1)")
    ax.set_xlabel("True class (sealed test, n = 205)")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, 1.13), ncols=3, frameon=False)

    rows = [{"class": c, "model": n, "precision": clf[k]["per_class"][c]["precision"],
             "recall": clf[k]["per_class"][c]["recall"], "f1": scores[n][j],
             "support": clf[k]["per_class"][c]["support"]}
            for n, k in models for j, c in enumerate(CLASSES)]
    save(fig, "f3_per_class_f1", rows, ["sealed"],
         "per-class F1 = 2PR/(P+R) from saved precision and recall, M1, M2, V4")


# ---------------------------------------------------------------- F4


def f4_cv_folds() -> None:
    cands = (("Hybrid\n(e5 + rules)", "cv_hybrid", "CV hybrid mean"),
             ("LR on e5", "cv_lr_e5", "CV LR on e5 mean"),
             ("DistilBERT", "cv_distilbert", "CV DistilBERT mean"),
             ("DistilBERT\n+ keyword", "cv_distilbert_kw", "CV DistilBERT + keyword mean"),
             ("M2", "cv_m2", "CV M2 mean"),
             ("M1", "cv_m1", "CV M1 mean"))
    fig, ax = plt.subplots(figsize=(WIDTH, 3.6), constrained_layout=True)
    rows, ticks = [], []
    markers = ("o", "s", "^", "D", "v")
    for i, (label, key, stated) in enumerate(cands):
        d = read_json(key)
        folds = d["per_fold_macro_f1"]
        mean = d["macro_f1_mean"]
        computed[stated] = mean
        for j, (fold, v) in enumerate(sorted(folds.items(), key=lambda kv: int(kv[0]))):
            ax.scatter(i + (j - 2) * 0.07, v, marker=markers[j], s=26, facecolor="white", edgecolor="black",
                       linewidth=0.9, zorder=3, label=f"Fold {fold}" if i == 0 else None)
            rows.append({"candidate": label.replace("\n", " "), "source": SOURCES[key], "fold": int(fold),
                         "macro_f1": v, "mean": mean})
        ax.hlines(mean, i - 0.28, i + 0.28, color="black", linewidth=2.2, zorder=4,
                  label="Mean of folds" if i == 0 else None)
        ticks.append(f"{label}\nmean {mean:.3f}" if "\n" in label else f"{label}\n\nmean {mean:.3f}")
    ax.set_xticks(range(len(cands)), ticks)
    ax.set_xlim(-0.5, len(cands) - 0.5)
    ax.set_ylim(0.4, 1.0)
    ax.set_ylabel("Macro-F1 on held-out fold (0 to 1)")
    ax.set_xlabel("Candidate (five-fold cross-validation, 380 seeds)")
    ax.yaxis.grid(True, color="#dddddd", linewidth=0.6)
    ax.set_axisbelow(True)
    ax.legend(loc="lower left", ncols=3, frameon=False, fontsize=10)
    save(fig, "f4_cv_macro_f1_per_fold", rows,
         ["cv_hybrid", "cv_lr_e5", "cv_distilbert", "cv_distilbert_kw", "cv_m2", "cv_m1"],
         "per-fold macro-F1 (5 folds) and fold mean for six candidates")


# ---------------------------------------------------------------- F5


def f5_gate_scores() -> None:
    groups = (("correct", "Correct\nentry"), ("wrong", "Wrong\nentry"), ("off_topic", "Off-topic"))
    arms = (("k5_full", "(a) 62 entries, full mode"), ("k5_question", "(b) 62 entries, question mode"))
    fig, axes = plt.subplots(1, 2, figsize=(WIDTH, 3.6), sharey=True, constrained_layout=True)
    rows = []
    rng = np.random.default_rng(0)  # horizontal jitter only, for legibility
    for ax, (key, title) in zip(axes, arms):
        d = read_json(key)
        thr = d["gate_threshold"]
        computed["gate threshold"] = thr
        per = d["gate_set"]["per_query"]
        computed["gate items"] = len(per)
        unscored = [q for q in per if q.get("score") is None]
        data = []
        for g, _ in groups:
            vals = [q["score"] for q in per if q.get("kind") == g and q.get("score") is not None]
            data.append(vals)
            for q in per:
                if q.get("kind") == g and q.get("score") is not None:
                    rows.append({"arm": key, "mode": d["mode"], "kb_entries": d["health"]["kb_entries"],
                                 "item_id": q["id"], "group": g, "top1_score": q["score"],
                                 "passes_gate": q["passes_gate"], "threshold": thr})
        for q in unscored:
            rows.append({"arm": key, "mode": d["mode"], "kb_entries": d["health"]["kb_entries"],
                         "item_id": q["id"], "group": q["kind"], "top1_score": "", "passes_gate": "",
                         "threshold": thr})
        ax.boxplot(data, positions=range(3), widths=0.5, showfliers=False,
                   medianprops={"color": "black", "linewidth": 1.4},
                   boxprops={"color": "black"}, whiskerprops={"color": "black"}, capprops={"color": "black"})
        for i, vals in enumerate(data):
            jitter = rng.uniform(-0.12, 0.12, len(vals))
            ax.scatter(np.full(len(vals), i) + jitter, vals, s=18, facecolor=GREYS[1], edgecolor="black",
                       linewidth=0.5, zorder=3)
        ax.axhline(thr, color="black", linestyle="--", linewidth=1.1, label=f"Gate threshold {thr}")
        ax.set_xticks(range(3), [f"{lbl}\n(n={len(v)})" for (_, lbl), v in zip(groups, data)])
        ax.set_title(title, loc="left")
        ax.set_xlabel(f"Gate item group ({len(per) - len(unscored)} scored of {len(per)})")
    axes[0].set_ylabel("Top-1 retrieval score\n(cosine similarity)")
    axes[0].legend(loc="lower left", frameon=False)
    save(fig, "f5_gate_scores_kb62", rows, ["k5_full", "k5_question"],
         "top-1 score per gate item by group, 62-entry base, full and question modes; threshold line")


# ---------------------------------------------------------------- F6


def f6_retrieval() -> None:
    base21 = read_json("k5_base21")
    full62 = read_json("k5_full")
    q62 = read_json("k5_question")
    fresh = read_json("fresh")
    n_dev = base21["questions"]
    dev = (base21["correct"], q62["dev"]["correct"])
    computed["dev questions"] = n_dev
    computed["dev 21 entries correct"] = dev[0]
    computed["dev 62 entries correct"] = dev[1]
    computed["fresh questions"] = fresh["questions"]
    outcomes = (("correct_answer", "Correct\nanswer", "correct"), ("wrong_answer", "Wrong answer\nserved", "wrong served"),
                ("correct_abstain", "Correct\nabstain/ask", "correct abstain/ask"),
                ("missed_answer", "Missed\nanswer", "missed"))
    a21 = [fresh["counts"]["arm_a"][k] for k, _, _ in outcomes]
    a62 = [fresh["counts"]["arm_b"][k] for k, _, _ in outcomes]
    for (_, _, s), v21, v62 in zip(outcomes, a21, a62):
        computed[f"fresh 21 {s}"] = v21
        computed[f"fresh 62 {s}"] = v62

    fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 3.6), width_ratios=(1.3, 3), constrained_layout=True)
    bars = a.bar([0, 1], dev, 0.6, color=(GREYS[3], GREYS[1]), edgecolor="black", hatch=(HATCHES[1], HATCHES[0]))
    bar_labels(a, bars, "{:.0f}", pad=0.4)
    a.set_xticks([0, 1], ["21\nentries", "62\nentries"])
    a.set_ylim(0, n_dev)
    a.set_ylabel(f"Correct answers (count, of {n_dev})")
    a.set_xlabel("Knowledge base")
    a.set_title("(a) Dev set", loc="left")

    x, w = np.arange(4), 0.38
    b1 = b.bar(x - w / 2, a21, w, color=GREYS[3], edgecolor="black", hatch=HATCHES[1], label="21 entries")
    b2 = b.bar(x + w / 2, a62, w, color=GREYS[1], edgecolor="black", hatch=HATCHES[0], label="62 entries")
    bar_labels(b, list(b1) + list(b2), "{:.0f}", pad=0.4)
    b.set_xticks(x, [o[1] for o in outcomes])
    b.set_ylim(0, 45)
    b.set_ylabel("Questions (count)")
    b.set_xlabel(f"Outcome (fresh test, n = {fresh['questions']})")
    b.set_title("(b) Fresh test", loc="left")
    b.legend(loc="upper right", frameon=False)

    rows = [{"panel": "a_dev", "arm": "21 entries", "outcome": "correct_answer", "count": dev[0], "of": n_dev,
             "source": SOURCES["k5_base21"]},
            {"panel": "a_dev", "arm": "62 entries (question mode)", "outcome": "correct_answer", "count": dev[1],
             "of": n_dev, "source": SOURCES["k5_question"]}]
    rows += [{"panel": "b_fresh", "arm": arm, "outcome": k, "count": v, "of": fresh["questions"],
              "source": SOURCES["fresh"]}
             for arm, vals in (("21 entries (arm A)", a21), ("62 entries (arm B)", a62))
             for (k, _, _), v in zip(outcomes, vals)]
    rows.append({"panel": "note", "arm": "62 entries (full mode)", "outcome": "correct_answer",
                 "count": full62["dev"]["correct"], "of": n_dev, "source": SOURCES["k5_full"]})
    save(fig, "f6_retrieval_results", rows, ["k5_base21", "k5_question", "fresh"],
         "dev correct answers 21 vs 62 entries; fresh-test outcome counts arm A (21) vs arm B (62)")


# ---------------------------------------------------------------- F7


def f7_class_distribution() -> None:
    totals = read_json("frozen")["rows"]
    seeds = {c: 0 for c in CLASSES}
    for r in csv.DictReader(read_text("oof_hybrid").splitlines()):
        seeds[r["true"]] += 1
    paras = {c: totals["per_class"][c] - seeds[c] for c in CLASSES}
    assert sum(seeds.values()) == totals["seeds"] and sum(paras.values()) == totals["paraphrases"]

    fig, ax = plt.subplots(figsize=(WIDTH, 3.4), constrained_layout=True)
    x = np.arange(6)
    s = [seeds[c] for c in CLASSES]
    p = [paras[c] for c in CLASSES]
    ax.bar(x, s, 0.6, color=GREYS[1], edgecolor="black", hatch=HATCHES[0], label="Seeds")
    ax.bar(x, p, 0.6, bottom=s, color=GREYS[3], edgecolor="black", hatch=HATCHES[1], label="Paraphrases")
    for i in range(6):
        ax.text(i, s[i] + p[i] + 6, f"{s[i] + p[i]}", ha="center", va="bottom", fontsize=10)
    ax.set_xticks(x, [f"{lbl}\n{n} seeds" if "\n" in lbl else f"{lbl}\n\n{n} seeds"
                      for lbl, n in zip(CLASS_LABELS, s)])
    ax.set_ylim(0, 460)
    ax.set_ylabel("Training items (count)")
    ax.set_xlabel(f"Class (V4 training data: {totals['seeds']} seeds, {totals['paraphrases']} paraphrases)")
    ax.legend(loc="upper right", frameon=False)
    rows = [{"class": c, "seeds": seeds[c], "paraphrases": paras[c], "total": totals["per_class"][c]}
            for c in CLASSES]
    save(fig, "f7_class_distribution", rows, ["frozen", "oof_hybrid"],
         "seeds per class (OOF true labels) and paraphrases (frozen per-class total minus seeds)")


# ---------------------------------------------------------------- main


def differences() -> list[str]:
    out = []
    for k, stated in STATED.items():
        if k not in computed:
            out.append(f"{k}: not computed")
            continue
        v = computed[k]
        decimals = len(str(stated).split(".")[1]) if isinstance(stated, float) else 0
        if round(v, decimals) != stated:
            out.append(f"{k}: stated {stated}, saved {v}")
    return out


def main() -> None:
    for make in (f1_confusion, f2_model_comparison, f3_per_class_f1, f4_cv_folds, f5_gate_scores,
                 f6_retrieval, f7_class_distribution):
        make()
    with open(HERE / "MANIFEST.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["figure", "source", "values"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(manifest)
    for m in manifest:
        print(f"{m['figure']}: {m['source']}")
    diffs = differences()
    print("Differences from the stated figures:" if diffs else "No differences from the stated figures.")
    for d in diffs:
        print("  " + d)


if __name__ == "__main__":
    main()
