# KB scale validation: fresh test result (28 October 2026)

One run of `research/eval/fresh_test_run.py` on `fresh_test_v1.csv` (82 questions) with the locked labels. Arm A: the 21-entry base, full mode, gate 0.8439. Arm B: the 62-entry base, question mode, frozen gate_v2. Both with V4 triage, in the gateway's order. Counts and source row numbers only; no question text.

Run lock: started 2026-10-28T11:01:27.882898+00:00; labels SHA-256 71B7BD8F79ECACB4D6BDD5CFD31CA92604479D928E51F3B474E645975CB4E6B1; fresh 667A547C06CDF6B097061D6F096A1585339B3193F439240D98BC202036157C54; gate_v2 ad6895a120b538e4cc751ebe4de8944aace640c268e0013f981d29ceabe4bafc; V4 89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd; 21-entry KB e78a82afd10491fdc81d98bb2fca43119312be6908af7c4372ee2778d9dc1e30; 62-entry KB 1b53efad82587063462d24efa9a436c2e20df007ad86b8623429b73a12885ff0.

## Outcomes per arm

| Outcome | Arm A (21 entries) | Arm B (62 entries) |
|---|---|---|
| Correct answer | 17 | 24 |
| Wrong answer served | 21 | 29 |
| Correct abstain or ask | 38 | 21 |
| Missed answer | 6 | 8 |

Questions with an acceptable entry: arm A 33 (labelled entries present in the 21-entry base), arm B 51; a question with none is expected to abstain.

## Criteria (pre-registration item 7, test-arms amendment)

| Criterion | Arm A | Arm B | Paired | Result |
|---|---|---|---|---|
| (a) correct answers with the 62 at least those of the 21 | 17 | 24 | both 13, arm A only 4, arm B only 11, neither 54; exact McNemar p 0.118 | PASS |
| (b) wrong answers served with the 62 no more than with the 21 | 21 | 29 | both 13, arm A only 8, arm B only 16, neither 45; exact McNemar p 0.152 | FAIL |
| (c) off-topic and vague questions abstained or asked at least as often (14 questions) | 14 | 13 | both 13, arm A only 1, arm B only 0, neither 0; exact McNemar p 1.000 | FAIL |
| (d) safety, held-topic and help tests pass; V4 hash unchanged | – | tests: fail 0; V4 hash unchanged: True | – | PASS |

**Verdict (pre-registered rule): the demo stays on 21 entries.**

## Per group

Each cell: correct answer / wrong answer served / correct abstain or ask / missed answer.

| Group | Questions | Arm A | Arm B |
|---|---|---|---|
| Clinics, privacy, cost | 8 | 3 / 2 / 0 / 3 | 5 / 2 / 0 / 1 |
| Contraception | 12 | 2 / 3 / 7 / 0 | 6 / 3 / 1 / 2 |
| Not about reproductive health at all | 10 | 0 / 0 / 10 / 0 | 0 / 1 / 9 / 0 |
| Periods, puberty, hygiene | 6 | 3 / 1 / 0 / 2 | 3 / 2 / 0 / 1 |
| Pregnancy | 10 | 3 / 3 / 4 / 0 | 1 / 6 / 0 / 3 |
| Relationships and consent | 7 | 1 / 0 / 6 / 0 | 1 / 3 / 3 / 0 |
| Reproductive health, but unusual or specialised | 15 | 0 / 7 / 7 / 1 | 2 / 8 / 4 / 1 |
| STIs and HIV | 10 | 5 / 5 / 0 / 0 | 6 / 4 / 0 / 0 |
| Too vague to answer | 4 | 0 / 0 / 4 / 0 | 0 / 0 / 4 / 0 |

## Routing (same in both arms)

Before retrieval: held topic 5, vague rule 9, help 1, referral 0, V4 clarify 0, V4 abstain 13. Retrieved: 51 scoped, 3 unscoped.

Rows: held 5, 8, 11, 31, 32; vague 58, 69, 79, 81, 86, 89, 96, 97, 99; v4_abstain 36, 47, 57, 62, 71, 83, 84, 85, 87, 88, 90, 91, 92; help 95.

Gate abstained on retrieved questions (54): arm A 16, arm B 1.
