# V4 post-gate descriptive comparison with V3

Descriptive only; no decision depends on it.

V3 checkpoint sha256 e8bf2e3aa01c920197b51071e736ef6a3d1f16a57dd8d3bdb1565f75152cfb30; V4 frozen model sha256 89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd; labels sha256 99380b532b02f4f41cd7f4cdc4e61b0e96413230a3ff2966ec46ab384f850f39; script sha256 c90459e42fed488a4c15c7518e8cbe495665f635563853a6adcf784e7acfd1a7; git 26925494d483924237f5179ab3bdd12aa727d9c0.

## Counts

205 items; 156 with a topic label in V3's four classes; 133 of those where no upstream rule fires. Topic labels: {'contraception': 37, 'sti': 37, 'pregnancy': 34, 'general': 48, 'out_of_scope': 26, 'vague': 23}.

## four-class items (n = 156)

| | Accuracy | Macro-F1 (4) | Confident-wrong | ECE |
|---|---|---|---|---|
| V3 | 0.6090 | 0.5984 | 0.1538 | 0.1113 |
| V4 as is | 0.8526 | 0.8810 | 0.1154 | 0.0855 |
| V4 restricted | 0.8718 | 0.8727 | 0.0962 | 0.0694 |

V3 abstain rate at 0.35: 0.0128.

Per-class precision / recall:

| Class | V3 | V4 as is | V4 restricted | Support |
|---|---|---|---|---|
| contraception | 0.781 / 0.676 | 0.882 / 0.811 | 0.886 / 0.838 | 37 |
| sti | 0.578 / 0.703 | 0.969 / 0.838 | 0.861 / 0.838 | 37 |
| pregnancy | 0.508 / 0.941 | 0.886 / 0.912 | 0.889 / 0.941 | 34 |
| general | 0.750 / 0.250 | 0.911 / 0.854 | 0.857 / 0.875 | 48 |

V3 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general |
|---|---|---|---|---|
| contraception | 25 | 4 | 7 | 1 |
| sti | 4 | 26 | 4 | 3 |
| pregnancy | 0 | 2 | 32 | 0 |
| general | 3 | 13 | 20 | 12 |

V4 as is confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 30 | 0 | 2 | 1 | 3 | 1 |
| sti | 3 | 31 | 0 | 2 | 1 | 0 |
| pregnancy | 1 | 0 | 31 | 1 | 0 | 1 |
| general | 0 | 1 | 2 | 41 | 2 | 2 |

V4 restricted confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general |
|---|---|---|---|---|
| contraception | 31 | 1 | 2 | 3 |
| sti | 3 | 31 | 0 | 3 |
| pregnancy | 1 | 0 | 32 | 1 |
| general | 0 | 4 | 2 | 42 |

McNemar exact on correct/incorrect (V4 right and V3 wrong / V4 wrong and V3 right):

- v4 as is vs v3: 47 / 9, p = 0.0000
- v4 restricted vs v3: 48 / 7, p = 0.0000

## four-class items, no upstream rule fires (n = 133)

| | Accuracy | Macro-F1 (4) | Confident-wrong | ECE |
|---|---|---|---|---|
| V3 | 0.6241 | 0.6157 | 0.1429 | 0.0990 |
| V4 as is | 0.9173 | 0.9269 | 0.0602 | 0.1040 |
| V4 restricted | 0.9248 | 0.9251 | 0.0526 | 0.0676 |

V3 abstain rate at 0.35: 0.0150.

Per-class precision / recall:

| Class | V3 | V4 as is | V4 restricted | Support |
|---|---|---|---|---|
| contraception | 0.741 / 0.667 | 0.931 / 0.900 | 0.933 / 0.933 | 30 |
| sti | 0.610 / 0.714 | 0.969 / 0.886 | 0.939 / 0.886 | 35 |
| pregnancy | 0.510 / 0.963 | 0.897 / 0.963 | 0.897 / 0.963 | 27 |
| general | 0.857 / 0.293 | 0.950 / 0.927 | 0.927 / 0.927 | 41 |

V3 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general |
|---|---|---|---|---|
| contraception | 20 | 3 | 7 | 0 |
| sti | 4 | 25 | 4 | 2 |
| pregnancy | 0 | 1 | 26 | 0 |
| general | 3 | 12 | 14 | 12 |

V4 as is confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 27 | 0 | 2 | 0 | 1 | 0 |
| sti | 2 | 31 | 0 | 1 | 1 | 0 |
| pregnancy | 0 | 0 | 26 | 1 | 0 | 0 |
| general | 0 | 1 | 1 | 38 | 1 | 0 |

V4 restricted confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general |
|---|---|---|---|---|
| contraception | 28 | 0 | 2 | 0 |
| sti | 2 | 31 | 0 | 2 |
| pregnancy | 0 | 0 | 26 | 1 |
| general | 0 | 2 | 1 | 38 |

McNemar exact on correct/incorrect (V4 right and V3 wrong / V4 wrong and V3 right):

- v4 as is vs v3: 43 / 4, p = 0.0000
- v4 restricted vs v3: 43 / 3, p = 0.0000

## Paired bootstrap, four-class items

- v4 as is minus v3: 0.2826, 95% interval [0.2029, 0.3643]
- v4 restricted minus v3: 0.2743, 95% interval [0.1943, 0.3569]

(10000 resamples, seed 42.)

## Reply-kind correct rate

V3: upstream rules first, then confidence < 0.35 -> abstain, otherwise answer. V4 as in triage_sim.

| Subset | n | V3 | V4 |
|---|---|---|---|
| all | 205 | 0.7561 | 0.8195 |
| no_upstream | 163 | 0.7853 | 0.8650 |
