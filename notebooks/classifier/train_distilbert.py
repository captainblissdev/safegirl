"""
SafeGirl — DistilBERT Intent Classifier Training (V2, 5-fold CV)
===================================================================

Fine-tunes a multilingual DistilBERT model to classify SafeGirl SRH
queries into four intent categories: contraception, sti, pregnancy,
general.

Runs in Google Colab with a GPU runtime. Not executable in the sandbox
this was written in (no huggingface.co access there) -- syntax and the
pure-Python data/aggregation logic have been checked directly; the
transformers/torch training loop has not been execution-tested
end-to-end and should be debugged on first real run.

METHODOLOGY (locked, decision-log.md, 2026-09-XX)
--------------------------------------------------
V1 (55 seeds, single train/val split, 80% accuracy / macro-F1 0.7677)
is a historical baseline -- not retrained, not touched by this script.

V2 (182 seeds) uses 5-fold StratifiedGroupKFold cross-validation:
    - seed_id is the grouping variable (paraphrases of the same seed
      never cross a fold boundary -- DR-01 leakage prevention extended
      to k folds)
    - stratification preserves class proportions across folds
    - each fold serves as validation exactly once
    - model selection / early stopping: validation MACRO-F1, maximized
      (chosen over weighted F1 specifically because fold class counts
      are not perfectly balanced -- macro treats every class equally
      rather than letting larger classes dominate the metric)
    - mean +/- SD and an aggregate confusion matrix are reported across
      the 5 folds
    - the final deployed/tested model is a FRESH retrain on all 182
      seeds using the validated configuration -- not simply the
      best-performing individual fold's model
    - that final model is evaluated exactly once on the independent
      expert test set (DR-04), only once that test set actually exists

Training must only use manually reviewed paraphrases in
dataset/reviewed/ -- this script refuses to run against
dataset/generated/ content.
"""

from __future__ import annotations

import csv
import json
import statistics
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from torch.utils.data import Dataset
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
N_FOLDS = 5

MODEL_NAME = "distilbert-base-multilingual-cased"

DATA_DIR = Path("./dataset")
OUTPUT_DIR = Path("./safegirl-classifier-checkpoints")

MAX_LENGTH = 64
BATCH_SIZE = 16
LEARNING_RATE = 2e-5
MAX_EPOCHS = 5
EARLY_STOPPING_PATIENCE = 2

# Locked at the "Step 12" methodology checkpoint: macro-F1, not weighted,
# drives model selection and early stopping. Weighted F1 is still
# computed and reported for transparency, but never used for selection.
MODEL_SELECTION_METRIC = "f1_macro"

CATEGORIES = ["contraception", "sti", "pregnancy", "general"]
LABEL2ID = {label: i for i, label in enumerate(CATEGORIES)}
ID2LABEL = {i: label for label, i in LABEL2ID.items()}


def set_seed(seed: int) -> None:
    import random
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


set_seed(SEED)


# ============================================================================
# Data loading
# ============================================================================

def load_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_seeds(path: Path) -> list[dict[str, str]]:
    rows = load_csv(path)
    if not rows:
        raise RuntimeError(f"Seed file is empty: {path}")
    missing = {"seed_id", "text", "class"} - rows[0].keys()
    if missing:
        raise ValueError(f"Seed file missing columns: {sorted(missing)}")
    return rows


def load_fold_assignment(path: Path) -> dict[str, int]:
    """
    Loads the frozen V2 fold assignment (seed_id, class, fold), where
    fold is an integer 1..N_FOLDS. This is NOT the old train/val/test
    'split' column -- every one of the 182 seeds belongs to exactly one
    fold; there is no separate 'test' value in this file. The
    independent expert test set (DR-04) lives entirely separately, in
    dataset/test/, and is loaded by load_test_set() below.
    """
    rows = load_csv(path)
    if not rows:
        raise RuntimeError(f"Fold assignment file is empty: {path}")
    missing = {"seed_id", "fold"} - rows[0].keys()
    if missing:
        raise ValueError(
            f"Fold assignment file missing columns: {sorted(missing)}. "
            "If this file still uses a 'split' column instead of 'fold', "
            "it is the pre-CV V1 format and needs regenerating via the "
            "frozen V2 StratifiedGroupKFold script first."
        )
    return {row["seed_id"]: int(row["fold"]) for row in rows}


