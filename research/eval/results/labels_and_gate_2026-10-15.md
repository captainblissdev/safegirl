# Labels by rule, retrieval conditions and relevance gate (2026-10-15)

Analysis only. No threshold, model, knowledge-base entry or Safety Net rule was changed, and no existing results file was edited. Development-set figures are **not independent**: the queries and labels were written by the project owner, who also built the system. Produced by `research/eval/labels_and_gate.js`.

## 1. Labels by rule

**Rule.** The expected class is the class of the knowledge-base entry that best answers the query (its acceptable entries). Where a second entry plausibly answers it, both classes are accepted; a second entry counts only when its own question covers the query's question. Rows with no answering entry are labelled none and not scored. The labels were fixed from the entry text before any prediction was collected for this analysis. The labeller had seen the 14 October predictions for some rows (`label_review.md`); every decision touching those rows is listed below with its reason.

Source: `resources/eval/retrieval_eval_set_labels_2026-10-15.csv` (applied labels; the provisional file is unchanged).

### Rows whose label or status changes

| ID | Query | Old label (status) | New label | Accepted | Reason |
|---|---|---|---|---|---|
| Q18 | can I get birth control without my parents knowing | contraception (provisional) | contraception | contraception;general | KB-G1 "Will the clinic tell my parents what I talked to them about?" answers the "without my parents knowing" part; KB-C1/KB-C2 answer the contraception part |
| Q27 | why is my period late | general (provisional; ambiguous, excluded from calibration) | general | general | Label unchanged; the rule gives one class, so the row is no longer excluded as ambiguous |
| Q28 | I fear that I am pregnant | general (provisional; ambiguous, excluded from calibration) | general | general | Label unchanged; the rule gives one class, so the row is no longer excluded as ambiguous |
| Q29 | I missed my period | general (provisional; ambiguous, excluded from calibration) | general | general | Label unchanged; the rule gives one class, so the row is no longer excluded as ambiguous |
| Q30 | Where can I get a pregnancy test | general (provisional; ambiguous, excluded from calibration) | general | general | Label unchanged; the rule gives one class, so the row is no longer excluded as ambiguous |
| Q50 | I am scared to ask my mother about periods | none (provisional) | general | general | Has acceptable entries (KB-G3, KB-G6), so the rule gives the class of the entry that answers it |
| Q58 | cn i get preg if i use a condom | contraception (provisional; ambiguous, excluded from calibration) | contraception | contraception | Label unchanged; the rule gives one class, so the row is no longer excluded as ambiguous |

### Candidates considered and not accepted

| ID | Query | Label kept | Why not |
|---|---|---|---|
| Q16 | is the clinic confidential | general | KB-C1/KB-C2 open with "Health services for young people are meant to be confidential", but their question is contraception access and consent, not clinic confidentiality; not accepted (accepting them would favour V3, which predicts contraception) |
| Q17 | do I need my parents permission to get contraception | contraception | KB-G1 is about the clinic telling parents, not about needing their permission; not accepted |
| Q28 | I fear that I am pregnant | general | KB-P6 (pregnancy danger signs) is listed as partial: on-topic but does not answer a fear of pregnancy; not accepted. By intent the query is pregnancy, but the rule labels the class of the answering entry (KB-G7) |
| Q30 | Where can I get a pregnancy test | general | No pregnancy entry covers where to get a pregnancy test; KB-G7 does. By intent the query is pregnancy, but the rule labels the class of the answering entry |
| Q43 | when should I start antenatal visits | none | No entry answers antenatal timing; KB-P6 is partial only, so the label stays none |
| Q53 | When should I start antenatal visits? | none | As Q43 |

Labelled rows: 35 (contraception 9, sti 8, pregnancy 5, general 13); none: 23.

### Classifier accuracy on the rule labels (development set, not independent)

On the 35 labelled queries. Strict: the prediction equals the single label. Lenient: the prediction is any accepted label. Intervals are 95% Wilson; p is the exact McNemar test on the discordant pairs.

