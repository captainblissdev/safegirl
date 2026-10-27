"""V4 sealed evaluation: one run, pre-registered metrics, mechanical gate.

Run from the repository root (.venv, CPU; Node on PATH). The input
paths are given as arguments and never stored in the repository:

    .venv/Scripts/python.exe -I research/v4/sealed_eval.py \
        --texts TEXTS.csv --labels LABELS.csv --confirm-final
    .venv/Scripts/python.exe -I research/v4/sealed_eval.py \
        --texts TEXTS.csv --labels LABELS.csv --dry-run

TEXTS.csv has the columns id, text; LABELS.csv has id, topic_label,
route (route is none, held or safety).

1. Pre-run checks, printed as a checklist; any failure stops the run:
   the frozen model's sha256 equals its sidecar and the decision log;
   the fold file's sha256; a clean git status for research/v4 and app;
   the decision-log entries the run follows; both input files outside
   the repository; the same ids in both files (205 of them, except in a
   dry run); no empty text; a topic label from the six classes; a valid
   route; and, for a real run, no previous run. A real run also needs
   --confirm-final.
2. One-run lock (real run only): a sentinel file next to the labels
   file is created, exclusively, before anything is computed. It holds
   the time, the frozen model's sha256, the sha256 of both input files
   and of this script. If it exists, the run is refused.
3. Metrics, from triage_sim (reply kinds, M1 and M2 classes) and
   v4_infer (V4 probabilities), on all items and on the subset where no
   upstream rule fires:
   - classifier level against topic_label: macro-F1, per-class
     precision and recall, confusion matrix, sti and pregnancy recall,
     for V4 (argmax), M1 and M2; for V4 also the confident-wrong rate
     (wrong with top probability > 0.5) and ECE (10 bins);
   - reply-kind level: the expected kind from the labels (route held ->
     held, safety -> referral; vague -> ask or help; out_of_scope ->
     abstain; topic class -> answer), the correct rate of V4, M1 and M2,
     and McNemar's exact test of V4 against M1 and against M2 with the
     discordant counts;
   - a paired bootstrap of macro-F1(V4) - macro-F1(M2) on all items:
     10,000 resamples, numpy default_rng(42), 95% percentile interval.
4. The gate, mechanically: (1) the macro-F1 gain is at least 0.05 and
   the interval excludes 0; (2) sti and pregnancy recall are not lower
   than M2's; (3) the reply-kind correct rate is not lower than M1's
   and not lower than M2's; (4) app/ is unchanged since the commit the
   frozen model was fitted at. PASS or FAIL for each and overall.
5. Outputs: aggregates only (no text, no per-item rows) to
   research/v4/results/sealed_result.json and .md; per-item predictions
   (ids and labels, no text) next to the labels file, outside the
   repository. A dry run writes its aggregates next to the labels file
   too, marked DRY RUN, and writes nothing in the repository.

Nothing printed or written contains question text or an input path.
The rules are in docs/decision-log.md: clarification 2, the threshold
rule, the frozen candidate and deviations 1 to 5.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import importlib.util
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
FROZEN = HERE / "frozen" / "v4_hybrid_c10.json"
SIDECAR = HERE / "frozen" / "v4_hybrid_c10.sha256"
DECISION_LOG = REPO / "docs" / "decision-log.md"
RESULTS = HERE / "results"
EXPECTED_N = 205
ROUTES = ("none", "held", "safety")
MARGIN = 0.05
BOOTSTRAP = 10_000
BOOTSTRAP_SEED = 42
LOCK_NAME = "V4_SEALED_RUN.lock"
REQUIRED_TITLES = (
    "## V4 pre-registration: clarification 2 (2026-10-26)",
    "## V4 threshold rule (2026-10-26)",
    "## V4 frozen candidate (2026-10-26)",
    "## V4 pre-registration: deviation 1 (2026-10-26), before the sealed set is opened",
    "## V4 pre-registration: deviation 2 (2026-10-26), before the sealed set is opened",
    "## V4 pre-registration: deviation 3 (2026-10-27), labelling guide and timing",
    "## V4 pre-registration: deviation 4 (2026-10-27), system-level measure",
    "## V4 pre-registration: deviation 5 (2026-10-27), comparators and the help row",
)


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cv = _load("cv_common", HERE / "cv_common.py")
ts = _load("triage_sim", HERE / "triage_sim.py")
CLASSES = cv.CLASSES
TOPICS = ts.TOPICS


def sha256(path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


# ------------------------------------------------------------- inputs


def read_texts(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not {"id", "text"} <= set(reader.fieldnames or []):
            raise ValueError("texts file needs the columns id, text")
        return [(r["id"].strip(), r["text"]) for r in reader]


def read_labels(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not {"id", "topic_label", "route"} <= set(reader.fieldnames or []):
            raise ValueError("labels file needs the columns id, topic_label, route")
        return [(r["id"].strip(), r["topic_label"].strip(), r["route"].strip()) for r in reader]


def inside(path, root=REPO) -> bool:
    try:
        Path(path).resolve().relative_to(Path(root).resolve())
        return True
    except ValueError:
        return False


# --------------------------------------------------------- pre-run checks


def git_clean(root=REPO, paths=("research/v4", "app")) -> bool:
    out = subprocess.run(["git", "-C", str(root), "status", "--porcelain", "--", *paths],
                         capture_output=True, text=True, check=True).stdout
    return out.strip() == ""


def prerun_checks(texts_path, labels_path, dry_run=False, root=REPO, frozen=FROZEN, sidecar=SIDECAR,
                  fold=cv.FOLD_FILE, log=DECISION_LOG, clean=None):
    """[(check, ok, detail)], with details that hold no text and no
    input path. clean overrides the git check (for tests)."""
    checks = []

    def add(name, ok, detail=""):
        checks.append((name, bool(ok), detail))

    frozen_hash = sha256(frozen) if Path(frozen).exists() else None
    recorded = Path(sidecar).read_text(encoding="utf-8").split()[0] if Path(sidecar).exists() else None
    add("frozen model sha256 equals its sidecar", frozen_hash and frozen_hash == recorded, frozen_hash or "missing")
    log_text = Path(log).read_text(encoding="utf-8") if Path(log).exists() else ""
    add("frozen model sha256 is the one in the decision log", frozen_hash and frozen_hash in log_text)
    add("fold file sha256 matches", Path(fold).exists() and sha256(fold) == cv.FOLD_SHA256)
    add("git status clean for research/v4 and app", git_clean(root) if clean is None else clean)
    lines = set(log_text.splitlines())
    missing = [t[3:] for t in REQUIRED_TITLES if t not in lines]
    add("decision-log entries present (clarification 2, threshold rule, frozen candidate, deviations 1-5)",
        not missing, "missing: " + "; ".join(missing) if missing else "")
    add("input files are outside the repository", not inside(texts_path, root) and not inside(labels_path, root))
    if not dry_run:
        add("no previous run (no lock next to the labels file)", not (Path(labels_path).parent / LOCK_NAME).exists())

    try:
        texts, labels = read_texts(texts_path), read_labels(labels_path)
    except (OSError, ValueError, KeyError) as error:
        add("input files readable with the expected columns", False, type(error).__name__)
        return checks, None, None
    add("input files readable with the expected columns", True)
    t_ids, l_ids = [i for i, _ in texts], [i for i, _, _ in labels]
    add("same ids in both files, no duplicates",
        len(set(t_ids)) == len(t_ids) and len(set(l_ids)) == len(l_ids) and set(t_ids) == set(l_ids),
        f"{len(set(t_ids))} text ids, {len(set(l_ids))} label ids")
    if dry_run:
        add("item count (dry run: 205 not required)", len(texts) > 0, f"{len(texts)} items")
    else:
        add(f"{EXPECTED_N} items", len(texts) == EXPECTED_N, f"{len(texts)} items")
    add("no empty text", all(t.strip() for _, t in texts))
    add("topic_label filled and one of the six classes", all(c in CLASSES for _, c, _ in labels))
    add("route is none, held or safety", all(r in ROUTES for _, _, r in labels))
    return checks, texts, labels


def format_checklist(checks) -> str:
    lines = ["Pre-run checks:"]
    for name, ok, detail in checks:
        lines.append(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" ({detail})" if detail else ""))
    return "\n".join(lines)


# ------------------------------------------------------------- lock


def acquire_lock(labels_path, texts_path, frozen=FROZEN) -> Path:
    """Create the sentinel next to the labels file, exclusively; raise
    FileExistsError if a run already happened."""
    lock = Path(labels_path).parent / LOCK_NAME
    record = {"timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
              "frozen_model_sha256": sha256(frozen), "labels_sha256": sha256(labels_path),
              "texts_sha256": sha256(texts_path), "script_sha256": sha256(__file__)}
    with open(lock, "x", encoding="utf-8") as f:
        json.dump(record, f, indent=1)
        f.write("\n")
    return lock


# ------------------------------------------------------------- metrics


def expected_kinds(topic_label: str, route: str) -> frozenset:
    """Deviation 4, with deviation 5's help row."""
    if route == "held":
        return frozenset({"held"})
    if route == "safety":
        return frozenset({"referral"})
    if topic_label == "vague":
        return frozenset({"ask", "help"})
    if topic_label == "out_of_scope":
        return frozenset({"abstain"})
    if topic_label in TOPICS:
        return frozenset({"answer"})
    raise ValueError(f"unknown topic label {topic_label!r}")


