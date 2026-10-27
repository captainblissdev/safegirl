# K5 measurements, 62-entry KB (27 October 2026)

Branch `kb/merge-60` at 01fc5ad. ml_service restarted from this tree for each mode (V4 and generation off); gateway with `AUTH_DISABLED=true`, relevance gate on at 0.8439, thresholds 0.35 / 0.5. Produced by `research/eval/k5_measure.js` and `research/eval/k5_health_terms.js`; full per-item ids in `k5_question.json`, `k5_full.json` and `k5_health_terms.json`. Dev labels: `retrieval_eval_set_labels_2026-10-15.csv` as it is (provisional; predates the new entries). Gate set: `resources/eval/relevance_validation.csv`, likely entries also predate the new entries.

## Self-retrieval (62 KB questions)

| | question | full |
|---|---|---|
| unscoped, own entry top-1 | 62 / 62 | 61 / 62 |
| scoped (live V3), own entry top-1 | 57 / 62 | 56 / 62 |
| unscoped failures | none | KB-C4->KB-C18 |
| scoped failures | KB-C11->KB-P5 (scoped pregnancy), KB-S16->KB-G16 (scoped general), KB-P1->KB-G3 (scoped general), KB-P9->KB-G6 (scoped general), KB-G13->KB-P5 (scoped pregnancy) | KB-C4->KB-C18 (scoped contraception), KB-C11->KB-P8 (scoped pregnancy), KB-S16->KB-G16 (scoped general), KB-P1->KB-G14 (scoped general), KB-P9->KB-G14 (scoped general), KB-G13->KB-P8 (scoped pregnancy) |
| near-misses < 0.03 (unscoped / live lines) | 0 / 0 | 24 / 22 |

Near-miss entries, unscoped: question: none; full: KB-C1, KB-C2, KB-C3, KB-C5, KB-C8, KB-C9, KB-C12, KB-C19, KB-C21, KB-S3, KB-S4, KB-S5, KB-S8, KB-S12, KB-P5, KB-P8, KB-G3, KB-G5, KB-G6, KB-G7, KB-G9, KB-G14, KB-G16, KB-G17.

## Dev questions (35, provisional labels)

| | question | full |
|---|---|---|
| correct | 21 / 35 | 23 / 35 |
| 21-entry result (K3 "Before") | 29 / 35 | 29 / 35 |
| replies changed vs 21 entries | Q03, Q07, Q11, Q13, Q16, Q20, Q23, Q28, Q30, Q54, Q55, Q58 | Q02, Q03, Q04, Q11, Q23, Q30, Q50, Q54, Q55 |

Changed replies, question mode (before → now · verdict · gate score):

- Q03: answer-scoped KB-C5 (correct) → answer-scoped KB-C18 · wrong · 0.8675
- Q07: answer-unscoped KB-S7 (correct) → abstain · wrong · 0.8408
- Q11: answer-unscoped KB-G3 (correct) → answer-unscoped KB-G14 · wrong · 0.8908
- Q13: answer-unscoped KB-G5 (correct) → answer-unscoped KB-G9 · wrong · 0.8538
- Q16: answer-unscoped KB-G1 (correct) → abstain · wrong · 0.8279
- Q20: answer-unscoped KB-C3 (correct) → abstain · wrong · 0.8416
- Q23: abstain (wrong) → answer-unscoped KB-S4 · correct · 0.8644
- Q28: answer-scoped KB-P6 (partial) → answer-scoped KB-P8 · wrong · 0.8544
- Q30: answer-scoped KB-P5 (wrong) → answer-scoped KB-P8 · wrong · 0.8899
- Q54: answer-unscoped KB-S7 (correct) → abstain · wrong · 0.8348
- Q55: answer-unscoped KB-G3 (correct) → answer-unscoped KB-G14 · wrong · 0.8785
- Q58: answer-scoped KB-C4 (correct) → answer-scoped KB-C12 · wrong · 0.8536

Changed replies, full mode (before → now · verdict · gate score):

- Q02: answer-scoped KB-C4 (correct) → answer-scoped KB-C18 · wrong · 0.8883
- Q03: answer-scoped KB-C5 (correct) → answer-scoped KB-C18 · wrong · 0.875
- Q04: answer-scoped KB-S4 (correct) → answer-scoped KB-S10 · wrong · 0.8947
- Q11: answer-unscoped KB-G3 (correct) → answer-unscoped KB-C7 · wrong · 0.8862
- Q23: abstain (wrong) → answer-unscoped KB-S21 · wrong · 0.8504
- Q30: answer-scoped KB-P5 (wrong) → answer-scoped KB-P8 · wrong · 0.879
- Q50: answer-scoped KB-P6 (correct) → answer-scoped KB-P8 · correct · 0.8591
- Q54: answer-unscoped KB-S7 (correct) → abstain · wrong · 0.8401
- Q55: answer-unscoped KB-G3 (correct) → answer-unscoped KB-G14 · wrong · 0.8761

## Gate separation (0.8439, unscoped top-1 score)

| | question | full |
|---|---|---|
| dev: correct answers | 0.8456 to 0.9675 (n=21) | 0.8580 to 0.9246 (n=23) |
| dev: wrong or partial answers | 0.8536 to 0.8908 (n=7) | 0.8439 to 0.8947 (n=8) |
| dev: abstentions | 0.8037 to 0.8416 (n=5) | 0.8227 to 0.8401 (n=2) |
| dev: wrong or partial answers passing the gate | 7 (Q03, Q11, Q13, Q28, Q30, Q55, Q58) | 8 (Q02, Q03, Q04, Q11, Q23, Q28, Q30, Q55) |
| dev: abstained although unscoped top-1 is acceptable | 5 (Q07, Q16, Q20, Q54, Q57) | 2 (Q54, Q57) |
| gate set: top-1 = likely entry | 0.8154 to 0.9107 (n=15) | 0.8259 to 0.9173 (n=12) |
| gate set: top-1 ≠ likely entry | 0.8538 to 0.9107 (n=5) | 0.8476 to 0.9258 (n=8) |
| gate set: off-topic (NOT_KB_ANSWER) | 0.7445 to 0.8489 (n=14) | 0.7657 to 0.8622 (n=14) |
| gate set: likely entry below the gate | 5 (V02, V03, V06, V17, V19) | 1 (V19) |
| gate set: wrong entry passing the gate | 5 (V05, V12, V14, V16, V18) | 8 (V01, V02, V03, V05, V12, V14, V17, V18) |
| gate set: off-topic passing the gate | 2 (V31, V34) | 4 (V29, V31, V33, V34) |
| gate set: referral or signpost rows, not scored | 6 | 6 |

## Health-term drift (read-only)

Sets: kb_questions 62, dev_questions 35, seeds 380, paraphrases 1239. Vague now: kb_questions 0, dev_questions 0, seeds 33, paraphrases 137.

| Term | healthTerms.json | extraHealthTerms.json | KB questions | dev | seeds | paraphrases | vague result changes if removed |
|---|---|---|---|---|---|---|---|
| abortion | yes | yes | 0 | 0 | 0 | 0 | none |
| nurse | yes | no | 0 | 0 | 3 | 5 | none |
| pharmacies | yes | no | 0 | 0 | 0 | 0 | none |
| sexuality | yes | no | 0 | 0 | 0 | 0 | none |

All four removed: vague result changes on 0 texts.
