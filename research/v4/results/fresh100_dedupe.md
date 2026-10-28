# Fresh question set: duplicate check (28 October 2026)

`fresh100.csv` (outside the repository), SHA-256 `8C7F0757A29B3F3ABE3DC2FEA9E5159985EFC42B8BA7CE549437FEA2A29E01FC` (as expected). 100 rows, 0 blank, 0 exact duplicates and 0 pairs at cosine 0.95 or above within the set (41 pairs at 0.90 or above). Rows are data row numbers (1 to 100). Embedding: intfloat/multilingual-e5-small, 'query: ' prefix on both sides, cosine of normalised vectors. Exact duplicates: lowercased, punctuation stripped. Counts, ids and row numbers only; no question text.

## Nearest neighbour per source

| Source | Rows at cosine >= 0.90 | Rows at cosine >= 0.95 | Highest cosine | Exact duplicates |
|---|---|---|---|---|
| Sealed 205 | 53 | 12 (10, 13, 21, 29, 30, 33, 44, 50, 52, 94, 98, 100) | 1.0 | 1 (row 94 = FS-156) |
| Dev questions (35) | 24 | 4 (22, 28, 30, 52) | 0.9728 | 0 |
| Gate set (40) | 17 | 1 (52) | 0.957 | 0 |
| V4 seeds (380) | 54 | 0 (none) | 0.9499 | 0 |
| V4 paraphrases (1,239) | 55 | 4 (10, 15, 37, 60) | 0.9618 | 0 |
| DR-04 (31) | 7 | 0 (none) | 0.9372 | 0 |
| KB entry questions (62) | 17 | 2 (10, 51) | 0.9662 | 0 |

Rows at cosine >= 0.90, per source:

- Sealed 205: 1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 21, 22, 23, 25, 27, 29, 30, 31, 32, 33, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48, 50, 51, 52, 60, 62, 67, 68, 82, 83, 86, 94, 95, 96, 97, 98, 100
- Dev questions (35): 1, 3, 15, 22, 28, 29, 30, 31, 37, 40, 42, 43, 44, 45, 46, 47, 48, 51, 52, 61, 62, 67, 70, 82
- Gate set (40): 1, 2, 15, 17, 22, 28, 29, 30, 42, 43, 44, 48, 50, 51, 52, 62, 86
- V4 seeds (380): 1, 2, 3, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 21, 23, 24, 25, 27, 28, 29, 30, 31, 33, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48, 51, 52, 53, 55, 60, 61, 62, 63, 65, 68, 83, 90, 93, 94, 95, 96, 97, 100
- V4 paraphrases (1,239): 1, 2, 3, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 21, 23, 24, 25, 29, 30, 31, 33, 36, 37, 38, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 52, 53, 55, 60, 61, 63, 65, 67, 68, 82, 90, 93, 94, 95, 96, 97, 98, 99, 100
- DR-04 (31): 1, 2, 11, 17, 21, 29, 33
- KB entry questions (62): 1, 7, 8, 10, 17, 18, 19, 25, 30, 33, 37, 43, 44, 51, 61, 62, 68

## Pairs at cosine >= 0.95

| Fresh row | Source | Neighbour | Cosine |
|---|---|---|---|
| 10 | Sealed 205 | FS-023 | 0.974 |
| 13 | Sealed 205 | FS-082 | 0.9694 |
| 21 | Sealed 205 | FS-092 | 0.953 |
| 29 | Sealed 205 | FS-108 | 0.967 |
| 30 | Sealed 205 | FS-201 | 0.9501 |
| 33 | Sealed 205 | FS-115 | 0.9683 |
| 44 | Sealed 205 | FS-123 | 0.9877 |
| 50 | Sealed 205 | FS-135 | 0.9786 |
| 52 | Sealed 205 | FS-126 | 0.9585 |
| 94 | Sealed 205 | FS-156 | 1.0 |
| 98 | Sealed 205 | FS-016 | 0.9502 |
| 100 | Sealed 205 | FS-040 | 0.9535 |
| 22 | Dev questions (35) | Q05 | 0.9552 |
| 28 | Dev questions (35) | Q07 | 0.9728 |
| 30 | Dev questions (35) | Q27 | 0.9558 |
| 52 | Dev questions (35) | Q13 | 0.957 |
| 52 | Gate set (40) | V16 | 0.957 |
| 10 | V4 paraphrases (1,239) | SEED-PREG-18-P1 | 0.9618 |
| 15 | V4 paraphrases (1,239) | SEED-V4-STI-010-P2 | 0.9529 |
| 37 | V4 paraphrases (1,239) | SEED-V4-PREG-018-P4 | 0.9503 |
| 60 | V4 paraphrases (1,239) | SEED-GEN-17-P4 | 0.9608 |
| 10 | KB entry questions (62) | KB-C11 | 0.9662 |
| 51 | KB entry questions (62) | KB-G14 | 0.9517 |

## Rows to review

- Exact duplicate in any source: 1 (row 94).
- Cosine >= 0.95 in any source: 18 rows (10, 13, 15, 21, 22, 28, 29, 30, 33, 37, 44, 50, 51, 52, 60, 94, 98, 100).
