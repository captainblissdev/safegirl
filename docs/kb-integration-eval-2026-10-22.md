# KB integration: development-set evaluation (22 October 2026)

Step K3, branch `kb/integrate-candidates`. The 35 labelled questions of
the development set (`resources/eval/retrieval_eval_set.csv`, labels from
`retrieval_eval_set_labels_2026-10-15.csv`, expected class not "none")
run through the full gateway pipeline before and after the KB expansion.
DR-04 and the demo-risk set are not used.

**Unchanged:** classifier V3, thresholds 0.35 / 0.5, relevance gate
0.8439 (on), Safety Net, held-topic and vague rules. The index is rebuilt
the usual way: `ml_service/build_kb.py` writes `knowledge_base.json`, and
ml_service embeds it at start-up.

- **Before:** the 21 live entries, with the gateway and
  `knowledge_base.json` as on `fix/ui-redesign` (4dd5834, before K2a).
- **After:** the 62 approved entries (the 4 pending ones are not served).

A reply is scored with `research/eval/run_eval.js`'s verdict rule: an
answer is correct when its entry is one of the query's acceptable
entries; "partial" when it is a partial entry; abstain, help, held-topic
and vague replies are scored against the expected behaviour. "Gate score"
is the unscoped top-1 retrieval score, which the gate compares with
0.8439.

**The labels predate the new entries.** They name only the 21 old
entries, so an answer from a new entry counts as wrong even when it fits.
The "Reading" column below is a reading of each changed reply, not a
relabel; the counts use the labels as they are.

## Before and after

| | Before (21 live entries) | After (62 approved entries) |
|---|---|---|
| answer-scoped | 22 | 22 |
| answer-unscoped | 9 | 9 |
| abstain | 2 | 2 |
| help | 0 | 0 |
| held-topic | 2 | 2 |
| vague | 0 | 0 |
| referral | 0 | 0 |
| **correct reply** | **29 / 35 (83%)** | **23 / 35 (66%)** |
| partial | 1 | 1 |
| wrong | 5 | 11 |
| gate score of correct answers | 0.8503 to 0.9239 | 0.8580 to 0.9246 |
| gate score of wrong or partial answers | 0.8439 to 0.8508 | 0.8439 to 0.8947 |
| gate score of abstentions | 0.8379 to 0.8437 | 0.8227 to 0.8401 |

## Replies that changed (9)

| Id | Query | Label | Before | After | Caused by | Reading |
|---|---|---|---|---|---|---|
| Q03 | will the injection make me unable to have kids | ANSWER KB-C5 | answer-scoped KB-C5 (correct, 0.8570) | answer-scoped KB-C18 (wrong, 0.8777) | KB-C18 | wrong: KB-C18 is about choosing a method before having a baby, not fertility after |
| Q04 | I have discharge and itching down there, is it an STI? | ANSWER KB-S4 | answer-scoped KB-S4 (correct, 0.8858) | answer-scoped KB-S10 (wrong, 0.8947) | KB-S10 | related: KB-S10 (is discharge always an STI?) is close but is not the symptom entry |
| Q11 | is it normal for my period to be irregular | ANSWER KB-G3 | answer-unscoped KB-G3 (correct, 0.9071) | answer-unscoped KB-C7 (wrong, 0.8862) | KB-C7 | wrong: KB-C7 is bleeding on the implant or injection, not an irregular period |
| Q18 | can I get birth control without my parents knowing | ANSWER KB-C1;KB-C2 | answer-scoped KB-C1 (correct, 0.8768) | answer-scoped KB-C18 (wrong, 0.8768) | KB-C18 | wrong: KB-C18 does not address parents; KB-C22 (consent) would, but it is pending |
| Q23 | my private parts are burning, what could it be | ANSWER KB-S4 | abstain (wrong, 0.8437) | answer-unscoped KB-S21 (wrong, 0.8504) | KB-S21 | related: KB-S21 (yeast infection) fits burning; before, this query abstained |
| Q30 | Where can I get a pregnancy test | ANSWER KB-G7 | answer-scoped KB-P5 (wrong, 0.8508) | answer-scoped KB-P8 (wrong, 0.8790) | KB-P8 | plausibly right: KB-P8 says how to get a pregnancy test; the labels predate it |
| Q50 | I am scared to ask my mother about periods | NOT_REFERRAL KB-G3;KB-G6 | answer-scoped KB-P6 (correct, 0.8503) | answer-scoped KB-P8 (correct, 0.8591) | KB-P8 | still scored correct (not a referral), but KB-P8 (pregnancy test) does not fit |
| Q54 | What is PrEP? | ANSWER KB-S7 | answer-unscoped KB-S7 (correct, 0.8543) | abstain (wrong, 0.8401) | KB-S7 text (top KB-S7 0.8401) | lost: KB-S7's new text lowers the gate score to 0.8401, so the answer is gated out |
| Q55 | IS MY PERIOD NORMAL | ANSWER KB-G3 | answer-unscoped KB-G3 (correct, 0.8744) | answer-unscoped KB-G14 (wrong, 0.8761) | KB-G14 | wrong: KB-G14 is about periods not yet started |

