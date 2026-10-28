# Reranker selection: eight pipelines on 68 items (28 October 2026)

Development data only: the 75 relabelled items, 68 scored (the 6 distress items are not scored; V16 is the same question as Q13 and counts with it). Leave-one-out with the registered utility and selection rule; complexity order P0; P1, P2; P4, P6; P3; P5, P7. Reranker `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` at revision `1427fd652930e4ba29e8149678df786c240d8825` (weights SHA-256 `5daeca2481a76b5976a2bdc32f0a78532b6716da4f8cd3ff59460ef8d2f359b4`), query paired with each entry's question for the top 10. Produced by `research/eval/gate_candidates_v3.py`; per-item ids in `selection_v3.json`.

K5 reproduced before scoring: full: dev 25/35, correct below gate 1, wrong passing 4, off-topic passing 4; question: dev 25/35, correct below gate 5, wrong passing 4, off-topic passing 2.

| Pipeline | LOO score (68) | Correct answers | Wrong answers served | Correct abstains | Missed answers | Difference to P0 (95% bootstrap interval) | Earlier score (69) |
|---|---|---|---|---|---|---|---|
| P0: full mode, current gate 0.8439 (baseline) | 51 / 68 | 39 | 11 | 12 | 6 | +0 (+0 to +0) | 52 / 69 |
| P1: full mode, threshold recalibrated | 50 / 68 | 39 | 12 | 11 | 6 | -1 (-3 to +0) | 51 / 69 |
| P2: question mode, threshold recalibrated | 53 / 68 | 42 | 10 | 11 | 5 | +2 (-3 to +8) | 53 / 69 |
| P3: question mode, logistic gate (top-1 score, margin, V4 agreement) | 57 / 68 | 42 | 6 | 15 | 5 | +6 (+0 to +12) | 57 / 69 |
| P4: question mode, hybrid ranking, threshold recalibrated | 54 / 68 | 42 | 7 | 12 | 7 | +3 (-3 to +9) | 54 / 69 |
| P5: question mode, hybrid ranking, logistic gate | 55 / 68 | 41 | 7 | 14 | 6 | +4 (-2 to +10) | 55 / 69 |
| P6: question mode, reranker over the top 10, threshold recalibrated | 45 / 68 | 30 | 12 | 15 | 11 | -6 (-14 to +2) | – |
| P7: question mode, reranker over the top 10, logistic gate | 44 / 68 | 29 | 7 | 15 | 17 | -7 (-15 to +1) | – |

With V4 off (fallback logistic gate on score and margin): P3 55 / 68, P5 56 / 68, P7 41 / 68.

Top entry acceptable on the 49 answer-expected items that retrieve: question-mode dense 42, reranked 31.

Winner: **P3**. P3 still wins, so `frozen_gate_v2.json` (SHA-256 `ad6895a120b538e4cc751ebe4de8944aace640c268e0013f981d29ceabe4bafc`) stands and no `frozen_gate_v3.json` is written. The winner adds no reranker latency; the reranker itself measured median 94 ms, p90 109 ms on 10 synthetic pairs.
