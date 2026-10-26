"""Shared code for the V4 cross-validation runs (research/v4/cv_*.py).

The protocol is in docs/decision-log.md, "V4 pre-registration:
clarification 2 (2026-10-26)":

- the folds are research/v4/fold_assignment_v4.csv, checked against its
  frozen sha256 before anything runs;
- evaluation rows are the SEEDS of the held-out fold, original wording
  only; their paraphrases are never scored;
- training rows are the seeds of the other folds plus their paraphrases,
  minus the ids in dr05_exclusions.csv and v3_pool_exclusions.csv; a
  paraphrase always follows its seed's fold.

Metrics are computed here, without scikit-learn, so that each one is
plain to read and unit-tested on hand-computed cases.

Loaded by path (it imports make_folds.py the same way), so it also runs
under python -I.
"""

from __future__ import annotations

import csv
import hashlib
import importlib.metadata
import importlib.util
import json
import platform
import statistics
import subprocess
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
_spec = importlib.util.spec_from_file_location("make_folds", HERE / "make_folds.py")
mf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mf)

CLASSES = ("contraception", "sti", "pregnancy", "general", "out_of_scope", "vague")
FOLDS = (1, 2, 3, 4, 5)
FOLD_FILE = HERE / "fold_assignment_v4.csv"
FOLD_SHA256 = "9fa96d80c22d020b62ada028d87c0679004c0d68be87e6b2f40d4bff46361cbf"
EXPECTED_SEEDS = 380
EXPECTED_PARAPHRASES = 1239
RESULTS_DIR = HERE / "results"
CONFIDENT = 0.5
ECE_BINS = 10


# ------------------------------------------------------------------ data


def sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def exclusions(root: Path = REPO) -> set[str]:
    v4 = root / "research" / "v4"
    ids = {r["item_id"] for r in mf.read_csv(v4 / "v3_pool_exclusions.csv")}
    ids |= {r["item_id"] for r in mf.read_csv(v4 / "dr05_exclusions.csv")}
    return ids


def load_data(root: Path = REPO, fold_file: Path | None = None, expect: bool = True) -> dict:
    """Seeds with their folds, and the training paraphrases.

    Returns {"seeds": [...], "paraphrases": [...], "excluded": set}. Each
    seed is {id, seed_id, text, cls, fold, source}; each paraphrase is
    {id, seed_id, text, cls, fold}. With expect=True the frozen counts and
    the fold file's sha256 are asserted.
    """
    fold_file = fold_file or root / "research" / "v4" / "fold_assignment_v4.csv"
    if expect:
        assert sha256(fold_file) == FOLD_SHA256, "fold_assignment_v4.csv does not match its frozen sha256"
    folds = {r["seed_id"]: r for r in mf.read_csv(fold_file)}
    v4dir = root / "research" / "v4"
    rows = mf.v4_seeds(sorted(v4dir.glob("seeds_v4_batch*.csv")))
    rows += mf.v3_seeds(root / "resources" / "seeds" / "seeds.csv")
    excluded = exclusions(root)
    seeds = []
    for r in rows:
        assert r["seed_id"] in folds, f"seed {r['seed_id']} has no fold"
        f = folds[r["seed_id"]]
        assert f["primary_class"] == r["primary_class"], r["seed_id"]
        if r["seed_id"] in excluded:
            continue
        seeds.append({"id": r["seed_id"], "seed_id": r["seed_id"], "text": r["text"],
                      "cls": r["primary_class"], "fold": int(f["fold"]), "source": f["source"]})
    assert len({s["id"] for s in seeds}) == len(seeds), "duplicate seed id"
    para_files = sorted((root / "resources" / "reviewed").glob("*.csv"))
    para_files += sorted((root / "resources" / "reviewed" / "v4").glob("*.csv"))
    paraphrases = []
    for path in para_files:
        for r in mf.read_csv(path):
            if r["paraphrase_id"] in excluded:
                continue
            assert r["seed_id"] in folds, f"paraphrase {r['paraphrase_id']} has a seed with no fold"
            paraphrases.append({"id": r["paraphrase_id"], "seed_id": r["seed_id"], "text": r["text"],
                                "cls": r["class"], "fold": int(folds[r["seed_id"]]["fold"])})
    if expect:
        assert len(seeds) == EXPECTED_SEEDS, f"{len(seeds)} seeds, expected {EXPECTED_SEEDS}"
        assert len(folds) == EXPECTED_SEEDS and set(folds) == {s["id"] for s in seeds}, "every seed has a fold"
        assert len(paraphrases) == EXPECTED_PARAPHRASES, f"{len(paraphrases)} paraphrases, expected {EXPECTED_PARAPHRASES}"
    return {"seeds": seeds, "paraphrases": paraphrases, "excluded": excluded}


def load_v1_restore(data: dict, root: Path = REPO) -> list[dict]:
    """The V1 restore candidates (status "candidate"), minus excluded ids,
    each taking its seed's fold."""
    folds = {s["seed_id"]: s["fold"] for s in data["seeds"]}
    rows = mf.read_csv(root / "research" / "v4" / "v1_paraphrases_restore_candidates.csv")
    out = []
    for r in rows:
        if r["status"] != "candidate" or r["paraphrase_id"] in data["excluded"]:
            continue
        assert r["seed_id"] in folds, f"V1 paraphrase {r['paraphrase_id']} has a seed with no fold"
        out.append({"id": r["paraphrase_id"], "seed_id": r["seed_id"], "text": r["text"],
                    "cls": r["class"], "fold": folds[r["seed_id"]]})
    return out


