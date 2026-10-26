"""DR-05 ambiguity report: near-duplicate texts with different class labels.

Run from the repository root, in isolated mode:

    .venv/Scripts/python.exe -I research/v4/review_dr05.py [--out PATH] [--limit 0.93]

One pool of training texts, each with its class label and a source tag:

- "v3": the V3 training pool, resources/seeds/seeds.csv and
  resources/reviewed/*.csv (not the v4/ subfolder), minus the ids in
  research/v4/v3_pool_exclusions.csv;
- "v4_seed": the V4 seeds, research/v4/seeds_v4_batch*.csv
  (primary_class);
- "v4_para": the reviewed V4 paraphrases, resources/reviewed/v4/*.csv;
- "v1_cand": the 220 V1 restore candidates,
  research/v4/v1_paraphrases_restore_candidates.csv (every row).

Every pair with DIFFERENT class labels (out_of_scope and vague count as
classes) whose e5 cosine is at least --limit (0.93), and every exact
duplicate text across classes, is written to
research/v4/dr05_ambiguity_report.csv: id_a, class_a, tag_a, id_b,
class_b, tag_b, cosine. Ids and scores only, no text. Counts per class
pair and per tag pair are printed. No data file is changed.

The embedding and text normalisation are check_seeds.py's, loaded from
the same directory, so it also runs under python -I.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("check_seeds", HERE / "check_seeds.py")
cs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cs)

REPO = cs.REPO
LIMIT = 0.93
OUTPUT = HERE / "dr05_ambiguity_report.csv"
COLUMNS = ["id_a", "class_a", "tag_a", "id_b", "class_b", "tag_b", "cosine"]


def build_pool(root: Path) -> list[dict]:
    """Every text with its id, class label and source tag."""
    res = root / "resources"
    v4dir = root / "research" / "v4"
    excluded = {r["item_id"] for r in cs.read_csv(v4dir / "v3_pool_exclusions.csv")[1]}
    pool = []

    def add(tag, rid, cls, text):
        if rid not in excluded or tag != "v3":
            pool.append({"id": rid, "class": cls, "tag": tag, "text": text})

    for r in cs.read_csv(res / "seeds" / "seeds.csv")[1]:
        add("v3", r["seed_id"], r["class"], r["text"])
    for path in sorted((res / "reviewed").glob("*.csv")):  # not v4/: no recursion
        for r in cs.read_csv(path)[1]:
            add("v3", r["paraphrase_id"], r["class"], r["text"])
    for path in sorted(v4dir.glob("seeds_v4_batch*.csv")):
        for r in cs.read_csv(path)[1]:
            add("v4_seed", r["seed_id"], r["primary_class"], r["text"])
    for path in sorted((res / "reviewed" / "v4").glob("*.csv")):
        for r in cs.read_csv(path)[1]:
            add("v4_para", r["paraphrase_id"], r["class"], r["text"])
    for r in cs.read_csv(v4dir / "v1_paraphrases_restore_candidates.csv")[1]:
        add("v1_cand", r["paraphrase_id"], r["class"], r["text"])
    return pool


def find_pairs(pool, embed, limit=LIMIT):
    """Cross-class pairs at or above the limit, plus cross-class exact
    duplicates, highest cosine first."""
    vectors = embed([p["text"] for p in pool])
    cosines = vectors @ vectors.T
    norm = [cs.normalise(p["text"]) for p in pool]
    pairs = []
    for i in range(len(pool)):
        for j in range(i + 1, len(pool)):
            if pool[i]["class"] == pool[j]["class"]:
                continue
            cosine = float(cosines[i][j])
            if cosine >= limit or norm[i] == norm[j]:
                a, b = sorted((pool[i], pool[j]), key=lambda p: (p["tag"], p["id"]))
                pairs.append({"id_a": a["id"], "class_a": a["class"], "tag_a": a["tag"],
                              "id_b": b["id"], "class_b": b["class"], "tag_b": b["tag"],
                              "cosine": round(cosine, 4)})
    return sorted(pairs, key=lambda p: (-p["cosine"], p["id_a"], p["id_b"]))


def counts(pairs):
    by_class = Counter(" / ".join(sorted((p["class_a"], p["class_b"]))) for p in pairs)
    by_tag = Counter(" / ".join(sorted((p["tag_a"], p["tag_b"]))) for p in pairs)
    return by_class, by_tag


def write_report(path, pairs):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(pairs)


def main(argv=None, embed=None, root=REPO, out=sys.stdout):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, default=OUTPUT)
    parser.add_argument("--limit", type=float, default=LIMIT)
    args = parser.parse_args(argv)
    pool = build_pool(root)
    pairs = find_pairs(pool, embed or cs.e5_embedder(), args.limit)
    write_report(args.out, pairs)
    by_class, by_tag = counts(pairs)
    tags = Counter(p["tag"] for p in pool)
    print(f"pool: {len(pool)} texts ({', '.join(f'{t} {n}' for t, n in sorted(tags.items()))})", file=out)
    print(f"cross-class pairs at cosine >= {args.limit} or exact duplicates: {len(pairs)}", file=out)
    print("per class pair:", file=out)
    for k, n in sorted(by_class.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {k}: {n}", file=out)
    print("per tag pair:", file=out)
    for k, n in sorted(by_tag.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {k}: {n}", file=out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