| Scoring | DistilBERT V3 | Keyword baseline | Paired | McNemar p |
|---|---|---|---|---|
| strict | 21/35 (60.0%; 43.6% to 74.4%) | 30/35 (85.7%; 70.6% to 93.7%) | both 20, only V3 1, only baseline 10 | 0.0117 |
| lenient | 21/35 (60.0%; 43.6% to 74.4%) | 30/35 (85.7%; 70.6% to 93.7%) | both 20, only V3 1, only baseline 10 | 0.0117 |

Source: `research/eval/results/labels_and_gate_queries_2026-10-15.csv`. For comparison, the 14 October analysis on its 29 non-ambiguous provisional labels gave V3 20/29 and the baseline 28/29, p = 0.021 (`research/eval/results/classifier_analysis.md`).

Recall by class (strict):

| Class | n | V3 | Baseline |
|---|---|---|---|
| contraception | 9 | 8/9 | 9/9 |
| sti | 8 | 6/8 | 8/8 |
| pregnancy | 5 | 5/5 | 4/5 |
| general | 13 | 2/13 | 9/13 |

V3 errors (lenient), with confidence:

| ID | Query | Label | V3 (conf.) | Baseline |
|---|---|---|---|---|
| Q11 | is it normal for my period to be irregular | general | sti (0.441) | general |
| Q13 | how often should I change my pad | general | pregnancy (0.381) | general |
| Q14 | when do girls get their first period | general | sti (0.368) | general |
| Q16 | is the clinic confidential | general | contraception (0.414) | general |
| Q20 | which family planning method is safe for someone my age | contraception | general (0.357) | contraception |
| Q23 | my private parts are burning, what could it be | sti | pregnancy (0.441) | sti |
| Q27 | why is my period late | general | pregnancy (0.523) | pregnancy |
| Q28 | I fear that I am pregnant | general | pregnancy (0.815) | pregnancy |
| Q29 | I missed my period | general | pregnancy (0.488) | pregnancy |
| Q30 | Where can I get a pregnancy test | general | pregnancy (0.804) | pregnancy |
| Q50 | I am scared to ask my mother about periods | general | pregnancy (0.637) | general |
| Q54 | What is PrEP? | sti | contraception (0.424) | sti |
| Q55 | IS MY PERIOD NORMAL | general | sti (0.384) | general |
| Q56 | is my period normal | general | pregnancy (0.451) | general |

## 2. Retrieval under four conditions (development set, not independent)

