"""V4 post-gate descriptive comparison with V3, on the sealed items.

Run from the repository root (.venv, CPU; Node on PATH). The input
paths are arguments and never stored in the repository:

    .venv/Scripts/python.exe -I research/v4/v3_comparison.py \
        --texts TEXTS.csv --labels LABELS.csv --confirm-final

Descriptive only: docs/decision-log.md, "V4 post-gate descriptive
comparison with V3 (2026-10-27)". No decision depends on it.

- Pre-run checks, as in sealed_eval.py: the V3 checkpoint's sha256 is
  the one in the decision log; the V4 frozen model matches its sidecar;
  the fold file; a clean git status for research/v4 and app; the
  decision-log entries it follows; inputs outside the repository; the
  same 205 ids with valid labels; no earlier run. Without
  --confirm-final it is check-only: it prints the checklist and stops,
  writing no lock and computing nothing. With it, a lock
  (V3_COMPARISON_RUN.lock) is created next to the labels file before
  anything is computed. --dry-run skips the lock and the 205 count and
  writes everything next to the labels file, marked DRY RUN.
- V3 is loaded offline from ml_service/final and classifies each text
  on its own, as ml_service/app.py does (truncation at 64, softmax,
  argmax). V4 is the frozen e5 hybrid (v4_infer), as is (six-class
  argmax) and restricted to the four topic classes (argmax over their
  probabilities, confidence renormalised over the four).
- On the items whose topic label is one of V3's four classes, and on
  the subset where no upstream rule fires: accuracy, macro-F1 over the
  four classes, per-class precision and recall, confusion matrix,
  confident-wrong (> 0.5), ECE (10 bins), V3's abstain rate at 0.35;
  McNemar's exact test on correct/incorrect (V4 as is vs V3, V4
  restricted vs V3); a paired bootstrap of each macro-F1 difference
  (10,000 resamples, numpy default_rng(42), 95% percentile interval).
- On all items, a reply-kind correct rate: V3 is the upstream rules,
  then confidence < 0.35 -> abstain, otherwise answer; V4 as in
  triage_sim.

Outputs: aggregates only to research/v4/results/sealed_v3_comparison
.json and .md; per-item rows (ids and labels, no text) next to the
labels file. Nothing printed or written contains question text or an
input path.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import importlib.metadata
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
V3_DIR = REPO / "ml_service" / "final"
V3_WEIGHTS = V3_DIR / "model.safetensors"
V3_MAX_LENGTH = 64
V3_ABSTAIN = 0.35
TOPICS = ("contraception", "sti", "pregnancy", "general")
LOCK_NAME = "V3_COMPARISON_RUN.lock"
RESULTS = HERE / "results"
CONFIDENT = 0.5
REQUIRED_TITLES = (
    "## V4 sealed result (2026-10-27)",
    "## V4 post-gate descriptive comparison with V3 (2026-10-27)",
)


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


se = _load("sealed_eval", HERE / "sealed_eval.py")
cv, ts = se.cv, se.ts
sha256, mcnemar_exact = se.sha256, se.mcnemar_exact


# --------------------------------------------------------- pre-run checks


def prerun_checks(texts_path, labels_path, dry_run=False, root=REPO, v3_weights=V3_WEIGHTS, log=se.DECISION_LOG,
                  clean=None):
    """sealed_eval's checks (its lock check replaced by this script's),
    plus the V3 checkpoint hash and this comparison's log entries."""
    checks, texts, labels = se.prerun_checks(texts_path, labels_path, dry_run=True, root=root, log=log, clean=clean)
    checks = [c for c in checks if not c[0].startswith("item count")]
    log_text = Path(log).read_text(encoding="utf-8") if Path(log).exists() else ""
    v3_hash = sha256(v3_weights) if Path(v3_weights).exists() else None
    extra = [("V3 checkpoint sha256 is the one in the decision log", bool(v3_hash and v3_hash in log_text),
              v3_hash or "missing")]
    lines = set(log_text.splitlines())
    missing = [t[3:] for t in REQUIRED_TITLES if t not in lines]
    extra.append(("decision-log entries present (sealed result, V3 comparison)", not missing,
                  "missing: " + "; ".join(missing) if missing else ""))
    if dry_run:
        n = len(texts) if texts is not None else 0
        extra.append(("item count (dry run: 205 not required)", n > 0, f"{n} items"))
    else:
        n = len(texts) if texts is not None else 0
        extra.append((f"{se.EXPECTED_N} items", n == se.EXPECTED_N, f"{n} items"))
        extra.append(("no previous run (no V3 comparison lock next to the labels file)",
                      not (Path(labels_path).parent / LOCK_NAME).exists(), ""))
    return checks + extra, texts, labels


