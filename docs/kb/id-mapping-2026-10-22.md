# Knowledge-base ID mapping (22 October 2026)

Two steps on the same day: K2a (below, first) and K3 (at the end).
**K3 is the current state**; the K2a statuses are superseded.

Step K2a. How each candidate in
`resources/knowledge_base/incoming/kb-candidate-entries.md` maps to its
final ID in `resources/knowledge_base/`.

Rules:

- A candidate that replaces a live entry keeps the live ID, so the
  evaluation sets and tests that name it need no relabelling.
- A new entry continues after the highest number ever used in its
  class, counting the reserved held numbers: contraception after KB-C6
  (reserved for NEW-C-06, on hold; EC-* entries are held too), STIs after
  KB-S7 (KB-S1 and KB-S2 are held), pregnancy after KB-P7 (KB-P2 and
  KB-P4 are held), general after KB-G7. No held number is reused.
- NEW-C-06 and NEW-S-06 are on hold and not built; KB-S3 (PEP) stays as
  it is.
- Status: "approved" only for live entries no candidate touches and for
  replacements whose answer and sources are unchanged (NEW-P-01 to
  NEW-P-03). Every other entry is "pending" clinician review.

| Candidate | Final ID | Change | Status | Question |
|---|---|---|---|---|
| NEW-C-01 | KB-C3 | replaces the live entry, same ID | pending | Which birth control methods can a teenager use? |
| NEW-C-02 | KB-C4 | replaces the live entry, same ID | pending | Do I still need a condom if I'm on the pill or the implant? |
| NEW-C-03 | KB-C5 | replaces the live entry, same ID | pending | Will contraception make me infertile or stop me having babies later? |
| NEW-C-06 | not built (HOLD) | – | – | What should I do if a condom breaks or slips? |
| NEW-C-07 | KB-C7 | new entry | pending | Is irregular bleeding normal with the implant or the injection? |
| NEW-C-08 | KB-C8 | new entry | pending | How does the contraceptive implant work, and how long does it last? |
| NEW-C-09 | KB-C9 | new entry | pending | How does the contraceptive injection work, and how often do I need it? |
| NEW-C-10 | KB-C10 | new entry | pending | How does the combined contraceptive pill work, and what are the side effects? |
| NEW-G-01 | KB-G3 | replaces the live entry, same ID | pending | Is my period normal, and when should I see a health worker? |
| NEW-G-02 | KB-G4 | replaces the live entry, same ID | pending | What can I do about period pain? |
| NEW-G-03 | KB-G5 | replaces the live entry, same ID | pending | How do I manage my period hygienically? |
| NEW-G-04 | KB-G6 | replaces the live entry, same ID | pending | What changes happen to my body at puberty, and when does my first period come? |
| NEW-G-05 | KB-G7 | replaces the live entry, same ID | pending | What does a youth-friendly health service offer, and what should I expect? |
| NEW-G-06 | KB-G8 | new entry | pending | Why do I feel tired, moody or get pimples before my period? |
| NEW-G-07 | KB-G9 | new entry | pending | What can I use during my period: pads, tampons or a cup? |
| NEW-G-08 | KB-G10 | new entry | pending | How do I dispose of a used pad safely? |
| NEW-G-09 | KB-G11 | new entry | pending | What is a period, and why does it happen? |
| NEW-P-01 | KB-P5 | replaces the live entry, same ID | approved | Can I stay in school if I'm pregnant, and can I go back after the baby? |
| NEW-P-02 | KB-P6 | replaces the live entry, same ID | approved | What warning signs in pregnancy mean I should go to hospital right away? |
| NEW-P-03 | KB-P7 | replaces the live entry, same ID | approved | Do I need iron and folic acid tablets in pregnancy, and what should I eat? |
| NEW-P-04 | KB-P8 | new entry | pending | How can I know if I am pregnant or not, and how do I get a pregnancy test? |
| NEW-S-01 | KB-S4 | replaces the live entry, same ID | pending | I have unusual discharge, itching, burning or lower belly pain. Could it be an STI? |
| NEW-S-02 | KB-S5 | replaces the live entry, same ID | pending | Can STIs be cured, and can they harm me if I leave them? |
| NEW-S-03 | KB-S6 | replaces the live entry, same ID | pending | Is the HPV vaccine available to me, and am I old enough? |
| NEW-S-04 | KB-S7 | replaces the live entry, same ID | pending | Can I take PrEP to prevent HIV? I'm a teenager. |
| NEW-S-05 | KB-S8 | new entry | pending | Can I have an STI without knowing? |
| NEW-S-06 | not built (HOLD) | – | – | Can I take medicine after unprotected sex to stop HIV? |
| NEW-S-07 | KB-S9 | new entry | pending | If a person with HIV takes their medicine, can they still pass HIV to a partner during sex? |
| NEW-S-08 | KB-S10 | new entry | pending | Is vaginal discharge always a sign of an STI? |
| NEW-S-09 | KB-S11 | new entry | pending | How do I get tested for HIV, and can I test myself? |
| NEW-S-10 | KB-S12 | new entry | pending | How soon after sex can an HIV test tell me if I have HIV? |
| NEW-S-11 | KB-S13 | new entry | pending | What is pelvic inflammatory disease (PID)? |
| NEW-S-12 | KB-S14 | new entry | pending | What are genital warts, and can I prevent them? |
| NEW-S-13 | KB-S15 | new entry | pending | I have painful sores or blisters on my genitals. Could it be herpes or syphilis? |
| NEW-S-14 | KB-S16 | new entry | pending | I have itching in my pubic hair or private area. Could it be lice or scabies? |
| NEW-S-15 | KB-S17 | new entry | pending | Can I catch hepatitis B from sex, and how can I prevent it? |
| NEW-S-16 | KB-S18 | new entry | pending | Could a painless sore or a rash on my palms be syphilis? |

