"""
SafeGirl -- V3 euphemism holdout, per-example prediction inspection
=====================================================================

Loads the already-trained V3 final checkpoint (safegirl-classifier-
checkpoints-v3/final_v3) and re-runs it against the 13 euphemism
holdout examples ONLY, printing the actual text, true label,
predicted label, and full per-class confidence scores for each one.

This does NOT retrain anything -- it's a diagnostic pass over a model
that already exists, so it runs in seconds. Use this to see exactly
which holdout examples are being misclassified and where the
confidence is landing, rather than just the aggregate confusion
matrix.

Run this from the project root, same as train_distilbert_v3.py.
"""

from pathlib import Path

import numpy as np
import torch
from transformers import (
    DistilBertForSequenceClassification,
    DistilBertTokenizerFast,
)

# ----------------------------------------------------------------
# Config -- must match train_distilbert_v3.py
# ----------------------------------------------------------------
DATA_DIR = Path("./dataset")
CHECKPOINT_DIR = Path("./safegirl-classifier-checkpoints-v3") / "final_v3"
MAX_LENGTH = 64

CATEGORIES = ["contraception", "sti", "pregnancy", "general"]
EUPHEMISM_HOLDOUT_LABEL = "euphemism_holdout"


# ----------------------------------------------------------------
# Data loading (same logic as train_distilbert_v3.py, trimmed to
# just what's needed to reconstruct the holdout set)
# ----------------------------------------------------------------
import csv


def load_csv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_fold_assignment(path: Path) -> dict[str, str]:
    rows = load_csv(path)
    return {row["seed_id"]: row["fold"] for row in rows}


def build_holdout_examples(seeds_path: Path, reviewed_dir: Path, fold_path: Path):
    fold_assignment = load_fold_assignment(fold_path)
    holdout_seed_ids = {
        sid for sid, fold in fold_assignment.items()
        if fold == EUPHEMISM_HOLDOUT_LABEL
    }
    print(f"Holdout seed IDs: {sorted(holdout_seed_ids)}\n")

    examples = []  # (text, true_class, seed_id, source)

    seeds = load_csv(seeds_path)
    for seed in seeds:
        if seed["seed_id"] in holdout_seed_ids and seed["class"] in CATEGORIES:
            examples.append((seed["text"], seed["class"], seed["seed_id"], "seed"))

    for path in sorted(reviewed_dir.glob("*.csv")):
        for row in load_csv(path):
            if row.get("seed_id") in holdout_seed_ids and row.get("class") in CATEGORIES:
                examples.append((row["text"], row["class"], row["seed_id"], "paraphrase"))

    return examples


# ----------------------------------------------------------------
# Load model + tokenizer
# ----------------------------------------------------------------
print(f"Loading model from: {CHECKPOINT_DIR}")
device = "cuda" if torch.cuda.is_available() else "cpu"
tokenizer = DistilBertTokenizerFast.from_pretrained(str(CHECKPOINT_DIR))
model = DistilBertForSequenceClassification.from_pretrained(str(CHECKPOINT_DIR))
model.to(device)
model.eval()

id2label = model.config.id2label
print(f"Model id2label: {id2label}\n")


# ----------------------------------------------------------------
# Build holdout set and predict, one example at a time
# ----------------------------------------------------------------
seeds_path = DATA_DIR / "seeds" / "seeds.csv"
fold_path = DATA_DIR / "seeds" / "seed_split_assignment_v3.csv"
reviewed_dir = DATA_DIR / "reviewed"

holdout_examples = build_holdout_examples(seeds_path, reviewed_dir, fold_path)
print(f"Total holdout examples: {len(holdout_examples)}\n")
print("=" * 100)

correct = 0
for text, true_class, seed_id, source in holdout_examples:
    encoding = tokenizer(
        text, truncation=True, padding="max_length",
        max_length=MAX_LENGTH, return_tensors="pt",
    ).to(device)

    with torch.no_grad():
        logits = model(**encoding).logits
        probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()

    predicted_id = int(np.argmax(probs))
    predicted_class = id2label[predicted_id]
    is_correct = predicted_class == true_class
    correct += int(is_correct)

    marker = "correct" if is_correct else "WRONG"
    print(f"\n[{marker}] {seed_id} ({source})")
    print(f"  Text:      {text}")
    print(f"  True:      {true_class}")
    print(f"  Predicted: {predicted_class}")
    print("  Scores:    " + ", ".join(
        f"{id2label[i]}={probs[i]:.3f}" for i in range(len(probs))
    ))

print("\n" + "=" * 100)
print(f"\nHoldout accuracy: {correct}/{len(holdout_examples)} = {correct/len(holdout_examples):.1%}")