def mcnemar_exact(b: int, c: int) -> float:
    """Two-sided exact McNemar p-value from the discordant counts: twice
    the smaller binomial tail with p = 1/2, capped at 1."""
    n = b + c
    if n == 0:
        return 1.0
    tail = sum(math.comb(n, k) for k in range(min(b, c) + 1))
    return min(1.0, 2 * tail / 2 ** n)


def macro_f1_codes(true_codes, pred_codes, k=len(CLASSES)) -> float:
    """Macro-F1 over k classes from integer codes (same as
    cv_common.macro_f1, vectorised for the bootstrap)."""
    cm = np.bincount(np.asarray(true_codes) * k + np.asarray(pred_codes), minlength=k * k).reshape(k, k)
    tp = np.diag(cm).astype(float)
    fp = cm.sum(axis=0) - tp
    fn = cm.sum(axis=1) - tp
    with np.errstate(divide="ignore", invalid="ignore"):
        prec = np.where(tp + fp > 0, tp / (tp + fp), 0.0)
        rec = np.where(tp + fn > 0, tp / (tp + fn), 0.0)
        f1 = np.where(prec + rec > 0, 2 * prec * rec / (prec + rec), 0.0)
    return float(f1.mean())


def paired_bootstrap(gold, pred_a, pred_b, n_boot=BOOTSTRAP, seed=BOOTSTRAP_SEED):
    """(point, low, high): macro-F1(a) - macro-F1(b) and its 95%
    percentile interval over item resamples."""
    index = {c: i for i, c in enumerate(CLASSES)}
    g, a, b = (np.array([index[x] for x in v]) for v in (gold, pred_a, pred_b))
    point = macro_f1_codes(g, a) - macro_f1_codes(g, b)
    rng = np.random.default_rng(seed)
    draws = rng.integers(0, len(g), size=(n_boot, len(g)))
    diffs = np.array([macro_f1_codes(g[i], a[i]) - macro_f1_codes(g[i], b[i]) for i in draws])
    low, high = np.percentile(diffs, [2.5, 97.5])
    return point, float(low), float(high)