def train_rows(data: dict, held_out: int, extra=()) -> list[dict]:
    """Seeds and paraphrases (and extra paraphrases) outside the held-out fold."""
    items = data["seeds"] + data["paraphrases"] + list(extra)
    return [x for x in items if x["fold"] != held_out]


def eval_rows(data: dict, held_out: int) -> list[dict]:
    """The held-out fold's seeds, original wording only."""
    return [s for s in data["seeds"] if s["fold"] == held_out]


# --------------------------------------------------------------- metrics


def confusion(true, pred, labels=CLASSES):
    """rows = true class, columns = predicted class, in labels order."""
    index = {c: i for i, c in enumerate(labels)}
    m = [[0] * len(labels) for _ in labels]
    for t, p in zip(true, pred):
        m[index[t]][index[p]] += 1
    return m


def per_class(true, pred, labels=CLASSES):
    """{class: {precision, recall, f1, support}}; 0 where undefined."""
    out = {}
    for c in labels:
        tp = sum(1 for t, p in zip(true, pred) if t == c and p == c)
        fp = sum(1 for t, p in zip(true, pred) if t != c and p == c)
        fn = sum(1 for t, p in zip(true, pred) if t == c and p != c)
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        out[c] = {"precision": prec, "recall": rec, "f1": f1, "support": tp + fn}
    return out


def macro_f1(true, pred, labels=CLASSES):
    """Unweighted mean F1 over the given labels (all six by default)."""
    pc = per_class(true, pred, labels)
    return sum(pc[c]["f1"] for c in labels) / len(labels)


def confident_wrong(true, pred, conf, threshold=CONFIDENT):
    """Share of all items that are wrong with confidence above threshold.
    With no confidence (conf None) it is the plain error rate."""
    n = len(true)
    if not n:
        return 0.0
    if conf is None:
        return sum(1 for t, p in zip(true, pred) if t != p) / n
    return sum(1 for t, p, c in zip(true, pred, conf) if t != p and c > threshold) / n


def ece(true, pred, conf, bins=ECE_BINS):
    """Expected calibration error with equal-width bins on [0, 1]: the
    item-weighted mean of |accuracy - mean confidence| per bin. Bin k
    holds k/bins <= c < (k+1)/bins; a confidence of 1.0 goes in the last
    bin. None when there is no confidence."""
    if conf is None:
        return None
    n = len(true)
    total = 0.0
    for k in range(bins):
        members = [i for i, c in enumerate(conf) if min(int(c * bins), bins - 1) == k]
        if not members:
            continue
        acc = sum(1 for i in members if true[i] == pred[i]) / len(members)
        mean_conf = sum(conf[i] for i in members) / len(members)
        total += len(members) / n * abs(acc - mean_conf)
    return total


def summarise(oof: list[dict], has_confidence: bool = True) -> dict:
    """Per-fold and pooled out-of-fold metrics. oof rows: seed_id, fold,
    true, pred, confidence (None without confidence)."""
    per_fold = {}
    for f in FOLDS:
        rows = [r for r in oof if r["fold"] == f]
        per_fold[f] = macro_f1([r["true"] for r in rows], [r["pred"] for r in rows])
    true = [r["true"] for r in oof]
    pred = [r["pred"] for r in oof]
    conf = [r["confidence"] for r in oof] if has_confidence else None
    pooled = per_class(true, pred)
    values = [per_fold[f] for f in FOLDS]
    return {
        "per_fold_macro_f1": {str(f): v for f, v in per_fold.items()},
        "macro_f1_mean": statistics.mean(values),
        "macro_f1_sd": statistics.stdev(values),
        "pooled_macro_f1": macro_f1(true, pred),
        "pooled_per_class": pooled,
        "sti_recall": pooled["sti"]["recall"],
        "pregnancy_recall": pooled["pregnancy"]["recall"],
        "confident_wrong": confident_wrong(true, pred, conf),
        "confident_wrong_is_plain_error_rate": not has_confidence,
        "ece": ece(true, pred, conf),
        "confusion": {"labels": list(CLASSES), "matrix": confusion(true, pred)},
        "n": len(oof),
    }


# ---------------------------------------------------------------- output


def environment(root: Path = REPO) -> dict:
    versions = {}
    for p in ("scikit-learn", "numpy", "pandas", "torch", "transformers", "sentence-transformers"):
        try:
            versions[p] = importlib.metadata.version(p)
        except importlib.metadata.PackageNotFoundError:
            versions[p] = None
    try:
        commit = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True,
                                text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = None
    return {"python": platform.python_version(), "packages": versions, "git_commit": commit,
            "fold_file_sha256": FOLD_SHA256}


def write_results(name: str, oof: list[dict], config: dict, has_confidence: bool = True,
                  out_dir: Path = RESULTS_DIR, root: Path = REPO) -> dict:
    """Write cv_<name>.json and cv_<name>_oof.csv; return the summary."""
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = {"candidate": name, "config": config, **summarise(oof, has_confidence),
               "environment": environment(root)}
    (out_dir / f"cv_{name}.json").write_text(json.dumps(summary, indent=1) + "\n", encoding="utf-8",
                                                  newline="\n")
    with open(out_dir / f"cv_{name}_oof.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["seed_id", "fold", "true", "pred", "confidence"])
        for r in sorted(oof, key=lambda r: (r["fold"], r["seed_id"])):
            c = r["confidence"]
            w.writerow([r["seed_id"], r["fold"], r["true"], r["pred"], "" if c is None else f"{c:.6f}"])
    return summary


def class_counts(items) -> dict:
    return dict(Counter(x["cls"] for x in items))
