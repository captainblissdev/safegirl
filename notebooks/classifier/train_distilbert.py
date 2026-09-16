"""
SafeGirl — DistilBERT Intent Classifier Fine-Tuning
====================================================

Fine-tunes a multilingual DistilBERT model to classify SafeGirl
sexual and reproductive health (SRH) queries into four intent
categories:

    - contraception
    - sti
    - pregnancy
    - general

This script is intended to run in Google Colab with a GPU runtime.

IMPORTANT
---------
Training must only use manually reviewed paraphrases stored in
dataset/reviewed/. The script deliberately refuses to train directly
from dataset/generated/ to preserve the project's review gate:

    seeds -> paraphrase -> human review -> training dataset

Dataset splitting follows seed-level assignment. All paraphrases
derived from the same seed inherit that seed's split to prevent
data leakage between training and validation/test sets.

Final performance must be reported using a genuinely independent
test set. Validation metrics are not final test metrics.
"""

from __future__ import annotations

import csv
import os
import random
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from torch.utils.data.dataset import Dataset
from transformers import (
    DistilBertForSequenceClassification,
    DistilBertTokenizerFast,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
)


# ============================================================================
# Configuration
# ============================================================================

SEED = 42

MODEL_NAME = "distilbert-base-multilingual-cased"

DATA_DIR = Path("./dataset")
OUTPUT_DIR = Path("./safegirl-classifier-checkpoints")

MAX_LENGTH = 64
BATCH_SIZE = 16
LEARNING_RATE = 2e-5
MAX_EPOCHS = 5
EARLY_STOPPING_PATIENCE = 2

CATEGORIES = [
    "contraception",
    "sti",
    "pregnancy",
    "general",
]

LABEL2ID = {
    label: index
    for index, label in enumerate(CATEGORIES)
}

ID2LABEL = {
    index: label
    for label, index in LABEL2ID.items()
}


# ============================================================================
# Reproducibility
# ============================================================================

def set_seed(seed: int) -> None:
    """Set random seeds used by Python, NumPy and PyTorch."""

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


set_seed(SEED)


# ============================================================================
# Data Loading
# ============================================================================