def load_reviewed_paraphrases(reviewed_dir: Path) -> list[dict[str, str]]:
    """Refuses to run against dataset/generated/ -- unreviewed content
    never enters training, per the standing project review gate."""
    if not reviewed_dir.exists():
        raise RuntimeError(f"Reviewed directory does not exist: {reviewed_dir}")
    csv_files = sorted(reviewed_dir.glob("*.csv"))
    if not csv_files:
        raise RuntimeError(
            f"No reviewed CSV files found in {reviewed_dir}. Complete "
            "manual review and place approved paraphrases there first."
        )
    rows: list[dict[str, str]] = []
    for path in csv_files:
        file_rows = load_csv(path)
        if file_rows:
            missing = {"seed_id", "text", "class"} - file_rows[0].keys()
            if missing:
                raise ValueError(f"{path} missing columns: {sorted(missing)}")
        rows.extend(file_rows)
    if not rows:
        raise RuntimeError(f"Reviewed CSVs in {reviewed_dir} contain no records.")
    return rows


def load_test_set(test_dir: Path):
    """Loads the independent expert test set (DR-04). Returns None if
    it doesn't exist yet -- CV and the final retrain can both proceed
    without it; only the final one-time test evaluation needs it."""
    if not test_dir.exists() or not any(test_dir.glob("*.csv")):
        return None
    examples = []
    for path in sorted(test_dir.glob("*.csv")):
        for row in load_csv(path):
            if row.get("class") in CATEGORIES and row.get("text"):
                examples.append((row["text"], row["class"]))
    return examples if examples else None


def build_all_examples(seeds_path: Path, reviewed_dir: Path):
    """Returns (text, class, seed_id) for every seed AND every reviewed
    paraphrase -- the full 910-example V2 pool, not yet split into
    folds. seed_id is carried through so build_fold_datasets() can
    assign each example to its seed's fold."""
    seeds = load_seeds(seeds_path)
    paraphrases = load_reviewed_paraphrases(reviewed_dir)

    examples = []
    for seed in seeds:
        if seed["class"] in CATEGORIES:
            examples.append((seed["text"], seed["class"], seed["seed_id"]))
    for para in paraphrases:
        if para["class"] in CATEGORIES:
            examples.append((para["text"], para["class"], para["seed_id"]))
    return examples


def build_fold_datasets(all_examples, fold_assignment: dict[str, int]):
    """Buckets every example (seed + its paraphrases) into its seed's
    frozen fold. This is a lookup against the ALREADY-FROZEN fold
    assignment (StratifiedGroupKFold was run once, on seeds only, to
    produce seed_split_assignment_v2.csv) -- paraphrases are never
    re-split independently, they inherit their seed's fold exactly."""
    folds = {i: [] for i in range(1, N_FOLDS + 1)}
    unassigned = []
    for text, cls, seed_id in all_examples:
        fold = fold_assignment.get(seed_id)
        if fold is None:
            unassigned.append(seed_id)
            continue
        folds[fold].append((text, cls))

    if unassigned:
        raise RuntimeError(
            f"{len(unassigned)} examples reference seed_ids with no fold "
            f"assignment (first few: {unassigned[:5]}). The fold "
            "assignment file may be stale relative to the seeds/"
            "paraphrases actually present."
        )

    print("\nExamples per fold:")
    for fold_num in sorted(folds):
        print(f"  fold {fold_num}: {len(folds[fold_num])} examples")
    return folds


# ============================================================================
# PyTorch dataset
# ============================================================================

class SafeGirlDataset(Dataset):
    def __init__(self, examples, tokenizer, max_length):
        self.examples = examples
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, index):
        text, label = self.examples[index]
        encoding = self.tokenizer(
            text, truncation=True, padding="max_length",
            max_length=self.max_length, return_tensors="pt",
        )
        item = {k: v.squeeze(0) for k, v in encoding.items()}
        item["labels"] = torch.tensor(LABEL2ID[label], dtype=torch.long)
        return item


# ============================================================================
# Metrics
# ============================================================================

