<!-- SYNTHETIC FORMAT SAMPLE. NOT A RESULT. -->

> **Format sample only.** Produced by `research/v4/sealed_eval.py --dry-run`
> on a synthetic set of 60 V4 training seeds (10 per class, chosen with
> random seed 20261027), with fake routes: 3 rows marked held and 3 marked
> safety, the rest none. V4 was trained on these seeds, so every number
> below is in-sample and means nothing. The synthetic texts and labels are
> not in the repository. The sealed set was not used.

# V4 sealed evaluation (DRY RUN)

**DRY RUN on synthetic data. This is not a result.**

Frozen model sha256 89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd; labels sha256 8d146d90ba61223d3d9356f385d625f6e403fd47c7f3e0ce4690186038403ce2; script sha256 1ac48c6e59cbfc0852ebe37835ae222e856c3452ec4f500757bbb845237152e2; git f978cc9a2c3f340b9b4e59a0996827f5dc6282af.

## Counts

60 items; 41 where no upstream rule fires. Routes: {'none': 54, 'held': 3, 'safety': 3}. Topic labels: {'contraception': 10, 'sti': 10, 'pregnancy': 10, 'general': 10, 'out_of_scope': 10, 'vague': 10}. Upstream fired: {'held_A': 4, 'held_B': 1, 'vague_rule': 14}.

## Classifier level, all items (n = 60)

| | Macro-F1 | STI recall | Pregnancy recall | Confident-wrong | ECE |
|---|---|---|---|---|---|
| V4 | 0.9666 | 0.9000 | 1.0000 | 0.0333 | 0.0765 |
| M1 | 0.4083 | 0.6000 | 0.5000 | n/a | n/a |
| M2 | 0.5889 | 0.6000 | 0.5000 | n/a | n/a |

Per-class precision / recall:

| Class | V4 | M1 | M2 | Support |
|---|---|---|---|---|
| contraception | 0.900 / 0.900 | 0.700 / 0.700 | 0.700 / 0.700 | 10 |
| sti | 1.000 / 0.900 | 1.000 / 0.600 | 1.000 / 0.600 | 10 |
| pregnancy | 0.909 / 1.000 | 0.833 / 0.500 | 0.833 / 0.500 | 10 |
| general | 1.000 / 1.000 | 0.237 / 0.900 | 1.000 / 0.200 | 10 |
| out_of_scope | 1.000 / 1.000 | 0.000 / 0.000 | 0.273 / 0.600 | 10 |
| vague | 1.000 / 1.000 | 0.000 / 0.000 | 0.643 / 0.900 | 10 |

V4 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 9 | 0 | 1 | 0 | 0 | 0 |
| sti | 1 | 9 | 0 | 0 | 0 | 0 |
| pregnancy | 0 | 0 | 10 | 0 | 0 | 0 |
| general | 0 | 0 | 0 | 10 | 0 | 0 |
| out_of_scope | 0 | 0 | 0 | 0 | 10 | 0 |
| vague | 0 | 0 | 0 | 0 | 0 | 10 |

M1 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 7 | 0 | 1 | 2 | 0 | 0 |
| sti | 1 | 6 | 0 | 3 | 0 | 0 |
| pregnancy | 1 | 0 | 5 | 4 | 0 | 0 |
| general | 1 | 0 | 0 | 9 | 0 | 0 |
| out_of_scope | 0 | 0 | 0 | 10 | 0 | 0 |
| vague | 0 | 0 | 0 | 10 | 0 | 0 |

M2 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 7 | 0 | 1 | 0 | 2 | 0 |
| sti | 1 | 6 | 0 | 0 | 3 | 0 |
| pregnancy | 1 | 0 | 5 | 0 | 4 | 0 |
| general | 1 | 0 | 0 | 2 | 6 | 1 |
| out_of_scope | 0 | 0 | 0 | 0 | 6 | 4 |
| vague | 0 | 0 | 0 | 0 | 1 | 9 |