def acquire_lock(labels_path, texts_path) -> Path:
    lock = Path(labels_path).parent / LOCK_NAME
    record = {"timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
              "v3_checkpoint_sha256": sha256(V3_WEIGHTS), "v4_frozen_sha256": sha256(se.FROZEN),
              "labels_sha256": sha256(labels_path), "texts_sha256": sha256(texts_path),
              "script_sha256": sha256(__file__)}
    with open(lock, "x", encoding="utf-8") as f:
        json.dump(record, f, indent=1)
        f.write("\n")
    return lock


# ------------------------------------------------------------- models


class V3:
    """The frozen V3 checkpoint, offline, one text at a time as in
    ml_service/app.py."""

    def __init__(self, model_dir=V3_DIR):
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self.torch = torch
        self.tok = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_dir, local_files_only=True)
        self.model.eval()
        self.labels = [str(self.model.config.id2label[i]).lower() for i in range(self.model.config.num_labels)]
        assert sorted(self.labels) == sorted(TOPICS), self.labels

    def predict_proba(self, texts) -> np.ndarray:
        """Rows in TOPICS order."""
        order = [self.labels.index(c) for c in TOPICS]
        out = []
        for text in texts:
            enc = self.tok(text, return_tensors="pt", truncation=True, padding=True, max_length=V3_MAX_LENGTH)
            with self.torch.inference_mode():
                p = self.torch.softmax(self.model(**enc).logits, dim=-1)[0].numpy().astype(np.float64)
            out.append(p[order])
        return np.array(out)


def restricted(v4_proba_row, v4_classes):
    """(class, confidence) over the four topic classes only: the argmax of
    their probabilities, renormalised to sum to 1."""
    p = np.array([v4_proba_row[v4_classes.index(c)] for c in TOPICS], dtype=np.float64)
    p = p / p.sum()
    i = int(np.argmax(p))
    return TOPICS[i], float(p[i])


def v3_kind(upstream: str, confidence: float) -> str:
    """V3 reply kind: the upstream rules first, then abstain below 0.35,
    otherwise answer."""
    if upstream:
        return ts.UPSTREAM_KIND[upstream]
    return "abstain" if confidence < V3_ABSTAIN else "answer"


# ------------------------------------------------------------- metrics


def per_class(true, pred, labels=TOPICS):
    """Precision and recall for each of labels; predictions outside
    labels count as misses for the true class and as nobody's positive."""
    return {c: cv.per_class(true, pred, labels)[c] for c in labels}


def confusion(true, pred, rows=TOPICS, cols=TOPICS):
    index = {c: i for i, c in enumerate(cols)}
    m = [[0] * len(cols) for _ in rows]
    for t, p in zip(true, pred):
        m[rows.index(t)][index[p]] += 1
    return {"rows": list(rows), "cols": list(cols), "matrix": m}


def block(true, pred, conf, cols=TOPICS) -> dict:
    n = len(true)
    pc = per_class(true, pred)
    return {"n": n, "accuracy": (sum(1 for t, p in zip(true, pred) if t == p) / n) if n else None,
            "macro_f1": (sum(pc[c]["f1"] for c in TOPICS) / len(TOPICS)) if n else None,
            "per_class": {c: {"precision": pc[c]["precision"], "recall": pc[c]["recall"],
                              "support": pc[c]["support"]} for c in TOPICS},
            "confusion": confusion(true, pred, cols=cols),
            "confident_wrong": cv.confident_wrong(true, pred, conf, CONFIDENT) if n else None,
            "ece": cv.ece(true, pred, conf) if n else None}


def macro_f1_topics(true_codes, pred_codes, k=len(cv.CLASSES)) -> float:
    """Macro-F1 over the four topic classes from codes in cv.CLASSES
    order (topics are the first four), vectorised for the bootstrap."""
    cm = np.bincount(np.asarray(true_codes) * k + np.asarray(pred_codes), minlength=k * k).reshape(k, k)
    tp = np.diag(cm).astype(float)[:4]
    fp = cm.sum(axis=0)[:4] - tp
    fn = cm.sum(axis=1)[:4] - tp
    with np.errstate(divide="ignore", invalid="ignore"):
        prec = np.where(tp + fp > 0, tp / (tp + fp), 0.0)
        rec = np.where(tp + fn > 0, tp / (tp + fn), 0.0)
        f1 = np.where(prec + rec > 0, 2 * prec * rec / (prec + rec), 0.0)
    return float(f1.mean())


