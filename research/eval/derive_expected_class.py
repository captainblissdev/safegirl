"""
Derive a PROVISIONAL expected_class label for each query in the retrieval
development set, without changing the original file.

Reads   resources/eval/retrieval_eval_set.csv          (left untouched)
Writes  resources/eval/retrieval_eval_set_expected_class_PROVISIONAL.csv

Rule: the class of the acceptable_entry_ids (KB-C -> contraception,
KB-S -> sti, KB-P -> pregnancy, KB-G -> general); "none" for off_topic,
gap, held_topic and safety rows, and for rows with no acceptable entry.

Rows listed in AMBIGUOUS are labelled by the same rule but flagged
"ambiguous" in label_status, and are excluded from calibration. The
reasons and the proposed changes are in
research/eval/results/label_review.md. No proposal is applied here.
"""

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "resources" / "eval" / "retrieval_eval_set.csv"
TARGET = ROOT / "resources" / "eval" / "retrieval_eval_set_expected_class_PROVISIONAL.csv"

CLASS_BY_PREFIX = {
    "KB-C": "contraception",
    "KB-S": "sti",
    "KB-P": "pregnancy",
    "KB-G": "general",
}
NONE_GROUPS = {"off_topic", "gap", "held_topic", "safety_positive", "safety_negative"}

# The query's intent and the class of the entry that answers it differ;
# see label_review.md. Excluded from calibration until confirmed.
AMBIGUOUS = {"Q27", "Q28", "Q29", "Q30", "Q58"}


def expected_class(row: dict) -> str:
    if row["group"] in NONE_GROUPS:
        return "none"
    ids = [i.strip() for i in row["acceptable_entry_ids"].split(";") if i.strip()]
    classes = {CLASS_BY_PREFIX[i[:4]] for i in ids}
    if not classes:
        return "none"
    if len(classes) > 1:
        return "ambiguous"
    return classes.pop()


def main() -> None:
    with SOURCE.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        columns = list(reader.fieldnames or [])
        rows = list(reader)

    for row in rows:
        row["expected_class"] = expected_class(row)
        if row["expected_class"] == "ambiguous" or row["id"] in AMBIGUOUS:
            row["label_status"] = "provisional; ambiguous, excluded from calibration"
        else:
            row["label_status"] = "provisional"

    with TARGET.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=columns + ["expected_class", "label_status"], lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(rows)

    counts: dict[str, int] = {}
    for row in rows:
        counts[row["expected_class"]] = counts.get(row["expected_class"], 0) + 1
    print(f"wrote {TARGET.relative_to(ROOT)}: {len(rows)} rows, {counts}")
    print("ambiguous:", sorted(r["id"] for r in rows if "ambiguous" in r["label_status"]))


if __name__ == "__main__":
    main()
