# Classifier calibration and per-class errors (development set)

Inputs: `research/eval/results/analysis_inputs_2026-10-14.csv`. Labels: provisional (`resources/eval/retrieval_eval_set_expected_class_PROVISIONAL.csv`). Not the independent DR-04 test set.

## B. Calibration and per-class errors

Rows: the 29 development-set queries with a real, non-ambiguous `expected_class` (provisional labels). Excluded as ambiguous: Q27, Q28, Q29, Q30, Q58 (see `label_review.md`). **n is small: every figure here is indicative only.**

### Accuracy (95% Wilson interval)

| classifier | correct | n | accuracy | 95% interval |
|---|---|---|---|---|
| DistilBERT V3 (ml_service) | 20 | 29 | 69.0% | 50.8% to 82.7% |
| frozen keyword baseline | 28 | 29 | 96.6% | 82.8% to 99.4% |

Paired on the same 29 queries: both right 19, only V3 right 1, only the baseline right 9, both wrong 0. Exact McNemar test on the 10 discordant queries: p = 0.021. The two 95% intervals do not overlap, though only just. With n = 29 on a development set, this is a strong hint, not a measured difference.

### Per-class precision and recall

| class | n | V3 precision | V3 recall | baseline precision | baseline recall |
|---|---|---|---|---|---|
| contraception | 8 | 77.8% (7/9) | 87.5% (7/8) | 100.0% (8/8) | 100.0% (8/8) |
| sti | 8 | 66.7% (6/9) | 75.0% (6/8) | 100.0% (8/8) | 100.0% (8/8) |
| pregnancy | 5 | 62.5% (5/8) | 100.0% (5/5) | 100.0% (4/4) | 80.0% (4/5) |
| general | 8 | 66.7% (2/3) | 25.0% (2/8) | 88.9% (8/9) | 100.0% (8/8) |

### V3 confusion matrix (rows: expected, columns: predicted; counts)

| expected \ predicted | contraception | sti | pregnancy | general |
|---|---|---|---|---|
| contraception | 7 | 0 | 0 | 1 |
| sti | 1 | 6 | 1 | 0 |
| pregnancy | 0 | 0 | 5 | 0 |
| general | 1 | 3 | 2 | 2 |

### V3 reliability (confidence = top-1 softmax probability)

| confidence bin | n | mean confidence | accuracy | accuracy minus confidence |
|---|---|---|---|---|
| 0.30-0.40 | 5 | 0.359 | 20.0% | -0.159 |
| 0.40-0.50 | 6 | 0.433 | 16.7% | -0.266 |
| 0.50-0.60 | 4 | 0.562 | 100.0% | +0.438 |
| 0.60-0.70 | 0 | - | - | - |
| 0.70-0.80 | 4 | 0.739 | 100.0% | +0.261 |
| 0.80-0.90 | 8 | 0.831 | 100.0% | +0.169 |
| 0.90-1.00 | 2 | 0.918 | 100.0% | +0.082 |

**Expected calibration error (ECE): 0.231** (weighted mean of |accuracy - confidence| over the bins). With 29 queries spread over 6 bins, most bins hold a handful of queries, so the ECE is a rough indication only.

### V3 confidence of correct and wrong predictions

|  | n | median confidence | min | max |
|---|---|---|---|---|
| correct | 20 | 0.784 | 0.306 | 0.929 |
| wrong | 9 | 0.414 | 0.357 | 0.451 |

### Most confident wrong V3 predictions

| id | query | expected | V3 predicted | confidence | baseline |
|---|---|---|---|---|---|
| Q56 | is my period normal | general | pregnancy | 0.451 | general |
| Q23 | my private parts are burning, what could it be | sti | pregnancy | 0.441 | sti |
| Q11 | is it normal for my period to be irregular | general | sti | 0.441 | general |
| Q54 | What is PrEP? | sti | contraception | 0.424 | sti |
| Q16 | is the clinic confidential | general | contraception | 0.414 | general |
| Q55 | IS MY PERIOD NORMAL | general | sti | 0.384 | general |
