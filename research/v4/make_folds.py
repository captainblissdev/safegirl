"""Assign whole V3 and V4 seeds to 5 cross-validation folds.

Run from the repository root, in isolated mode:

    .venv/Scripts/python.exe -I research/v4/make_folds.py SEEDS.csv [SEEDS.csv ...]
    .venv/Scripts/python.exe -I research/v4/make_folds.py \
        research/v4/seeds_v4_batch1.csv ... research/v4/seeds_v4_batch4.csv \
        --v3-seeds resources/seeds/seeds.csv \
        --paraphrases PARAPHRASES.csv [...]

Writes research/v4/fold_assignment_v4.csv (seed_id, primary_class,
style, fold, source); --out writes elsewhere.

The positional files are V4 seed files (primary_class, style). With
--v3-seeds, the V3 seeds join the same folds: their class becomes
primary_class, their style the placeholder "v3_unlabelled" (V3 seeds
have no phrasing style), and their source "v3" (V4 seeds are "v4").
Every V3 seed is assigned, including those with no paraphrases.

Only seeds are assigned. A paraphrase never gets a fold of its own: it
is in its seed's fold (fold_of_examples() below). With --paraphrases the
builder fails if any paraphrase names a seed that is not in the files.

Exclusions (v3_pool_exclusions.csv, dr05_exclusions.csv) are not applied
here: they drop items at training time, and an excluded item keeps its
seed's fold.

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
V3_STYLE = "v3_unlabelled"
COLUMNS = ["seed_id", "primary_class", "style", "fold", "source"]


def read_csv(path):
    # utf-8-sig: a file saved by Excel starts with a BOM; strip it.
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def v4_seeds(paths):
    """Rows of the V4 seed files, tagged source v4."""
    return [{**row, "source": "v4"} for path in paths for row in read_csv(path)]


def v3_seeds(path):
    """The V3 seeds as fold rows: class -> primary_class, the placeholder
    style, source v3."""
    return [
        {"seed_id": row["seed_id"], "primary_class": row["class"], "style": V3_STYLE,
         "text": row.get("text", ""), "source": "v3"}
        for row in read_csv(path)
    ]


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
        writer.writerow(COLUMNS)
        for s in sorted(seeds, key=lambda s: (folds[s["seed_id"]], s["seed_id"])):
            writer.writerow([s["seed_id"], s["primary_class"], s["style"], folds[s["seed_id"]],
                             s.get("source", "v4")])


def main(argv=None, out=sys.stdout):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("seeds", type=Path, nargs="+", help="V4 seed files")
    parser.add_argument("--v3-seeds", type=Path, metavar="PATH",
                        help="the V3 seeds (resources/seeds/seeds.csv), folded with the V4 seeds")
    parser.add_argument("--paraphrases", type=Path, nargs="*", default=[])
    parser.add_argument("--out", type=Path, default=OUTPUT)
    args = parser.parse_args(argv)

    seeds = v4_seeds(args.seeds) + (v3_seeds(args.v3_seeds) if args.v3_seeds else [])
    if not seeds:
        print("the seed files have no seeds; nothing written", file=out)
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
    by_source = {src: sum(1 for s in seeds if s["source"] == src) for src in ("v4", "v3")}
    print(f"{len(seeds)} seeds (v4 {by_source['v4']}, v3 {by_source['v3']}) -> {args.out} "
          f"(fold sizes {sizes})", file=out)
    if paraphrases:
        print(f"{len(paraphrases)} paraphrases, each in its seed's fold", file=out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