def paired_bootstrap(true, pred_a, pred_b, n_boot=se.BOOTSTRAP, seed=se.BOOTSTRAP_SEED):
    """(point, low, high) for macro-F1(a) - macro-F1(b) over the four topic
    classes; numpy default_rng(seed), 95% percentile interval."""
    index = {c: i for i, c in enumerate(cv.CLASSES)}
    g, a, b = (np.array([index[x] for x in v]) for v in (true, pred_a, pred_b))
    point = macro_f1_topics(g, a) - macro_f1_topics(g, b)
    draws = np.random.default_rng(seed).integers(0, len(g), size=(n_boot, len(g)))
    diffs = np.array([macro_f1_topics(g[i], a[i]) - macro_f1_topics(g[i], b[i]) for i in draws])
    low, high = np.percentile(diffs, [2.5, 97.5])
    return point, float(low), float(high)


def mcnemar(correct_a, correct_b) -> dict:
    b = sum(1 for x, y in zip(correct_a, correct_b) if x and not y)
    c = sum(1 for x, y in zip(correct_a, correct_b) if not x and y)
    return {"a_right_b_wrong": b, "a_wrong_b_right": c, "p_exact": mcnemar_exact(b, c)}


def evaluate(texts, labels, v4_model, v3_model) -> tuple[dict, list[dict]]:
    label_of = {i: (c, r, a == "1") for i, c, r, a in labels}
    v4p = v4_model.predict_proba([t for _, t in texts])
    rows = ts.simulate(texts, v4_model, proba=v4p)
    v3p = v3_model.predict_proba([t for _, t in texts])
    items = []
    for (item_id, _), row, p4, p3 in zip(texts, rows, v4p, v3p):
        topic, route, ambiguous = label_of[item_id]
        r_cls, r_conf = restricted(p4, v4_model.classes)
        v3_cls, v3_conf = TOPICS[int(np.argmax(p3))], float(np.max(p3))
        expected = se.expected_kinds(topic, route)
        k3 = v3_kind(row["upstream_fired"], v3_conf)
        items.append({"id": item_id, "topic_label": topic, "route": route, "ambiguous": ambiguous,
                      "upstream_fired": row["upstream_fired"], "v3_class": v3_cls, "v3_confidence": v3_conf,
                      "v4_class": row["v4_class"], "v4_confidence": float(np.max(p4)),
                      "v4r_class": r_cls, "v4r_confidence": r_conf, "expected_kind": "|".join(sorted(expected)),
                      "v3_kind": k3, "v4_kind": row["v4_kind"], "v3_kind_correct": k3 in expected,
                      "v4_kind_correct": row["v4_kind"] in expected})

    def compare(subset):
        t = [x["topic_label"] for x in subset]
        out = {"v3": block(t, [x["v3_class"] for x in subset], [x["v3_confidence"] for x in subset]),
               "v4_as_is": block(t, [x["v4_class"] for x in subset], [x["v4_confidence"] for x in subset],
                                 cols=cv.CLASSES),
               "v4_restricted": block(t, [x["v4r_class"] for x in subset], [x["v4r_confidence"] for x in subset])}
        out["v3"]["abstain_rate_at_0.35"] = (sum(1 for x in subset if x["v3_confidence"] < V3_ABSTAIN) / len(subset)
                                             if subset else None)
        ok = {m: [x[f"{k}_class"] == x["topic_label"] for x in subset]
              for m, k in (("v3", "v3"), ("v4_as_is", "v4"), ("v4_restricted", "v4r"))}
        out["mcnemar"] = {"v4_as_is_vs_v3": mcnemar(ok["v4_as_is"], ok["v3"]),
                          "v4_restricted_vs_v3": mcnemar(ok["v4_restricted"], ok["v3"])}
        return out

    four = [x for x in items if x["topic_label"] in TOPICS]
    four_no_up = [x for x in four if not x["upstream_fired"]]
    t = [x["topic_label"] for x in four]
    boot = {}
    for name, key in (("v4_as_is_minus_v3", "v4"), ("v4_restricted_minus_v3", "v4r")):
        point, low, high = paired_bootstrap(t, [x[f"{key}_class"] for x in four], [x["v3_class"] for x in four])
        boot[name] = {"point": point, "ci95": [low, high]}

    def kind_rates(subset):
        n = len(subset)
        return {"n": n, "v3": sum(x["v3_kind_correct"] for x in subset) / n if n else None,
                "v4": sum(x["v4_kind_correct"] for x in subset) / n if n else None}

    aggregates = {
        "counts": {"items": len(items), "four_class_items": len(four), "four_class_no_upstream": len(four_no_up),
                   "topic_label": {c: sum(1 for x in items if x["topic_label"] == c) for c in cv.CLASSES}},
        "four_classes": {"all": compare(four), "no_upstream": compare(four_no_up)},
        "bootstrap": {"statistic": "macro-F1 over the four topic classes, difference with V3", **boot,
                      "resamples": se.BOOTSTRAP, "seed": se.BOOTSTRAP_SEED,
                      "method": "numpy default_rng, item resampling, percentile interval"},
        "reply_kind": {"all": kind_rates(items), "no_upstream": kind_rates([x for x in items
                                                                           if not x["upstream_fired"]])},
    }
    return aggregates, items


