"""Assign whole V4 seeds to 5 cross-validation folds.

Run from the repository root, in isolated mode:

    .venv/Scripts/python.exe -I research/v4/make_folds.py SEEDS.csv
    .venv/Scripts/python.exe -I research/v4/make_folds.py SEEDS.csv \
        --paraphrases PARAPHRASES.csv [...]

Writes research/v4/fold_assignment_v4.csv (seed_id, primary_class,
style, fold); --out writes elsewhere.

Only seeds are assigned. A paraphrase never gets a fold of its own: it
is in its seed's fold (fold_of_examples() below). With --paraphrases the
builder fails if any paraphrase names a seed that is not in the file.

Stratified by primary_class x style: within each stratum, the seeds are
shuffled with a fixed random seed, then each goes to the fold with the
fewest seeds of that stratum, ties broken by the fewest seeds overall,
then the lowest fold number. So each stratum is spread as evenly as it
can be (fold counts differ by at most one), fold sizes stay close, and
the same file always gives the same folds.
"""

from __future__ import annotations

import argparse
import csv
import random
import sys
from collections import defaultdict
from pathlib import Path

N_FOLDS = 5
RANDOM_SEED = 20261022
OUTPUT = Path(__file__).resolve().parent / "fold_assignment_v4.csv"


def read_csv(path):
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def assign_folds(seeds, n_folds=N_FOLDS, random_seed=RANDOM_SEED):
    """seed_id -> fold (1..n_folds) for a list of seed rows."""
    ids = [s["seed_id"] for s in seeds]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise ValueError(f"duplicate seed_id: {duplicates}")

    strata = defaultdict(list)
    for s in seeds:
        strata[(s["primary_class"], s["style"])].append(s["seed_id"])

    rng = random.Random(random_seed)
    per_stratum = defaultdict(lambda: [0] * n_folds)
    totals = [0] * n_folds
    folds = {}
    # Sorted ids, then a seeded shuffle: the result does not depend on
    # the row order of the file.
    for key in sorted(strata):
        members = sorted(strata[key])
        rng.shuffle(members)
        counts = per_stratum[key]
        for seed_id in members:
            fold = min(range(n_folds), key=lambda f: (counts[f], totals[f], f))
            counts[fold] += 1
            totals[fold] += 1
            folds[seed_id] = fold + 1
    return folds


def fold_of_examples(folds, paraphrases):
    """paraphrase id -> its seed's fold. Fails on an unknown seed."""
    unknown = sorted({p["seed_id"] for p in paraphrases if p["seed_id"] not in folds})
    if unknown:
        raise ValueError(f"paraphrases name seeds that are not in the seed file: {unknown}")
    return {p.get("paraphrase_id") or p["text"]: folds[p["seed_id"]] for p in paraphrases}


def write_assignment(path, seeds, folds):
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["seed_id", "primary_class", "style", "fold"])
        for s in sorted(seeds, key=lambda s: (folds[s["seed_id"]], s["seed_id"])):
            writer.writerow([s["seed_id"], s["primary_class"], s["style"], folds[s["seed_id"]]])


def main(argv=None, out=sys.stdout):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("seeds", type=Path)
    parser.add_argument("--paraphrases", type=Path, nargs="*", default=[])
    parser.add_argument("--out", type=Path, default=OUTPUT)
    args = parser.parse_args(argv)

    seeds = read_csv(args.seeds)
    if not seeds:
        print(f"{args.seeds} has no seeds; nothing written", file=out)
        return 1
    try:
        folds = assign_folds(seeds)
        paraphrases = [row for path in args.paraphrases for row in read_csv(path)]
        fold_of_examples(folds, paraphrases)
    except ValueError as error:
        print(f"failed: {error}", file=out)
        return 1

    write_assignment(args.out, seeds, folds)
    sizes = [sum(1 for f in folds.values() if f == n) for n in range(1, N_FOLDS + 1)]
    print(f"{len(seeds)} seeds -> {args.out} (fold sizes {sizes})", file=out)
    if paraphrases:
        print(f"{len(paraphrases)} paraphrases, each in its seed's fold", file=out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
