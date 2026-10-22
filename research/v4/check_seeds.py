"""Check a V4 seed file before it is used (research/v4/README.md).

Run from the repository root, in isolated mode:

    .venv/Scripts/python.exe -I research/v4/check_seeds.py SEEDS.csv
    .venv/Scripts/python.exe -I research/v4/check_seeds.py --test-items TEST.csv

Exit status: 0 when every check passes (warnings allowed), 1 on any
failure, 2 when the check cannot run (missing file, no Node).

Failures: schema and allowed values; duplicate or empty seed_id; missing
or unusable source; exact or near duplicates inside the file; near
duplicates of the V3 training pool, DR-04, relevance_validation.csv or
the development set; an item the held-topic rule matches.

DR-04 is read only for the comparison, and only its row numbers are ever
printed. The same goes for the development set and
relevance_validation.csv, reported by their row ids.

--sealed PATH adds a sealed set kept outside the repository: a CSV with
columns id,text. A seed near a sealed item fails, reported as seed_id,
sealed id and similarity only. The sealed text and PATH itself are never
printed, so neither can reach a log or report.

Self-contained on purpose: under ``python -I`` the script's own directory
is not on sys.path, so it imports nothing from research/.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Callable, Sequence

REPO = Path(__file__).resolve().parents[2]

COLUMNS = [
    "seed_id",
    "text",
    "primary_class",
    "secondary_class",
    "style",
    "boundary",
    "source",
    "notes",
]
TOPIC_CLASSES = ("contraception", "sti", "pregnancy", "general")
CLASSES = TOPIC_CLASSES + ("out_of_scope", "vague")
STYLES = (
    "formal",
    "colloquial",
    "symptom_only",
    "euphemism",
    "myth_or_worry",
    "short_or_misspelt",
)
DESIGN_RULE = "design rule"
KB_ID = re.compile(r"^KB-[A-Z]+\d+$")
DOCUMENT_PAGE = re.compile(r"\S.*\b(p|pp|page|pages)\.?\s*\d+", re.IGNORECASE)

COSINE_LIMIT = 0.95
RATIO_LIMIT = 0.85
# A KB question whose best training match reaches this is the same
# question as a training item ("train overlap"): in V3, KB-S8, KB-G1,
# KB-G2 and KB-S12. Matches from COSINE_LIMIT up to it are listed as close.
TRAIN_OVERLAP_LIMIT = 0.97
MIN_PER_CLASS = 25
E5_MODEL = "intfloat/multilingual-e5-small"

Embed = Callable[[Sequence[str]], "object"]


# ---------------------------------------------------------------- reading


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames or []), list(reader)


def normalise(text: str) -> str:
    """Lowercase, punctuation removed, whitespace collapsed."""
    return " ".join(re.sub(r"[^\w\s]", " ", text.lower()).split())


def active_kb(root: Path) -> dict[str, str]:
    """Active KB entry id -> question, from the four class files."""
    entries = {}
    for name in ("contraception", "sti", "pregnancy", "general"):
        path = root / "resources" / "knowledge_base" / f"{name}.md"
        if not path.exists():
            continue
        active = path.read_text(encoding="utf-8").split("\n---\n")[0]
        for block in active.split("\n## ")[1:]:
            match = re.match(r"(KB-\S+)", block)
            question = re.search(r"\*\*User question:\*\*\s*(.+)", block)
            if match and question:
                entries[match.group(1)] = question.group(1).strip()
    return entries


def reference_sets(root: Path) -> dict[str, list[tuple[str, str]]]:
    """Each protected or training pool as (label, text) pairs."""
    res = root / "resources"
    v3 = [
        (f"V3 seed {row['seed_id']}", row["text"])
        for row in read_csv(res / "seeds" / "seeds.csv")[1]
    ]
    for path in sorted((res / "reviewed").glob("*.csv")):
        v3 += [
            (f"V3 paraphrase {row['paraphrase_id']}", row["text"])
            for row in read_csv(path)[1]
        ]
    dr04 = [
        (f"DR-04 row {i}", row["text"])
        for i, row in enumerate(read_csv(res / "test" / "independent_test_set.csv")[1], 1)
        if row.get("text")
    ]
    relevance = [
        (f"relevance_validation {row['id']}", row["query"])
        for row in read_csv(res / "eval" / "relevance_validation.csv")[1]
    ]
    # The development set exists in three files with the same queries
    # (the queries file and two label files); one copy is enough.
    dev = [
        (f"development set {row['id']}", row["query"])
        for row in read_csv(res / "eval" / "retrieval_eval_set.csv")[1]
    ]
    return {
        "V3 training pool": v3,
        "DR-04": dr04,
        "relevance_validation.csv": relevance,
        "development set": dev,
    }


# ------------------------------------------------------------- similarity


def e5_embedder() -> Embed:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(E5_MODEL)

    def embed(texts):
        return model.encode(
            ["query: " + t for t in texts],
            normalize_embeddings=True,
            batch_size=64,
        )

    return embed


def cached(embed: Embed) -> Embed:
    """Embed each distinct text once, however many checks use it."""
    import numpy as np

    store = {}

    def run(texts):
        todo = [t for t in dict.fromkeys(texts) if t not in store]
        if todo:
            store.update(zip(todo, embed(todo)))
        return np.array([store[t] for t in texts])

    return run


def show(cosine, ratio):
    """A pair's scores; a ratio skipped by the quick filter is under the limit."""
    shown = f"{ratio:.3f}" if ratio >= RATIO_LIMIT else f"<{RATIO_LIMIT}"
    return f"cosine {cosine:.3f}, ratio {shown}"


