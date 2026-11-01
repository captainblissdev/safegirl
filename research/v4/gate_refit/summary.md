# Gate refit under V4 routing (development only)

Pre-registration: docs/decision-log.md, "Gate refit under V4 routing (PRE-REGISTRATION)", 2026-11-01. Development evidence, not a test; no gate is chosen or deployed. Ids and counts only.

Items: 157 development items (dev 35, gate 40, fresh 82); scored 150 (not scored: V16 (same text as Q13); V35 (distress (referral)); V36 (distress (referral)); V37 (distress (referral)); V38 (distress (referral)); V39 (distress (referral)); V40 (distress (referral))). Bases: KB-21 full mode, KB-62 question mode (kb/merge-60 9ae43bb). Routing: V4 triage, gateway order, id 57c6a5b638ab; the same routing is asserted for every fit and evaluation.

Routes of the scored items (same for both bases): clarify 0, held 7, help 1, referral 0, retrieve_scoped 104, retrieve_unscoped 3, v4_abstain 15, vague 20.

Fresh-test reproduction before scoring: (a) on KB-21 (17, 21, 38, 6) = arm A; frozen gate v2 on KB-62 (24, 29, 21, 8) = arm B (correct, wrong served, correct abstain or ask, missed).

## Leave-one-out counts

| Base | Cand. | Gate | Correct | Wrong served | Correct abstain/ask | Missed | Served correct | Gate abstains (of retrieved) | Rank |
|---|---|---|---|---|---|---|---|---|---|
| kb21 | a | current gate: top-1 >= 0.8439 | 61 | 26 | 51 | 12 | 0.701 | 20 of 107 | 8 |
| kb21 | b | top-1, threshold refitted | 52 | 20 | 54 | 24 | 0.722 | 35 of 107 | 7 |
| kb21 | c | top-1 + margin | 54 | 15 | 57 | 24 | 0.783 | 38 of 107 | 1 |
| kb21 | d | top-1 + V4 top probability | 55 | 16 | 57 | 22 | 0.775 | 36 of 107 | 4 |
| kb21 | e | top-1 + margin + V4 top probability | 53 | 15 | 57 | 25 | 0.779 | 39 of 107 | 2 |
| kb21 | f | top-1 + margin + agreement (V4 vs unscoped top-1) | 58 | 18 | 56 | 18 | 0.763 | 31 of 107 | 6 |
| kb21 | g | (f) + V4 top probability | 58 | 16 | 57 | 19 | 0.784 | 33 of 107 | 3 |
| kb21 | h | live entry score + gap to top-1 | 59 | 17 | 57 | 17 | 0.776 | 31 of 107 | 5 |
| kb62 | a | current gate: top-1 >= 0.8439 | 56 | 20 | 43 | 31 | 0.737 | 31 of 107 | 5 |
| kb62 | b | top-1, threshold refitted | 67 | 36 | 35 | 12 | 0.650 | 4 of 107 | 8 |
| kb62 | c | top-1 + margin | 53 | 18 | 42 | 37 | 0.747 | 36 of 107 | 4 |
| kb62 | d | top-1 + V4 top probability | 59 | 22 | 41 | 28 | 0.728 | 26 of 107 | 7 |
| kb62 | e | top-1 + margin + V4 top probability | 58 | 17 | 42 | 33 | 0.773 | 32 of 107 | 3 |
| kb62 | f | top-1 + margin + agreement (V4 vs unscoped top-1) | 65 | 17 | 44 | 24 | 0.793 | 25 of 107 | 2 |
| kb62 | g | (f) + V4 top probability | 62 | 14 | 44 | 30 | 0.816 | 31 of 107 | 1 |
| kb62 | h | live entry score + gap to top-1 | 58 | 21 | 42 | 29 | 0.734 | 28 of 107 | 6 |

Rank: the pre-registered reporting rule within each base (fewest wrong answers served, then most correct answers, then the earlier letter). Reporting only.

## Constant signals

- kb21, retrieved items (n = 107): constant: none; distinct values agree 2, agree_live 2, v4_class 4; items at 0: agree 20, agree_live 2, gap 89.
- kb21, scoped items (n = 104): constant: agree_live; distinct values agree 2, agree_live 1, v4_class 4; items at 0: agree 18, agree_live 0, gap 86.
- kb62, retrieved items (n = 107): constant: none; distinct values agree 2, agree_live 2, v4_class 4; items at 0: agree 17, agree_live 1, gap 91.
- kb62, scoped items (n = 104): constant: agree_live; distinct values agree 2, agree_live 1, v4_class 4; items at 0: agree 16, agree_live 0, gap 88.

agree_live (V4 class against the served entry's class, gate v2's signal) is constant on scoped items and varies only on the unscoped ones; gap (h) is 0 whenever the served entry is the unscoped top-1.

## Against the current gate on KB-62

(a) serves 20 wrong answers on KB-62. Candidates serving fewer: c, e, f, g.
