# Chapter 5 notes: evaluation

Organised notes for the evaluation chapter, compiled on 15 October 2026
from files already in the repository. **Nothing was re-run for these notes
and no new claims are made.** Every number is given with its source file.
Where a count is read off a confusion matrix in a log, that is said.

Commit hashes in older sources are given as written there; the
post-cleanup hashes are in [`docs/history-rewrite-map.md`](history-rewrite-map.md).

## 1. What was built

- **Gateway** (`app/gateway`, Node/Express). Each query goes through, in
  order: the Safety Net, the generic-help rule, the intent classifier
  (via `ml_service`, with a keyword fallback), then retrieval and a
  stubbed generation step. A flagged query gets a referral and skips
  retrieval. Source: [`README.md`](../README.md#request-order).
- **Safety Net** (`app/gateway/src/safetyNet.js`). Rule-based: 43
  keyword phrases and 44 pattern rules (22 self-harm, 22 abuse), frozen
  on 2026-10-15 apart from the one J08 exception. Source:
  [`docs/safety-net-evaluation.md`](safety-net-evaluation.md#method),
  [`docs/decision-log.md`](decision-log.md#safety-net-patterns-frozen-2026-10-15).
- **`ml_service`** (FastAPI). DistilBERT V3 (`distilbert-base-multilingual-cased`,
  fine-tuned on four classes: contraception, sti, pregnancy, general) for
  `/classify`, and `intfloat/multilingual-e5-small` semantic retrieval
  over 21 knowledge-base entries for `/retrieve`. Source:
  [`docs/decision-log.md`](decision-log.md#demo-freeze-until-after-milestone-2-2026-10-15).
- **Thresholds.** Retrieval is scoped to the predicted class at
  confidence 0.5 or above, unscoped below, and skipped below 0.35. Both
  are provisional and frozen. Source:
  [`docs/decision-log.md`](decision-log.md#demo-freeze-until-after-milestone-2-2026-10-15).
- **Answers are extractive.** Generation is stubbed; the answer is the
  retrieved entry's text. Source: [`README.md`](../README.md).
- **Interface** (`app/interface`, React PWA). Anonymous Firebase sign-in
  held in memory only, and an offline pipeline with a port of the Safety
  Net kept identical by a parity test. Source:
  [`docs/testing/pwa-audit.md`](testing/pwa-audit.md),
  [`docs/safety-net-evaluation.md`](safety-net-evaluation.md#method).

## 2. Results, reported separately

The three kinds of result answer different questions and must not be
pooled.

### 2a. Cross-validation

| Model | Data | Accuracy | Macro-F1 | Source |
|---|---|---|---|---|
| V1 | Single split, 55 seeds | 80.0% | 0.7677 | [`docs/development-log.md`](development-log.md) |
| V2 | 5-fold StratifiedGroupKFold, 182 seeds, 910 examples | 82.9% (mean across folds; no SD recorded) | 0.8274 (SD 0.0726) | [`docs/development-log.md`](development-log.md), [`docs/decision-log.md`](decision-log.md#v2-evaluation-methodology-2026-09-16) |
| V3 | 5-fold, CV pool of 776 examples (euphemism hold-out excluded) | 0.8041 ± 0.0427 (folds 0.7464–0.8471) | 0.7965 ± 0.0482 | [`research/experiments/logs/v3_1_training_log.txt`](../research/experiments/logs/v3_1_training_log.txt) (UTF-16) |

- V2's CV found a General ↔ STI boundary confusion: 46 errors across 910
  pooled predictions (22 general→sti, 24 sti→general). Source:
  [`docs/development-log.md`](development-log.md).
- V3's pooled CV per-class recall: contraception 0.8372, sti 0.8497,
  pregnancy 0.6763, general 0.8445. Pregnancy is V3's lowest class in CV.
  Source: [`v3_1_training_log.txt`](../research/experiments/logs/v3_1_training_log.txt).
- **Unfavourable to V3:** V3's CV accuracy and macro-F1 are lower than
  V2's. The two used different data (776 against 910 examples) and V3
  excludes a euphemism hold-out, so the sources do not support reading
  this as a like-for-like comparison either way.
- V3's euphemism hold-out (4 seeds and their paraphrases, 13 examples,
  never seen in CV or training): 9/13 correct (derived from the
  confusion matrix in the training log; the log gives no totals);
  general 1/3. Source:
  [`v3_1_training_log.txt`](../research/experiments/logs/v3_1_training_log.txt).

### 2b. Independent expert test

| Model | Set | Result | Status | Source |
|---|---|---|---|---|
| V2 | DR-04, n = 31 | Accuracy 90.3%, macro-F1 0.8832 | Independent, blind, one-time | [`docs/development-log.md`](development-log.md), [`docs/DR04_record.md`](DR04_record.md) |
| V3 | DR-04, n = 31 | 27/31 correct (derived from the confusion matrix in the training log; the log gives no totals); general 1/3 | **Not independent:** the log calls it a "disclosed reuse, not a fresh blind evaluation" | [`v3_1_training_log.txt`](../research/experiments/logs/v3_1_training_log.txt) |
| V3 | Fresh independent expert test | – | **Pending** | – |

- DR-04 has no examples on the General ↔ STI boundary, so it does not
  test V2's known weakness, and its general class has only 3 examples.
  Source: [`docs/development-log.md`](development-log.md), [`README.md`](../README.md).

### 2c. Development set (retrieval evaluation)

`resources/eval/retrieval_eval_set.csv`: 58 owner-written queries. A
development set, not an independent test.

| Run | Correct | Partial | Wrong | Source |
|---|---|---|---|---|
| 2026-10-06 (before the Safety Net patches) | 40 | 3 | 15 | [`retrieval_eval_2026-10-06-0715.summary.md`](../research/eval/results/retrieval_eval_2026-10-06-0715.summary.md) |
| 2026-10-14 (post-patch, not independent) | 45 | 3 | 10 | [`retrieval_eval_2026-10-14-0744_postpatch.summary.md`](../research/eval/results/retrieval_eval_2026-10-14-0744_postpatch.summary.md) |

The 2026-10-14 run by group: clear 16/16, consent 3/3, paraphrase 7/8,
pregnancy_worry 1/3 (1 partial), help_seeking 3/3, off_topic 1/5 correct, held_topic 1/4 correct, gap 0/1
(1 partial), variant 4/6. Source: the 2026-10-14 summary above.

## 3. Keyword baseline against V3

On the development set, on the 29 queries with a clear, non-ambiguous
class:

| Classifier | Correct | Accuracy | 95% Wilson interval |
|---|---|---|---|
| DistilBERT V3 | 20/29 | 69.0% | 50.8% to 82.7% |
| Frozen keyword baseline | 28/29 | 96.6% | 82.8% to 99.4% |

- Paired: both right on 19, only V3 on 1, only the baseline on 9.
  **Exact McNemar p = 0.021**, and the two intervals only just fail to
  overlap.
- V3 recall by class: contraception 7/8, sti 6/8, pregnancy 5/5,
  **general 2/8**. Baseline recall: 8/8, 8/8, 4/5, 8/8.
- Expected calibration error 0.231. Every wrong V3 prediction is below
  0.46 confidence, and everything at 0.5 or above is right.
- Source for all of the above:
  [`research/eval/results/classifier_analysis.md`](../research/eval/results/classifier_analysis.md)
  and [`classifier_calibration.md`](../research/eval/results/classifier_calibration.md).
- A second count, by the evaluation harness against the class of each
  query's acceptable entry: V3 21/35 (0.600), keyword baseline 30/35
  (0.857). Source: [`retrieval_eval_2026-10-14-0744_postpatch.summary.md`](../research/eval/results/retrieval_eval_2026-10-14-0744_postpatch.summary.md).

**This is unfavourable to V3**, and the sources limit how far it goes:
- the queries are short, plain English and keyword-friendly;
- the labels are provisional, and four ambiguous pregnancy and period
  rows (Q27–Q30) are excluded, all predicted pregnancy by V3;
- the set does not cover DR-04, Sheng or code-switched language;
- so it does not show that the baseline is better in general.

Source: [`classifier_analysis.md`](../research/eval/results/classifier_analysis.md#what-this-does-not-show).

## 4. Scoped against unscoped retrieval

- **Unscoped retrieval finds the right entry far more often.** Hit@1 on
  the 34 answerable queries: scoped to the predicted class 21/34,
  unscoped 32/34, keyword fallback 26/34. Hit@3 is the same as hit@1
  for both. Source: [`retrieval_eval_2026-10-14-0744_postpatch.summary.md`](../research/eval/results/retrieval_eval_2026-10-14-0744_postpatch.summary.md).
- **Why the live system still does well.** Every wrong V3 prediction is
  below 0.5, so the 0.5 scoping threshold sends them all to unscoped
  retrieval, which is why many still get the right answer live. Source:
  [`classifier_analysis.md`](../research/eval/results/classifier_analysis.md#what-this-shows).
- **Fragile answers.** Q11, Q14 and Q16 are misclassified by V3 and right
  only because their confidence is below 0.5 (scoped they would get
  KB-S4, KB-S6 and KB-C1, all wrong). Q14 is 0.018 above the 0.35
  no-answer cut-off. Any change to the thresholds, model or knowledge base
  can flip them. Source:
  [`docs/decision-log.md`](decision-log.md#demo-freeze-until-after-milestone-2-2026-10-15),
  [`suggested_questions_2026-10-14.csv`](../research/eval/results/suggested_questions_2026-10-14.csv).
- **Threshold sweep** (offline replay, live thresholds unchanged): at the
  live 0.35/0.5, 45 correct, 9 wrong answers, 1 false abstain (3
  partial). Raising the scoped threshold to 0.55 or above gives 46 / 8 / 1
  on this set. Found on the scored data, so optimistic. Source: the
  2026-10-14 summary above.
- **"Should I answer at all?"** The unscoped top-1 retrieval score
  separates should-answer from should-not-answer queries better than
  classifier confidence (AUC 0.882 against 0.731). At 0.8439 it keeps
  31/34 answerable queries and wrongly keeps 5/20, against 18/20 wrongly
  kept by the live 0.35 confidence cut-off. Indicative only: 34 against
  20 queries, and the threshold was found on the same data. No gate is
  implemented. Source:
  [`relevance_signal.md`](../research/eval/results/relevance_signal.md),
  [`classifier_analysis.md`](../research/eval/results/classifier_analysis.md#c-relevance-signal-when-should-the-system-not-answer).

## 5. Safety Net results

- **Independent:** the sealed hold-out 3 run, once, before any rule was
  changed for it: **recall 6/14, false referrals 2/10**, gateway and
  offline agreeing. Source:
  [`safety_holdout_3_SEALED_8a083cf.csv`](../research/eval/results/safety_holdout_3_SEALED_8a083cf.csv),
  [`docs/safety-net-evaluation.md`](safety-net-evaluation.md#sealed-result-hold-out-3).
- **Post-patch, not independent:** hold-out 1 18/19 and 0/10; hold-out 2
  16/16 and 2/10 (after the J08 fix); hold-out 3 9/14 and 2/10; 58-query
  safety rows 6/6 and 0/3; other rows 0/49 false referrals. Source:
  [`docs/decision-log.md`](decision-log.md#safety-net-at-exclusion-narrowed-the-one-freeze-exception-2026-10-15).
- **A missed disclosure gets an ordinary answer.** The ten missed
  disclosures run through the full gateway on 2026-10-06 all received an
  unrelated knowledge-base answer (for example "I want to be dead" got
  the HIV PEP entry), and the 0.35 cut-off never fired (lowest confidence
  0.374). Five of the ten are now caught by the Safety Net. Source:
  [`holdout3_missed_pipeline.csv`](../research/eval/results/holdout3_missed_pipeline.csv),
  [`docs/safety-net-evaluation.md`](safety-net-evaluation.md#what-a-missed-disclosure-receives).

## 6. Limitations

- Small samples: DR-04 n = 31 (general 3); development-set calibration
  on 29 queries; relevance on 34 against 20. Sources above.
- No independent test of V3 yet; its DR-04 result is a non-blind reuse.
- The development set and its provisional labels were written by the
  project owner, who also built the system.
- The Safety Net is a keyword net with low independent recall (6/14),
  and it misses indirect disclosures, other languages and slang. Source:
  [`docs/safety-net-evaluation.md`](safety-net-evaluation.md).
- No GBV class; GBV-adjacent queries the Safety Net misses get unrelated
  answers. Source: [`docs/safety-net-evaluation.md`](safety-net-evaluation.md#what-a-missed-disclosure-receives).
- Answers are extractive; generation is not implemented, so nothing here
  evaluates generated answers.
- 15 of the 21 knowledge-base entries were ratified by the project owner
  only, without independent clinical review; the referral wording is
  interim and the help numbers are unverified. Source:
  [`README.md`](../README.md#known-limitations).
- Local demo only, with no real adolescent users; Lighthouse ran on
  `localhost`. Sources: [`README.md`](../README.md#known-limitations),
  [`docs/testing/pwa-audit.md`](testing/pwa-audit.md#lighthouse).
- Held content: GBV information and Sheng/code-switched material are
  excluded pending review. Source: [`README.md`](../README.md).

## 7. Decisions to cite

### Supervisor guidance, 12 October 2026

Given by the supervisor, Kelvin, on 12 October 2026, and recorded in
[`docs/decision-log.md`](decision-log.md#supervisor-guidance-12-october-2026):

- **Reviewers.** Consult the industry mentor and the lecturer to find
  clinical and legal reviewers.
- **Retrieval.** Keep classifier-scoped retrieval experimental, and
  report unscoped retrieval as a finding, with the reason (section 4).
- **V3.** Document V3's weaknesses on period and puberty questions.
  Retrain only after the planned evaluation; V4 is future work.
- **Answers.** Keep extractive answers, not an LLM.
- **Safety Net.** The keyword Safety Net is acceptable for a supervised
  prototype demo if its limits are stated and the referral numbers are
  verified.
- **Demo.** A rehearsed local demo of about six predefined queries, with
  no real adolescent users.
- **Pilot.** Consult the data protection officer and the ethics committee
  before any pilot with minors.
- **Milestone 2 must show:**
  - an integrated prototype;
  - completed authentication and privacy checks;
  - a keyword baseline against V3 comparison with metrics and error
    analysis;
  - cross-validation, independent expert test and development-set results
    reported separately;
  - a scoped against unscoped retrieval analysis;
  - updated diagrams;
  - documented limitations;
  - a rehearsed demo.

### Other logged decisions

Apart from the guidance above, the decision log does **not** say which
decisions were made or approved by the supervisor, so that attribution
needs to be confirmed before the chapter states it.

| Date | Decision | Link |
|---|---|---|
| 2026-08-20 | Gemini chosen for generation; no real user or PII data ever sent to it | [decision log](decision-log.md#2026-08-20) |
| 2026-08-27 | Keyword baseline frozen; ML evaluation scoped to four classes, GBV routing-only | [decision log](decision-log.md#2026-08-27) |
| 2026-08-29 | Gemini kept despite the terms-of-service conflict, for the prototype only, to be raised with the supervisor for sign-off | [decision log](decision-log.md#2026-08-29) |
| 2026-09-16 | V2 evaluated by 5-fold StratifiedGroupKFold CV grouped by seed; V1 locked as historical | [decision log](decision-log.md#v2-evaluation-methodology-2026-09-16) |
| 2026-09-18 | V2 paraphrasing protocol frozen | [decision log](decision-log.md#v2-paraphrasing-protocol-frozen-2026-09-18) |
| 2026-10-15 | Safety Net patterns frozen until after Milestone 2 | [decision log](decision-log.md#safety-net-patterns-frozen-2026-10-15) |
| 2026-10-15 | Demo freeze: checkpoint, thresholds, knowledge base, patterns and packages | [decision log](decision-log.md#demo-freeze-until-after-milestone-2-2026-10-15) |
| 2026-10-15 | The one freeze exception: the "at" exclusion narrowed for J08 | [decision log](decision-log.md#safety-net-at-exclusion-narrowed-the-one-freeze-exception-2026-10-15) |

The demo-freeze entry says `ml_service/requirements.txt` still pins torch
2.4.1 and pydantic 2.9.2. That was fixed on this branch: the file now
matches the working environment.