def compute_metrics_factory(verbose: bool = True):
    """Returns a compute_metrics function for the Trainer. Reports BOTH
    macro and weighted F1 -- macro drives model selection (locked
    decision), weighted is kept for transparency/comparison only."""

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        predictions = np.argmax(logits, axis=1)

        p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(
            labels, predictions, average="macro", zero_division=0
        )
        p_weighted, r_weighted, f1_weighted, _ = precision_recall_fscore_support(
            labels, predictions, average="weighted", zero_division=0
        )
        accuracy = accuracy_score(labels, predictions)

        cat_p, cat_r, cat_f1, support = precision_recall_fscore_support(
            labels, predictions, labels=list(range(len(CATEGORIES))),
            average=None, zero_division=0,
        )

        if verbose:
            print("\nPer-category performance")
            print("-" * 60)
            for i, cat in enumerate(CATEGORIES):
                print(
                    f"{cat:<15} precision={cat_p[i]:.4f} "
                    f"recall={cat_r[i]:.4f} f1={cat_f1[i]:.4f} "
                    f"support={support[i]}"
                )
            print("\nConfusion matrix (rows=true, cols=predicted)")
            print(CATEGORIES)
            print(confusion_matrix(labels, predictions, labels=list(range(len(CATEGORIES)))))

        return {
            "accuracy": float(accuracy),
            "f1_macro": float(f1_macro),
            "f1_weighted": float(f1_weighted),
            "precision_macro": float(p_macro),
            "recall_macro": float(r_macro),
            "precision_weighted": float(p_weighted),
            "recall_weighted": float(r_weighted),
        }

    return compute_metrics


# ============================================================================
# Single-fold training
# ============================================================================

def train_one_fold(fold_num, train_examples, val_examples, tokenizer):
    """Trains one model with fold_num held out as validation. Returns
    the validation metrics, raw predictions (for the aggregate
    confusion matrix), and the best epoch (for averaging into the
    final retrain's epoch count)."""

    print(f"\n{'=' * 70}\nFOLD {fold_num}/{N_FOLDS}\n{'=' * 70}")

    model = DistilBertForSequenceClassification.from_pretrained(
        MODEL_NAME, num_labels=len(CATEGORIES),
        id2label=ID2LABEL, label2id=LABEL2ID,
    )

    train_dataset = SafeGirlDataset(train_examples, tokenizer, MAX_LENGTH)
    val_dataset = SafeGirlDataset(val_examples, tokenizer, MAX_LENGTH)

    fold_output_dir = OUTPUT_DIR / f"fold_{fold_num}"

    training_args = TrainingArguments(
        output_dir=str(fold_output_dir),
        num_train_epochs=MAX_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        learning_rate=LEARNING_RATE,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model=MODEL_SELECTION_METRIC,
        greater_is_better=True,
        seed=SEED,
        logging_dir=str(fold_output_dir / "logs"),
        logging_steps=10,
        report_to="tensorboard",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics_factory(verbose=True),
        callbacks=[EarlyStoppingCallback(early_stopping_patience=EARLY_STOPPING_PATIENCE)],
    )

    trainer.train()

    # Corrected per Sergeant's review: trainer.state.epoch reflects
    # wherever training HALTED, not necessarily the epoch of the actual
    # best checkpoint -- early stopping patience can let training run
    # for additional non-improving epochs before actually stopping, so
    # naively reading trainer.state.epoch can overstate the best epoch.
    # Instead, search log_history for the evaluation entry that actually
    # achieved the best metric value, and read ITS epoch.
    best_epoch = None
    metric_key = f"eval_{MODEL_SELECTION_METRIC}"
    eval_entries = [e for e in trainer.state.log_history if metric_key in e]
    if eval_entries:
        best_entry = max(eval_entries, key=lambda e: e[metric_key])
        best_epoch = int(round(best_entry["epoch"]))

    metrics = trainer.evaluate()

    predictions_output = trainer.predict(val_dataset)
    predicted_labels = np.argmax(predictions_output.predictions, axis=1)
    true_labels = predictions_output.label_ids

    return {
        "fold": fold_num,
        "metrics": metrics,
        "best_epoch": best_epoch,
        "true_labels": true_labels,
        "predicted_labels": predicted_labels,
    }


# ============================================================================
# Cross-validation orchestration
# ============================================================================

def run_cross_validation(folds, tokenizer):
    """Runs all N_FOLDS training runs, each with one fold held out as
    validation and the rest combined as training data."""
    fold_results = []
    for val_fold in range(1, N_FOLDS + 1):
        train_examples = []
        for fold_num, examples in folds.items():
            if fold_num != val_fold:
                train_examples.extend(examples)
        val_examples = folds[val_fold]

        result = train_one_fold(val_fold, train_examples, val_examples, tokenizer)
        fold_results.append(result)
    return fold_results


