# K5 on relabelled labels, 62-entry KB (28 October 2026)

Branch `kb/merge-60`. Labels: Cindy's blind relabelling sheet (75 items), passed by `research/eval/relabel_check.js` and converted to `retrieval_eval_set_labels_kb62.csv` and `relevance_validation_kb62.csv` (kept outside the repository). 35 dev rows relabelled, 0 marked none fits; gate set 20 ANSWER, 14 NOT_KB_ANSWER, 6 REFERRAL_OR_SIGNPOST (not scored). ml_service restarted from this tree for each mode (V4 and generation off); gateway with `AUTH_DISABLED=true`, relevance gate on at 0.8439, thresholds 0.35 / 0.5. Produced by `research/eval/k5_measure.js --labels --gate --tag relabelled` and `research/eval/k5_baseline21.js`; per-item ids in `k5_question_relabelled.json`, `k5_full_relabelled.json` and `k5_baseline21_relabelled.json`.

## Self-retrieval (62 KB questions)

| | question | full |
|---|---|---|
| unscoped, own entry top-1 | 62 / 62 | 61 / 62 |
| scoped (live V3), own entry top-1 | 57 / 62 | 56 / 62 |
| unscoped failures | none | KB-C4->KB-C18 |

## Dev questions (35, relabelled)

| | question | full |
|---|---|---|
| correct | 25 / 35 | 25 / 35 |
| not correct | Q03 (answer-scoped KB-C18, wrong), Q07 (abstain, wrong), Q13 (answer-unscoped KB-G9, wrong), Q16 (abstain, wrong), Q20 (abstain, wrong), Q27 (held-topic, wrong), Q29 (held-topic, wrong), Q54 (abstain, wrong), Q55 (answer-unscoped KB-G14, wrong), Q57 (abstain, wrong) | Q02 (answer-scoped KB-C18, wrong), Q03 (answer-scoped KB-C18, wrong), Q11 (answer-unscoped KB-C7, wrong), Q27 (held-topic, wrong), Q28 (answer-scoped KB-P6, wrong), Q29 (held-topic, wrong), Q54 (abstain, wrong), Q55 (answer-unscoped KB-G14, wrong), Q57 (abstain, wrong), Q58 (answer-scoped KB-C4, wrong) |
| replies changed vs the 21-entry replies | Q03, Q07, Q11, Q13, Q16, Q20, Q23, Q28, Q30, Q54, Q55, Q58 | Q02, Q03, Q04, Q11, Q23, Q30, Q50, Q54, Q55 |

Context, not part of the rule: the 21-entry KB's replies (K3 "Before") scored on the same relabelled labels: 28 / 35 (29 / 35 on the 2026-10-15 labels; verdict changed: Q28, Q58).

## Gate separation (0.8439, unscoped top-1 score)

| | question | full |
|---|---|---|
| dev: correct answers | 0.8456 to 0.9675 (n=25) | 0.8504 to 0.9246 (n=25) |
| dev: wrong or partial answers | 0.8538 to 0.8785 (n=3) | 0.8439 to 0.8904 (n=6) |
| dev: abstentions | 0.8037 to 0.8416 (n=5) | 0.8227 to 0.8401 (n=2) |
| dev: wrong or partial answers passing the gate | 3 (Q03, Q13, Q55) | 6 (Q02, Q03, Q11, Q28, Q55, Q58) |
| dev: abstained although unscoped top-1 is acceptable | 5 (Q07, Q16, Q20, Q54, Q57) | 2 (Q54, Q57) |
| gate set: top-1 acceptable | 0.8154 to 0.9107 (n=16) | 0.8259 to 0.9258 (n=16) |
| gate set: top-1 not acceptable | 0.8538 to 0.8832 (n=4) | 0.8476 to 0.8896 (n=4) |
| gate set: off-topic (NOT_KB_ANSWER) | 0.7445 to 0.8489 (n=14) | 0.7657 to 0.8622 (n=14) |
| gate set: acceptable top-1 below the gate | 5 (V02, V03, V06, V17, V19) | 1 (V19) |
| gate set: wrong top-1 passing the gate | 4 (V12, V14, V16, V18) | 4 (V02, V03, V12, V18) |
| gate set: off-topic passing the gate | 2 (V31, V34) | 4 (V29, V31, V33, V34) |
| gate set: referral or signpost rows, not scored | 6 | 6 |
