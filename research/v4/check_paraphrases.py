"""Check a V4 paraphrase file before manual review (research/v4/README.md).

Run from the repository root, in isolated mode:

    .venv/Scripts/python.exe -I research/v4/check_paraphrases.py PARAPHRASES.csv \
        --seeds research/v4/seeds_v4_batch4.csv [--seeds ...] \
        [--compare-seeds research/v4/seeds_v4_batch1.csv ...] [--sealed PATH]

--seeds files hold the seeds this file's paraphrases belong to: every
paraphrase must name one of them, and the count rule applies to each of
them. --compare-seeds files hold other seeds (for example the other
batches), used only to find paraphrases close to a seed they do not
belong to; no count rule applies to them.

PARAPHRASES.csv has the columns seed_id,paraphrase_id,class,text. Exit
status: 0 when every check passes (warnings allowed), 1 on any failure, 2
when the check cannot run.

a. The V2 paraphrasing protocol's automated checks (decision log,
   2026-09-18): every seed_id is a seed in the --seeds files; class
   equals the seed's primary_class; exactly 4 paraphrases per seed, and 0
   for a seed whose notes carry the held-topic override (so held-topic
   phrasing is not multiplied); no exact duplicates; none under 10
   characters; none identical to its seed; no Swahili or Sheng markers.
b. Near duplicates (e5 cosine >= 0.95 or character ratio >= 0.85) of the
   sealed set, DR-04, relevance_validation.csv, the development set, the
   V3 training pool, the 220 deleted V1 paraphrases, and every other
   seed of the --seeds and --compare-seeds files (a paraphrase is meant
   to be close to its own seed, so that one is not compared).
c. The gateway's held-topic rule (groups A, B, C) and Safety Net: no
   paraphrase may match either. Unlike a seed, a paraphrase has no
   override.

Only ids, scores and counts are printed: never a paraphrase's text, and
never the sealed set's text or path. DR-04 is reported by row number.

The matching and similarity code is check_seeds.py's own, loaded from the
same directory (this script imports nothing from research/ otherwise, so
it also runs under python -I).

The Swahili/Sheng marker check reads research/v4/sheng_swahili_markers.txt
(one marker per line, # for comments). The V2 marker list was never
committed to the repository, so until that file exists the check does not
run and the report says so as a warning.
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("check_seeds", HERE / "check_seeds.py")
cs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cs)

REPO = cs.REPO
COLUMNS = ["seed_id", "paraphrase_id", "class", "text"]
PER_SEED = 4
MIN_LENGTH = 10
MARKERS_FILE = HERE / "sheng_swahili_markers.txt"


def read_markers(path: Path) -> list[str] | None:
    """Lowercase markers, or None when the list does not exist."""
    if not path.exists():
        return None
    markers = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.split("#", 1)[0].strip().lower()
        if line:
            markers.append(line)
    return markers


def has_marker(text: str, markers: list[str]) -> list[str]:
    words = set(cs.normalise(text).split())
    norm = " " + cs.normalise(text) + " "
    return [m for m in markers if (m in words) or (" " in m and f" {m} " in norm)]


def check_structure(header, rows, seeds, markers, report):
    if header != COLUMNS:
        report.fail(f"schema: columns must be exactly {','.join(COLUMNS)}")
        return False
    ids = Counter(r["paraphrase_id"] for r in rows)
    for pid, n in ids.items():
        if n > 1:
            report.fail(f"structure: duplicate paraphrase_id {pid} ({n} rows)")
    for r in rows:
        pid = r["paraphrase_id"] or "(empty id)"
        seed = seeds.get(r["seed_id"])
        if seed is None:
            report.fail(f"structure: {pid}: seed_id {r['seed_id']} is not in the --seeds files")
            continue
        if not pid.startswith(r["seed_id"] + "-P"):
            report.fail(f"structure: {pid}: id does not start with its seed_id")
        if r["class"] != seed["primary_class"]:
            report.fail(f"structure: {pid}: class {r['class']} differs from its seed's {seed['primary_class']}")
        if len(r["text"].strip()) < MIN_LENGTH:
            report.fail(f"structure: {pid}: under {MIN_LENGTH} characters")
        if cs.normalise(r["text"]) == cs.normalise(seed["text"]):
            report.fail(f"structure: {pid}: identical to its seed")
        if markers:
            found = has_marker(r["text"], markers)
            if found:
                report.fail(f"structure: {pid}: Swahili/Sheng marker ({len(found)} found)")
    if markers is None:
        report.warn(
            "structure: no Swahili/Sheng marker list (research/v4/sheng_swahili_markers.txt); "
            "the marker check did not run"
        )

    per_seed = Counter(r["seed_id"] for r in rows)
    for sid, seed in seeds.items():
        held = cs.HELD_TOPIC_OVERRIDE in (seed.get("notes") or "")
        want = 0 if held else PER_SEED
        if per_seed.get(sid, 0) != want:
            why = " (held-topic override: none allowed)" if held else ""
            report.fail(f"count: {sid} has {per_seed.get(sid, 0)} paraphrases, expected {want}{why}")

    groups = defaultdict(list)
    for r in rows:
        groups[cs.normalise(r["text"])].append(r["paraphrase_id"])
    for group in groups.values():
        if len(group) > 1:
            report.fail(f"duplicate: exact duplicate text {', '.join(group)}")
    return True


def check_near(rows, seeds, refs, sealed, embed, report, compare=None):
    texts = [r["text"] for r in rows]
    pids = [r["paraphrase_id"] for r in rows]
    pools = dict(refs)
    if sealed is not None:
        pools = {"sealed": [(f"sealed {i}", t) for i, t in sealed], **pools}
    for name, pool in pools.items():
        pool_texts = [t for _, t in pool]
        exact = {cs.normalise(t): label for label, t in pool}
        for i, t in enumerate(texts):
            if cs.normalise(t) in exact:
                report.fail(f"duplicate: {pids[i]} is the text of {exact[cs.normalise(t)]}")
        for i, j, cosine, ratio in cs.near_pairs(texts, pool_texts, embed):
            report.fail(f"{name}: {pids[i]} ~ {pool[j][0]} ({cs.show(cosine, ratio)})")
    others = {**(compare or {}), **seeds}
    seed_ids = list(others)
    seed_texts = [others[s]["text"] for s in seed_ids]
    for i, j, cosine, ratio in cs.near_pairs(texts, seed_texts, embed):
        if rows[i]["seed_id"] == seed_ids[j]:
            continue  # its own seed: a paraphrase is meant to be close
        report.fail(f"other seed: {pids[i]} ~ {seed_ids[j]} ({cs.show(cosine, ratio)})")
    if sealed is not None:
        report.note(f"sealed set: {len(sealed)} items compared")


def check_rules(rows, rules, report):
    for r, result in zip(rows, rules([r["text"] for r in rows])):
        if result["held"]:
            report.fail(f"held topic: {r['paraphrase_id']} matches held-topic group {result['held']}")
        if result["safety"]:
            report.fail(f"Safety Net: {r['paraphrase_id']} is flagged ({result['safety']})")


def load_seeds(paths):
    seeds = {}
    for path in paths:
        header, rows = cs.read_csv(path)
        missing = [c for c in ("seed_id", "text", "primary_class", "notes") if c not in header]
        if missing:
            raise ValueError(f"{Path(path).name}: seed file lacks columns {missing}")
        for r in rows:
            seeds[r["seed_id"]] = r
    return seeds


def check_file(path, seed_paths, root=REPO, embed=None, rules=None, sealed=None, markers_file=MARKERS_FILE,
               compare_paths=()):
    report = cs.Report()
    header, rows = cs.read_csv(path)
    seeds = load_seeds(seed_paths)
    compare = {sid: s for sid, s in load_seeds(compare_paths).items() if sid not in seeds}
    if not check_structure(header, rows, seeds, read_markers(markers_file), report):
        return report
    embed = cs.cached(embed or cs.e5_embedder())
    rules = rules or cs.gateway_rules(root)
    check_near(rows, seeds, cs.reference_sets(root), sealed, embed, report, compare)
    check_rules(rows, rules, report)
    held = sum(1 for s in seeds.values() if cs.HELD_TOPIC_OVERRIDE in (s.get("notes") or ""))
    report.note(f"paraphrases: {len(rows)}; seeds: {len(seeds)} ({held} with the held-topic override)")
    if compare_paths:
        report.note(f"compared with {len(compare)} other seeds (--compare-seeds, no count rule)")
    by_class = Counter(r["class"] for r in rows)
    report.note("per class: " + ", ".join(f"{c} {by_class[c]}" for c in cs.CLASSES if by_class[c]))
    return report


def main(argv=None, embed=None, rules=None, root=REPO, out=sys.stdout, markers_file=MARKERS_FILE):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("paraphrases", type=Path)
    parser.add_argument("--seeds", type=Path, action="append", required=True, metavar="PATH",
                        help="a V4 seed file the paraphrases belong to; the count rule applies "
                        "to its seeds (repeatable)")
    parser.add_argument("--compare-seeds", type=Path, action="append", default=[], metavar="PATH",
                        help="a V4 seed file used only for the near-duplicate comparison, with "
                        "no count rule (repeatable)")
    parser.add_argument("--sealed", type=Path, metavar="PATH",
                        help="a sealed set (CSV: id,text) kept outside the repository; "
                        "only ids and scores are printed, never its text or path")
    args = parser.parse_args(argv)
    for p in [args.paraphrases, *args.seeds, *args.compare_seeds]:
        if not p.exists():
            print(f"no such file: {p}", file=out)
            return 2
    sealed = None
    if args.sealed is not None:
        try:
            sealed = cs.read_sealed(args.sealed)
        except cs.SealedSetError as error:
            print(f"cannot run the check: {error}", file=out)
            return 2
    try:
        report = check_file(args.paraphrases, args.seeds, root, embed, rules, sealed, markers_file,
                            args.compare_seeds)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"cannot run the check: {error}", file=out)
        return 2
    for line in report.info:
        print(line, file=out)
    print(f"\nwarnings ({len(report.warnings)}):", file=out)
    for line in report.warnings:
        print(f"  {line}", file=out)
    print(f"failures ({len(report.failures)}):", file=out)
    for line in report.failures:
        print(f"  {line}", file=out)
    print("\nFAILED" if report.failures else "\npassed", file=out)
    return 1 if report.failures else 0


if __name__ == "__main__":
    sys.exit(main())
