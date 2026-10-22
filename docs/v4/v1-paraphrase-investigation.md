# The deleted V1 paraphrases

Step V4-2, 22 October 2026. A read-only look at the 220 V1 paraphrases
that the V3 pool no longer contains: nothing has been restored into the
repository and no V3 file has been changed.

## What was removed

Commit `447b3bd` ("feat: V3.1 euphemism-fix retrain", 23 September 2026)
deleted four files and renamed four others:

| Change in `447b3bd` | File |
|---|---|
| deleted | `dataset/reviewed/contraception_paraphrases.csv` |
| deleted | `dataset/reviewed/general_paraphrases (1).csv` |
| deleted | `dataset/reviewed/pregnancy_paraphrases.csv` |
| deleted | `dataset/reviewed/sti_paraphrases (1).csv` |
| renamed | `dataset/reviewed/{contraception,general,pregnancy,sti}_v2_paraphrases.csv` to `*_v3_paraphrases.csv` (84 to 93% similar) |

The four deleted files are exactly the four that commit `48c6d29`
("docs: finalize V2 classifier evaluation protocol", 16 September 2026)
added; the git blobs are identical, so they were not edited in between.

They hold 220 paraphrases, exactly 4 for each of the 55 original V1
seeds (`SEED-CONTRA-01` to `-14`, `SEED-STI-01` to `-16`, `SEED-PREG-01`
to `-15`, `SEED-GEN-01` to `-10`): contraception 56, sti 64, pregnancy
60, general 40.

**They are different files from `resources/generated/*_v2_paraphrases.csv`.**
Those hold 508 unreviewed V2 paraphrases of the 127 V2 seeds; they share
no seed, paraphrase id or text with the V1 files. None of the 220 texts
is in the current `resources/reviewed/` files either.

## Whether a reason is recorded

Nothing in the repository says why the V1 paraphrases were removed.

- The decision log keeps them: "Existing V1 paraphrases (220, covering
  the original 55 seeds) are untouched" and "Final V2 dataset: 182
  seeds + 728 total paraphrases (220 existing + 508 new) = 910
  examples" (V2 Paraphrasing Protocol Frozen, 2026-09-18). No later
  entry mentions them.
- The `447b3bd` commit message is about the euphemism fix (5 targeted
  seeds, regularisation, holdout recall) and does not mention the
  deletion.
- The V2 training commit describes the final model as trained on "all
  910 examples (182 seeds + 220 V1 paraphrases + 508 new)", and
  `SafeGirl_V2_Training.ipynb` asserts 910 examples.
- Commit `94d78ac` (17 September 2026) is titled "Added initial V1
  paraphrases to supplement all the folds effectively", but it added
  the four `*_v2_paraphrases.csv` files, not V1 ones. The name may have
  caused confusion later; that is a guess, not a record.
- GitHub issues could not be searched from this machine (`gh` is not
  installed); issues #15 and #16, which the V3 commits reference, were
  not read.

**When they dropped out.** The V3 training log
(`research/experiments/logs/v3_training_log.txt`) reports 774 examples:
206 seeds + 508 V2 paraphrases + 60 euphemism paraphrases. So the V1
paraphrases were already out of the training directory for V3's first
run, not only from V3.1 (789 examples). V2 trained on them; V3 and V3.1
did not. The V2-to-V3 comparison therefore changed more than the 24
added seeds and 60 paraphrases: 220 paraphrases also left.

## The 220 run through the V4 checks

Extracted from git history (`447b3bd^`) into a scratch directory
outside the repository and checked with `research/v4/check_seeds.py`'s
functions (e5, the same thresholds, the gateway's own held-topic rule).
The checker is written for seeds, so two of its checks always hit a
paraphrase: being near its own seed, and being near another paraphrase
of the same seed. The table shows both views.

| Class | Total | Pass (all checks) | Fail (all checks) | Pass, ignoring own-seed matches | Fail, ignoring own-seed matches |
|---|---|---|---|---|---|
| contraception | 56 | 27 | 29 | 42 | 14 |
| sti | 64 | 6 | 58 | 47 | 17 |
| pregnancy | 60 | 14 | 46 | 43 | 17 |
| general | 40 | 3 | 37 | 38 | 2 |
| **Total** | **220** | **50** | **170** | **170** | **50** |

Paraphrases failing each check (one paraphrase can fail several):

| Check | contraception | sti | pregnancy | general | What it means |
|---|---|---|---|---|---|
| Structure | 0 | 0 | 0 | 0 | Columns, ids, seed references, class matching the seed, length, not identical to the seed, 4 per seed: all pass. (Id style differs: `-P1` in contraception and pregnancy, `-P01` in sti and general.) |
| Near its own seed (V3 pool) | 20 | 56 | 39 | 32 | Expected for a paraphrase; low variety. |
| Near another paraphrase of the same seed | 14 | 58 | 35 | 37 | Expected; 145 pairs. |
| Near another seed's paraphrase in the file | 1 | 10 | 0 | 2 | 9 pairs, from SEED-CONTRA-01, STI-01, STI-04, STI-11. |
| Near another V3 pool item | 1 | 12 | 0 | 0 | e.g. STI-11's paraphrases are near SEED-STI-28; STI-15's near SEED-STI-35. |
| DR-04 | 0 | 2 | 2 | 0 | SEED-PREG-12-P1/-P3 near DR-04 row 10; SEED-STI-01-P01/-P03 near row 29. |
| relevance_validation.csv | 0 | 4 | 0 | 0 | All four SEED-STI-01 paraphrases near V05. |
| Development set | 0 | 0 | 1 | 0 | SEED-PREG-01-P2 near Q53. |
| Held topic | 13 | 0 | 16 | 0 | Group A (emergency contraception): CONTRA-09, -11, -12, -13. Group C (possible pregnancy and testing): PREG-11, -12, -13, -15. Group B: one of PREG-14's. |
| Safety Net | 0 | 0 | 0 | 0 | None flagged. |

## Related: the current V3 seeds

The same held-topic rule, run on the 211 current V3 seeds, matches 28
of them (15 contraception, 11 pregnancy, 2 general; listed in
`research/v4/v3_seeds_held_topic.csv`), including the parent seeds of
the 29 held-topic paraphrases above. The held-topic rule was written on
20 October 2026, after V3 was trained, so V3 learnt from these seeds;
the gateway now signposts such questions before the classifier runs.
The Safety Net flags one V3 seed, SEED-PREG-06, which the held-topic
rule does not match.

## What this means for V4

Not decided here. If any of the 220 come back, they would need: the
held-topic ones (29) left out under the V4 rule; the DR-04, development
set and relevance_validation near-duplicates (7 paraphrases; 34 with the
held-topic ones, as two of group C also sit near DR-04) left out;
and a choice on how much own-seed similarity is acceptable for a
paraphrase, which the V4 checker does not yet distinguish.