Live entries no candidate touches (approved, unchanged): KB-C1, KB-C2,
KB-S3, KB-P1, KB-G1, KB-G2.

Final counts: contraception 9, STIs 16, pregnancy 5, general 11; 41 in
all.

## Step K3: the medic-verified 60 entries (22 October 2026)

Source of truth: `resources/knowledge_base/kb-final-60-approved-2026-10-22.md`
(60 entries, each with a clinician review mark). It replaces
`incoming/kb-candidate-entries.md` (37 entries, removed). Entry text is
copied verbatim; the review lines are not copied.

Rules:

- IDs from K2a are kept. New entries continue the K2a numbering:
  NEW-C-06 takes KB-C6 (reserved for it in K2a); NEW-C-11 to NEW-C-22
  take KB-C11 to KB-C22; NEW-S-06, NEW-S-17 and NEW-S-18 take KB-S19 to
  KB-S21; NEW-P-05 and NEW-P-06 take KB-P9 and KB-P10; NEW-G-10 to
  NEW-G-16 take KB-G12 to KB-G18.
- **Status is derived from the review mark** (the 60-entry file has no
  Status line): "approved" when the mark is `[x] approve`, otherwise
  "pending". Whatever the mark, the owner keeps four entries pending:
  NEW-C-06, NEW-S-06 and NEW-C-14 (held-topic rules not yet reviewed)
  and NEW-C-22 (consent wording is an open decision). All 60 marks are
  `[x] approve`.
- **Pending entries are never served.** They stay in the class files,
  validated, but the gateway, `ml_service/knowledge_base.json`,
  `kbQuestions.json` and the offline `Kbdata.json` leave them out.
- Live entries no candidate touches stay approved: KB-C1, KB-C2, KB-S3,
  KB-P1, KB-G1, KB-G2.
- NEW-G-08 (KB-G10) now includes its last sentence, which K2a left out
  as unverified: the medic verified it.