# ------------------------------------------------------------- outputs


def fmt(v, digits=4):
    return "n/a" if v is None else f"{v:.{digits}f}"


def markdown(result, dry_run) -> str:
    a, prov = result["aggregates"], result["provenance"]
    title = "# V4 post-gate descriptive comparison with V3" + (" (DRY RUN)" if dry_run else "")
    lines = [title, ""]
    if dry_run:
        lines += ["**DRY RUN on synthetic data. This is not a result.**", ""]
    lines += ["Descriptive only; no decision depends on it.", "",
              f"V3 checkpoint sha256 {prov['v3_checkpoint_sha256']}; V4 frozen model sha256 "
              f"{prov['v4_frozen_sha256']}; labels sha256 {prov['labels_sha256']}; script sha256 "
              f"{prov['script_sha256']}; git {prov['git_head']}.", "",
              "## Counts", "",
              f"{a['counts']['items']} items; {a['counts']['four_class_items']} with a topic label in V3's four "
              f"classes; {a['counts']['four_class_no_upstream']} of those where no upstream rule fires. "
              f"Topic labels: {a['counts']['topic_label']}.", ""]
    names = (("v3", "V3"), ("v4_as_is", "V4 as is"), ("v4_restricted", "V4 restricted"))
    for subset, label in (("all", "four-class items"), ("no_upstream", "four-class items, no upstream rule fires")):
        c = a["four_classes"][subset]
        lines += [f"## {label} (n = {c['v3']['n']})", "",
                  "| | Accuracy | Macro-F1 (4) | Confident-wrong | ECE |", "|---|---|---|---|---|"]
        for key, name in names:
            b = c[key]
            lines.append(f"| {name} | {fmt(b['accuracy'])} | {fmt(b['macro_f1'])} | {fmt(b['confident_wrong'])} | "
                         f"{fmt(b['ece'])} |")
        lines += ["", f"V3 abstain rate at 0.35: {fmt(c['v3']['abstain_rate_at_0.35'])}.", "",
                  "Per-class precision / recall:", "", "| Class | V3 | V4 as is | V4 restricted | Support |",
                  "|---|---|---|---|---|"]
        for cls in TOPICS:
            cells = [f"{fmt(c[k]['per_class'][cls]['precision'], 3)} / {fmt(c[k]['per_class'][cls]['recall'], 3)}"
                     for k, _ in names]
            lines.append(f"| {cls} | " + " | ".join(cells) + f" | {c['v3']['per_class'][cls]['support']} |")
        for key, name in names:
            m = c[key]["confusion"]
            lines += ["", f"{name} confusion (rows true, columns predicted):", "",
                      "| | " + " | ".join(m["cols"]) + " |", "|---" * (len(m["cols"]) + 1) + "|"]
            lines += [f"| {r} | " + " | ".join(str(v) for v in row) + " |" for r, row in zip(m["rows"], m["matrix"])]
        lines += ["", "McNemar exact on correct/incorrect (V4 right and V3 wrong / V4 wrong and V3 right):", ""]
        for k, v in c["mcnemar"].items():
            lines.append(f"- {k.replace('_', ' ')}: {v['a_right_b_wrong']} / {v['a_wrong_b_right']}, "
                         f"p = {fmt(v['p_exact'])}")
        lines.append("")
    bs = a["bootstrap"]
    lines += ["## Paired bootstrap, four-class items", ""]
    for k in ("v4_as_is_minus_v3", "v4_restricted_minus_v3"):
        lines.append(f"- {k.replace('_', ' ')}: {fmt(bs[k]['point'])}, 95% interval [{fmt(bs[k]['ci95'][0])}, "
                     f"{fmt(bs[k]['ci95'][1])}]")
    lines += ["", f"({bs['resamples']} resamples, seed {bs['seed']}.)", "",
              "## Reply-kind correct rate", "",
              "V3: upstream rules first, then confidence < 0.35 -> abstain, otherwise answer. V4 as in triage_sim.", "",
              "| Subset | n | V3 | V4 |", "|---|---|---|---|"]
    for subset in ("all", "no_upstream"):
        r = a["reply_kind"][subset]
        lines.append(f"| {subset} | {r['n']} | {fmt(r['v3'])} | {fmt(r['v4'])} |")
    return "\n".join(lines) + "\n"


