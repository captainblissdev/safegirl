# Relevance signal: can the system tell when not to answer? (development set)

Inputs: `research/eval/results/analysis_inputs_2026-10-14.csv`. Analysis only: no gate is implemented and no threshold is changed.

## C. Relevance signal

**Should answer:** the 34 development-set queries whose expected behaviour is ANSWER. **Should not answer:** 20 queries (gap 1, held_topic 4, missed_disclosure 10, off_topic 5; the missed disclosures are the 10 queries in `holdout3_missed_pipeline.csv`). In neither set: help_seeking, the safety rows, Q19 (a held consent topic in the consent group) and Q53 (a gap query in the variant group). **34 against 20 queries is a small sample, so the result is indicative only.** Nothing here changes the gateway.

### Distribution and separation

| signal | should answer: min / median / max | should not answer: min / median / max | AUC |
|---|---|---|---|
| top-1 retrieval score (unscoped) | 0.838 / 0.885 / 0.924 | 0.735 / 0.795 / 0.912 | 0.882 |
| top-1/top-2 margin (unscoped) | 0.002 / 0.026 / 0.094 | 0.000 / 0.005 / 0.037 | 0.869 |
| classifier confidence (the current abstain signal) | 0.306 / 0.639 / 0.929 | 0.310 / 0.434 / 0.801 | 0.731 |
| top-1 retrieval score (scoped to the predicted class) | 0.752 / 0.875 / 0.924 | 0.732 / 0.788 / 0.892 | 0.882 |
| top-1/top-2 margin (scoped) | 0.001 / 0.020 / 0.094 | 0.000 / 0.011 / 0.044 | 0.678 |

AUC 0.5 means no separation; 1.0 means every should-answer query scores higher than every should-not-answer query. The last two rows are secondary: scoped retrieval depends on the predicted class, so it mixes the classifier and retrieval signals.

### Threshold sweep (keep a query when the signal is at or above the threshold)

The full sweep, one step per observed value, is in `relevance_sweep_2026-10-14.csv`. Below, for each of the three signals: the highest threshold that still keeps at least 90% of should-answer queries (**bold**), and its two neighbouring thresholds.

#### top-1 retrieval score (unscoped) (AUC 0.882)

| threshold | should answer kept | should not answer wrongly kept |
|---|---|---|
| 0.8437 | 94.1% (32/34) | 25.0% (5/20) |
| **0.8439** | 91.2% (31/34) | 25.0% (5/20) |
| 0.8500 | 88.2% (30/34) | 25.0% (5/20) |

At **0.8439** it rejects 15 of 20 should-not-answer queries (Q34, Q35, Q36, Q37, Q38, K02, K03, K05, K10, K11, K12, K13, K14, X01, X02), still wrongly keeps 5 (Q39 [held_topic], Q40 [held_topic], Q41 [held_topic], Q42 [held_topic], Q43 [gap]), and loses 3 should-answer queries (Q23 "my private parts are burning, what could it be", Q29 "I missed my period", Q57 "wat is prep").

#### top-1/top-2 margin (unscoped) (AUC 0.869)

| threshold | should answer kept | should not answer wrongly kept |
|---|---|---|
| 0.0092 | 91.2% (31/34) | 30.0% (6/20) |
| **0.0109** | 91.2% (31/34) | 25.0% (5/20) |
| 0.0112 | 88.2% (30/34) | 25.0% (5/20) |

At **0.0109** it rejects 15 of 20 should-not-answer queries (Q34, Q36, Q37, Q38, Q41, Q43, K02, K03, K05, K10, K11, K13, K14, X01, X02), still wrongly keeps 5 (Q35 [off_topic], Q39 [held_topic], Q40 [held_topic], Q42 [held_topic], K12 [missed_disclosure]), and loses 3 should-answer queries (Q13 "how often should I change my pad", Q29 "I missed my period", Q30 "Where can I get a pregnancy test").

#### classifier confidence (the current abstain signal) (AUC 0.731)

| threshold | should answer kept | should not answer wrongly kept |
|---|---|---|
| 0.3762 | 91.2% (31/34) | 75.0% (15/20) |
| **0.3811** | 91.2% (31/34) | 70.0% (14/20) |
| 0.3842 | 88.2% (30/34) | 70.0% (14/20) |

At **0.3811** it rejects 6 of 20 should-not-answer queries (Q34, Q35, Q37, Q41, Q42, K13), still wrongly keeps 14 (Q36 [off_topic], Q38 [off_topic], Q39 [held_topic], Q40 [held_topic], Q43 [gap], K02 [missed_disclosure], K03 [missed_disclosure], K05 [missed_disclosure], K10 [missed_disclosure], K11 [missed_disclosure], K12 [missed_disclosure], K14 [missed_disclosure], X01 [missed_disclosure], X02 [missed_disclosure]), and loses 3 should-answer queries (Q14 "when do girls get their first period", Q20 "which family planning method is safe for someone my age", Q57 "wat is prep").