def classifier_block(gold, pred, conf=None) -> dict:
    pc = cv.per_class(gold, pred)
    block = {"n": len(gold), "macro_f1": cv.macro_f1(gold, pred) if gold else None,
             "per_class": {c: {"precision": pc[c]["precision"], "recall": pc[c]["recall"],
                               "support": pc[c]["support"]} for c in CLASSES},
             "sti_recall": pc["sti"]["recall"], "pregnancy_recall": pc["pregnancy"]["recall"],
             "confusion": {"labels": list(CLASSES), "matrix": cv.confusion(gold, pred)}}
    if conf is not None:
        block["confident_wrong"] = cv.confident_wrong(gold, pred, conf) if gold else None
        block["ece"] = cv.ece(gold, pred, conf) if gold else None
    return block


def reply_block(items) -> dict:
    n = len(items)
    rate = {m: (sum(1 for x in items if x[f"{m}_correct"]) / n if n else None) for m in ("v4", "m1", "m2")}
    mc = {}
    for other in ("m1", "m2"):
        b = sum(1 for x in items if x["v4_correct"] and not x[f"{other}_correct"])
        c = sum(1 for x in items if not x["v4_correct"] and x[f"{other}_correct"])
        mc[f"v4_vs_{other}"] = {"v4_right_other_wrong": b, "v4_wrong_other_right": c, "p_exact": mcnemar_exact(b, c)}
    return {"n": n, "correct_rate": rate, "mcnemar": mc}