In short: one reply plausibly improves (Q30) and one is related (Q23,
which abstained before); four are wrong because a new entry outscores
the right one (Q03, Q11, Q18, Q55); one is related but not the symptom
entry (Q04); one is lost to the gate (Q54); one is still scored correct
but answers badly (Q50). Q18 asks about parents: the entry that answers
it, KB-C22, is pending. Not correct both before and after: Q23 and
Q30 (in the table above), Q27 and Q29 (held-topic signposts), Q28
(partial) and Q57 (abstains).

**The gate no longer separates right from wrong on this set.** Before,
every wrong or partial answer scored 0.8508 or less and every correct one
0.8503 or more. After, wrong answers reach 0.8947, well inside the range
of correct ones (from 0.8580), because the new entries are close
neighbours of the old ones. The 0.8439 threshold was set on the 21-entry
KB and is unchanged here; re-validating it on the larger KB is open
(K2b).

## Every question

Each cell: reply kind and entry · verdict · gate score.

| Id | Label | Before | After |
|---|---|---|---|
| Q01 | ANSWER KB-C3 | answer-scoped KB-C3 · correct · 0.8993 | answer-scoped KB-C3 · correct · 0.8931 |
| Q02 | ANSWER KB-C4 | answer-scoped KB-C4 · correct · 0.8834 | answer-scoped KB-C4 · correct · 0.8847 |
| Q03 | ANSWER KB-C5 | answer-scoped KB-C5 · correct · 0.8570 | answer-scoped KB-C18 · wrong · 0.8777 |
| Q04 | ANSWER KB-S4 | answer-scoped KB-S4 · correct · 0.8858 | answer-scoped KB-S10 · wrong · 0.8947 |
| Q05 | ANSWER KB-S5 | answer-scoped KB-S5 · correct · 0.8980 | answer-scoped KB-S5 · correct · 0.8949 |
| Q06 | ANSWER KB-S6 | answer-scoped KB-S6 · correct · 0.9239 | answer-scoped KB-S6 · correct · 0.9246 |
| Q07 | ANSWER KB-S7 | answer-unscoped KB-S7 · correct · 0.8729 | answer-unscoped KB-S7 · correct · 0.8580 |
| Q08 | ANSWER KB-P5 | answer-scoped KB-P5 · correct · 0.8931 | answer-scoped KB-P5 · correct · 0.8914 |
| Q09 | ANSWER KB-P6 | answer-scoped KB-P6 · correct · 0.9142 | answer-scoped KB-P6 · correct · 0.9142 |
| Q10 | ANSWER KB-P7 | answer-scoped KB-P7 · correct · 0.9138 | answer-scoped KB-P7 · correct · 0.9138 |
| Q11 | ANSWER KB-G3 | answer-unscoped KB-G3 · correct · 0.9071 | answer-unscoped KB-C7 · wrong · 0.8862 |
| Q12 | ANSWER KB-G4 | answer-scoped KB-G4 · correct · 0.8898 | answer-scoped KB-G4 · correct · 0.8903 |
| Q13 | ANSWER KB-G5 | answer-unscoped KB-G5 · correct · 0.8533 | answer-unscoped KB-G5 · correct · 0.8693 |
| Q14 | ANSWER KB-G6 | answer-unscoped KB-G6 · correct · 0.9149 | answer-unscoped KB-G6 · correct · 0.9094 |
| Q15 | ANSWER KB-G7 | answer-scoped KB-G7 · correct · 0.9057 | answer-scoped KB-G7 · correct · 0.8772 |
| Q16 | ANSWER KB-G1 | answer-unscoped KB-G1 · correct · 0.8703 | answer-unscoped KB-G1 · correct · 0.8703 |
| Q17 | ANSWER KB-C2 | answer-scoped KB-C2 · correct · 0.8896 | answer-scoped KB-C2 · correct · 0.8896 |
| Q18 | ANSWER KB-C1;KB-C2 | answer-scoped KB-C1 · correct · 0.8768 | answer-scoped KB-C18 · wrong · 0.8768 |
| Q20 | ANSWER KB-C3 | answer-unscoped KB-C3 · correct · 0.8842 | answer-unscoped KB-C3 · correct · 0.8842 |
| Q21 | ANSWER KB-C4 | answer-scoped KB-C4 · correct · 0.8900 | answer-scoped KB-C4 · correct · 0.8903 |
| Q22 | ANSWER KB-C5 | answer-scoped KB-C5 · correct · 0.8836 | answer-scoped KB-C5 · correct · 0.8917 |
| Q23 | ANSWER KB-S4 | abstain  · wrong · 0.8437 | answer-unscoped KB-S21 · wrong · 0.8504 |
| Q24 | ANSWER KB-S7 | answer-scoped KB-S7 · correct · 0.8702 | answer-scoped KB-S7 · correct · 0.8789 |
| Q25 | ANSWER KB-P5 | answer-scoped KB-P5 · correct · 0.8897 | answer-scoped KB-P5 · correct · 0.8883 |
| Q26 | ANSWER KB-P6 | answer-scoped KB-P6 · correct · 0.8846 | answer-scoped KB-P6 · correct · 0.8846 |
| Q27 | ANSWER KB-G3 | held-topic  · wrong · 0.8947 | held-topic  · wrong · 0.8906 |
| Q28 | ANSWER KB-G7 | answer-scoped KB-P6 · partial · 0.8439 | answer-scoped KB-P6 · partial · 0.8439 |
| Q29 | ANSWER KB-G3;KB-G7 | held-topic  · wrong · 0.8391 | held-topic  · wrong · 0.8468 |
| Q30 | ANSWER KB-G7 | answer-scoped KB-P5 · wrong · 0.8508 | answer-scoped KB-P8 · wrong · 0.8790 |
| Q50 | NOT_REFERRAL KB-G3;KB-G6 | answer-scoped KB-P6 · correct · 0.8503 | answer-scoped KB-P8 · correct · 0.8591 |
| Q54 | ANSWER KB-S7 | answer-unscoped KB-S7 · correct · 0.8543 | abstain  · wrong · 0.8401 |
| Q55 | ANSWER KB-G3 | answer-unscoped KB-G3 · correct · 0.8744 | answer-unscoped KB-G14 · wrong · 0.8761 |
| Q56 | ANSWER KB-G3 | answer-unscoped KB-G3 · correct · 0.9042 | answer-unscoped KB-G3 · correct · 0.9036 |
| Q57 | ANSWER KB-S7 | abstain  · wrong · 0.8379 | abstain  · wrong · 0.8227 |
| Q58 | ANSWER KB-C4 | answer-scoped KB-C4 · correct · 0.8945 | answer-scoped KB-C4 · correct · 0.8904 |
