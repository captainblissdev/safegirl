# Development Log

## V2 Training Complete — Full Results Comparison (2026-09-17)

> Historical record from 17 September 2026, written then but never committed. Recovered on 15 October 2026 from an unbranched stash (`stash@{2}`, saved as branch `stash-2-save`); the text below is unchanged.

Three evaluations now exist, each measuring something different --
presented together deliberately, not cherry-picked:

- V1 (single train/val split, n=40): 80.0% accuracy, macro-F1 0.7677
- V2 5-fold CV (mean across folds): 82.9% accuracy, macro-F1 0.8274 (SD
  0.0726) -- the robust estimate, and where the General<->STI boundary
  confusion was discovered (46 errors across 910 pooled predictions:
  22 general->sti, 24 sti->general)
- V2 independent expert test (n=31, DR-04): 90.3% accuracy, macro-F1
  0.8832

The independent test result is higher than both V1 and V2's own CV
mean. This is NOT read as evidence the model outperforms what CV
suggested. This specific 31-question test set contains ZERO
general<->sti confusion cases (verified directly against its confusion
matrix), while CV's aggregate found 46 such errors across the full
910-example pool -- meaning this test set simply doesn't happen to
probe the one known weakness, not that the weakness is resolved.
Additionally, general has only n=3 in this test set; a single
misclassification swings its F1 by ~33 points, so that figure carries
real uncertainty despite the clean decimal presentation.

Per the locked protocol, this was a ONE-TIME evaluation -- not
rerun, not retuned against. This result is final and stands as the
record for Chapter 6.
