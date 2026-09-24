"""
Generate the client-side offline knowledge-base bundle.

The authoritative knowledge base remains in:
    resources/knowledge_base/*.md

This script exports the active KB entries to JSON so the frontend
can bundle and cache them for offline use.

Held content separated by "---" is intentionally excluded.

Run from the repository root:
    python3 app/interface/src/scripts/generate-kb-json.py
"""

import json
import os
import re


KB_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "..",
    "resources",
    "knowledge_base",
)

OUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "src",
    "offline",
    "kbData.json",
)

ACTIVE_CATEGORIES = [
    "contraception",
    "sti",
    "pregnancy",
    "general",
]


def parse_kb_file(path):
    """Parse active knowledge-base entries from a Markdown file."""
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


def main():
    """Build kbData.json from the active knowledge-base files."""
    kb = {}

    for category in ACTIVE_CATEGORIES:
        path = os.path.join(KB_DIR, f"{category}.md")

        if os.path.exists(path):
            kb[category] = parse_kb_file(path)
        else:
            kb[category] = []

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    with open(OUT_PATH, "w", encoding="utf-8") as file:
        json.dump(kb, file, indent=2, ensure_ascii=False)
        file.write("\n")

    total = sum(len(entries) for entries in kb.values())

    print(
        f"Exported {total} entries across "
        f"{len(kb)} categories to {OUT_PATH}"
    )

    for category, entries in kb.items():
        print(f"  {category}: {len(entries)}")


if __name__ == "__main__":
    main()