def char_ratio(a: str, b: str) -> float:
    matcher = SequenceMatcher(None, a, b)
    if matcher.real_quick_ratio() < RATIO_LIMIT or matcher.quick_ratio() < RATIO_LIMIT:
        return 0.0
    return matcher.ratio()


def near_pairs(left, right, embed: Embed, same=False):
    """(i, j, cosine, ratio) for every near-duplicate pair.

    left and right are lists of texts. With same=True they are the same
    list and each unordered pair is reported once.
    """
    if not left or not right:
        return []
    a = embed(left)
    b = a if same else embed(right)
    cosines = a @ b.T
    norm_left = [normalise(t) for t in left]
    norm_right = norm_left if same else [normalise(t) for t in right]
    pairs = []
    for i in range(len(left)):
        for j in range(i + 1 if same else 0, len(right)):
            cosine = float(cosines[i][j])
            ratio = char_ratio(norm_left[i], norm_right[j])
            if cosine >= COSINE_LIMIT or ratio >= RATIO_LIMIT:
                pairs.append((i, j, cosine, ratio))
    return pairs


# ------------------------------------------------------------------ rules


RULES_JS = r"""
const path = require("path");
const gw = path.join(process.argv[1], "app", "gateway", "src");
const { matchHeldTopic } = require(path.join(gw, "heldTopics"));
const { checkSafety } = require(path.join(gw, "safetyNet"));
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const out = JSON.parse(input).map((text) => {
    const s = checkSafety(text);
    return { held: matchHeldTopic(text), safety: s.flagged ? s.category : null };
  });
  process.stdout.write(JSON.stringify(out));
});
"""


def gateway_rules(root: Path):
    """Run the gateway's own held-topic rule and Safety Net on texts."""

    def run(texts):
        done = subprocess.run(
            ["node", "-e", RULES_JS, str(root)],
            input=json.dumps(list(texts)),
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        )
        return json.loads(done.stdout)

    return run


# ----------------------------------------------------------------- checks


class Report:
    def __init__(self):
        self.failures: list[str] = []
        self.warnings: list[str] = []
        self.info: list[str] = []

    def fail(self, message):
        self.failures.append(message)

    def warn(self, message):
        self.warnings.append(message)

    def note(self, message):
        self.info.append(message)


