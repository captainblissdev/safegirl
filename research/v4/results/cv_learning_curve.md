# V4 learning curve (e5 hybrid, C 10)

Seed-level, class-stratified subsampling of the training folds (random seed 20261026, nested sizes); paraphrases follow their seeds; scored on the held-out fold seeds.

| Training seeds | Mean seeds per class | Mean training rows | Macro-F1 mean +/- sd | Fold 1 | Fold 2 | Fold 3 | Fold 4 | Fold 5 |
|---|---|---|---|---|---|---|---|---|
| 20% | 10.1 | 263 | 0.8050 +/- 0.0238 | 0.7989 | 0.8081 | 0.8074 | 0.7719 | 0.8385 |
| 40% | 20.1 | 513 | 0.8549 +/- 0.0457 | 0.8421 | 0.9187 | 0.8681 | 0.7921 | 0.8534 |
| 60% | 30.5 | 775 | 0.8682 +/- 0.0461 | 0.8373 | 0.9303 | 0.8590 | 0.8162 | 0.8980 |
| 80% | 40.5 | 1028 | 0.8750 +/- 0.0575 | 0.8572 | 0.9490 | 0.8970 | 0.7918 | 0.8799 |
| 100% | 50.7 | 1295 | 0.8835 +/- 0.0507 | 0.8467 | 0.9390 | 0.8970 | 0.8167 | 0.9181 |

Mean seeds per class at each size:

| Training seeds | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| 20% | 12.0 | 13.0 | 12.0 | 14.8 | 5.0 | 4.0 |
| 40% | 24.0 | 26.0 | 24.0 | 29.0 | 9.2 | 8.6 |
| 60% | 36.8 | 39.6 | 36.0 | 43.8 | 14.0 | 13.0 |
| 80% | 48.8 | 52.6 | 48.0 | 58.0 | 18.2 | 17.6 |
| 100% | 60.8 | 65.6 | 60.0 | 72.8 | 23.2 | 21.6 |
