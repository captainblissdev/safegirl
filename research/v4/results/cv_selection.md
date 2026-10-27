# V4 CV selection

Rule: docs/decision-log.md, clarification 2, item 3. Held-out seeds only (380), folds research/v4/fold_assignment_v4.csv.

| Candidate | Best setting | Mean macro-F1 +/- sd | STI recall | Pregnancy recall | Confident-wrong | ECE |
|---|---|---|---|---|---|---|
| baseline M2 | baseline_m2 | 0.6194 +/- 0.0525 | 0.756 | 0.627 | 0.384 (plain error rate) | n/a |
| LR on e5 (no V1) | lr_e5_base_C10 | 0.8606 +/- 0.0616 | 0.927 | 0.827 | 0.068 | 0.118 |
| hybrid e5 | hybrid_C10 | 0.8835 +/- 0.0507 | 0.963 | 0.827 | 0.055 | 0.066 |
| DistilBERT | distilbert_lr3e-5 | 0.7883 +/- 0.0832 | 0.841 | 0.787 | 0.142 | 0.053 |
| DistilBERT + keyword | distilbert_kw_lr3e-5 | 0.7866 +/- 0.0644 | 0.854 | 0.787 | 0.147 | 0.075 |
| baseline M1 (reference, not a candidate) | baseline_m1 | 0.5166 +/- 0.0179 | 0.756 | 0.627 | 0.311 (plain error rate) | n/a |

## Decision

1. Best mean macro-F1: 0.8835 (hybrid e5).
2. Within 0.01 of it (>= 0.8735): hybrid e5.
3. Confident-wrong of those: hybrid e5 0.055.
Winner: **hybrid e5, hybrid_C10** (decided by macro-F1).

## Paired per-fold comparison (for the record, not part of the rule)

Per-fold macro-F1 of hybrid e5 minus each candidate.

| Candidate | Fold 1 | Fold 2 | Fold 3 | Fold 4 | Fold 5 | Mean | Folds ahead |
|---|---|---|---|---|---|---|---|
| baseline M2 | +0.1508 | +0.3663 | +0.2582 | +0.2483 | +0.2968 | +0.2641 | 5/5 |
| LR on e5 (no V1) | -0.0361 | +0.0454 | +0.0714 | +0.0443 | -0.0102 | +0.0230 | 3/5 |
| DistilBERT | -0.0224 | +0.1036 | +0.2018 | +0.1152 | +0.0776 | +0.0952 | 4/5 |
| DistilBERT + keyword | +0.0309 | +0.0905 | +0.1467 | +0.1248 | +0.0916 | +0.0969 | 5/5 |

## Winner's pooled out-of-fold details

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| contraception | 0.946 | 0.921 | 0.933 | 76 |
| sti | 0.952 | 0.963 | 0.958 | 82 |
| pregnancy | 0.886 | 0.827 | 0.855 | 75 |
| general | 0.830 | 0.857 | 0.843 | 91 |
| out_of_scope | 0.833 | 0.862 | 0.847 | 29 |
| vague | 0.828 | 0.889 | 0.857 | 27 |

Confusion matrix (rows true, columns predicted):

| true \ pred | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 70 | 0 | 2 | 3 | 1 | 0 |
| sti | 1 | 79 | 1 | 0 | 0 | 1 |
| pregnancy | 2 | 0 | 62 | 8 | 1 | 2 |
| general | 1 | 4 | 5 | 78 | 2 | 1 |
| out_of_scope | 0 | 0 | 0 | 3 | 25 | 1 |
| vague | 0 | 0 | 0 | 2 | 1 | 24 |

Most frequent confusions:

- pregnancy -> general: 8
- general -> pregnancy: 5
- general -> sti: 4
- contraception -> general: 3
- out_of_scope -> general: 3
