"""
SafeGirl -- V3 seed-level fold assignment (euphemism holdout)
===============================================================

Extends the frozen V2 StratifiedGroupKFold logic to the V3 seed pool
(206 seeds: the original 182 + 24 new seeds targeting euphemistic /
colloquial symptom phrasing).

METHODOLOGY CHANGE FROM V2
---------------------------
Before running StratifiedGroupKFold, a fixed set of 4 seeds (one per
class) is carved OUT of the CV pool entirely. These are the
"euphemism holdout" seeds -- deliberately never seen during any of
the 5 CV folds or the final retrain. They (and their paraphrases,
handled downstream in train_classifier.py) exist solely to answer one
question after training: did V3 actually fix the euphemism
misclassification problem documented against V2? Reusing a
CV/training seed for that check would not be a real answer.

The remaining 202 seeds go through StratifiedGroupKFold exactly as
V2 did -- seed_id as the group, class-stratified, 5 folds, same
random_state for reproducibility of the *splitting procedure* (note:
this is a different, larger pool than V2's 182 seeds, so fold
membership is not expected to match V2's assignment).

Output fold column now contains two kinds of values:
    - integers 1..5            -> normal CV fold membership
    - the string "euphemism_holdout" -> excluded from all CV/training

This is a deliberate schema change from V2's integer-only fold
column. train_classifier.py's loader has been updated to handle it
(see load_fold_assignment() and build_fold_datasets() there).
"""

from pathlib import Path

import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold


# -------------------------------------------------------------------
# Paths
# -------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]

SEEDS_FILE = PROJECT_ROOT / "resources" / "seeds" / "seeds.csv"
OUTPUT_FILE = (
    PROJECT_ROOT
    / "resources"
    / "seeds"
    / "fold_assignment_v3.csv"
)

# Reproducibility
RANDOM_STATE = 42
N_SPLITS = 5

# Fixed euphemism holdout -- one seed per class, carved out BEFORE
# StratifiedGroupKFold ever sees the pool. Never touched by CV or the
# final retrain. Chosen deliberately as genuinely euphemistic phrasing
# per class, not picked after seeing any model output.
HOLDOUT_SEED_IDS = {
    "SEED-CONTRA-46",
    "SEED-STI-47",
    "SEED-PREG-49",
    "SEED-GEN-56",
}


# -------------------------------------------------------------------
# Load and validate seeds
# -------------------------------------------------------------------
seeds = pd.read_csv(SEEDS_FILE)

required_columns = {"seed_id", "class", "text"}

missing_columns = required_columns - set(seeds.columns)
if missing_columns:
    raise ValueError(
        f"Missing required columns: {sorted(missing_columns)}"
    )

if seeds["seed_id"].duplicated().any():
    duplicates = seeds.loc[
        seeds["seed_id"].duplicated(), "seed_id"
    ].tolist()
    raise ValueError(f"Duplicate seed IDs found: {duplicates}")

if seeds[["seed_id", "class", "text"]].isnull().any().any():
    raise ValueError("Seeds file contains missing values.")

missing_holdout = HOLDOUT_SEED_IDS - set(seeds["seed_id"])
if missing_holdout:
    raise ValueError(
        f"Configured holdout seed IDs not found in seeds file: "
        f"{sorted(missing_holdout)}"
    )


# -------------------------------------------------------------------
# Split off the euphemism holdout BEFORE any fold assignment
# -------------------------------------------------------------------
is_holdout = seeds["seed_id"].isin(HOLDOUT_SEED_IDS)
holdout_seeds = seeds.loc[is_holdout].copy()
cv_pool_seeds = seeds.loc[~is_holdout].copy()

print(f"\nTotal seeds: {len(seeds)}")
print(f"Euphemism holdout seeds (excluded from CV/training): {len(holdout_seeds)}")
print(f"Remaining CV pool: {len(cv_pool_seeds)}")

if len(holdout_seeds) != len(HOLDOUT_SEED_IDS):
    raise ValueError(
        "Holdout seed count mismatch -- check for duplicate seed_ids."
    )


# -------------------------------------------------------------------
# Create seed-level stratified group folds (CV pool only)
#
# Each seed is its own group. Because we are assigning the seeds
# themselves to folds, all future paraphrases belonging to a seed
# will inherit the same fold.
# -------------------------------------------------------------------
splitter = StratifiedGroupKFold(
    n_splits=N_SPLITS,
    shuffle=True,
    random_state=RANDOM_STATE,
)

fold_assignments: dict[str, object] = {}

X = cv_pool_seeds["text"]
y = cv_pool_seeds["class"]
groups = cv_pool_seeds["seed_id"]

for fold_number, (_, validation_indices) in enumerate(
    splitter.split(X, y, groups),
    start=1,
):
    for index in validation_indices:
        seed_id = cv_pool_seeds.iloc[index]["seed_id"]
        fold_assignments[seed_id] = fold_number

# Holdout seeds get the sentinel string value, not a fold number.
for seed_id in holdout_seeds["seed_id"]:
    fold_assignments[seed_id] = "euphemism_holdout"


# -------------------------------------------------------------------
# Build output
# -------------------------------------------------------------------
assignment = seeds[["seed_id", "class"]].copy()

assignment["fold"] = assignment["seed_id"].map(fold_assignments)

if assignment["fold"].isnull().any():
    raise ValueError("Some seeds were not assigned to a fold.")

# fold is now a mixed-type column (int fold numbers + the
# "euphemism_holdout" string) -- keep it as-is (object dtype), do NOT
# cast to int like the V2 script did.

# Sort CV-pool rows by fold/class/seed_id, then append holdout rows
# at the end grouped by class, so the file reads cleanly.
cv_pool_assignment = assignment[assignment["fold"] != "euphemism_holdout"].copy()
holdout_assignment = assignment[assignment["fold"] == "euphemism_holdout"].copy()

cv_pool_assignment["fold"] = cv_pool_assignment["fold"].astype(int)
cv_pool_assignment = cv_pool_assignment.sort_values(
    ["fold", "class", "seed_id"]
).reset_index(drop=True)

holdout_assignment = holdout_assignment.sort_values(
    ["class", "seed_id"]
).reset_index(drop=True)

assignment = pd.concat(
    [cv_pool_assignment, holdout_assignment], ignore_index=True
)


# -------------------------------------------------------------------
# Verification
# -------------------------------------------------------------------
if len(assignment) != len(seeds):
    raise ValueError("Assignment does not contain all seeds.")

if assignment["seed_id"].nunique() != len(seeds):
    raise ValueError("Seed IDs are not unique in the assignment.")

fold_counts = (
    cv_pool_assignment.groupby(["fold", "class"])
    .size()
    .unstack(fill_value=0)
)

print("\nV3 fold assignment created.")
print(f"Total seeds: {len(assignment)}")
print(f"Number of CV folds: {N_SPLITS}")
print(f"Random state: {RANDOM_STATE}")

print("\nCV-pool seeds per fold:")
print(cv_pool_assignment["fold"].value_counts().sort_index())

print("\nCV-pool class distribution by fold:")
print(fold_counts)

print("\nOverall class distribution (all 206 seeds, incl. holdout):")
print(assignment["class"].value_counts())

print("\nEuphemism holdout seeds:")
print(holdout_assignment.to_string(index=False))

# Make sure every seed has exactly one fold/label value.
assert assignment.groupby("seed_id")["fold"].nunique().max() == 1

# Save
assignment.to_csv(OUTPUT_FILE, index=False)

print(f"\nSaved to:\n{OUTPUT_FILE}")