def evaluate(texts, labels, model) -> tuple[dict, list[dict]]:
    """(aggregates, per-item rows). texts: [(id, text)]; labels: [(id,
    topic_label, route)]. Per-item rows hold ids and labels, never text."""
    label_of = {i: (c, r) for i, c, r in labels}
    proba = model.predict_proba([t for _, t in texts])
    rows = ts.simulate(texts, model, proba=proba)
    items = []
    for (item_id, _), row, p in zip(texts, rows, proba):
        topic, route = label_of[item_id]
        top = int(np.argmax(p))
        assert model.classes[top] == row["v4_class"]
        expected = expected_kinds(topic, route)
        items.append({"id": item_id, "topic_label": topic, "route": route,
                      "expected_kind": "|".join(sorted(expected)), "upstream_fired": row["upstream_fired"],
                      "v4_class": row["v4_class"], "v4_confidence": float(p[top]),
                      "m1_class": row["baseline_m1_class"], "m2_class": row["baseline_class"],
                      "v4_kind": row["v4_kind"], "m1_kind": row["baseline_m1_kind"], "m2_kind": row["baseline_kind"],
                      "v4_correct": row["v4_kind"] in expected, "m1_correct": row["baseline_m1_kind"] in expected,
                      "m2_correct": row["baseline_kind"] in expected})

    def level(subset):
        gold = [x["topic_label"] for x in subset]
        return {"v4": classifier_block(gold, [x["v4_class"] for x in subset], [x["v4_confidence"] for x in subset]),
                "m1": classifier_block(gold, [x["m1_class"] for x in subset]),
                "m2": classifier_block(gold, [x["m2_class"] for x in subset])}

    no_upstream = [x for x in items if not x["upstream_fired"]]
    point, low, high = paired_bootstrap([x["topic_label"] for x in items], [x["v4_class"] for x in items],
                                        [x["m2_class"] for x in items])
    aggregates = {
        "counts": {"items": len(items), "no_upstream": len(no_upstream),
                   "route": {r: sum(1 for x in items if x["route"] == r) for r in ROUTES},
                   "topic_label": {c: sum(1 for x in items if x["topic_label"] == c) for c in CLASSES},
                   "upstream_fired": {u: sum(1 for x in items if x["upstream_fired"] == u)
                                      for u in sorted({x["upstream_fired"] for x in items}) if u}},
        "classifier": {"all": level(items), "no_upstream": level(no_upstream)},
        "reply_kind": {"all": reply_block(items), "no_upstream": reply_block(no_upstream)},
        "bootstrap": {"statistic": "macro-F1(V4) - macro-F1(M2), all items", "point": point,
                      "ci95": [low, high], "resamples": BOOTSTRAP, "seed": BOOTSTRAP_SEED,
                      "method": "numpy default_rng, item resampling, percentile interval"},
    }
    return aggregates, items


# ------------------------------------------------------------- gate


def app_diff_stat(commit, root=REPO) -> str:
    return subprocess.run(["git", "-C", str(root), "diff", "--stat", commit, "--", "app"],
                          capture_output=True, text=True, check=True).stdout.strip()


