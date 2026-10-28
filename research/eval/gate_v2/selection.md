# Gate and ranking selection, 62-entry KB (28 October 2026)

Development data only: the 75 relabelled items (35 dev questions, 40 gate-set items); the 6 distress items are not scored, leaving 69. Leave-one-out cross-validation; every threshold, hybrid weight and logistic gate is fitted on the other 68 items. Utility: answered with an acceptable entry, or correctly abstained (Q50, NOT_REFERRAL, counts unless referred). V3 routes in every pipeline (abstain below 0.35, scoped at 0.5 or above); V4 is only the agreement signal of P3 and P5. Produced by `research/eval/gate_candidates.py`; per-item ids in `selection.json`.

Routes of the 69 scored items before retrieval: held 2, referral 0, retrieve 56, vague 11.

K5 reproduced before scoring (dev correct; gate-set counts at 0.8439): full: dev 25/35, correct below gate 1, wrong passing 4, off-topic passing 4; question: dev 25/35, correct below gate 5, wrong passing 4, off-topic passing 2.

## Pipelines (leave-one-out, 69 items)

| Pipeline | LOO score | Correct answers | Wrong answers served | Correct abstains | Missed answers | Difference to P0 (95% bootstrap interval) |
|---|---|---|---|---|---|---|
| P0: full mode, current gate 0.8439 (baseline) | 52 / 69 | 40 | 11 | 12 | 6 | +0 (+0 to +0) |
| P1: full mode, threshold recalibrated | 51 / 69 | 40 | 12 | 11 | 6 | -1 (-3 to +0) |
| P2: question mode, threshold recalibrated | 53 / 69 | 42 | 11 | 11 | 5 | +1 (-5 to +7) |
| P3: question mode, logistic gate (top-1 score, margin, V4 agreement) | 57 / 69 | 42 | 7 | 15 | 5 | +5 (-1 to +11) |
| P4: question mode, hybrid ranking, threshold recalibrated | 54 / 69 | 42 | 8 | 12 | 7 | +2 (-4 to +8) |
| P5: question mode, hybrid ranking, logistic gate | 55 / 69 | 41 | 8 | 14 | 6 | +3 (-3 to +10) |

Bootstrap: 10,000 resamples of the 69 items, seed 20261028, percentile interval of the difference in successes.

## With V4 off

P0, P1, P2 and P4 do not use V4 and behave the same. P3 and P5 fall back to a logistic gate on top-1 score and margin only:

| Pipeline | LOO score | Correct answers | Wrong answers served | Correct abstains | Missed answers |
|---|---|---|---|---|---|
| P3 (V4 off) | 54 / 69 | 41 | 9 | 13 | 6 |
| P5 (V4 off) | 56 / 69 | 43 | 6 | 13 | 7 |

## Selection

Rule (pre-registered): the highest LOO score; within one item of it, the simpler pipeline (P0; then P1 and P2; then P4; then P3; then P5), then fewer wrong answers served. Winner: **P3**. Frozen as `research/eval/gate_v2/frozen_gate_v2.json`, SHA-256 `ad6895a120b538e4cc751ebe4de8944aace640c268e0013f981d29ceabe4bafc`.
