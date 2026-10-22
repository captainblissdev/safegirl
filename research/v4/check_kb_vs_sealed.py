"""Compare every knowledge-base question with a sealed set.

Run from the repository root, in isolated mode:

    .venv/Scripts/python.exe -I research/v4/check_kb_vs_sealed.py --sealed PATH

PATH is a CSV with columns id,text, kept outside the repository. For each
KB entry's "User question" (every entry in the class files: approved,
pending and held, plus gbv.md), the script prints the KB entry id, the
sealed id and the e5 cosine for every pair at or above 0.95. It never
prints or saves the sealed text or the path, including in its errors.

Exit status: 0 when no pair reaches the limit, 1 when one does, 2 when
the check cannot run.

The embedding is the one research/v4/check_seeds.py uses (on the
v4/data-tooling branch): intfloat/multilingual-e5-small, "query: "
prefix, normalised. It is repeated here because this script lives on the
KB branch, where check_seeds.py is not present.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
KB_FILES = ("contraception", "sti", "pregnancy", "general", "gbv")
COSINE_LIMIT = 0.95
E5_MODEL = "intfloat/multilingual-e5-small"


def e5_embedder():
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(E5_MODEL)

    def embed(texts):
        return model.encode(
            ["query: " + t for t in texts],
            normalize_embeddings=True,
            batch_size=64,
        )

    return embed


class SealedSetError(Exception):
    """The sealed set cannot be used. The message never names the path."""


def read_sealed(path: Path) -> list[tuple[str, str]]:
    try:
        with open(path, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            header, rows = list(reader.fieldnames or []), list(reader)
    except FileNotFoundError:
        raise SealedSetError("the sealed set file was not found") from None
    except (OSError, UnicodeDecodeError, csv.Error):
        raise SealedSetError("the sealed set file cannot be read as UTF-8 CSV") from None
    if header != ["id", "text"]:
        raise SealedSetError("the sealed set must have exactly the columns id,text")
    if any(not (r["id"] or "").strip() or not (r["text"] or "").strip() for r in rows):
        raise SealedSetError("the sealed set has a row with an empty id or text")
    return [(r["id"].strip(), r["text"]) for r in rows]


def kb_questions(kb_dir: Path) -> list[tuple[str, str]]:
    """(entry id, User question) for every entry heading in the KB files,
    above and below the HELD boundary."""
    out = []
    for name in KB_FILES:
        path = kb_dir / f"{name}.md"
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        # Active entries use "## "; held ones below the boundary use "### ".
        for block in re.split(r"\n#{2,3} ", "\n" + text)[1:]:
            entry = re.match(r"([A-Z]+-\S+)", block)
            question = re.search(r"\*\*User question:\*\*\s*(.+)", block)
            if entry and question:
                out.append((entry.group(1), question.group(1).strip()))
    return out


def pairs(questions, sealed, embed, limit=COSINE_LIMIT):
    """(KB id, sealed id, cosine) at or above the limit, highest first."""
    if not questions or not sealed:
        return []
    cosines = embed([q for _, q in questions]) @ embed([t for _, t in sealed]).T
    found = [
        (questions[i][0], sealed[j][0], float(cosines[i][j]))
        for i in range(len(questions))
        for j in range(len(sealed))
        if float(cosines[i][j]) >= limit
    ]
    return sorted(found, key=lambda p: -p[2])


def main(argv=None, embed=None, kb_dir=None, out=sys.stdout):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--sealed", type=Path, required=True, metavar="PATH")
    args = parser.parse_args(argv)
    try:
        sealed = read_sealed(args.sealed)
    except SealedSetError as error:
        print(f"cannot run the check: {error}", file=out)
        return 2
    questions = kb_questions(kb_dir or REPO / "resources" / "knowledge_base")
    found = pairs(questions, sealed, embed or e5_embedder())
    print(
        f"{len(questions)} KB questions compared with {len(sealed)} sealed items "
        f"(cosine >= {COSINE_LIMIT})",
        file=out,
    )
    for kb_id, sealed_id, cosine in found:
        print(f"  {kb_id} ~ sealed {sealed_id} (cosine {cosine:.3f})", file=out)
    print(f"pairs: {len(found)}", file=out)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