def gate(aggregates, diff_stat: str) -> dict:
    v4, m2 = aggregates["classifier"]["all"]["v4"], aggregates["classifier"]["all"]["m2"]
    gain = v4["macro_f1"] - m2["macro_f1"]
    low, high = aggregates["bootstrap"]["ci95"]
    rate = aggregates["reply_kind"]["all"]["correct_rate"]
    conditions = {
        "1 macro-F1 gain >= 0.05 and the 95% interval excludes 0": {
            "pass": gain >= MARGIN and not (low <= 0 <= high), "gain": gain, "ci95": [low, high]},
        "2 sti and pregnancy recall not lower than M2's": {
            "pass": v4["sti_recall"] >= m2["sti_recall"] and v4["pregnancy_recall"] >= m2["pregnancy_recall"],
            "v4": [v4["sti_recall"], v4["pregnancy_recall"]], "m2": [m2["sti_recall"], m2["pregnancy_recall"]]},
        "3 reply-kind correct rate not lower than M1's and than M2's": {
            "pass": rate["v4"] >= rate["m1"] and rate["v4"] >= rate["m2"], "rates": rate},
        "4 app/ unchanged since the frozen model's commit": {"pass": diff_stat == "", "diff_stat": diff_stat},
    }
    return {"conditions": conditions, "overall": all(c["pass"] for c in conditions.values())}


# ------------------------------------------------------------- outputs


def fmt(v, digits=4):
    return "n/a" if v is None else f"{v:.{digits}f}"


def markdown(result, dry_run) -> str:
    a = result["aggregates"]
    lines = ["# V4 sealed evaluation" + (" (DRY RUN)" if dry_run else ""), ""]
    if dry_run:
        lines += ["**DRY RUN on synthetic data. This is not a result.**", ""]
    lines += [f"Frozen model sha256 {result['provenance']['frozen_model_sha256']}; "
              f"labels sha256 {result['provenance']['labels_sha256']}; script sha256 "
              f"{result['provenance']['script_sha256']}; git {result['provenance']['git_head']}.", "",
              "## Counts", "",
              f"{a['counts']['items']} items; {a['counts']['no_upstream']} where no upstream rule fires. "
              f"Routes: {a['counts']['route']}. Topic labels: {a['counts']['topic_label']}. "
              f"Upstream fired: {a['counts']['upstream_fired']}.", ""]
    for subset, title in (("all", "all items"), ("no_upstream", "no upstream rule fires")):
        c = a["classifier"][subset]
        lines += [f"## Classifier level, {title} (n = {c['v4']['n']})", "",
                  "| | Macro-F1 | STI recall | Pregnancy recall | Confident-wrong | ECE |", "|---|---|---|---|---|---|"]
        for m in ("v4", "m1", "m2"):
            b = c[m]
            lines.append(f"| {m.upper()} | {fmt(b['macro_f1'])} | {fmt(b['sti_recall'])} | "
                         f"{fmt(b['pregnancy_recall'])} | {fmt(b.get('confident_wrong'))} | {fmt(b.get('ece'))} |")
        lines += ["", "Per-class precision / recall:", "", "| Class | " + " | ".join(m.upper() for m in ("v4", "m1", "m2"))
                  + " | Support |", "|---|---|---|---|---|"]
        for cls in CLASSES:
            cells = [f"{fmt(c[m]['per_class'][cls]['precision'], 3)} / {fmt(c[m]['per_class'][cls]['recall'], 3)}"
                     for m in ("v4", "m1", "m2")]
            lines.append(f"| {cls} | " + " | ".join(cells) + f" | {c['v4']['per_class'][cls]['support']} |")
        for m in ("v4", "m1", "m2"):
            mat = c[m]["confusion"]["matrix"]
            lines += ["", f"{m.upper()} confusion (rows true, columns predicted):", "",
                      "| | " + " | ".join(CLASSES) + " |", "|---" * (len(CLASSES) + 1) + "|"]
            lines += [f"| {cls} | " + " | ".join(str(v) for v in row) + " |" for cls, row in zip(CLASSES, mat)]
        lines.append("")
    lines += ["## Reply-kind level", "", "| Subset | n | V4 | M1 | M2 |", "|---|---|---|---|---|"]
    for subset in ("all", "no_upstream"):
        r = a["reply_kind"][subset]
        lines.append(f"| {subset} | {r['n']} | " + " | ".join(fmt(r["correct_rate"][m]) for m in ("v4", "m1", "m2"))
                     + " |")
    lines += ["", "McNemar exact (discordant counts: V4 right / other wrong, V4 wrong / other right):", ""]
    for subset in ("all", "no_upstream"):
        for k, v in a["reply_kind"][subset]["mcnemar"].items():
            lines.append(f"- {subset}, {k.replace('_', ' ')}: {v['v4_right_other_wrong']} / "
                         f"{v['v4_wrong_other_right']}, p = {fmt(v['p_exact'])}")
    bs = a["bootstrap"]
    lines += ["", "## Paired bootstrap", "",
              f"{bs['statistic']}: {fmt(bs['point'])}, 95% interval [{fmt(bs['ci95'][0])}, {fmt(bs['ci95'][1])}] "
              f"({bs['resamples']} resamples, seed {bs['seed']}).", "", "## Gate", ""]
    for name, cond in result["gate"]["conditions"].items():
        lines.append(f"- [{'PASS' if cond['pass'] else 'FAIL'}] {name}")
    lines += [f"- **Overall: {'PASS' if result['gate']['overall'] else 'FAIL'}**", "",
              "Run the suites and confirm gateway files unchanged.", "",
              "git diff --stat of app/ against the frozen model's commit "
              f"{result['provenance']['frozen_commit']}:", "", "```",
              result["gate"]["conditions"]["4 app/ unchanged since the frozen model's commit"]["diff_stat"] or "(empty)",
              "```"]
    return "\n".join(lines) + "\n"


