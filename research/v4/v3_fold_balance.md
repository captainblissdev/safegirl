# V3 fold balance

Class balance of the V3 cross-validation folds, from
`resources/seeds/fold_assignment_v3.csv`, `resources/seeds/seeds.csv` and
`resources/reviewed/*_v3_paraphrases.csv` (read only; generated for Step
V4-1 on 22 October 2026). V3 trains on these 211 seeds and 578 reviewed
paraphrases, 789 examples (the V3.1 training log reports the same
total and fold sizes).

V3 stratified **seeds** by class (StratifiedGroupKFold, seed as group),
so seed counts per fold are close. Examples per fold are not: a seed
brings 0 to 4 paraphrases, and the 55 seeds with none
(`seeds_without_paraphrases.csv`) are spread unevenly.

### Seeds per fold

| Fold | contraception | sti | pregnancy | general | Total | General share |
|---|---|---|---|---|---|---|
| 1 | 9 (21%) | 11 (26%) | 10 (24%) | 12 (29%) | 42 | 29% |
| 2 | 10 (24%) | 11 (27%) | 9 (22%) | 11 (27%) | 41 | 27% |
| 3 | 9 (22%) | 11 (27%) | 10 (24%) | 11 (27%) | 41 | 27% |
| 4 | 9 (22%) | 11 (27%) | 9 (22%) | 12 (29%) | 41 | 29% |
| 5 | 10 (24%) | 11 (26%) | 10 (24%) | 11 (26%) | 42 | 26% |
| euphemism holdout | 1 (25%) | 1 (25%) | 1 (25%) | 1 (25%) | 4 | 25% |
| **CV pool (1-5)** | 47 (23%) | 55 (27%) | 48 (23%) | 57 (28%) | 207 | 28% |

### Examples per fold (seeds + reviewed paraphrases)

| Fold | contraception | sti | pregnancy | general | Total | General share |
|---|---|---|---|---|---|---|
| 1 | 22 (16%) | 29 (21%) | 30 (22%) | 57 (41%) | 138 | 41% |
| 2 | 42 (26%) | 40 (25%) | 32 (20%) | 46 (29%) | 160 | 29% |
| 3 | 34 (21%) | 45 (28%) | 34 (21%) | 49 (30%) | 162 | 30% |
| 4 | 32 (22%) | 36 (25%) | 39 (27%) | 39 (27%) | 146 | 27% |
| 5 | 42 (25%) | 43 (25%) | 38 (22%) | 47 (28%) | 170 | 28% |
| euphemism holdout | 3 (23%) | 4 (31%) | 3 (23%) | 3 (23%) | 13 | 23% |
| **CV pool (1-5)** | 172 (22%) | 193 (25%) | 173 (22%) | 238 (31%) | 776 | 31% |

### Seeds with no paraphrase, per fold

| Fold | 1 | 2 | 3 | 4 | 5 | euphemism holdout |
|---|---|---|---|---|---|---|
| Seeds | 16 | 10 | 9 | 12 | 8 | 0 |

## Notes

- **Fold 1 is lopsided in examples:** 57 of its 138 examples (41%) are
  general, and only 22 (16%) are contraception. Its seeds are not
  (29% general): the skew comes from which seeds have paraphrases.
  Fold 1 holds 16 of the 55 seeds with none.
- A fold's validation score in V3 is therefore partly a general-class
  score for fold 1. Per-fold numbers should be read with this table.
- V4 stratifies seeds by class x style (`make_folds.py`). Example-level
  balance still depends on paraphrases per seed, so V4 should give every
  seed the same number of paraphrases, or report example balance per
  fold the same way.

## Why 55 seeds have no paraphrase

They are exactly the 55 original V1 seeds (`SEED-CONTRA-01` to `-14`,
`SEED-STI-01` to `-16`, `SEED-PREG-01` to `-15`, `SEED-GEN-01` to
`-10`; all 55 are in `resources/seeds/seed_split_assignment.csv`, the V1
split). The V2 paraphrasing protocol (decision log, 2026-09-18) left
their 220 V1 paraphrases "untouched" and counted them in the V2 dataset
(728 paraphrases). Commit `447b3bd` (V3.1, 23 September 2026) deleted
the four V1 paraphrase files (`dataset/reviewed/*_paraphrases.csv`) and
renamed the V2 files to `*_v3_paraphrases.csv`. Neither that commit
message nor the decision log gives a reason, so from V3.1 on these seeds
train without paraphrases. The V1 files are still in git history
(added in `48c6d29`).