def load_csv(path: Path) -> list[dict[str, str]]:
    """Load a CSV file into a list of dictionaries."""

    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")

    with path.open("r", encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def load_seeds(path: Path) -> list[dict[str, str]]:
    """Load the original SafeGirl seed questions."""

    rows = load_csv(path)

    required_columns = {"seed_id", "text", "class"}

    if not rows:
        raise RuntimeError(f"Seed file is empty: {path}")

    missing = required_columns - rows[0].keys()

    if missing:
        raise ValueError(
            f"Seed file is missing required columns: {sorted(missing)}"
        )

    return rows


def load_split_assignment(path: Path) -> dict[str, str]:
    """
    Load seed-level train/validation/test assignments.

    Expected format:

        seed_id,split

    where split is train, val or test.

    The current project may not yet contain an independent test split.
    In that case, test remains empty until DR-04 is completed.
    """

    rows = load_csv(path)

    required_columns = {"seed_id", "split"}

    if rows:
        missing = required_columns - rows[0].keys()

        if missing:
            raise ValueError(
                "Split assignment file is missing required columns: "
                f"{sorted(missing)}"
            )

    return {
        row["seed_id"]: row["split"]
        for row in rows
    }


def load_reviewed_paraphrases(
    reviewed_dir: Path,
) -> list[dict[str, str]]:
    """
    Load manually reviewed paraphrases.

    Training is blocked if dataset/reviewed/ does not exist or contains
    no CSV files. This prevents accidental training on unreviewed data
    from dataset/generated/.
    """

    if not reviewed_dir.exists():
        raise RuntimeError(
            f"Reviewed dataset directory does not exist: {reviewed_dir}"
        )

    csv_files = sorted(reviewed_dir.glob("*.csv"))

    if not csv_files:
        raise RuntimeError(
            f"No reviewed CSV files found in {reviewed_dir}.\n"
            "Complete manual review and place the approved paraphrases "
            "in dataset/reviewed/ before training."
        )

    rows: list[dict[str, str]] = []

    for path in csv_files:
        file_rows = load_csv(path)

        if file_rows:
            required_columns = {"seed_id", "text", "class"}
            missing = required_columns - file_rows[0].keys()

            if missing:
                raise ValueError(
                    f"{path} is missing required columns: "
                    f"{sorted(missing)}"
                )

        rows.extend(file_rows)

    if not rows:
        raise RuntimeError(
            f"Reviewed CSV files were found in {reviewed_dir}, "
            "but they contain no records."
        )

    return rows


def build_dataset(
    seeds_path: Path,
    split_path: Path,
    reviewed_dir: Path,
) -> dict[str, list[tuple[str, str]]]:
    """
    Build train, validation and test datasets.

    Original seed questions and their reviewed paraphrases inherit the
    split assigned to their seed. This prevents paraphrases derived
    from the same seed from appearing across different splits.
    """

    seeds = load_seeds(seeds_path)
    split_assignment = load_split_assignment(split_path)
    paraphrases = load_reviewed_paraphrases(reviewed_dir)

    splits: dict[str, list[tuple[str, str]]] = {
        "train": [],
        "val": [],
        "test": [],
    }

    for seed in seeds:
        split = split_assignment.get(seed["seed_id"])

        if split not in splits:
            continue

        if seed["class"] not in CATEGORIES:
            continue

        splits[split].append(
            (seed["text"], seed["class"])
        )

    for paraphrase in paraphrases:
        split = split_assignment.get(paraphrase["seed_id"])

        if split not in splits:
            continue

        if paraphrase["class"] not in CATEGORIES:
            continue

        splits[split].append(
            (paraphrase["text"], paraphrase["class"])
        )

    print("\nDataset summary")
    print("-" * 40)

    for split_name, examples in splits.items():
        print(f"{split_name:>5}: {len(examples)} examples")

    print("-" * 40)

    return splits


# ============================================================================
# PyTorch Dataset
# ============================================================================

class SafeGirlDataset(Dataset):
    """PyTorch dataset for SafeGirl intent classification."""

    def __init__(
        self,
        examples: list[tuple[str, str]],
        tokenizer: DistilBertTokenizerFast,
        max_length: int,
    ) -> None:
        self.examples = examples
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        text, label = self.examples[index]

        encoding = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=self.max_length,
            return_tensors="pt",
        )

        item = {
            key: value.squeeze(0)
            for key, value in encoding.items()
        }

        item["labels"] = torch.tensor(
            LABEL2ID[label],
            dtype=torch.long,
        )

        return item


# ============================================================================
# Evaluation
# ============================================================================

def compute_metrics(eval_pred) -> dict[str, float]:
    """
    Calculate aggregate classification metrics.

    Aggregate metrics:
        - Accuracy
        - Weighted precision
        - Weighted recall
        - Weighted F1

    Per-category metrics and the confusion matrix are printed for
    error analysis.
    """

    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=1)

    precision, recall, f1, _ = precision_recall_fscore_support(
        labels,
        predictions,
        average="weighted",
        zero_division=0,
    )

    accuracy = accuracy_score(labels, predictions)

    category_precision, category_recall, category_f1, support = (
        precision_recall_fscore_support(
            labels,
            predictions,
            labels=list(range(len(CATEGORIES))),
            average=None,
            zero_division=0,
        )
    )

    print("\nPer-category performance")
    print("-" * 60)

    for index, category in enumerate(CATEGORIES):
        print(
            f"{category:<15} "
            f"precision={category_precision[index]:.4f} "
            f"recall={category_recall[index]:.4f} "
            f"f1={category_f1[index]:.4f} "
            f"support={support[index]}"
        )

    print("\nConfusion matrix")
    print("-" * 60)
    print("Rows = true labels")
    print("Columns = predicted labels")
    print(CATEGORIES)
    print(confusion_matrix(
        labels,
        predictions,
        labels=list(range(len(CATEGORIES))),
    ))

    return {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
    }