def write_items(items, path):
    cols = ["id", "topic_label", "route", "ambiguous", "upstream_fired", "v3_class", "v3_confidence", "v4_class",
            "v4_confidence", "v4r_class", "v4r_confidence", "expected_kind", "v3_kind", "v4_kind", "v3_kind_correct",
            "v4_kind_correct"]
    with open(path, "x", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        for x in items:
            w.writerow({**{k: x[k] for k in cols}, "ambiguous": int(x["ambiguous"]),
                        **{k: f"{x[k]:.6f}" for k in ("v3_confidence", "v4_confidence", "v4r_confidence")}})


def run(texts, labels, labels_path, texts_path, dry_run, v4_model=None, v3_model=None, results_dir=RESULTS) -> dict:
    v4_model = v4_model or _load("v4_infer", HERE / "v4_infer.py").load()
    v3_model = v3_model or V3()
    aggregates, items = evaluate(texts, labels, v4_model, v3_model)
    head = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True,
                          check=True).stdout.strip()
    versions = {p: importlib.metadata.version(p) for p in ("torch", "transformers", "numpy")}
    result = {"dry_run": dry_run, "descriptive_only": True,
              "provenance": {"v3_checkpoint_sha256": sha256(V3_WEIGHTS), "v4_frozen_sha256": sha256(se.FROZEN),
                             "labels_sha256": sha256(labels_path), "texts_sha256": sha256(texts_path),
                             "script_sha256": sha256(__file__), "git_head": head, "versions": versions,
                             "v3_settings": {"max_length": V3_MAX_LENGTH, "abstain": V3_ABSTAIN, "scoped": 0.5,
                                             "one_text_at_a_time": True}},
              "aggregates": aggregates}
    out_dir = Path(labels_path).parent if dry_run else Path(results_dir)
    stem = "sealed_v3_comparison_DRYRUN" if dry_run else "sealed_v3_comparison"
    (out_dir / f"{stem}.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8", newline="\n")
    (out_dir / f"{stem}.md").write_text(markdown(result, dry_run), encoding="utf-8", newline="\n")
    write_items(items, Path(labels_path).parent / ("v3_comparison_predictions_DRYRUN.csv" if dry_run
                                                   else "v3_comparison_predictions.csv"))
    return result


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--texts", type=Path, required=True)
    ap.add_argument("--labels", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--confirm-final", action="store_true")
    args = ap.parse_args(argv)
    checks, texts, labels = prerun_checks(args.texts, args.labels, dry_run=args.dry_run)
    print(se.format_checklist(checks))
    if not all(ok for _, ok, _ in checks):
        print("STOP: a pre-run check failed. Nothing was computed.")
        return 2
    if args.dry_run:
        print("DRY RUN: no lock; outputs go next to the labels file and are marked DRY RUN.")
    elif not args.confirm_final:
        print("CHECK ONLY: all checks passed. No lock was written and nothing was computed. "
              "Add --confirm-final for the one comparison run.")
        return 3
    else:
        acquire_lock(args.labels, args.texts)
        print("Lock written next to the labels file. This is the one comparison run.")
    result = run(texts, labels, args.labels, args.texts, args.dry_run)
    print(markdown(result, args.dry_run))
    return 0


if __name__ == "__main__":
    sys.exit(main())