def aggregate_cv_results(fold_results):
    """Computes mean +/- SD across folds for each metric, an aggregate
    confusion matrix (every one of the 182 seeds' examples appears in
    exactly one fold's validation set, so summing gives full-dataset
    coverage without double-counting), and the average best epoch
    (used as the fixed epoch count for the final retrain, since that
    retrain has no held-out data to run early stopping against)."""

    metric_keys = [
        "eval_accuracy", "eval_f1_macro", "eval_f1_weighted",
        "eval_precision_macro", "eval_recall_macro",
    ]

    print(f"\n{'=' * 70}\nCROSS-VALIDATION SUMMARY ({N_FOLDS} folds)\n{'=' * 70}")

    aggregated = {}
    for key in metric_keys:
        values = [r["metrics"][key] for r in fold_results if key in r["metrics"]]
        if values:
            mean = statistics.mean(values)
            sd = statistics.stdev(values) if len(values) > 1 else 0.0
            aggregated[key] = {"mean": mean, "sd": sd, "values": values}
            print(f"{key:<25} {mean:.4f} +/- {sd:.4f}   (per fold: {[round(v,4) for v in values]})")

    all_true = np.concatenate([r["true_labels"] for r in fold_results])
    all_pred = np.concatenate([r["predicted_labels"] for r in fold_results])
    aggregate_cm = confusion_matrix(all_true, all_pred, labels=list(range(len(CATEGORIES))))

    print("\nAggregate confusion matrix across all 5 folds (covers all 182 seeds' examples once each)")
    print(CATEGORIES)
    print(aggregate_cm)

    cat_p, cat_r, cat_f1, support = precision_recall_fscore_support(
        all_true, all_pred, labels=list(range(len(CATEGORIES))), average=None, zero_division=0,
    )
    print("\nAggregate per-category performance (pooled across all folds)")
    for i, cat in enumerate(CATEGORIES):
        print(f"  {cat:<15} precision={cat_p[i]:.4f} recall={cat_r[i]:.4f} f1={cat_f1[i]:.4f} support={support[i]}")

    best_epochs = [r["best_epoch"] for r in fold_results if r["best_epoch"] is not None]
    avg_best_epoch = round(statistics.mean(best_epochs)) if best_epochs else MAX_EPOCHS
    avg_best_epoch = max(1, avg_best_epoch)
    print(f"\nBest epoch per fold: {best_epochs}")
    print(f"Average best epoch (rounded, min 1): {avg_best_epoch}")
    print("This will be used as the FIXED epoch count for the final full-data retrain,")
    print("since that retrain has no held-out validation set to run early stopping against.")

    aggregated["aggregate_confusion_matrix"] = aggregate_cm
    aggregated["avg_best_epoch"] = avg_best_epoch

    # Machine-readable outputs, per Sergeant's review -- so Chapter 5
    # can be populated from these files directly rather than by
    # manually copying terminal output.
    save_cv_results(fold_results, aggregated)

    return aggregated


