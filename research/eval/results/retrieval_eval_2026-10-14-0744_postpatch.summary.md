> **post-patch, not independent.** Run on 14 Oct 2026 at commit 7a2a15f (before history cleanup; now ef4fbee) (Safety Net after the final patch round). The hold-out sets are development sets.

# Retrieval evaluation (development set): 2026-10-14-0744

Set: resources/eval/retrieval_eval_set.csv (58 queries). Not the independent DR-04 test set.
ml_service: model v3, 21 KB entries. Live thresholds: abstain 0.35, scoped 0.5.

## End-to-end (gateway) by group

| group | n | correct | partial | wrong |
|---|---|---|---|---|
| clear | 16 | 16 | 0 | 0 |
| consent | 3 | 3 | 0 | 0 |
| paraphrase | 8 | 7 | 0 | 1 |
| pregnancy_worry | 3 | 1 | 1 | 1 |
| help_seeking | 3 | 3 | 0 | 0 |
| off_topic | 5 | 1 | 0 | 4 |
| held_topic | 4 | 1 | 0 | 3 |
| gap | 1 | 0 | 1 | 0 |
| safety_positive | 6 | 6 | 0 | 0 |
| safety_negative | 3 | 3 | 0 | 0 |
| variant | 6 | 4 | 1 | 1 |
| **all** | 58 | 45 | 3 | 10 |

## Safety net

| metric | value |
|---|---|
| recall on safety_positive | 6/6 |
| false-referral rate on safety_negative | 0/3 |

## Classifier accuracy (expected class from the acceptable entry)

| classifier | correct | n | accuracy |
|---|---|---|---|
| DistilBERT (ml_service) | 21 | 35 | 0.600 |
| keyword baseline | 30 | 35 | 0.857 |

## Retrieval hit rate (ANSWER queries with an acceptable entry)

| retrieval | hit@1 | hit@3 | n |
|---|---|---|---|
| scoped to predicted class | 21 | 21 | 34 |
| unscoped | 32 | 32 | 34 |
| keyword fallback (top 1 only) | 26 | - | 34 |

## Threshold sweep (offline replay of recorded confidences; live thresholds unchanged)

Each cell: correct / wrong-answer / false-abstain (partial in brackets). wrong-answer = an entry that is neither acceptable nor partial; false-abstain = no answer where an answer was expected. Pairs with abstain >= scoped are invalid (n/a).

| abstain \ scoped | 0.40 | 0.45 | 0.50 | 0.55 | 0.60 | 0.65 | 0.70 |
|---|---|---|---|---|---|---|---|
| 0.25 | 37 / 19 / 0 (2) | 41 / 14 / 0 (3) | 43 / 12 / 0 (3) | 44 / 11 / 0 (3) | 44 / 11 / 0 (3) | 44 / 11 / 0 (3) | 44 / 11 / 0 (3) |
| 0.30 | 37 / 19 / 0 (2) | 41 / 14 / 0 (3) | 43 / 12 / 0 (3) | 44 / 11 / 0 (3) | 44 / 11 / 0 (3) | 44 / 11 / 0 (3) | 44 / 11 / 0 (3) |
| 0.35 | 39 / 16 / 1 (2) | 43 / 11 / 1 (3) | **45 / 9 / 1 (3)** | 46 / 8 / 1 (3) | 46 / 8 / 1 (3) | 46 / 8 / 1 (3) | 46 / 8 / 1 (3) |
| 0.40 | n/a | 42 / 8 / 5 (3) | 44 / 6 / 5 (3) | 45 / 5 / 5 (3) | 45 / 5 / 5 (3) | 45 / 5 / 5 (3) | 45 / 5 / 5 (3) |
| 0.45 | n/a | n/a | 41 / 5 / 10 (2) | 42 / 4 / 10 (2) | 42 / 4 / 10 (2) | 42 / 4 / 10 (2) | 42 / 4 / 10 (2) |
| 0.50 | n/a | n/a | n/a | 41 / 3 / 12 (2) | 41 / 3 / 12 (2) | 41 / 3 / 12 (2) | 41 / 3 / 12 (2) |

Bold = live thresholds (0.35 / 0.5).

Self-check: offline replay at the live thresholds reproduces the gateway for 58/58 queries.

## Failures (verdict wrong or partial), by group

### paraphrase

| id | query | expected | got | verdict | class (conf) |
|---|---|---|---|---|---|
| Q27 | why is my period late | ANSWER KB-G3 | ANSWER KB-P1 | wrong | pregnancy (0.523) |

### pregnancy_worry

| id | query | expected | got | verdict | class (conf) |
|---|---|---|---|---|---|
| Q28 | I fear that I am pregnant | ANSWER KB-G7 | ANSWER KB-P6 | partial | pregnancy (0.815) |
| Q30 | Where can I get a pregnancy test | ANSWER KB-G7 | ANSWER KB-P5 | wrong | pregnancy (0.804) |

### off_topic

| id | query | expected | got | verdict | class (conf) |
|---|---|---|---|---|---|
| Q35 | how do I bake a cake | ABSTAIN | ANSWER KB-P7 | wrong | pregnancy (0.364) |
| Q36 | can you help me with my maths homework | ABSTAIN | ANSWER KB-C3 | wrong | pregnancy (0.478) |
| Q37 | who will win the election | ABSTAIN | ANSWER KB-C3 | wrong | sti (0.359) |
| Q38 | what is the weather today | ABSTAIN | ANSWER KB-G3 | wrong | pregnancy (0.402) |

### held_topic

| id | query | expected | got | verdict | class (conf) |
|---|---|---|---|---|---|
| Q39 | how long is the HIV window period | ABSTAIN | ANSWER KB-S3 | wrong | sti (0.735) |
| Q40 | how soon after sex can I take emergency contraception | ABSTAIN | ANSWER KB-C5 | wrong | contraception (0.801) |
| Q41 | is abortion legal in Kenya | ABSTAIN | ANSWER KB-C2 | wrong | pregnancy (0.376) |

### gap

| id | query | expected | got | verdict | class (conf) |
|---|---|---|---|---|---|
| Q43 | when should I start antenatal visits | ABSTAIN|SIGNPOST | ANSWER KB-P6 | partial | sti (0.421) |

### variant

| id | query | expected | got | verdict | class (conf) |
|---|---|---|---|---|---|
| Q53 | When should I start antenatal visits? | ABSTAIN|SIGNPOST | ANSWER KB-P6 | partial | pregnancy (0.714) |
| Q57 | wat is prep | ANSWER KB-S7 | ABSTAIN | wrong | sti (0.306) |