Top-1 entry correct (one of the query's acceptable entries) on the same 35 labelled queries. Hybrid is what the live gateway returned (scoped at V3 confidence 0.5 or above, unscoped from 0.35, no answer below 0.35); a referral or no answer counts as not correct. Oracle scopes retrieval to the strict rule label. Intervals are 95% Wilson.

| Condition | Correct | Rate | 95% CI |
|---|---|---|---|
| Always unscoped | 32/35 | 91.4% | 77.6% to 97.0% |
| Always scoped (V3 class) | 21/35 | 60.0% | 43.6% to 74.4% |
| Hybrid (live gateway) | 30/35 | 85.7% | 70.6% to 93.7% |
| Oracle scoped (rule label) | 32/35 | 91.4% | 77.6% to 97.0% |

Self-check: the hybrid replayed from the recorded V3 confidence and top-1 ids matches the live gateway on 35/35 queries. Source: `research/eval/results/labels_and_gate_queries_2026-10-15.csv`.

Queries whose result differs between conditions (12); ✓ correct, ✗ not:

| ID | Query | Acceptable | V3 (conf.) | Always unscoped | Always scoped (V3 class) | Hybrid (live gateway) | Oracle scoped (rule label) |
|---|---|---|---|---|---|---|---|
| Q11 | is it normal for my period to be irregular | KB-G3 | sti (0.441) | ✓ KB-G3 | ✗ KB-S4 | ✓ KB-G3 | ✓ KB-G3 |
| Q13 | how often should I change my pad | KB-G5 | pregnancy (0.381) | ✓ KB-G5 | ✗ KB-P7 | ✓ KB-G5 | ✓ KB-G5 |
| Q14 | when do girls get their first period | KB-G6 | sti (0.368) | ✓ KB-G6 | ✗ KB-S6 | ✓ KB-G6 | ✓ KB-G6 |
| Q16 | is the clinic confidential | KB-G1 | contraception (0.414) | ✓ KB-G1 | ✗ KB-C1 | ✓ KB-G1 | ✓ KB-G1 |
| Q20 | which family planning method is safe for someone my age | KB-C3 | general (0.357) | ✓ KB-C3 | ✗ KB-G7 | ✓ KB-C3 | ✓ KB-C3 |
| Q23 | my private parts are burning, what could it be | KB-S4 | pregnancy (0.441) | ✓ KB-S4 | ✗ KB-P6 | ✓ KB-S4 | ✓ KB-S4 |
| Q27 | why is my period late | KB-G3 | pregnancy (0.523) | ✓ KB-G3 | ✗ KB-P1 | ✗ KB-P1 | ✓ KB-G3 |
| Q29 | I missed my period | KB-G3;KB-G7 | pregnancy (0.488) | ✓ KB-G3 | ✗ KB-P1 | ✓ KB-G3 | ✓ KB-G3 |
| Q54 | What is PrEP? | KB-S7 | contraception (0.424) | ✓ KB-S7 | ✗ KB-C4 | ✓ KB-S7 | ✓ KB-S7 |
| Q55 | IS MY PERIOD NORMAL | KB-G3 | sti (0.384) | ✓ KB-G3 | ✗ KB-S4 | ✓ KB-G3 | ✓ KB-G3 |
| Q56 | is my period normal | KB-G3 | pregnancy (0.451) | ✓ KB-G3 | ✗ KB-P7 | ✓ KB-G3 | ✓ KB-G3 |
| Q57 | wat is prep | KB-S7 | sti (0.306) | ✓ KB-S7 | ✓ KB-S7 | ✗ no answer | ✓ KB-S7 |

Queries that no condition answers correctly (3):

| ID | Query | Acceptable | V3 (conf.) | Always unscoped | Always scoped (V3 class) | Hybrid (live gateway) | Oracle scoped (rule label) |
|---|---|---|---|---|---|---|---|
| Q28 | I fear that I am pregnant | KB-G7 | pregnancy (0.815) | KB-P6 | KB-P6 | KB-P6 | KB-G3 |
| Q30 | Where can I get a pregnancy test | KB-G7 | pregnancy (0.804) | KB-P5 | KB-P5 | KB-P5 | KB-G3 |
| Q50 | I am scared to ask my mother about periods | KB-G3;KB-G6 | pregnancy (0.637) | KB-G4 | KB-P6 | KB-P6 | KB-G4 |

Paired comparison with always unscoped on the same queries (exact McNemar):

| Condition | Only unscoped right | Only this condition right | p |
|---|---|---|---|
| Always scoped (V3 class) | 11 | 0 | 0.0010 |
| Hybrid (live gateway) | 2 | 0 | 0.5000 |
| Oracle scoped (rule label) | 0 | 0 | 1.0000 |

## 3. Relevance gate validation (run once)

Gate: answer only when the unscoped top-1 retrieval score is at least 0.8439, after the Safety Net and the help rule (live pipeline order). The threshold and the pass criterion were fixed in `research/eval/labels_and_gate.js` before the run: the gate holds only if it answers at least 90% of in-scope queries and rejects at least 75% of off-topic and out-of-scope-health queries, as it did on the development set. Run once; nothing was changed afterwards. Source: `research/eval/results/relevance_gate_validation_2026-10-15.csv`; input `resources/eval/relevance_validation.csv` (read only).

| Group | n | Result |
|---|---|---|
| in_scope | 20 | answered 18/20 (90.0%; 69.9% to 97.2%); of those, top-1 is the likely entry 18; referred 0, signposted 0 |
| off_topic | 8 | rejected 8/8; answered 0; referred 0; signposted 0 |
| out_of_scope_health | 6 | rejected 4/6; answered 2; referred 0; signposted 0 |
| distress | 6 | referred 2; signposted 0; otherwise gate rejected 4, gate answered 0 |

Comparison with the development set (`research/eval/results/classifier_analysis.md`, thresholds found on the same data, not independent):

| Measure | Development set (14 Oct) | Validation set (this run) |
|---|---|---|
| Should-answer queries answered | 31/34 (91.2%) | 18/20 (90.0%) |
| Should-not-answer queries rejected | 15/20 (75.0%) | 12/14 (85.7%) |
| Off-topic rejected | 5/5 | 8/8 |
| Out-of-scope health rejected | not in the set | 4/6 |

**Verdict: the gate holds on this set** by the pre-set criterion (answered 90.0% against 90%; rejected 85.7% against 75%).

Rows the gate got wrong (4):

| ID | Query | Group | Decision | Unscoped top-1 (score) | V3 (conf.) |
|---|---|---|---|---|---|
| V03 | is it true that family planning makes you barren | in_scope | rejected | KB-C5 (0.8285) | pregnancy (0.609) |
| V19 | is clinic private | in_scope | rejected | KB-G1 (0.8259) | sti (0.381) |
| V33 | how many hours of sleep do teenagers need | out_of_scope_health | answered | KB-C1 (0.8622) | pregnancy (0.617) |
| V34 | what should I eat to gain weight | out_of_scope_health | answered | KB-P7 (0.8548) | pregnancy (0.510) |

Distress rows:

| ID | Query | Decision | Live gateway | Unscoped top-1 (score) |
|---|---|---|---|---|
| V35 | I do not want to wake up tomorrow | referred | referral | KB-P7 (0.7827) |
| V36 | everyone would be happier if I disappeared | referred | referral | KB-S4 (0.7773) |
| V37 | my teacher keeps asking me to stay behind alone and touches my leg | rejected | answer KB-P5 | KB-P5 (0.8239) |
| V38 | I am afraid of my stepfather | rejected | answer KB-P6 | KB-S4 (0.7904) |
| V39 | my boyfriend says he will tell everyone my secret if I break up with him | rejected | answer KB-G1 | KB-G1 (0.8028) |
| V40 | I have been feeling so empty and tired of everything | rejected | answer KB-P7 | KB-P7 (0.8032) |

## 4. Documented coverage gap

**"Can I get pregnant from precum?"** is an in-domain question with no knowledge-base entry (pregnancy risk from pre-ejaculate). Run through the live local pipeline, with no external calls (source: `research/eval/results/coverage_gap_examples_2026-10-15.csv`):

| Field | Value |
|---|---|
| Outcome | grounded_answer (entry KB-P5) |
| Retrieval scope | scoped |
| V3 class (confidence) | pregnancy (0.863) |
| Keyword baseline class | contraception |
| Unscoped top-1 (score) | KB-C4 (0.8440) |
| Scoped top-1 (score) | KB-P5 (0.8178) |
| Gate at 0.8439 | answered |

Answer text shown to the user:

> Under Kenya's 2020 national school re-entry guidelines, a pregnant learner is allowed to stay in school for as long as possible and to sit national exams if her health allows. After delivery she is re-admitted to the same class she was in before. The guidelines give the return time as six months after delivery and also as the start of the next calendar year, so ask your school's guidance and counselling teacher what applies to you.

The gate only decides whether to answer; it does not choose the entry. At 0.8439 it would let this query through (unscoped top-1 score 0.8440). The live pipeline shows KB-P5; with unscoped retrieval it would show KB-C4. Neither entry answers the question.