def check_schema(header, rows, kb_ids, test_items, report):
    if header != COLUMNS:
        missing = [c for c in COLUMNS if c not in header]
        extra = [c for c in header if c not in COLUMNS]
        report.fail(
            "schema: columns must be exactly "
            f"{','.join(COLUMNS)} (missing {missing}, extra {extra}"
            + (", or out of order" if not missing and not extra else "")
            + ")"
        )
        if missing:
            return
    seen = Counter(row["seed_id"].strip() for row in rows)
    for value, count in seen.items():
        if value and count > 1:
            report.fail(f"schema: duplicate seed_id {value} ({count} rows)")
    for n, row in enumerate(rows, 2):
        sid = row["seed_id"].strip() or f"(line {n})"
        where = f"schema: {sid}"
        if not row["seed_id"].strip():
            report.fail(f"{where}: empty seed_id")
        if not row["text"].strip():
            report.fail(f"{where}: empty text")
        primary = row["primary_class"].strip()
        if primary not in CLASSES:
            report.fail(f"{where}: primary_class {primary!r} not one of {list(CLASSES)}")
        secondary = row["secondary_class"].strip()
        if secondary:
            if not test_items:
                report.fail(
                    f"{where}: secondary_class set on a training seed "
                    "(two plausible labels: test items only)"
                )
            elif secondary not in CLASSES or secondary == primary:
                report.fail(f"{where}: secondary_class {secondary!r} invalid")
        style = row["style"].strip()
        if style not in STYLES:
            report.fail(f"{where}: style {style!r} not one of {list(STYLES)}")
        boundary = row["boundary"].strip()
        if boundary:
            parts = boundary.split("_vs_")
            if len(parts) != 2 or any(p not in CLASSES for p in parts) or parts[0] == parts[1]:
                report.fail(f"{where}: boundary {boundary!r} is not <class>_vs_<class>")
        source = row["source"].strip()
        if not source:
            report.fail(f"{where}: missing source")
        elif primary in ("out_of_scope", "vague"):
            if source.lower() != DESIGN_RULE:
                report.fail(f"{where}: source for {primary} must be {DESIGN_RULE!r}")
        elif KB_ID.match(source):
            if source not in kb_ids:
                report.fail(f"{where}: source {source} is not an active KB entry")
        elif source.lower() == DESIGN_RULE:
            report.fail(f"{where}: {DESIGN_RULE!r} is only for out_of_scope and vague")
        elif not DOCUMENT_PAGE.search(source):
            report.fail(f"{where}: source {source!r} is neither a KB id nor a document with a page")


def check_duplicates(rows, refs, embed, report):
    ids = [row["seed_id"] for row in rows]
    texts = [row["text"] for row in rows]

    exact = {}
    for sid, text in zip(ids, texts):
        exact.setdefault(normalise(text), []).append(sid)
    for group in exact.values():
        if len(group) > 1:
            report.fail(f"in-file: exact duplicate text {', '.join(group)}")
    for i, j, cosine, ratio in near_pairs(texts, texts, embed, same=True):
        if normalise(texts[i]) == normalise(texts[j]):
            continue
        report.fail(f"in-file: near duplicate {ids[i]} ~ {ids[j]} ({show(cosine, ratio)})")

    for name, pool in refs.items():
        pool_texts = [text for _, text in pool]
        for i, j, cosine, ratio in near_pairs(texts, pool_texts, embed):
            # Only the label of a protected item is printed, never its text.
            report.fail(f"{name}: {ids[i]} ~ {pool[j][0]} ({show(cosine, ratio)})")


def check_rules(rows, rules, report):
    for row, result in zip(rows, rules([row["text"] for row in rows])):
        if result["held"]:
            report.fail(
                f"held topic: {row['seed_id']} matches held-topic group "
                f"{result['held']} (no held-topic content until approved)"
            )
        if result["safety"]:
            report.warn(
                f"Safety Net: {row['seed_id']} is flagged ({result['safety']}); "
                "the classifier never sees it"
            )


def check_counts(rows, test_items, report):
    by_class = Counter(row["primary_class"].strip() for row in rows)
    by_style = Counter((row["primary_class"].strip(), row["style"].strip()) for row in rows)
    report.note("counts per class:")
    for cls in CLASSES:
        report.note(f"  {cls:<14} {by_class.get(cls, 0)}")
        if not test_items and by_class.get(cls, 0) < MIN_PER_CLASS:
            report.warn(f"counts: {cls} has {by_class.get(cls, 0)} seeds (under {MIN_PER_CLASS})")
    report.note("counts per class x style:")
    report.note("  " + "class".ljust(14) + "".join(s[:12].rjust(13) for s in STYLES))
    for cls in CLASSES:
        report.note("  " + cls.ljust(14) + "".join(str(by_style.get((cls, s), 0)).rjust(13) for s in STYLES))


