# KB integration: diagnosis of the retrieval regression (22 October 2026)

Step K4, branch `kb/integrate-candidates`, after the wording fixes
("KB wording resolved, 22 Oct 2026"). Analysis only: no retrieval code,
KB text, gate, threshold or rule is changed. ml_service V3 with the
62-entry index; the development set's 35 labelled questions; DR-04, the
demo-risk set and the sealed set are not used.

## Summary

- **Correct replies stay at 23 of 35** (29 before the expansion). The
  wording fixes swap one: Q18 is right again (KB-C1), Q02 is newly wrong
  (KB-C18).
- **Two failure modes, roughly equal.** (1) *Crowding inside a class:*
  new entries sit close to the labelled ones (82 question pairs at cosine
  0.90 or above, most within one class) and win by small margins; scoping
  cannot fix these. KB-C18 alone wins 3 of the 16 cases. (2)
  *Mis-scoping:* V3 classes a question outside its class with high
  confidence (KB-C11, KB-S16, KB-P1, KB-G13, KB-P9), so scoped retrieval
  cannot reach the right entry; scoping to the labelled class fixes all
  five.
- **The gate no longer separates right from wrong:** wrong answers reach
  0.8947 against correct ones from 0.8580. One correct retrieval (Q54,
  KB-S7) is gated out at 0.8401.
