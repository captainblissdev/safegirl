# V4 sealed evaluation

Frozen model sha256 89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd; labels sha256 99380b532b02f4f41cd7f4cdc4e61b0e96413230a3ff2966ec46ab384f850f39; script sha256 315fa466cebccd655077cea3733461cf8410d9e740b47abf547b22038a84d007; git edf3778c5c0a9c4a1b3835eaab3de706317f24d5.

## Counts

205 items; 163 where no upstream rule fires; 4 flagged ambiguous. Routes: {'none': 185, 'held': 19, 'safety': 1}. Topic labels: {'contraception': 37, 'sti': 37, 'pregnancy': 34, 'general': 48, 'out_of_scope': 26, 'vague': 23}. Upstream fired: {'held_A': 8, 'held_B': 1, 'held_C': 9, 'help': 1, 'referral': 1, 'vague_rule': 22}.

## Classifier level, all items (n = 205)

| | Macro-F1 | STI recall | Pregnancy recall | Confident-wrong | ECE |
|---|---|---|---|---|---|
| V4 | 0.8572 | 0.8378 | 0.9118 | 0.1024 | 0.0919 |
| M1 | 0.5099 | 0.7297 | 0.8529 | n/a | n/a |
| M2 | 0.5864 | 0.7297 | 0.8529 | n/a | n/a |

Per-class precision / recall:

| Class | V4 | M1 | M2 | Support |
|---|---|---|---|---|
| contraception | 0.882 / 0.811 | 0.867 / 0.703 | 0.867 / 0.703 | 37 |
| sti | 0.912 / 0.838 | 1.000 / 0.730 | 1.000 / 0.730 | 37 |
| pregnancy | 0.886 / 0.912 | 0.906 / 0.853 | 0.906 / 0.853 | 34 |
| general | 0.854 / 0.854 | 0.397 / 0.958 | 0.750 / 0.062 | 48 |
| out_of_scope | 0.786 / 0.846 | 0.000 / 0.000 | 0.227 / 0.769 | 26 |
| vague | 0.808 / 0.913 | 0.000 / 0.000 | 0.542 / 0.565 | 23 |

V4 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 30 | 0 | 2 | 1 | 3 | 1 |
| sti | 3 | 31 | 0 | 2 | 1 | 0 |
| pregnancy | 1 | 0 | 31 | 1 | 0 | 1 |
| general | 0 | 1 | 2 | 41 | 2 | 2 |
| out_of_scope | 0 | 1 | 0 | 2 | 22 | 1 |
| vague | 0 | 1 | 0 | 1 | 0 | 21 |

M1 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 26 | 0 | 1 | 10 | 0 | 0 |
| sti | 3 | 27 | 0 | 7 | 0 | 0 |
| pregnancy | 1 | 0 | 29 | 4 | 0 | 0 |
| general | 0 | 0 | 2 | 46 | 0 | 0 |
| out_of_scope | 0 | 0 | 0 | 26 | 0 | 0 |
| vague | 0 | 0 | 0 | 23 | 0 | 0 |

M2 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 26 | 0 | 1 | 0 | 9 | 1 |
| sti | 3 | 27 | 0 | 1 | 6 | 0 |
| pregnancy | 1 | 0 | 29 | 0 | 3 | 1 |
| general | 0 | 0 | 2 | 3 | 40 | 3 |
| out_of_scope | 0 | 0 | 0 | 0 | 20 | 6 |
| vague | 0 | 0 | 0 | 0 | 10 | 13 |

## Classifier level, no upstream rule fires (n = 163)

| | Macro-F1 | STI recall | Pregnancy recall | Confident-wrong | ECE |
|---|---|---|---|---|---|
| V4 | 0.8977 | 0.8857 | 0.9630 | 0.0613 | 0.1120 |
| M1 | 0.5503 | 0.7714 | 0.8889 | n/a | n/a |
| M2 | 0.5301 | 0.7714 | 0.8889 | n/a | n/a |

Per-class precision / recall:

| Class | V4 | M1 | M2 | Support |
|---|---|---|---|---|
| contraception | 0.931 / 0.900 | 0.923 / 0.800 | 0.923 / 0.800 | 30 |
| sti | 0.912 / 0.886 | 1.000 / 0.771 | 1.000 / 0.771 | 35 |
| pregnancy | 0.897 / 0.963 | 0.960 / 0.889 | 0.960 / 0.889 | 27 |
| general | 0.884 / 0.927 | 0.482 / 1.000 | 0.750 / 0.073 | 41 |
| out_of_scope | 0.850 / 0.850 | 0.000 / 0.000 | 0.247 / 1.000 | 20 |
| vague | 1.000 / 0.800 | 0.000 / 0.000 | 0.000 / 0.000 | 10 |

V4 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 27 | 0 | 2 | 0 | 1 | 0 |
| sti | 2 | 31 | 0 | 1 | 1 | 0 |
| pregnancy | 0 | 0 | 26 | 1 | 0 | 0 |
| general | 0 | 1 | 1 | 38 | 1 | 0 |
| out_of_scope | 0 | 1 | 0 | 2 | 17 | 0 |
| vague | 0 | 1 | 0 | 1 | 0 | 8 |

M1 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 24 | 0 | 1 | 5 | 0 | 0 |
| sti | 2 | 27 | 0 | 6 | 0 | 0 |
| pregnancy | 0 | 0 | 24 | 3 | 0 | 0 |
| general | 0 | 0 | 0 | 41 | 0 | 0 |
| out_of_scope | 0 | 0 | 0 | 20 | 0 | 0 |
| vague | 0 | 0 | 0 | 10 | 0 | 0 |

M2 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 24 | 0 | 1 | 0 | 5 | 0 |
| sti | 2 | 27 | 0 | 1 | 5 | 0 |
| pregnancy | 0 | 0 | 24 | 0 | 3 | 0 |
| general | 0 | 0 | 0 | 3 | 38 | 0 |
| out_of_scope | 0 | 0 | 0 | 0 | 20 | 0 |
| vague | 0 | 0 | 0 | 0 | 10 | 0 |

## Reply-kind level

| Subset | n | V4 | M1 | M2 |
|---|---|---|---|---|
| all | 205 | 0.8195 | 0.7610 | 0.6146 |
| no_upstream | 163 | 0.8650 | 0.7914 | 0.6074 |

McNemar exact (discordant counts: V4 right / other wrong, V4 wrong / other right):

- all, v4 vs m1: 25 / 13, p = 0.0730
- all, v4 vs m2: 45 / 3, p = 0.0000
- no_upstream, v4 vs m1: 25 / 13, p = 0.0730
- no_upstream, v4 vs m2: 45 / 3, p = 0.0000

## Descriptive: without the items flagged ambiguous (n = 201; 4 flagged)

Not part of the gate.

| | Macro-F1 | STI recall | Pregnancy recall | Confident-wrong | ECE | Reply-kind correct |
|---|---|---|---|---|---|---|
| V4 | 0.8593 | 0.8333 | 0.9062 | 0.0995 | 0.0894 | 0.8159 |
| M1 | 0.5107 | 0.7222 | 0.8438 | n/a | n/a | 0.7562 |
| M2 | 0.5870 | 0.7222 | 0.8438 | n/a | n/a | 0.6070 |

Discordant counts (V4 right / other wrong, V4 wrong / other right): v4 vs m1 25 / 13; v4 vs m2 45 / 3.

## Paired bootstrap

macro-F1(V4) - macro-F1(M2), all items: 0.2708, 95% interval [0.2148, 0.3282] (10000 resamples, seed 42).

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
