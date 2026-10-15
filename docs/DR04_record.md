# SafeGirl — Independent Test Set (DR-04): Verification Record

Source: expert-verified spreadsheet, `SafeGirl_independent_test_set_verification.xlsx`.
34 questions submitted for verification; 31 make up the final scored test
set (`resources/test/independent_test_set.csv`). This document is the
record of what was excluded, why, and every expert note — nothing from
the source file is silently dropped, even where it didn't make it into
the final CSV.

## Normalization applied

The expert's `expert_verified_class` values used inconsistent
capitalization and abbreviations (`STI`, `PG`, `Contraception`,
`General`) that would not exact-match `train_classifier.py`'s
`CATEGORIES` list. Verified directly: **22 of the 34 rows (65%) would
have been silently dropped** by `load_test_set()` if used unnormalized,
with no error — the function skips non-matching rows silently. Mapped
`STI`→`sti`, `PG`→`pregnancy`, case-folded the rest. No wording, content,
or classification decisions were changed by this step — only label
formatting.

## Excluded from the scored test set (3 rows) — compound/dual-category labels

Our classifier outputs exactly one of four labels. These three were
explicitly identified by the expert as spanning two categories, so
forcing a single "correct" answer would produce a misleading result
regardless of what the model predicts. Excluded from scoring, kept here
for the record:

| ID | Question | Expert's label | Expert's note |
|---|---|---|---|
| TEST-014 | Can one get pregnant during her menses? | pregnancy/general | *(none)* |
| TEST-015 | Where do sperms go after sex? | pregnancy/general | "this could be a general reproductive health question or related to the process of fertilization of an ovum" |
| TEST-030 | What do I do when I get pregnant yet I'm on contraception? | contraception/PG | "It falls in both categories- failure of a contraceptive method and pregnancy" |

## Included, with scope explicitly limited — abortion-boundary questions (2 rows)

`resources/knowledge_base/pregnancy.md` holds abortion/PAC content pending
authoritative legal sourcing (same standing project rule as GBV content).
These two questions were **kept in the test set for intent-classification
testing only** — the system's classifier is being tested on whether it
correctly identifies these as pregnancy-related, not on whether it can or
should answer them. The active `pregnancy` KB entries do not include
abortion content, so retrieval would find nothing regardless of
classification correctness — no held content can reach a user through
this path.

| ID | Question | Class (for classification testing only) | Expert's note |
|---|---|---|---|
| TEST-005 | How long does tea leaves help with abortion? | pregnancy | *(none)* |
| TEST-006 | Is abortion a crime in Kenya? | pregnancy | "YES it generally is a crime in Kenya with some legal exceptions" |

**On TEST-006's note specifically:** this is the expert's own assertion,
recorded here as their input, not independently verified against current
Kenyan legal sources by this project. It should not be treated as a
sourced legal claim ready for use in any KB entry or user-facing content
— the same authoritative-sourcing bar applies to legal claims as to
medical ones (Chapter 1, §1.6).

## Other rows with expert notes, included and scored normally

| ID | Question | Note |
|---|---|---|
| TEST-001 | What can I do when I mess up? | "'messing up' can fit into any of the other categories" — expert still committed to a single class (`general`) despite the difficulty, unlike the compound-label exclusions above |
| TEST-025 | How late after sex is PEP still useful | "PEP- is postexposure prophylaxis for HIV infection prevention" — **note this was a correction**: the original proposed_class was `pregnancy`, the expert corrected it to `sti` |
| TEST-028 | What is the best contraception for me? | "this question may need qualifiers eg best may related to age, sexual partners, other comorbidities etc" |

## Still open — not resolved by this pass

**`verification_status` was empty for all 34 rows** in the source file,
despite the sheet's own instructions asking for `Verified`/`Amend`/`Needs
discussion`. Every row does have a definitive `expert_verified_class`,
but the status field itself was never filled in. This should be
confirmed with the expert directly rather than assumed — do not treat
silence here as equivalent to an explicit "Verified."

## Final test set composition

31 questions: STI 11, pregnancy 9, contraception 8, general 3.