def train_overlap(rows, refs, kb, embed, report):
    """KB questions that are also training items (info only).

    For each KB question, its best match among the V3 seeds and among the
    items of this file: "train overlap" at TRAIN_OVERLAP_LIMIT or above,
    "close" from COSINE_LIMIT.
    """
    if not kb:
        return
    ids, questions = zip(*kb.items())
    v3_seeds = [(label[len("V3 seed "):], text) for label, text in refs["V3 training pool"] if label.startswith("V3 seed ")]
    for label, pool in (("V3 seeds", v3_seeds), ("this file", [(r["seed_id"], r["text"]) for r in rows])):
        overlap, close = [], []
        if pool:
            cosines = embed(list(questions)) @ embed([t for _, t in pool]).T
            for i, kb_id in enumerate(ids):
                j = int(cosines[i].argmax())
                best = float(cosines[i][j])
                line = f"  {kb_id} ~ {pool[j][0]} (cosine {best:.3f})"
                if best >= TRAIN_OVERLAP_LIMIT:
                    overlap.append(line)
                elif best >= COSINE_LIMIT:
                    close.append(line)
        report.note(f"train overlap ({label}): {len(overlap)} KB question(s)")
        report.info.extend(overlap)
        report.note(f"close to a training item ({label}, cosine {COSINE_LIMIT}-{TRAIN_OVERLAP_LIMIT}): {len(close)}")
        report.info.extend(close)


class SealedSetError(Exception):
    """The sealed set cannot be used. The message never names the path."""


def read_sealed(path: Path) -> list[tuple[str, str]]:
    """(id, text) pairs of a sealed CSV with columns id,text.

    Errors say what is wrong without the path or any text, since this
    output may be pasted into a log or report.
    """
    try:
        header, rows = read_csv(path)
    except FileNotFoundError:
        raise SealedSetError("the sealed set file was not found") from None
    except (OSError, UnicodeDecodeError, csv.Error):
        raise SealedSetError("the sealed set file cannot be read as UTF-8 CSV") from None
    if header != ["id", "text"]:
        raise SealedSetError("the sealed set must have exactly the columns id,text")
    ids = [row["id"].strip() for row in rows]
    if any(not i for i in ids) or any(not (row["text"] or "").strip() for row in rows):
        raise SealedSetError("the sealed set has a row with an empty id or text")
    if len(set(ids)) != len(ids):
        raise SealedSetError("the sealed set has duplicate ids")
    return [(row["id"].strip(), row["text"]) for row in rows]


def check_sealed(rows, sealed, embed, report):
    """Near duplicates of the sealed set: ids and scores only."""
    texts = [row["text"] for row in rows]
    for i, j, cosine, ratio in near_pairs(texts, [t for _, t in sealed], embed):
        report.fail(f"sealed: {rows[i]['seed_id']} ~ sealed {sealed[j][0]} ({show(cosine, ratio)})")
    report.note(f"sealed set: {len(sealed)} items compared")


def check_file(path, root=REPO, embed=None, rules=None, test_items=False, sealed=None):
    report = Report()
    header, rows = read_csv(path)
    kb = active_kb(root)
    check_schema(header, rows, set(kb), test_items, report)
    if any(c not in header for c in COLUMNS):
        return report
    embed = cached(embed or e5_embedder())
    rules = rules or gateway_rules(root)
    refs = reference_sets(root)
    check_duplicates(rows, refs, embed, report)
    if sealed is not None:
        check_sealed(rows, sealed, embed, report)
    check_rules(rows, rules, report)
    check_counts(rows, test_items, report)
    train_overlap(rows, refs, kb, embed, report)
    return report


def main(argv=None, embed=None, rules=None, root=REPO, out=sys.stdout):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("seeds", type=Path)
    parser.add_argument(
        "--test-items",
        action="store_true",
        help="the file holds test items: secondary_class allowed, no per-class minimum",
    )
    parser.add_argument(
        "--sealed",
        type=Path,
        metavar="PATH",
        help="a sealed set (CSV: id,text) kept outside the repository; "
        "only ids and scores are printed, never its text or path",
    )
    args = parser.parse_args(argv)
    if not args.seeds.exists():
        print(f"no such file: {args.seeds}", file=out)
        return 2
    sealed = None
    if args.sealed is not None:
        try:
            sealed = read_sealed(args.sealed)
        except SealedSetError as error:
            print(f"cannot run the check: {error}", file=out)
            return 2
    try:
        report = check_file(args.seeds, root, embed, rules, args.test_items, sealed)
    except (OSError, subprocess.CalledProcessError) as error:
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
