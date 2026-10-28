# P3 residual errors on 68 items (28 October 2026)

Descriptive only. The winner P3's leave-one-out errors on the 68 scored development items (V16 counted with Q13): 6 wrong answers served and 5 missed answers. Same format as `p3_residual.md`; ids and numbers only.

| Id | Outcome | Acceptable | Route | Served / top entry (class) | Best acceptable (rank, unscoped / served list) | Top-1 score | Margin | Gate probability | V4 class, agrees | Cause |
|---|---|---|---|---|---|---|---|---|---|---|
| Q03 | wrong answer | KB-C5;KB-C9 | scoped (V3 contraception 0.555) | KB-C18 (contraception) | KB-C5 (2 / 2) | 0.8675 | 0.0135 | 0.844 | contraception, yes | a |
| Q13 | wrong answer | KB-G5 | unscoped (V3 pregnancy 0.381) | KB-G9 (general) | KB-G5 (9 / 9) | 0.8538 | 0.0001 | 0.7164 | general, yes | a |
| Q27 | missed answer | KB-G3;KB-P8 | held (V3 pregnancy 0.523) | – | – | – | – | – | general 0.784 | e |
| Q29 | missed answer | KB-P8;KB-G3 | held (V3 pregnancy 0.488) | – | – | – | – | – | pregnancy 0.435 | e |
| Q55 | wrong answer | KB-G3 | unscoped (V3 sti 0.384) | KB-G14 (general) | KB-G3 (2 / 2) | 0.8785 | 0.0019 | 0.7775 | general, yes | a |
| Q57 | missed answer | KB-S7 | v3_abstain (V3 sti 0.306) | – | – | – | – | – | sti 0.889 | e |
| V02 | missed answer | KB-C3;KB-C18 | v3_abstain (V3 sti 0.312) | – | – | – | – | – | contraception 0.666 | e |
| V03 | missed answer | KB-C5 | scoped (V3 pregnancy 0.609) | KB-P6 (pregnancy) | KB-C5 (1 / not in class) | 0.8197 | 0.0123 | 0.3689 | contraception, no | b |
| V12 | wrong answer | KB-G3;KB-G6 | unscoped (V3 pregnancy 0.376) | KB-G14 (general) | KB-G3 (2 / 2) | 0.872 | 0.0016 | 0.7606 | general, yes | a |
| V14 | wrong answer | KB-G6;KB-G14 | unscoped (V3 general 0.359) | KB-G11 (general) | KB-G6 (2 / 2) | 0.8832 | 0.0029 | 0.7971 | general, yes | a |
| V18 | wrong answer | KB-G3 | unscoped (V3 contraception 0.413) | KB-G14 (general) | KB-G3 (2 / 2) | 0.8732 | 0.014 | 0.8555 | general, yes | a |

| Cause | Count | Items | What kind of change could help |
|---|---|---|---|
| a: crowded neighbour, same class | 6 | Q03, Q13, Q55, V12, V14, V18 | the reranker did not help (P6 and P7 scored below P0); resolving near-duplicate entries (KB text change, clinician decision) or a stronger, domain-matched reranker; gate features help little (V4 agrees, gate probability 0.72 to 0.86) |
| b: neighbour of another class / scoping | 1 | V03 | not the gate or ranking: V4 routing, as in the registered test arms |
| c: gate wrong with the right entry on top | 0 | none | none observed |
| d: no good entry (labelling doubt) | 0 | none | none on this reading |
| e: other (routing) | 4 | Q27, Q29, Q57, V02 | held topics: nothing (by design); V3 abstains: V4 routing as in the test arms |
