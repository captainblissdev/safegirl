# K5 failure analysis, 62-entry KB (28 October 2026)

Descriptive only: nothing here may be used to change a rule, threshold, label or entry on the dev set. Per-question detail in `k5_failure_analysis.json`. Relabelled dev labels (35 questions); "pass on 21" is the 21-entry KB's recorded replies scored on the same labels (28 / 35).

## Regressions and improvements

| Mode | 21 pass, 62 fail | 21 fail, 62 pass | Net (28 → 62-entry score) |
|---|---|---|---|
| question | 7 (Q03, Q07, Q13, Q16, Q20, Q54, Q55) | 4 (Q23, Q28, Q30, Q58) | 28 − 7 + 4 = 25 |
| full | 5 (Q02, Q03, Q11, Q54, Q55) | 2 (Q23, Q30) | 28 − 5 + 2 = 25 |

## question mode, per question

| Id | Acceptable | V3 class (conf), retrieval | Unscoped top-1 (score) | Best acceptable rank, unscoped | Scoped top-1 | Best acceptable rank, scoped | Scoping moved it | Gate abstained | 62-entry reply | 21-entry reply | Cause |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Q03 | KB-C5;KB-C9 | contraception (0.555), scoped | KB-C18 (0.8675) | KB-C5 #2 | KB-C18 | #2 | no | no | answer-scoped KB-C18 | answer-scoped KB-C5 | a |
| Q07 | KB-S7 | sti (0.425), unscoped | KB-S7 (0.8408) | KB-S7 #1 | – | – | no | yes | abstain  | answer-unscoped KB-S7 | c |
| Q13 | KB-G5 | pregnancy (0.381), unscoped | KB-G9 (0.8538) | KB-G5 #9 | – | – | no | no | answer-unscoped KB-G9 | answer-unscoped KB-G5 | a |
| Q16 | KB-G1;KB-G7 | contraception (0.414), unscoped | KB-G1 (0.8279) | KB-G1 #1 | – | – | no | yes | abstain  | answer-unscoped KB-G1 | c |
| Q20 | KB-C3;KB-C18 | general (0.357), unscoped | KB-C3 (0.8416) | KB-C3 #1 | – | – | no | yes | abstain  | answer-unscoped KB-C3 | c |
| Q54 | KB-S7 | contraception (0.424), unscoped | KB-S7 (0.8348) | KB-S7 #1 | – | – | no | yes | abstain  | answer-unscoped KB-S7 | c |
| Q55 | KB-G3 | sti (0.384), unscoped | KB-G14 (0.8785) | KB-G3 #2 | – | – | no | no | answer-unscoped KB-G14 | answer-unscoped KB-G3 | a |
| Q23 | KB-S4;KB-S21;KB-S15 | pregnancy (0.441), unscoped | KB-S4 (0.8644) | KB-S4 #1 | – | – | no | no | answer-unscoped KB-S4 | abstain  | improvement |
| Q28 | KB-P8 | pregnancy (0.815), scoped | KB-P8 (0.8544) | KB-P8 #1 | KB-P8 | #1 | no | no | answer-scoped KB-P8 | answer-scoped KB-P6 | improvement |
| Q30 | KB-P8 | pregnancy (0.804), scoped | KB-P8 (0.8899) | KB-P8 #1 | KB-P8 | #1 | no | no | answer-scoped KB-P8 | answer-scoped KB-P5 | improvement |
| Q58 | KB-C12 | contraception (0.682), scoped | KB-C12 (0.8536) | KB-C12 #1 | KB-C12 | #1 | no | no | answer-scoped KB-C12 | answer-scoped KB-C4 | improvement |

## full mode, per question

| Id | Acceptable | V3 class (conf), retrieval | Unscoped top-1 (score) | Best acceptable rank, unscoped | Scoped top-1 | Best acceptable rank, scoped | Scoping moved it | Gate abstained | 62-entry reply | 21-entry reply | Cause |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Q02 | KB-C4 | contraception (0.907), scoped | KB-C18 (0.8883) | KB-C4 #2 | KB-C18 | #2 | no | no | answer-scoped KB-C18 | answer-scoped KB-C4 | a |
| Q03 | KB-C5;KB-C9 | contraception (0.555), scoped | KB-C18 (0.875) | KB-C5 #3 | KB-C18 | #3 | no | no | answer-scoped KB-C18 | answer-scoped KB-C5 | a |
| Q11 | KB-G3;KB-G6;KB-G14 | sti (0.441), unscoped | KB-C7 (0.8862) | KB-G3 #2 | – | – | no | no | answer-unscoped KB-C7 | answer-unscoped KB-G3 | e |
| Q54 | KB-S7 | contraception (0.424), unscoped | KB-S7 (0.8401) | KB-S7 #1 | – | – | no | yes | abstain  | answer-unscoped KB-S7 | c |
| Q55 | KB-G3 | sti (0.384), unscoped | KB-G14 (0.8761) | KB-G3 #2 | – | – | no | no | answer-unscoped KB-G14 | answer-unscoped KB-G3 | a |
| Q23 | KB-S4;KB-S21;KB-S15 | pregnancy (0.441), unscoped | KB-S21 (0.8504) | KB-S21 #1 | – | – | no | no | answer-unscoped KB-S21 | abstain  | improvement |
| Q30 | KB-P8 | pregnancy (0.804), scoped | KB-P8 (0.879) | KB-P8 #1 | KB-P8 | #1 | no | no | answer-scoped KB-P8 | answer-scoped KB-P5 | improvement |

## Causes of regressions

| Cause | question | full |
|---|---|---|
| a: new same-class entry outranks | 3 | 3 |
| b: scoping to the wrong class | 0 | 0 |
| c: gate abstained, acceptable on top | 4 | 1 |
| d: id or text changed | 0 | 0 |
| e: other | 0 | 1 |

Other (e): full: Q11 (new entry KB-C7 in another class).

## Competing entries in cause (a)

| Mode | Dev id | Competitor (class) | Acceptable it outranks | Question cosine | Within 0.03 |
|---|---|---|---|---|---|
| question | Q03 | KB-C18 (contraception) | KB-C5 | 0.8904 | no |
| question | Q13 | KB-G9 (general) | KB-G5 | 0.915 | no |
| question | Q55 | KB-G14 (general) | KB-G3 | 0.9177 | no |
| full | Q02 | KB-C18 (contraception) | KB-C4 | 0.9308 | no |
| full | Q03 | KB-C18 (contraception) | KB-C5 | 0.8904 | no |
| full | Q55 | KB-G14 (general) | KB-G3 | 0.9177 | no |

## Near duplicates

| | 62-entry KB | 21-entry KB |
|---|---|---|
| question pairs with cosine >= 0.97 (within 0.03) | 0 | 0 |
| question pairs with cosine >= 0.95 | 0 | 0 |
| question pairs with cosine >= 0.90 (entries in them) | 82 (49) | 9 (12) |
| highest question-pair cosine | 0.9452 | 0.9322 |
| self-retrieval near-misses < 0.03, question mode | 0 | 0 |
| self-retrieval near-misses < 0.03, full mode | 24 (own entry not top: KB-C4) | 4 |
