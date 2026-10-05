"""
SafeGirl -- knowledge base conversion
========================================

Converts the authored knowledge base -- the markdown files in
resources/knowledge_base/ that the gateway's retrievalModule.js and the
offline interface already read -- into the flat JSON list that
retrieval.py's KnowledgeBaseRetriever expects.

There is exactly ONE authored copy of the knowledge base: the markdown.
knowledge_base.json is generated; never edit it by hand. Change the
markdown and re-run:

    python build_kb.py            # regenerate knowledge_base.json
    python build_kb.py --check    # exit 1 if knowledge_base.json is stale

Markdown format (the same rules retrievalModule.js applies, so every
consumer serves the same entries):

    # Knowledge Base — Pregnancy          <- file title, ignored

    ## KB-P1                              <- one entry per level-2 heading
    - **Intent:** Pregnancy
    - **User question:** ...
    - **Answer:** ...
    - **Evidence/claim:** ...
    - **Source:** ...
    - **Conditions/limitations:** ...
    - **Safety/referral notes:** ...

    ---                                   <- HELD boundary

    ## HELD — pending review              <- never exported
    ### KB-P4 ...

A line containing only "---" is NOT an entry separator: it marks the
start of HELD content (pending supervisor/legal review). Everything after
the first such line is excluded. gbv.md is not exported at all -- the
category is held with 0 active entries and no consumer serves it.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

ML_SERVICE_DIR = Path(__file__).resolve().parent
KB_SOURCE_DIR = ML_SERVICE_DIR.parent / "resources" / "knowledge_base"
OUTPUT_PATH = ML_SERVICE_DIR / "knowledge_base.json"

# class value -> source file. Class values must match EXPECTED_LABELS in
# app.py. gbv is deliberately absent (see module docstring).
SOURCE_FILES = {
    "contraception": "contraception.md",
    "sti": "sti.md",
    "pregnancy": "pregnancy.md",
    "general": "general.md",
}

# Entry ids encode their category (KB-C1, KB-S2, ...). Checked so an entry
# pasted into the wrong file is caught rather than served under the wrong
# class.
ID_PREFIX_FOR_CLASS = {
    "contraception": "KB-C",
    "sti": "KB-S",
    "pregnancy": "KB-P",
    "general": "KB-G",
}

HELD_BOUNDARY = re.compile(r"^---[ \t]*$", re.MULTILINE)
ENTRY_HEADING = re.compile(r"^## ", re.MULTILINE)
ENTRY_ID = re.compile(r"^(KB-\S+)")
ANY_KB_ID = re.compile(r"\bKB-[A-Za-z0-9]+")

REQUIRED_FIELDS = ("User question", "Answer", "Source")
OPTIONAL_CONTENT_FIELDS = {
    # markdown label -> prefix used in the embedded/retrieved content
    "Evidence/claim": "Evidence",
    "Conditions/limitations": "Conditions",
    "Safety/referral notes": "Safety notes",
}

# "None required.", "None significant." etc. add nothing to a passage.
NONE_PLACEHOLDER = re.compile(r"^\s*none\b", re.IGNORECASE)


class KBParseError(RuntimeError):
    pass


def get_field(block: str, label: str) -> str | None:
    """Value of a '**Label:** value' line, or None if absent/empty.
    Single-line, matching retrievalModule.js."""
    match = re.search(rf"\*\*{re.escape(label)}:\*\*[ \t]*(.+)", block)
    if not match:
        return None
    value = match.group(1).strip()
    return value or None


def split_active_and_held(raw_text: str) -> tuple[str, str]:
    """Split a file into (active, held) at the first '---' line."""
    parts = HELD_BOUNDARY.split(raw_text, maxsplit=1)
    return parts[0], parts[1] if len(parts) > 1 else ""


def parse_entry(block: str, filename: str, entry_class: str) -> dict:
    entry_id = ENTRY_ID.match(block).group(1)

    expected_prefix = ID_PREFIX_FOR_CLASS[entry_class]
    if not entry_id.startswith(expected_prefix):
        raise KBParseError(
            f"{filename}: {entry_id} does not belong in the "
            f"'{entry_class}' file (expected ids starting {expected_prefix})."
        )

    fields = {label: get_field(block, label) for label in REQUIRED_FIELDS}
    missing = [label for label, value in fields.items() if value is None]
    if missing:
        raise KBParseError(
            f"{filename}: {entry_id} is missing required field(s) {missing}."
        )

    content_parts = [fields["Answer"]]
    for label, prefix in OPTIONAL_CONTENT_FIELDS.items():
        value = get_field(block, label)
        if value and not NONE_PLACEHOLDER.match(value):
            content_parts.append(f"{prefix}: {value}")

    return {
        "id": entry_id,
        "class": entry_class,
        "title": fields["User question"],
        "content": "\n\n".join(content_parts),
        "source": fields["Source"],
    }


def parse_file(path: Path, entry_class: str) -> list[dict]:
    raw_text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    active, held = split_active_and_held(raw_text)

    # The first chunk is the file title; each later chunk is one "## "
    # section. Sections whose heading is not a KB id are skipped, as in
    # retrievalModule.js.
    blocks = ENTRY_HEADING.split(active)[1:]
    entries = [
        parse_entry(block, path.name, entry_class)
        for block in blocks
        if ENTRY_ID.match(block)
    ]

    if not entries:
        raise KBParseError(f"{path.name}: no active KB entries found.")

    # Defence in depth: nothing referenced in the HELD section may be
    # exported, even if the same id were accidentally duplicated above
    # the boundary.
    held_ids = set(ANY_KB_ID.findall(held))
    leaked = held_ids & {e["id"] for e in entries}
    if leaked:
        raise KBParseError(
            f"{path.name}: HELD entries appear in the active section: "
            f"{sorted(leaked)}. Remove them above the '---' boundary."
        )

    return entries


def build_kb(source_dir: Path = KB_SOURCE_DIR) -> list[dict]:
    entries: list[dict] = []

    for entry_class, filename in SOURCE_FILES.items():
        path = source_dir / filename
        if not path.is_file():
            raise KBParseError(f"Knowledge-base file not found: {path}")
        entries.extend(parse_file(path, entry_class))

    ids = [e["id"] for e in entries]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        raise KBParseError(f"Duplicate ids across knowledge-base files: {dupes}")

    return entries


def serialize(entries: list[dict]) -> str:
    return json.dumps(entries, indent=2, ensure_ascii=False) + "\n"


def write_atomically(path: Path, text: str) -> None:
    """Write via a temp file + rename so a running service never reads a
    half-written knowledge base."""
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--check",
        action="store_true",
        help="Do not write; exit 1 if knowledge_base.json is missing or stale.",
    )
    args = parser.parse_args()

    try:
        entries = build_kb()
    except KBParseError as exc:
        print(f"KB conversion failed: {exc}", file=sys.stderr)
        return 1

    text = serialize(entries)
    rel_output = OUTPUT_PATH.relative_to(ML_SERVICE_DIR.parent).as_posix()

    if args.check:
        current = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else None
        if current != text:
            print(
                f"{rel_output} is out of date with resources/knowledge_base/. "
                "Run: python ml_service/build_kb.py",
                file=sys.stderr,
            )
            return 1
        print(f"{rel_output} is up to date ({len(entries)} entries).")
        return 0

    write_atomically(OUTPUT_PATH, text)

    by_class: dict[str, int] = {}
    for entry in entries:
        by_class[entry["class"]] = by_class.get(entry["class"], 0) + 1

    print(f"Wrote {len(entries)} entries to {rel_output}")
    print(f"By class: {by_class}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
