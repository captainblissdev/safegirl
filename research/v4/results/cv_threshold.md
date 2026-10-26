# V4 threshold calibration

Rule: docs/decision-log.md, "V4 threshold rule (2026-10-26)". Pooled out-of-fold predictions of the e5 hybrid at C 10 (380 held-out seeds). The sealed set is not used.

| t | Coverage | Accuracy | Macro-F1 | STI precision | Pregnancy precision | Confident-wrong | Below t | Qualifies |
|---|---|---|---|---|---|---|---|---|
| 0.30 | 0.997 | 0.892 | 0.886 | 0.952 | 0.886 | 0.108 | 1 | no |
| 0.35 (reference) | 0.979 | 0.903 | 0.899 | 0.952 | 0.899 | 0.095 | 8 | no |
| 0.40 | 0.966 | 0.907 | 0.905 | 0.952 | 0.899 | 0.089 | 13 | no |
| 0.45 | 0.934 | 0.921 | 0.925 | 0.952 | 0.908 | 0.074 | 25 | yes |
| 0.50 (reference) | 0.905 | 0.939 | 0.940 | 0.963 | 0.937 | 0.055 | 36 | yes |
| 0.55 | 0.884 | 0.943 | 0.948 | 0.963 | 0.933 | 0.050 | 44 | yes |
| 0.60 | 0.858 | 0.963 | 0.971 | 0.974 | 0.932 | 0.032 | 54 | yes |
| 0.65 | 0.813 | 0.964 | 0.972 | 0.973 | 0.931 | 0.029 | 71 | yes |
| 0.70 | 0.768 | 0.962 | 0.971 | 0.971 | 0.926 | 0.029 | 88 | yes |

t_act = **0.45** (the smallest qualifying t).