## Classifier level, no upstream rule fires (n = 41)

| | Macro-F1 | STI recall | Pregnancy recall | Confident-wrong | ECE |
|---|---|---|---|---|---|
| V4 | 0.9576 | 0.9000 | 1.0000 | 0.0488 | 0.0808 |
| M1 | 0.4299 | 0.6000 | 0.5000 | n/a | n/a |
| M2 | 0.4813 | 0.6000 | 0.5000 | n/a | n/a |

Per-class precision / recall:

| Class | V4 | M1 | M2 | Support |
|---|---|---|---|---|
| contraception | 0.857 / 0.857 | 0.714 / 0.714 | 0.714 / 0.714 | 7 |
| sti | 1.000 / 0.900 | 1.000 / 0.600 | 1.000 / 0.600 | 10 |
| pregnancy | 0.889 / 1.000 | 0.800 / 0.500 | 0.800 / 0.500 | 8 |
| general | 1.000 / 1.000 | 0.348 / 0.889 | 1.000 / 0.222 | 9 |
| out_of_scope | 1.000 / 1.000 | 0.000 / 0.000 | 0.286 / 1.000 | 6 |
| vague | 1.000 / 1.000 | 0.000 / 0.000 | 0.000 / 0.000 | 1 |

V4 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 6 | 0 | 1 | 0 | 0 | 0 |
| sti | 1 | 9 | 0 | 0 | 0 | 0 |
| pregnancy | 0 | 0 | 8 | 0 | 0 | 0 |
| general | 0 | 0 | 0 | 9 | 0 | 0 |
| out_of_scope | 0 | 0 | 0 | 0 | 6 | 0 |
| vague | 0 | 0 | 0 | 0 | 0 | 1 |

M1 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 5 | 0 | 1 | 1 | 0 | 0 |
| sti | 1 | 6 | 0 | 3 | 0 | 0 |
| pregnancy | 0 | 0 | 4 | 4 | 0 | 0 |
| general | 1 | 0 | 0 | 8 | 0 | 0 |
| out_of_scope | 0 | 0 | 0 | 6 | 0 | 0 |
| vague | 0 | 0 | 0 | 1 | 0 | 0 |

M2 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 5 | 0 | 1 | 0 | 1 | 0 |
| sti | 1 | 6 | 0 | 0 | 3 | 0 |
| pregnancy | 0 | 0 | 4 | 0 | 4 | 0 |
| general | 1 | 0 | 0 | 2 | 6 | 0 |
| out_of_scope | 0 | 0 | 0 | 0 | 6 | 0 |
| vague | 0 | 0 | 0 | 0 | 1 | 0 |

## Reply-kind level

| Subset | n | V4 | M1 | M2 |
|---|---|---|---|---|
| all | 60 | 0.7833 | 0.6667 | 0.5500 |
| no_upstream | 41 | 0.9268 | 0.7561 | 0.5854 |

McNemar exact (discordant counts: V4 right / other wrong, V4 wrong / other right):

- all, v4 vs m1: 7 / 0, p = 0.0156
- all, v4 vs m2: 14 / 0, p = 0.0001
- no_upstream, v4 vs m1: 7 / 0, p = 0.0156
- no_upstream, v4 vs m2: 14 / 0, p = 0.0001

## Paired bootstrap

macro-F1(V4) - macro-F1(M2), all items: 0.3777, 95% interval [0.2716, 0.5085] (10000 resamples, seed 42).

## Gate

- [PASS] 1 macro-F1 gain >= 0.05 and the 95% interval excludes 0
- [PASS] 2 sti and pregnancy recall not lower than M2's
- [PASS] 3 reply-kind correct rate not lower than M1's and than M2's
- [PASS] 4 app/ unchanged since the frozen model's commit
- **Overall: PASS**

Run the suites and confirm gateway files unchanged.

git diff --stat of app/ against the frozen model's commit 7a1c134208c6dc9a8b55abd9e08bae5b598e36b7:

```
(empty)
```
