# Evaluation sets

| File | Rows | Use |
|---|---|---|
| `retrieval_eval_set.csv` | 58 | Retrieval development set, run by `research/eval/run_eval.js`. Not the independent DR-04 test set. |
| `safety_holdout.csv` | 30 (H01–H30) | Safety Net hold-out 1. Used to build the rules. |
| `safety_holdout_2.csv` | 26 (J01–J26) | Safety Net hold-out 2. Used to build the rules. |
| `safety_holdout_3.csv` | 24 (K01–K24) | Safety Net hold-out 3. Run sealed at commit `8a083cf`: recall 6/14, false referrals 2/10. |

Hold-outs 1 and 2 were used to build the Safety Net rules. Hold-out 3 was run once, sealed, before any rule was changed in response to it; its result is **recall 6/14 and false referrals 2/10**. The Safety Net was then patched with hold-out 3 in view, so **all three hold-outs are now development sets**. Any result on them after that patch is post-patch and not independent.

H18 (Swahili) is recorded but not counted against recall.
