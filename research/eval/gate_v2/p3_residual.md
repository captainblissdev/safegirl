# P3 residual errors (28 October 2026)

Descriptive only. P3's leave-one-out errors on the 69 scored development items: 7 wrong answers served and 5 missed answers. Recomputed with the unchanged `gate_candidates.py` (each item's own fold model) and matched to `selection.json`. Ids and numbers only.

## Errors

| Id | Outcome | Acceptable | Route | Served / top entry (class) | Best acceptable (rank, unscoped / served list) | Top-1 score | Margin | Gate probability | V4 class, agrees | Cause |
|---|---|---|---|---|---|---|---|---|---|---|
| Q03 | wrong answer | KB-C5;KB-C9 | scoped (V3 contraception 0.555) | KB-C18 (contraception) | KB-C5 (2 / 2) | 0.8675 | 0.0135 | 0.825 | contraception, yes | a |
| Q13 | wrong answer | KB-G5 | unscoped (V3 pregnancy 0.381) | KB-G9 (general) | KB-G5 (9 / 9) | 0.8538 | 0.0001 | 0.6649 | general, yes | a |
| Q27 | missed answer | KB-G3;KB-P8 | held (V3 pregnancy 0.523) | – | – | – | – | – | general 0.784 | e |
| Q29 | missed answer | KB-P8;KB-G3 | held (V3 pregnancy 0.488) | – | – | – | – | – | pregnancy 0.435 | e |
| Q55 | wrong answer | KB-G3 | unscoped (V3 sti 0.384) | KB-G14 (general) | KB-G3 (2 / 2) | 0.8785 | 0.0019 | 0.7436 | general, yes | a |
| Q57 | missed answer | KB-S7 | v3_abstain (V3 sti 0.306) | – | – | – | – | – | sti 0.889 | e |
| V02 | missed answer | KB-C3;KB-C18 | v3_abstain (V3 sti 0.312) | – | – | – | – | – | contraception 0.666 | e |
| V03 | missed answer | KB-C5 | scoped (V3 pregnancy 0.609) | KB-P6 (pregnancy) | KB-C5 (1 / not in class) | 0.8197 | 0.0123 | 0.3693 | contraception, no | b |
| V12 | wrong answer | KB-G3;KB-G6 | unscoped (V3 pregnancy 0.376) | KB-G14 (general) | KB-G3 (2 / 2) | 0.872 | 0.0016 | 0.7228 | general, yes | a |
| V14 | wrong answer | KB-G6;KB-G14 | unscoped (V3 general 0.359) | KB-G11 (general) | KB-G6 (2 / 2) | 0.8832 | 0.0029 | 0.7676 | general, yes | a |
| V16 | wrong answer | KB-G5;KB-G16 | unscoped (V3 pregnancy 0.381) | KB-G9 (general) | KB-G5 (9 / 9) | 0.8538 | 0.0001 | 0.6649 | general, yes | a |
| V18 | wrong answer | KB-G3 | unscoped (V3 contraception 0.413) | KB-G14 (general) | KB-G3 (2 / 2) | 0.8732 | 0.014 | 0.8393 | general, yes | a |

## Causes

| Cause | Count | Items | What kind of change could help |
|---|---|---|---|
| a: crowded neighbour, same class | 7 | Q03, Q13, Q55, V12, V14, V16, V18 | a reranker or resolving near-duplicate entries (KB text change, clinician decision); gate features help little (V4 agrees, gate probability 0.66 to 0.84); more calibration data might help low-margin cases |
| b: neighbour of another class | 1 | V03 | not the gate or ranking: V4 routing (as in the registered test arms, V4 contraception 0.829) would retrieve in the right class |
| c: gate too lenient or strict, right entry on top | 0 | none | none observed |
| d: no good entry (labelling doubt) | 0 | none | labelling review only if a clinician thinks an entry should be accepted; none needed on this reading |
| e: other | 4 | Q27, Q29, Q57, V02 | held topics: nothing (by design; whether they should expect an answer is a labelling question); V3 abstains: V4 routing as in the test arms would retrieve |

Q13 and V16 have the same question text, so one error is counted twice.

## Labelling notes

- Q13/V16: no entry gives a pad-changing frequency; KB-G5 says to change the pad regularly, KB-G9 only says to change a tampon often. The acceptable set is not narrow, but no entry fully answers.
- Q55/V12/V18: KB-G14 notes that periods may not come regularly in the first few years, but it is framed for periods that have not started; the acceptable sets do not look narrow.
- V14: KB-G11 says periods start at puberty without an age; KB-G6 and KB-G14 give ages; not narrow.
