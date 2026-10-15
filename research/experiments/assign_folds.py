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
    / "fold_assignment_v2.csv"
)

# Reproducibility
RANDOM_STATE = 42
N_SPLITS = 5


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


# -------------------------------------------------------------------
# Create seed-level stratified group folds
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

fold_assignments = {}

X = seeds["text"]
y = seeds["class"]
groups = seeds["seed_id"]

for fold_number, (_, validation_indices) in enumerate(
    splitter.split(X, y, groups),
    start=1,
):
    for index in validation_indices:
        seed_id = seeds.iloc[index]["seed_id"]
        fold_assignments[seed_id] = fold_number


# -------------------------------------------------------------------
# Build output
# -------------------------------------------------------------------
assignment = seeds[["seed_id", "class"]].copy()

assignment["fold"] = assignment["seed_id"].map(fold_assignments)

if assignment["fold"].isnull().any():
    raise ValueError("Some seeds were not assigned to a fold.")

assignment["fold"] = assignment["fold"].astype(int)

assignment = assignment.sort_values(
    ["fold", "class", "seed_id"]
).reset_index(drop=True)


# -------------------------------------------------------------------
# Verification
# -------------------------------------------------------------------
if len(assignment) != len(seeds):
    raise ValueError("Assignment does not contain all seeds.")

if assignment["seed_id"].nunique() != len(seeds):
    raise ValueError("Seed IDs are not unique in the assignment.")

fold_counts = (
    assignment.groupby(["fold", "class"])
    .size()
    .unstack(fill_value=0)
)

print("\nV2 fold assignment created.")
print(f"Total seeds: {len(assignment)}")
print(f"Number of folds: {N_SPLITS}")
print(f"Random state: {RANDOM_STATE}")

print("\nSeeds per fold:")
print(assignment["fold"].value_counts().sort_index())

print("\nClass distribution by fold:")
print(fold_counts)

print("\nOverall class distribution:")
print(assignment["class"].value_counts())

# Make sure every seed has exactly one fold.
assert assignment.groupby("seed_id")["fold"].nunique().max() == 1

# Save
assignment.to_csv(OUTPUT_FILE, index=False)

print(f"\nSaved to:\n{OUTPUT_FILE}")