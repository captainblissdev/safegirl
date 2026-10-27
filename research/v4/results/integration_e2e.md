# V4 integration, end to end

Synthetic warm-up query, the 58 dev queries and the 380 V4 training seeds; ids only. Seeds are training data: the route comparison is an equivalence check, not an accuracy claim. Nothing was tuned.

## Startup, memory and latency

| | Flag off | Flag on |
|---|---|---|
| ml_service startup (s) | 24.44 | 26.19 |
| gateway startup (s) | 1.06 | 1.09 |
| ml_service memory after startup (MB) | 989.3 | 1377.9 |
| ml_service memory after queries (MB) | 1168.0 | 1388.8 |
| gateway memory after queries (MB) | 78.9 | 126.6 |
| first request (ms) | 569.3 | 211.6 |
| dev queries, median (ms) | 87.0 | 95.7 |
| dev queries, 95th percentile (ms) | 140.3 | 137.5 |
| dev queries, max (ms) | 154.6 | 179.7 |

e5 tensor check at startup (flag on only): median 0.81 s over 3 runs; result: match.

The flag-off run goes first, so it starts from a colder disk cache: its startup and first request include that, and the startup difference between the two runs is not the cost of V4. The e5 tensor check above is the measured startup cost V4 adds.

## Route equivalence with triage_sim (flag on)

| Set | Compared | Matching | Mismatch reasons |
|---|---|---|---|
| dev | 58 | 55 | {'gate': 3} |
| seeds | 380 | 286 | {'gate': 94} |

dev mismatches (id: live / triage_sim, reason):

- DEV-Q23: abstain / answer, gate
- DEV-Q53: abstain / answer, gate
- DEV-Q57: abstain / answer, gate

seeds mismatches (id: live / triage_sim, reason):

- SEED-V4-GEN-003: abstain / answer, gate
- SEED-V4-GEN-005: abstain / answer, gate
- SEED-V4-GEN-006: abstain / answer, gate
- SEED-V4-GEN-008: abstain / answer, gate
- SEED-V4-GEN-011: abstain / answer, gate
- SEED-V4-GEN-016: abstain / answer, gate
- SEED-V4-GEN-018: abstain / answer, gate
- SEED-V4-GEN-019: abstain / answer, gate
- SEED-V4-GEN-020: abstain / answer, gate
- SEED-V4-GEN-022: abstain / answer, gate
- SEED-V4-PREG-011: abstain / answer, gate
- SEED-V4-CON-007: abstain / answer, gate
- SEED-V4-CON-010: abstain / answer, gate
- SEED-V4-CON-013: abstain / answer, gate
- SEED-V4-STI-010: abstain / answer, gate
- SEED-V4-STI-011: abstain / answer, gate
- SEED-V4-STI-012: abstain / answer, gate
- SEED-V4-STI-014: abstain / answer, gate
- SEED-V4-STI-015: abstain / answer, gate
- SEED-V4-CON-025: abstain / answer, gate
- SEED-V4-CON-028: abstain / answer, gate
- SEED-V4-STI-017: abstain / answer, gate
- SEED-V4-STI-018: abstain / answer, gate
- SEED-V4-STI-022: abstain / answer, gate
- SEED-V4-STI-023: abstain / answer, gate
- SEED-V4-PREG-018: abstain / answer, gate
- SEED-V4-PREG-019: abstain / answer, gate
- SEED-V4-PREG-022: abstain / answer, gate
- SEED-V4-PREG-025: abstain / answer, gate
- SEED-V4-GEN-027: abstain / answer, gate
- SEED-CONTRA-06: abstain / answer, gate
- SEED-CONTRA-14: abstain / answer, gate
- SEED-CONTRA-20: abstain / answer, gate
- SEED-STI-07: abstain / answer, gate
- SEED-STI-10: abstain / answer, gate
- SEED-PREG-04: abstain / answer, gate
- SEED-PREG-05: abstain / answer, gate
- SEED-PREG-07: abstain / answer, gate
- SEED-PREG-20: abstain / answer, gate
- SEED-PREG-22: abstain / answer, gate
- SEED-GEN-04: abstain / answer, gate
- SEED-GEN-05: abstain / answer, gate
- SEED-GEN-06: abstain / answer, gate
- SEED-GEN-07: abstain / answer, gate
- SEED-GEN-08: abstain / answer, gate
- SEED-GEN-09: abstain / answer, gate
- SEED-GEN-11: abstain / answer, gate
- SEED-GEN-12: abstain / answer, gate
- SEED-GEN-13: abstain / answer, gate
- SEED-GEN-14: abstain / answer, gate
- SEED-GEN-15: abstain / answer, gate
- SEED-GEN-16: abstain / answer, gate
- SEED-GEN-18: abstain / answer, gate
- SEED-GEN-23: abstain / answer, gate
- SEED-GEN-24: abstain / answer, gate
- SEED-GEN-28: abstain / answer, gate
- SEED-GEN-30: abstain / answer, gate
- SEED-GEN-31: abstain / answer, gate
- SEED-GEN-33: abstain / answer, gate
- SEED-GEN-35: abstain / answer, gate
- SEED-GEN-42: abstain / answer, gate
- SEED-GEN-43: abstain / answer, gate
- SEED-GEN-44: abstain / answer, gate
- SEED-GEN-49: abstain / answer, gate
- SEED-GEN-51: abstain / answer, gate
- SEED-GEN-52: abstain / answer, gate
- SEED-STI-42: abstain / answer, gate
- SEED-PREG-28: abstain / answer, gate
- SEED-PREG-29: abstain / answer, gate
- SEED-PREG-32: abstain / answer, gate
- SEED-PREG-33: abstain / answer, gate
- SEED-PREG-34: abstain / answer, gate
- SEED-PREG-36: abstain / answer, gate
- SEED-PREG-39: abstain / answer, gate
- SEED-PREG-44: abstain / answer, gate
- SEED-CONTRA-48: abstain / answer, gate
- SEED-STI-45: abstain / answer, gate
- SEED-STI-46: abstain / answer, gate
- SEED-STI-47: abstain / answer, gate
- SEED-STI-48: abstain / answer, gate
- SEED-STI-50: abstain / answer, gate
- SEED-PREG-46: abstain / answer, gate
- SEED-PREG-47: abstain / answer, gate
- SEED-PREG-48: abstain / answer, gate
- SEED-PREG-51: abstain / answer, gate
- SEED-GEN-54: abstain / answer, gate
- SEED-GEN-55: abstain / answer, gate
- SEED-GEN-57: abstain / answer, gate
- SEED-GEN-58: abstain / answer, gate
- SEED-STI-51: abstain / answer, gate
- SEED-STI-52: abstain / answer, gate
- SEED-STI-53: abstain / answer, gate
- SEED-STI-54: abstain / answer, gate
- SEED-STI-55: abstain / answer, gate

Machine: AMD64 Family 25 Model 124 Stepping 0, AuthenticAMD; Python 3.14.6; Node v24.18.1; git 4da9e85.