# ============================================================================
# Main Training Procedure
# ============================================================================

def main() -> None:
    """Load data, fine-tune DistilBERT and save the best model."""

    print("=" * 70)
    print("SafeGirl — DistilBERT Intent Classifier")
    print("=" * 70)

    if torch.cuda.is_available():
        print(f"GPU available: {torch.cuda.get_device_name(0)}")
    else:
        print("WARNING: No GPU detected. Training will run on CPU.")

    seeds_path = DATA_DIR / "seeds" / "seeds.csv"
    split_path = DATA_DIR / "seeds" / "seed_split_assignment.csv"
    reviewed_dir = DATA_DIR / "reviewed"

    # ------------------------------------------------------------------
    # Load dataset
    # ------------------------------------------------------------------

    print("\nLoading dataset...")

    splits = build_dataset(
        seeds_path=seeds_path,
        split_path=split_path,
        reviewed_dir=reviewed_dir,
    )

    if not splits["train"]:
        raise RuntimeError(
            "Training split is empty. Check the seed split assignment "
            "and reviewed dataset."
        )

    if not splits["val"]:
        raise RuntimeError(
            "Validation split is empty. Check the seed split assignment "
            "and reviewed dataset."
        )

    # ------------------------------------------------------------------
    # Load tokenizer and pretrained model
    # ------------------------------------------------------------------

    print(f"\nLoading model: {MODEL_NAME}")

    tokenizer = DistilBertTokenizerFast.from_pretrained(
        MODEL_NAME
    )

    model = DistilBertForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(CATEGORIES),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )

    # ------------------------------------------------------------------
    # Prepare datasets
    # ------------------------------------------------------------------

    train_dataset = SafeGirlDataset(
        examples=splits["train"],
        tokenizer=tokenizer,
        max_length=MAX_LENGTH,
    )

    val_dataset = SafeGirlDataset(
        examples=splits["val"],
        tokenizer=tokenizer,
        max_length=MAX_LENGTH,
    )

    # ------------------------------------------------------------------
    # Training configuration
    # ------------------------------------------------------------------

    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),

        num_train_epochs=MAX_EPOCHS,

        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,

        learning_rate=LEARNING_RATE,

        eval_strategy="epoch",
        save_strategy="epoch",

        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,

        seed=SEED,

        logging_dir=str(OUTPUT_DIR / "logs"),
        logging_steps=10,

        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
        callbacks=[
            EarlyStoppingCallback(
                early_stopping_patience=EARLY_STOPPING_PATIENCE
            )
        ],
    )

    # ------------------------------------------------------------------
    # Train
    # ------------------------------------------------------------------

    print("\nStarting training...")

    trainer.train()

    # ------------------------------------------------------------------
    # Validate best model
    # ------------------------------------------------------------------

    print("\nFinal validation evaluation")
    print("=" * 70)

    validation_metrics = trainer.evaluate()

    for metric, value in validation_metrics.items():
        if isinstance(value, (float, int)):
            print(f"{metric}: {value}")

    # ------------------------------------------------------------------
    # Save best model
    # ------------------------------------------------------------------

    final_model_dir = OUTPUT_DIR / "final"

    print(f"\nSaving best model to: {final_model_dir}")

    trainer.save_model(str(final_model_dir))
    tokenizer.save_pretrained(str(final_model_dir))

    # ------------------------------------------------------------------
    # Test-set status
    # ------------------------------------------------------------------

    if splits["test"]:
        print(
            "\nWARNING: A test split was detected."
        )
        print(
            "Do not report it as the final evaluation until you have "
            "confirmed that it was constructed independently according "
            "to DR-04."
        )
    else:
        print(
            "\nNo independent test set is currently available."
        )
        print(
            "Validation metrics must NOT be reported as final test "
            "performance."
        )

    print("\nTraining complete.")


if __name__ == "__main__":
    main()