- **Answers that open with a verdict are a hazard when served for the
  wrong question.** 18 of the 62 served answers open with
  "Yes", "No", "Not…" or "It could be". KB-C18 opens "Yes." and is served
  for Q03 ("will the injection make me unable to have kids"), where it
  reads as "yes, it will"; KB-S10 opens "No." for Q04 ("discharge and
  itching… is it an STI?").
- **The labels predate the new entries,** so some "wrong" answers fit
  (Q30 → KB-P8, a pregnancy test). The blind review sheet is for judging
  that without the labels.

## What retrieval embeds, and what reaches the user

`ml_service/build_kb.py` writes each served entry as `title` = the User
question and `content` = the Answer, then "Evidence: …", "Conditions: …"
and "Safety notes: …" (each left out when empty or "None…").
`ml_service/retrieval.py` embeds **`passage: <question>. <content>`**, so
the passage holds **the question, the answer, the evidence, the
Conditions/limitations and the Safety/referral notes**. Source and
Intent are not embedded.

**The Conditions text is embedded.** It is written for clinicians
(caveats, page references, notes such as "the combined injectable is
given as about 5 months") and is never shown to the user, yet it shapes
which entry wins.

What reaches the user: the **answer** (verbatim), the **matched
question** (the answer screen's heading or "I found a question like
yours" banner) and the **Source** line. The gateway response also
carries `safetyNotes`, but the answer screen does not show it. Evidence
and Conditions never reach the user.

## B. Development set after the wording fixes

| | Before (21 live entries) | After (62 approved entries, wording resolved) |
|---|---|---|
| answer-scoped | 22 | 22 |
| answer-unscoped | 9 | 9 |
| abstain | 2 | 2 |
| help | 0 | 0 |
| held-topic | 2 | 2 |
| vague | 0 | 0 |
| referral | 0 | 0 |
| **correct reply** | **29 / 35 (83%)** | **23 / 35 (66%)** |
| partial / wrong | 1 / 5 | 1 / 11 |
| gate score of correct answers | 0.8503 to 0.9239 | 0.8580 to 0.9246 |
| gate score of wrong or partial answers | 0.8439 to 0.8508 | 0.8439 to 0.8947 |
| gate score of abstentions | 0.8379 to 0.8437 | 0.8227 to 0.8401 |

Replies that differ from before the expansion:

| Id | Before | After |
|---|---|---|
| Q02 | answer-scoped KB-C4 (correct, 0.8834) | answer-scoped KB-C18 (wrong, 0.8883) |
| Q03 | answer-scoped KB-C5 (correct, 0.8570) | answer-scoped KB-C18 (wrong, 0.8750) |
| Q04 | answer-scoped KB-S4 (correct, 0.8858) | answer-scoped KB-S10 (wrong, 0.8947) |
| Q11 | answer-unscoped KB-G3 (correct, 0.9071) | answer-unscoped KB-C7 (wrong, 0.8862) |
| Q23 | abstain (wrong, 0.8437) | answer-unscoped KB-S21 (wrong, 0.8504) |
| Q30 | answer-scoped KB-P5 (wrong, 0.8508) | answer-scoped KB-P8 (wrong, 0.8790) |
| Q50 | answer-scoped KB-P6 (correct, 0.8503) | answer-scoped KB-P8 (correct, 0.8591) |
| Q54 | answer-unscoped KB-S7 (correct, 0.8543) | abstain (wrong, 0.8401) |
| Q55 | answer-unscoped KB-G3 (correct, 0.8744) | answer-unscoped KB-G14 (wrong, 0.8761) |

Compared with K3's run: Q18 now gets KB-C1 (correct; it got KB-C18) and
Q02 now gets KB-C18 (wrong; it got KB-C4). The reworded KB-C18 answer
("you can use combined pills, the injection, the implant and the female
condom even if you have never had a baby…") pulls in pill, implant and
condom questions.

## 1. The cases

The nine dev questions whose reply changed in K3, plus Q02 (changed by
the wording fixes), and the self-retrievals that fail: the five
mis-scoped entries and KB-C4 (crowded out by KB-C18, even unscoped).
"Live path" is what the gateway does: scoped when V3's confidence is
0.5 or more, unscoped from 0.35.

| Case | Question | V3 class (p) · live path | Top 5 unscoped (score) | Live winner: question | Expected: question |
|---|---|---|---|---|---|
| Q02 | Do I need a condom if I am on the pill? | contraception 0.91 · scoped | KB-C18 0.888, KB-C4 0.885, KB-C13 0.861, KB-C3 0.857, KB-C12 0.854 | KB-C18: Can I use the pill, injection or implant if I have never had a baby? | KB-C4: Do I still need a condom if I'm on the pill or the implant? |
| Q03 | will the injection make me unable to have kids | contraception 0.56 · scoped | KB-C18 0.875, KB-C16 0.867, KB-C5 0.863, KB-C9 0.858, KB-C21 0.857 | KB-C18: Can I use the pill, injection or implant if I have never had a baby? | KB-C5: Will contraception make me infertile or stop me having babies later? |
| Q04 | I have discharge and itching down there, is it an STI? | sti 0.93 · scoped | KB-S10 0.895, KB-S21 0.889, KB-S4 0.881, KB-S15 0.871, KB-S16 0.868 | KB-S10: Is vaginal discharge always a sign of an STI? | KB-S4: I have unusual discharge, itching, burning or lower belly pain. Could it be an STI? |
| Q11 | is it normal for my period to be irregular | sti 0.44 · unscoped | KB-C7 0.886, KB-G3 0.882, KB-G14 0.876, KB-G6 0.870, KB-G12 0.870 | KB-C7: Is irregular bleeding normal with the implant or the injection? | KB-G3: Is my period normal, and when should I see a health worker? |
| Q18 | can I get birth control without my parents knowing | contraception 0.60 · scoped | KB-C1 0.877, KB-C18 0.876, KB-C3 0.866, KB-C2 0.856, KB-C20 0.853 | KB-C1: Can I get birth control even though I'm a teenager? | KB-C1: Can I get birth control even though I'm a teenager?; KB-C2: Do I need my parents' permission to get contraception? |
| Q23 | my private parts are burning, what could it be | pregnancy 0.44 · unscoped | KB-S21 0.850, KB-S15 0.844, KB-S16 0.843, KB-S13 0.833, KB-S4 0.833 | KB-S21: I have itching, burning and a thick white discharge. Could it be a yeast infection? | KB-S4: I have unusual discharge, itching, burning or lower belly pain. Could it be an STI? |
| Q30 | Where can I get a pregnancy test | pregnancy 0.80 · scoped | KB-P8 0.879, KB-S11 0.863, KB-G13 0.855, KB-S8 0.854, KB-C18 0.850 | KB-P8: How can I know if I am pregnant or not, and how do I get a pregnancy test? | KB-G7: What does a youth-friendly health service offer, and what should I expect? |
| Q50 | I am scared to ask my mother about periods | pregnancy 0.64 · scoped | KB-G8 0.859, KB-G18 0.849, KB-G11 0.848, KB-G4 0.844, KB-G14 0.842 | KB-P8: How can I know if I am pregnant or not, and how do I get a pregnancy test? | KB-G3: Is my period normal, and when should I see a health worker?; KB-G6: What changes happen to my body at puberty, and when does my first period come? |
| Q54 | What is PrEP? | contraception 0.42 · unscoped | KB-S7 0.840, KB-S3 0.829, KB-S12 0.803, KB-S9 0.790, KB-G8 0.781 | KB-S7: Can I take PrEP to prevent HIV? I'm a teenager. | KB-S7: Can I take PrEP to prevent HIV? I'm a teenager. |
| Q55 | IS MY PERIOD NORMAL | sti 0.38 · unscoped | KB-G14 0.876, KB-G3 0.871, KB-G12 0.861, KB-G8 0.854, KB-G11 0.852 | KB-G14: Is it normal that I have not started my periods yet? | KB-G3: Is my period normal, and when should I see a health worker? |
| KB-C11 | If a boy pulls out before he finishes, can I still get pregnant? | pregnancy 0.88 · scoped | KB-C11 0.922, KB-G13 0.871, KB-C5 0.864, KB-C21 0.863, KB-P8 0.862 | KB-P8: How can I know if I am pregnant or not, and how do I get a pregnancy test? | KB-C11: If a boy pulls out before he finishes, can I still get pregnant? |
| KB-S16 | I have itching in my pubic hair or private area. Could it be lice or scabies? | general 0.87 · scoped | KB-S16 0.939, KB-S21 0.866, KB-S15 0.862, KB-S10 0.854, KB-S18 0.854 | KB-G16: What can I do about itching, a rash or a bad smell during my period? | KB-S16: I have itching in my pubic hair or private area. Could it be lice or scabies? |
| KB-P1 | Do I have to get a pelvic exam right away at my first visit? | general 0.85 · scoped | KB-P1 0.902, KB-S11 0.867, KB-P9 0.861, KB-S4 0.858, KB-P8 0.855 | KB-G14: Is it normal that I have not started my periods yet? | KB-P1: Do I have to get a pelvic exam right away at my first visit? |
| KB-G13 | Can I get pregnant once I have started my periods? | pregnancy 0.88 · scoped | KB-G13 0.920, KB-G14 0.877, KB-G11 0.876, KB-G8 0.874, KB-C18 0.871 | KB-P8: How can I know if I am pregnant or not, and how do I get a pregnancy test? | KB-G13: Can I get pregnant once I have started my periods? |
| KB-P9 | How many antenatal clinic visits do I need, and what happens at the first one? | general 0.77 · scoped | KB-P9 0.897, KB-C10 0.857, KB-C19 0.851, KB-C21 0.849, KB-P10 0.848 | KB-G14: Is it normal that I have not started my periods yet? | KB-P9: How many antenatal clinic visits do I need, and what happens at the first one? |
| KB-C4 | Do I still need a condom if I'm on the pill or the implant? | contraception 0.91 · scoped | KB-C18 0.894, KB-C4 0.892, KB-C21 0.865, KB-C8 0.862, KB-C13 0.857 | KB-C18: Can I use the pill, injection or implant if I have never had a baby? | KB-C4: Do I still need a condom if I'm on the pill or the implant? |

## 2. Distractor map

Every pair of the 62 served questions at e5 cosine 0.90 or above
(question against question, `query:` prefix, the embedding retrieval
uses); the passage cosine (question + content) is given alongside.
**82 pairs, 11 of them cross-class.**

| Cosine (questions) | Cosine (passages) | Entry | Class | Entry | Class | Cross-class |
|---|---|---|---|---|---|---|
| 0.9452 | 0.9424 | KB-C8 | contraception | KB-C9 | contraception |  |
| 0.9408 | 0.8968 | KB-S15 | sti | KB-S18 | sti |  |
| 0.9387 | 0.9324 | KB-G9 | general | KB-G15 | general |  |
| 0.9349 | 0.9265 | KB-S4 | sti | KB-S21 | sti |  |
| 0.9329 | 0.8942 | KB-G4 | general | KB-G16 | general |  |
| 0.9322 | 0.9020 | KB-C1 | contraception | KB-C3 | contraception |  |
| 0.9316 | 0.9226 | KB-G13 | general | KB-G14 | general |  |
| 0.9310 | 0.9553 | KB-C5 | contraception | KB-C21 | contraception |  |
| 0.9308 | 0.9073 | KB-C4 | contraception | KB-C18 | contraception |  |
| 0.9293 | 0.9046 | KB-C8 | contraception | KB-C15 | contraception |  |
| 0.9257 | 0.8982 | KB-G4 | general | KB-G5 | general |  |
| 0.9252 | 0.9239 | KB-C9 | contraception | KB-C10 | contraception |  |
| 0.9239 | 0.9082 | KB-S11 | sti | KB-S12 | sti |  |
| 0.9229 | 0.9064 | KB-C8 | contraception | KB-C10 | contraception |  |
| 0.9216 | 0.8950 | KB-S4 | sti | KB-S10 | sti |  |
| 0.9211 | 0.9098 | KB-G9 | general | KB-G16 | general |  |
| 0.9204 | 0.8660 | KB-C1 | contraception | KB-S7 | sti | **yes** |
| 0.9204 | 0.9049 | KB-C9 | contraception | KB-C12 | contraception |  |
| 0.9197 | 0.9121 | KB-S3 | sti | KB-S7 | sti |  |
| 0.9194 | 0.8887 | KB-C21 | contraception | KB-G13 | general | **yes** |
| 0.9183 | 0.8964 | KB-S4 | sti | KB-S8 | sti |  |
| 0.9182 | 0.8665 | KB-S8 | sti | KB-S20 | sti |  |
| 0.9181 | 0.8977 | KB-C11 | contraception | KB-G13 | general | **yes** |
| 0.9179 | 0.9027 | KB-S4 | sti | KB-S15 | sti |  |
| 0.9177 | 0.9391 | KB-G3 | general | KB-G14 | general |  |
| 0.9163 | 0.9281 | KB-C12 | contraception | KB-C13 | contraception |  |
| 0.9160 | 0.8912 | KB-G4 | general | KB-G9 | general |  |
| 0.9152 | 0.9001 | KB-G14 | general | KB-G18 | general |  |
| 0.9150 | 0.9278 | KB-G5 | general | KB-G9 | general |  |
| 0.9147 | 0.9027 | KB-C21 | contraception | KB-P5 | pregnancy | **yes** |
| 0.9146 | 0.9347 | KB-C9 | contraception | KB-C21 | contraception |  |
| 0.9145 | 0.8506 | KB-C1 | contraception | KB-G13 | general | **yes** |
| 0.9144 | 0.9244 | KB-C8 | contraception | KB-C21 | contraception |  |
| 0.9143 | 0.8779 | KB-C11 | contraception | KB-P5 | pregnancy | **yes** |
| 0.9136 | 0.9030 | KB-C11 | contraception | KB-C21 | contraception |  |
| 0.9135 | 0.9302 | KB-G5 | general | KB-G16 | general |  |
| 0.9132 | 0.8924 | KB-G6 | general | KB-G11 | general |  |
| 0.9124 | 0.9777 | KB-C1 | contraception | KB-C2 | contraception |  |
| 0.9119 | 0.9120 | KB-S5 | sti | KB-S8 | sti |  |
| 0.9114 | 0.8886 | KB-C10 | contraception | KB-C13 | contraception |  |
| 0.9106 | 0.8965 | KB-C21 | contraception | KB-P8 | pregnancy | **yes** |
| 0.9099 | 0.8771 | KB-G4 | general | KB-G15 | general |  |
| 0.9096 | 0.8914 | KB-C8 | contraception | KB-C12 | contraception |  |
| 0.9087 | 0.8896 | KB-G6 | general | KB-G8 | general |  |
| 0.9086 | 0.8714 | KB-S4 | sti | KB-S5 | sti |  |
| 0.9083 | 0.8708 | KB-C1 | contraception | KB-C18 | contraception |  |
| 0.9078 | 0.8941 | KB-P5 | pregnancy | KB-G13 | general | **yes** |
| 0.9077 | 0.8955 | KB-S8 | sti | KB-S10 | sti |  |
| 0.9066 | 0.8567 | KB-S3 | sti | KB-S11 | sti |  |
| 0.9064 | 0.9145 | KB-C8 | contraception | KB-C13 | contraception |  |
| 0.9060 | 0.8580 | KB-C1 | contraception | KB-C21 | contraception |  |
| 0.9060 | 0.8945 | KB-G12 | general | KB-G16 | general |  |
| 0.9059 | 0.9059 | KB-C9 | contraception | KB-C13 | contraception |  |
| 0.9059 | 0.8980 | KB-C9 | contraception | KB-C15 | contraception |  |
| 0.9056 | 0.8981 | KB-G3 | general | KB-G18 | general |  |
| 0.9054 | 0.8608 | KB-S3 | sti | KB-S17 | sti |  |
| 0.9051 | 0.8998 | KB-C5 | contraception | KB-C11 | contraception |  |
| 0.9049 | 0.8373 | KB-C1 | contraception | KB-C17 | contraception |  |
| 0.9044 | 0.8348 | KB-C1 | contraception | KB-C11 | contraception |  |
| 0.9040 | 0.8734 | KB-S9 | sti | KB-S20 | sti |  |
| 0.9040 | 0.8894 | KB-G12 | general | KB-G18 | general |  |
| 0.9039 | 0.8768 | KB-S15 | sti | KB-S16 | sti |  |
| 0.9035 | 0.8605 | KB-S14 | sti | KB-S17 | sti |  |
| 0.9034 | 0.8680 | KB-S4 | sti | KB-S16 | sti |  |
| 0.9031 | 0.8789 | KB-S11 | sti | KB-P8 | pregnancy | **yes** |
| 0.9028 | 0.9134 | KB-S9 | sti | KB-S12 | sti |  |
| 0.9027 | 0.9086 | KB-G5 | general | KB-G15 | general |  |
| 0.9027 | 0.8986 | KB-G9 | general | KB-G17 | general |  |
| 0.9025 | 0.8676 | KB-S4 | sti | KB-S18 | sti |  |
| 0.9025 | 0.8839 | KB-G13 | general | KB-G17 | general |  |
| 0.9022 | 0.8692 | KB-S5 | sti | KB-S20 | sti |  |
| 0.9021 | 0.8627 | KB-C1 | contraception | KB-C4 | contraception |  |
| 0.9018 | 0.9054 | KB-C10 | contraception | KB-C12 | contraception |  |
| 0.9018 | 0.8430 | KB-S16 | sti | KB-S18 | sti |  |
| 0.9017 | 0.8411 | KB-C1 | contraception | KB-S6 | sti | **yes** |
| 0.9010 | 0.9332 | KB-G8 | general | KB-G18 | general |  |
| 0.9009 | 0.8885 | KB-C17 | contraception | KB-C21 | contraception |  |
| 0.9009 | 0.8793 | KB-S7 | sti | KB-S11 | sti |  |
| 0.9005 | 0.8780 | KB-G16 | general | KB-G18 | general |  |
| 0.9004 | 0.8270 | KB-C1 | contraception | KB-P5 | pregnancy | **yes** |
| 0.9004 | 0.9022 | KB-C19 | contraception | KB-C21 | contraception |  |
| 0.9003 | 0.9001 | KB-C5 | contraception | KB-C19 | contraception |  |

## 3. Scoping test

Retrieval re-run (a) scoped to V3's predicted class and (b) scoped to
the labelled class. **The winner changes in 11 of the 16 cases**;
scoped to the labelled class, **8 of 16** get an expected entry.

| Case | Live winner | (a) scoped to V3 class | (b) scoped to labelled class | (a) → (b) changes? | (b) right? |
|---|---|---|---|---|---|
| Q02 | KB-C18 | KB-C18 0.888 | KB-C18 0.888 (contraception) | no | no |
| Q03 | KB-C18 | KB-C18 0.875 | KB-C18 0.875 (contraception) | no | no |
| Q04 | KB-S10 | KB-S10 0.895 | KB-S10 0.895 (sti) | no | no |
| Q11 | KB-C7 | KB-S4 0.853 | KB-G3 0.882 (general) | yes | yes |
| Q18 | KB-C1 | KB-C1 0.877 | KB-C1 0.877 (contraception) | no | yes |
| Q23 | KB-S21 | KB-P6 0.817 | KB-S21 0.850 (sti) | yes | no |
| Q30 | KB-P8 | KB-P8 0.879 | KB-G13 0.855 (general) | yes | no |
| Q50 | KB-P8 | KB-P8 0.830 | KB-G8 0.859 (general) | yes | no |
| Q54 | KB-S7 | KB-C15 0.780 | KB-S7 0.840 (sti) | yes | yes |
| Q55 | KB-G14 | KB-S13 0.836 | KB-G14 0.876 (general) | yes | no |
| KB-C11 | KB-P8 | KB-P8 0.862 | KB-C11 0.922 (contraception) | yes | yes |
| KB-S16 | KB-G16 | KB-G16 0.845 | KB-S16 0.939 (sti) | yes | yes |
| KB-P1 | KB-G14 | KB-G14 0.845 | KB-P1 0.902 (pregnancy) | yes | yes |
| KB-G13 | KB-P8 | KB-P8 0.867 | KB-G13 0.920 (general) | yes | yes |
| KB-P9 | KB-G14 | KB-G14 0.839 | KB-P9 0.897 (pregnancy) | yes | yes |
| KB-C4 | KB-C18 | KB-C18 0.894 | KB-C18 0.894 (contraception) | no | no |

Scoping to the right class fixes the five mis-scoped entries and Q11,
and would find KB-S7 for Q54 (whose problem is the gate, not scope). It
cannot fix crowding inside a class: Q02, Q03, Q04 and KB-C4 keep the same
wrong winner, because that winner is in the right class, and Q55 (live
path unscoped) still gets KB-G14 when scoped to general. Q18 is right
either way.

In the tables, Q54's live winner is the retrieved entry (KB-S7); the
gate then abstains, because its score (0.8401) is under 0.8439.

## Offline what-if: which text to embed

Unscoped top-1 with the 62 served entries, embedding different parts of
each entry. Nothing in the repository was changed for this.

| Passage text | Dev top-1 acceptable (34 ANSWER questions, unscoped) | Self-retrieval (62) | The 16 cases right |
|---|---|---|---|
| question + answer + evidence + conditions + safety notes (current) | 25/34 | 61/62 | 7/16 |
| current without Conditions | 22/34 | 61/62 | 6/16 |
| question + answer | 21/34 | 61/62 | 8/16 |
| question only | 25/34 | 62/62 | 11/16 |

Dropping Conditions does not help on this set (22 against 25): the
caveats also carry useful words. Embedding the question alone ties the
current text on the dev set (25) and fixes self-retrieval (62/62) and
six of the cases (Q02, Q04, Q23, KB-C4 among them), but moves Q11, Q50
and Q55 to KB-G14. No single choice of text fixes crowding.

## Blind review

`docs/kb-integration-blind-review-2026-10-22.csv` holds the nine dev
questions whose reply differs from before the expansion (Q02, Q03, Q04,
Q11, Q23, Q30, Q50, Q54, Q55), each with the two replies the girl would
see (the answer text, or the no-answer message), in random order, and
blank `which_answers_better` and `notes` columns. Q18 is left out: its
reply is the same as before. The key (which reply is old and which
new) is kept outside the repository with the project owner since Step
K5; an earlier copy remains in the git history of commit 20b9184.

## Options (proposed, none applied)

1. **Retrieval phrasings per entry.** Add a few short alternative
   questions to each entry (for example "will the injection stop me
   having babies" for KB-C5), embedded as extra passages that point to
   the same entry; the answer text is unchanged. Retrieval scores an
   entry by its best passage. Phrasings would need the same checks as
   seeds (no near-duplicate of DR-04, the dev set, relevance_validation
   or the sealed set) and a re-run of this evaluation, which they would
   otherwise flatter.
2. **Separate what is embedded from what is shown.** Embed the question
   and phrasings, or the question and answer, but not the clinician-
   facing Conditions and Evidence; or embed Conditions only where it
   carries user words. The what-if above shows this alone is not enough
   and can cost answers, so it belongs with option 1, not instead of it.
3. **Resolve near-duplicates.** Several pairs answer almost the same
   question (KB-C5 / KB-C21 on fertility after stopping, 0.931; KB-S4 /
   KB-S21, 0.935; KB-G3 / KB-G14, 0.918; KB-C4 / KB-C18, 0.931). Merging
   or sharpening the questions (text change, so a clinician decision)
   would remove the closest distractors.
4. **Do not let a verdict word travel.** For answers that open with
   "Yes" or "No", either restate the question in the answer ("Yes, you
   can use the injection even if…") or show the matched question more
   prominently on the typed path. Text change: needs sign-off.
5. **Softer scoping.** When V3's class differs from the unscoped
   winner's class and the unscoped winner is clearly ahead, prefer it;
   or retrain the classifier (V4) with seeds for the mis-scoped topics.
   Any rule change needs its own validation.
6. **Re-validate the gate on the 62-entry KB (K2b),** after any of the
   above, since every option moves the scores.
7. **Relabel the development set for the new entries,** using the blind
   review, so the next evaluation measures the KB rather than the age of
   its labels. The labelled set then stops being blind to these entries,
   which should be recorded.
