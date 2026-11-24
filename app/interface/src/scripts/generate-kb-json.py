"""
Generate the client-side offline knowledge-base bundle.

The authoritative knowledge base remains in:
    resources/knowledge_base/*.md

This script exports the active KB entries to JSON so the frontend
can bundle and cache them for offline use.

Held content separated by "---" is intentionally excluded.

Run from the repository root:
    python3 app/interface/src/scripts/generate-kb-json.py
    python3 app/interface/src/scripts/generate-kb-json.py --check   # exit 1 if stale

With --kb-set kb62 it reads resources/knowledge_base/kb62/ (the 62-entry
set, whose entries carry a review status; only approved ones are written)
and writes Kbdata_kb62.json instead; Kbdata.json is not touched.
"""

import argparse
import json
import os
import re
import sys


KB_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "..",
    "..",
    "resources",
    "knowledge_base",
)

OUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "offline",
    "Kbdata.json",
)

ACTIVE_CATEGORIES = [
    "contraception",
    "sti",
    "pregnancy",
    "general",
]

# The 62-entry set (--kb-set kb62), next to the default files.
KB62_DIR = os.path.join(KB_DIR, "kb62")
KB62_OUT_PATH = os.path.join(os.path.dirname(OUT_PATH), "Kbdata_kb62.json")
KB_STATUSES = ("approved", "pending")


def parse_kb_file(path, with_status=False):
    """Parse active knowledge-base entries from a Markdown file. With
    with_status (the kb62 set) every entry must carry a review status and
    only approved entries are returned; the status is never written."""
    with open(path, encoding="utf-8") as file:
        raw = file.read()

    # Content after the first separator may contain HELD material.
    active_section = raw.split("\n---\n")[0]

    entries = []

    # Each entry begins with a second-level Markdown heading.
    blocks = active_section.split("\n## ")[1:]

    for block in blocks:
        id_match = re.match(r"^(KB-\S+)", block)

        if not id_match:
            continue

        def get_field(field):
            pattern = rf"\*\*{re.escape(field)}:\*\*\s*(.+)"
            match = re.search(pattern, block)
            return match.group(1).strip() if match else None

        if with_status:
            status = get_field("Status")
            if status not in KB_STATUSES:
                found = f"unknown status {status!r}" if status else "no status"
                raise SystemExit(
                    f"{os.path.basename(path)}: {id_match.group(1)} has {found} "
                    f"(expected one of {list(KB_STATUSES)})."
                )
            if status != "approved":
                continue

        entries.append(
            {
                "kbId": id_match.group(1),
                "intent": get_field("Intent"),
                "question": get_field("User question"),
                "answer": get_field("Answer"),
                "evidenceClaim": get_field("Evidence/claim"),
                "source": get_field("Source"),
                "conditions": get_field("Conditions/limitations"),
                "safetyNotes": get_field("Safety/referral notes"),
            }
        )

    return entries


def build(kb_dir, with_status=False):
    """Entries by category from the knowledge-base files in kb_dir."""
    kb = {}

    for category in ACTIVE_CATEGORIES:
        path = os.path.join(kb_dir, f"{category}.md")

        if os.path.exists(path):
            kb[category] = parse_kb_file(path, with_status)
        else:
            kb[category] = []

    return kb


def serialize(kb):
    """The file text, exactly as json.dump with indent 2 plus a newline."""
    return json.dumps(kb, indent=2, ensure_ascii=False) + "\n"


def main(argv=None):
    """Build Kbdata.json (or, with --kb-set kb62, Kbdata_kb62.json)."""
    parser = argparse.ArgumentParser(description="Export the KB for offline use.")
    parser.add_argument("--check", action="store_true", help="Do not write; exit 1 if the file is stale.")
    parser.add_argument("--kb-set", choices=("kb62",), help="Export the 62-entry set instead.")
    args = parser.parse_args(argv)
    kb62 = args.kb_set == "kb62"
    out_path = KB62_OUT_PATH if kb62 else OUT_PATH
    kb = build(KB62_DIR if kb62 else KB_DIR, with_status=kb62)
    text = serialize(kb)

    if args.check:
        current = None
        if os.path.exists(out_path):
            with open(out_path, encoding="utf-8", newline="") as file:
                current = file.read()
        name = os.path.basename(out_path)
        if current != text:
            print(f"{name} is out of date. Run: python3 app/interface/src/scripts/generate-kb-json.py"
                  f"{' --kb-set kb62' if kb62 else ''}", file=sys.stderr)
            return 1
        print(f"{name} is up to date ({sum(len(e) for e in kb.values())} entries).")
        return 0

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    # newline="\n": write LF on every platform (text mode would write CRLF
    # on Windows).
    with open(out_path, "w", encoding="utf-8", newline="\n") as file:
        file.write(text)

    total = sum(len(entries) for entries in kb.values())

    print(
        f"Exported {total} entries across "
        f"{len(kb)} categories to {out_path}"
    )

    for category, entries in kb.items():
        print(f"  {category}: {len(entries)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())