def save_cv_results(fold_results: list[dict], aggregated: dict) -> None:
    """
    Writes two files to OUTPUT_DIR:
      - cv_fold_results.csv: one row per fold (accuracy, f1_macro,
        f1_weighted, precision_macro, recall_macro, best_epoch)
      - cv_summary.json: mean/SD per metric across folds, the aggregate
        confusion matrix (as a nested list -- JSON has no array type),
        and avg_best_epoch (the fixed epoch count used for the final
        retrain).
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    fold_csv_path = OUTPUT_DIR / "cv_fold_results.csv"
    fieldnames = [
        "fold", "eval_accuracy", "eval_f1_macro", "eval_f1_weighted",
        "eval_precision_macro", "eval_recall_macro", "best_epoch",
    ]
    with fold_csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in fold_results:
            row = {"fold": r["fold"], "best_epoch": r["best_epoch"]}
            for key in fieldnames[1:-1]:
                row[key] = r["metrics"].get(key)
            writer.writerow(row)
    print(f"\nSaved per-fold results to: {fold_csv_path}")

    summary_json_path = OUTPUT_DIR / "cv_summary.json"
    summary = {
        "n_folds": N_FOLDS,
        "categories": CATEGORIES,
        "model_selection_metric": MODEL_SELECTION_METRIC,
        "metrics": {
            key: {"mean": v["mean"], "sd": v["sd"], "per_fold": v["values"]}
            for key, v in aggregated.items()
            if isinstance(v, dict) and "mean" in v
        },
        "aggregate_confusion_matrix": aggregated["aggregate_confusion_matrix"].tolist(),
        "avg_best_epoch": aggregated["avg_best_epoch"],
        "best_epoch_per_fold": [r["best_epoch"] for r in fold_results],
    }
    with summary_json_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved aggregate CV summary to: {summary_json_path}")


# ============================================================================
# Final retrain on all 182 seeds' worth of data
# ============================================================================

def train_final_model(all_folds, tokenizer, fixed_epochs: int):
    """Trains the model that actually gets saved/tested -- NOT any of
    the 5 fold models. Uses every example (all folds combined, no
    held-out validation) and the fixed epoch count derived from CV
    (avg_best_epoch), since there is nothing to early-stop against."""

    print(f"\n{'=' * 70}\nFINAL MODEL: retraining on all data ({fixed_epochs} epochs, no held-out validation)\n{'=' * 70}")

    all_examples = []
    for examples in all_folds.values():
        all_examples.extend(examples)
    print(f"Final training set size: {len(all_examples)} examples (should be 910)")

    model = DistilBertForSequenceClassification.from_pretrained(
        MODEL_NAME, num_labels=len(CATEGORIES),
        id2label=ID2LABEL, label2id=LABEL2ID,
    )
    train_dataset = SafeGirlDataset(all_examples, tokenizer, MAX_LENGTH)

    final_output_dir = OUTPUT_DIR / "final_training_run"
    training_args = TrainingArguments(
        output_dir=str(final_output_dir),
        num_train_epochs=fixed_epochs,
        per_device_train_batch_size=BATCH_SIZE,
        learning_rate=LEARNING_RATE,
        save_strategy="epoch",
        seed=SEED,
        logging_dir=str(final_output_dir / "logs"),
        logging_steps=10,
        report_to="tensorboard",
    )

    trainer = Trainer(model=model, args=training_args, train_dataset=train_dataset)
    trainer.train()

    final_model_dir = OUTPUT_DIR / "final"
    print(f"\nSaving final V2 model to: {final_model_dir}")
    trainer.save_model(str(final_model_dir))
    tokenizer.save_pretrained(str(final_model_dir))

    return trainer


def evaluate_on_test_set(trainer, tokenizer, test_dir: Path):
    """Runs exactly once, after the final model is fully trained and
    saved. Refuses to substitute CV/validation results if the
    independent test set doesn't exist yet."""
    test_examples = load_test_set(test_dir)
    if test_examples is None:
        print(f"\n'{test_dir}' is empty or missing.")
        print("Independent expert test set (DR-04) not yet available.")
        print("Do NOT report CV or validation metrics as final test results.")
        return None

    test_dataset = SafeGirlDataset(test_examples, tokenizer, MAX_LENGTH)
    predictions_output = trainer.predict(test_dataset)
    predicted = np.argmax(predictions_output.predictions, axis=1)
    true = predictions_output.label_ids

    metrics_fn = compute_metrics_factory(verbose=True)
    print(f"\n{'=' * 70}\nINDEPENDENT TEST SET -- FINAL, ONE-TIME EVALUATION\n{'=' * 70}")
    return metrics_fn((predictions_output.predictions, true))


# ============================================================================
# Main
# ============================================================================

def main() -> None:
    print("=" * 70)
    print("SafeGirl -- DistilBERT Intent Classifier (V2, 5-fold CV)")
    print("=" * 70)

    if torch.cuda.is_available():
        print(f"GPU available: {torch.cuda.get_device_name(0)}")
    else:
        print("WARNING: No GPU detected. Training will run on CPU (very slow).")

    seeds_path = DATA_DIR / "seeds" / "seeds.csv"
    fold_path = DATA_DIR / "seeds" / "seed_split_assignment_v2.csv"
    reviewed_dir = DATA_DIR / "reviewed"
    test_dir = DATA_DIR / "test"

    print("\nLoading dataset...")
    all_examples = build_all_examples(seeds_path, reviewed_dir)
    print(f"Total examples (seeds + reviewed paraphrases): {len(all_examples)} (should be 910)")

    fold_assignment = load_fold_assignment(fold_path)
    folds = build_fold_datasets(all_examples, fold_assignment)

    print(f"\nLoading tokenizer: {MODEL_NAME}")
    tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_NAME)

    # Stage 1: 5-fold cross-validation
    fold_results = run_cross_validation(folds, tokenizer)
    cv_summary = aggregate_cv_results(fold_results)

    # Stage 2: fresh retrain on everything, using the validated epoch count
    final_trainer = train_final_model(folds, tokenizer, cv_summary["avg_best_epoch"])

    # Stage 3: one-time independent test evaluation (only if it exists)
    evaluate_on_test_set(final_trainer, tokenizer, test_dir)

    print("\nDone.")


if __name__ == "__main__":
    main()