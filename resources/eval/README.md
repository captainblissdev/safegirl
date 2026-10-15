# Evaluation sets

| File | Rows | Use |
|---|---|---|
| `retrieval_eval_set.csv` | 58 | Retrieval development set, run by `research/eval/run_eval.js`. Not the independent DR-04 test set. |
| `safety_holdout.csv` | 30 (H01–H30) | Safety Net hold-out 1. Used to build the rules. |
| `safety_holdout_2.csv` | 26 (J01–J26) | Safety Net hold-out 2. Used to build the rules. |
| `safety_holdout_3.csv` | 24 (K01–K24) | Safety Net hold-out 3. Run sealed at commit `8a083cf` (before history cleanup; now `be91073`): recall 6/14, false referrals 2/10. |
| `relevance_validation.csv` | 40 (V01–V40) | Relevance gate validation set. Used once; see below. |

Hold-outs 1 and 2 were used to build the Safety Net rules. Hold-out 3 was run once, sealed, before any rule was changed in response to it; its result is **recall 6/14 and false referrals 2/10**. The Safety Net was then patched with hold-out 3 in view, so **all three hold-outs are now development sets**. Any result on them after that patch is post-patch and not independent.

H18 (Swahili) is recorded but not counted against recall.

The sealed run's per-row results are in
`research/eval/results/safety_holdout_3_SEALED_8a083cf.csv`. Its file name keeps
the hash from before the 2026-10-15 history cleanup; that commit is now `be91073`
(see `docs/history-rewrite-map.md`).

## Relevance validation set

`relevance_validation.csv` has 40 synthetic queries, written by the
project team with AI assistance (Claude). They are in four groups:

| Group | Rows |
|---|---|
| `in_scope` | 20 (V01–V20) |
| `off_topic` | 8 (V21–V28) |
| `out_of_scope_health` | 6 (V29–V34) |
| `distress` | 6 (V35–V40) |

12 of the 20 in-scope rows paraphrase development-set questions (their
`notes` say which), so that part of the check is easier than a fully
fresh set would be.

It was used **once**, on 15 October 2026, to check the relevance gate at
its fixed threshold of 0.8439 (results:
`research/eval/results/relevance_gate_validation_2026-10-15.csv` and
`research/eval/results/labels_and_gate_2026-10-15.md`). **It must not be
used to tune anything**: no threshold, rule, model or knowledge-base
entry may be chosen or changed with it in view.

From 15 October 2026, flagged queries are not classified, so in
evaluation runs made after that date the `gw_predicted_category`,
`gw_classifier_source` and `gw_confidence` columns are empty for flagged
rows (see `docs/decision-log.md`, "Classifier skipped on flagged
queries").