| Candidate | Final ID | Change | Status | Question |
|---|---|---|---|---|
| NEW-C-01 | KB-C3 | replaces the live entry, same id | approved | Which birth control methods can a teenager use? |
| NEW-C-02 | KB-C4 | replaces the live entry, same id | approved | Do I still need a condom if I'm on the pill or the implant? |
| NEW-C-03 | KB-C5 | replaces the live entry, same id | approved | Will contraception make me infertile or stop me having babies later? |
| NEW-C-06 | KB-C6 | new entry | pending (held-topic rules not yet reviewed) | What should I do if a condom breaks or slips? |
| NEW-C-07 | KB-C7 | new entry | approved | Is irregular bleeding normal with the implant or the injection? |
| NEW-C-08 | KB-C8 | new entry | approved | How does the contraceptive implant work, and how long does it last? |
| NEW-C-09 | KB-C9 | new entry | approved | How does the contraceptive injection work, and how often do I need it? |
| NEW-C-10 | KB-C10 | new entry | approved | How does the combined contraceptive pill work, and what are the side effects? |
| NEW-C-11 | KB-C11 | new entry | approved | If a boy pulls out before he finishes, can I still get pregnant? |
| NEW-C-12 | KB-C12 | new entry | approved | How well do condoms work, and how do I use one correctly? |
| NEW-C-13 | KB-C13 | new entry | approved | What is a female condom, and does it work? |
| NEW-C-14 | KB-C14 | new entry | pending (held-topic rules not yet reviewed) | What do I do if I forget to take my birth control pill? |
| NEW-C-15 | KB-C15 | new entry | approved | What is an IUD (the coil), and how long does it last? |
| NEW-C-16 | KB-C16 | new entry | approved | I missed my injection date. What should I do? |
| NEW-C-17 | KB-C17 | new entry | approved | Can birth control make me gain or lose weight? |
| NEW-C-18 | KB-C18 | new entry | approved | Can I use the pill, injection or implant if I have never had a baby? |
| NEW-C-19 | KB-C19 | new entry | approved | I am breastfeeding. Which contraception can I use? |
| NEW-C-20 | KB-C20 | new entry | approved | Does birth control cause cancer? |
| NEW-C-21 | KB-C21 | new entry | approved | Can I stop or change my contraceptive method, and how soon can I get pregnant after I stop? |
| NEW-C-22 | KB-C22 | new entry | pending (consent wording is an open decision) | Do I need my parents' permission to get contraception? |
| NEW-S-01 | KB-S4 | replaces the live entry, same id | approved | I have unusual discharge, itching, burning or lower belly pain. Could it be an STI? |
| NEW-S-02 | KB-S5 | replaces the live entry, same id | approved | Can STIs be cured, and can they harm me if I leave them? |
| NEW-S-03 | KB-S6 | replaces the live entry, same id | approved | Is the HPV vaccine available to me, and am I old enough? |
| NEW-S-04 | KB-S7 | replaces the live entry, same id | approved | Can I take PrEP to prevent HIV? I'm a teenager. |
| NEW-S-05 | KB-S8 | new entry | approved | Can I have an STI without knowing? |
| NEW-S-07 | KB-S9 | new entry | approved | If a person with HIV takes their medicine, can they still pass HIV to a partner during sex? |
| NEW-S-08 | KB-S10 | new entry | approved | Is vaginal discharge always a sign of an STI? |
| NEW-S-09 | KB-S11 | new entry | approved | How do I get tested for HIV, and can I test myself? |
| NEW-S-10 | KB-S12 | new entry | approved | How soon after sex can an HIV test tell me if I have HIV? |
| NEW-S-11 | KB-S13 | new entry | approved | What is pelvic inflammatory disease (PID)? |
| NEW-S-12 | KB-S14 | new entry | approved | What are genital warts, and can I prevent them? |
| NEW-S-13 | KB-S15 | new entry | approved | I have painful sores or blisters on my genitals. Could it be herpes or syphilis? |
| NEW-S-14 | KB-S16 | new entry | approved | I have itching in my pubic hair or private area. Could it be lice or scabies? |
| NEW-S-15 | KB-S17 | new entry | approved | Can I catch hepatitis B from sex, and how can I prevent it? |
| NEW-S-16 | KB-S18 | new entry | approved | Could a painless sore or a rash on my palms be syphilis? |
| NEW-S-06 | KB-S19 | new entry | pending (held-topic rules not yet reviewed) | Can I take medicine after unprotected sex to stop HIV? |
| NEW-S-17 | KB-S20 | new entry | approved | If I have an STI, does my partner need treatment too? |
| NEW-S-18 | KB-S21 | new entry | approved | I have itching, burning and a thick white discharge. Could it be a yeast infection? |
| NEW-P-01 | KB-P5 | replaces the live entry, same id | approved | Can I stay in school if I'm pregnant, and can I go back after the baby? |
| NEW-P-02 | KB-P6 | replaces the live entry, same id | approved | What warning signs in pregnancy mean I should go to hospital right away? |
| NEW-P-03 | KB-P7 | replaces the live entry, same id | approved | Do I need iron and folic acid tablets in pregnancy, and what should I eat? |
| NEW-P-04 | KB-P8 | new entry | approved | How can I know if I am pregnant or not, and how do I get a pregnancy test? |
| NEW-P-05 | KB-P9 | new entry | approved | How many antenatal clinic visits do I need, and what happens at the first one? |
| NEW-P-06 | KB-P10 | new entry | approved | How do I prepare for giving birth? |
| NEW-G-01 | KB-G3 | replaces the live entry, same id | approved | Is my period normal, and when should I see a health worker? |
| NEW-G-02 | KB-G4 | replaces the live entry, same id | approved | What can I do about period pain? |
| NEW-G-03 | KB-G5 | replaces the live entry, same id | approved | How do I manage my period hygienically? |
| NEW-G-04 | KB-G6 | replaces the live entry, same id | approved | What changes happen to my body at puberty, and when does my first period come? |
| NEW-G-05 | KB-G7 | replaces the live entry, same id | approved | What does a youth-friendly health service offer, and what should I expect? |
| NEW-G-06 | KB-G8 | new entry | approved | Why do I feel tired, moody or get pimples before my period? |
| NEW-G-07 | KB-G9 | new entry | approved | What can I use during my period: pads, tampons or a cup? |
| NEW-G-08 | KB-G10 | new entry | approved | How do I dispose of a used pad safely? |
| NEW-G-09 | KB-G11 | new entry | approved | What is a period, and why does it happen? |
| NEW-G-10 | KB-G12 | new entry | approved | Is having a period dirty, shameful or a sickness? |
| NEW-G-11 | KB-G13 | new entry | approved | Can I get pregnant once I have started my periods? |
| NEW-G-12 | KB-G14 | new entry | approved | Is it normal that I have not started my periods yet? |
| NEW-G-13 | KB-G15 | new entry | approved | What should I not use as a pad during my period? |
| NEW-G-14 | KB-G16 | new entry | approved | What can I do about itching, a rash or a bad smell during my period? |
| NEW-G-15 | KB-G17 | new entry | approved | Can I swim, run or play sports when I am on my period? |
| NEW-G-16 | KB-G18 | new entry | approved | Is it normal to feel sick, vomit, have diarrhoea or a headache around my period? |

Final counts: 66 entries, 62 approved (served) and 4 pending:
contraception 19 + 3 pending, STIs 18 + 1 pending, pregnancy 7, general
18.