def write_items(items, path):
    cols = ["id", "topic_label", "route", "expected_kind", "upstream_fired", "v4_class", "v4_confidence", "m1_class",
            "m2_class", "v4_kind", "m1_kind", "m2_kind", "v4_correct", "m1_correct", "m2_correct"]
    with open(path, "x", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        for x in items:
            w.writerow({**{k: x[k] for k in cols}, "v4_confidence": f"{x['v4_confidence']:.6f}"})


def run(texts, labels, labels_path, texts_path, dry_run, model=None, results_dir=RESULTS) -> dict:
    if model is None:
        model = _load("v4_infer", HERE / "v4_infer.py").load()
    spec = json.loads(FROZEN.read_bytes())
    aggregates, items = evaluate(texts, labels, model)
    diff = app_diff_stat(spec["git"]["commit"])
    head = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True,
                          check=True).stdout.strip()
    result = {"dry_run": dry_run,
              "provenance": {"frozen_model_sha256": sha256(FROZEN), "frozen_commit": spec["git"]["commit"],
                             "labels_sha256": sha256(labels_path), "texts_sha256": sha256(texts_path),
                             "script_sha256": sha256(__file__), "git_head": head, "t_act": ts.T_ACT},
              "aggregates": aggregates, "gate": gate(aggregates, diff)}
    out_dir = Path(labels_path).parent if dry_run else Path(results_dir)
    stem = "sealed_result_DRYRUN" if dry_run else "sealed_result"
    (out_dir / f"{stem}.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8", newline="\n")
    (out_dir / f"{stem}.md").write_text(markdown(result, dry_run), encoding="utf-8", newline="\n")
    write_items(items, Path(labels_path).parent / ("v4_sealed_predictions_DRYRUN.csv" if dry_run
                                                   else "v4_sealed_predictions.csv"))
    return result


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--texts", type=Path, required=True)
    ap.add_argument("--labels", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--confirm-final", action="store_true")
    args = ap.parse_args(argv)
    checks, texts, labels = prerun_checks(args.texts, args.labels, dry_run=args.dry_run)
    print(format_checklist(checks))
    if not all(ok for _, ok, _ in checks):
        print("STOP: a pre-run check failed. Nothing was computed.")
        return 2
    if args.dry_run:
        print("DRY RUN: no lock; outputs go next to the labels file and are marked DRY RUN.")
    elif not args.confirm_final:
        print("STOP: add --confirm-final for the one sealed run. Nothing was computed.")
        return 3
    else:
        acquire_lock(args.labels, args.texts)
        print("Lock written next to the labels file. This is the one sealed run.")
    result = run(texts, labels, args.labels, args.texts, args.dry_run)
    print(markdown(result, args.dry_run))
    return 0


if __name__ == "__main__":
    sys.exit(main())
