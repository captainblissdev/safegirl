# SafeGirl — Dataset Development Plan
Prepared for review by Project Supervisor
Ogutu Cindy Atieno — 17/18 August 2026

## 1. Purpose

This plan covers the intended intent classes, source documents, data generation procedure,
human-review process, independent test-set construction, and ethical safeguards for the
training data underlying the SafeGirl intent classifier — submitted for review before any
data is generated at scale.

## 2. Intent classes

| Class | Definition scope | Primary source document(s) |
|---|---|---|
| Contraception | Methods, access, emergency contraception, consent/age considerations | Kenya MOH National Guidelines for Adolescent and Youth Friendly Services; WHO adolescent SRH publications |
| STIs | Symptoms, testing, prevention, confidentiality of services | Kenya MOH National Guidelines; WHO adolescent SRH publications |
| Pregnancy | Signs of pregnancy, options, antenatal access, confidentiality | Kenya MOH National Guidelines; KDHS 2022 (contextual/demographic grounding only — see Section 6) |
| GBV-related | Definitions of abuse/coercion, reporting pathways, safety | Kenya MOH National Guidelines; additional GBV-specific source to be selected and approved before seed generation for this class (see Section 7) |
| General | App mechanics, privacy, referral/clinic-location queries | N/A — derived from system design, not health literature |

**Class boundary ambiguity:** some queries sit close to a boundary between classes — for
example, "Can I get contraception without my parents knowing?" (contraception) vs. "Can I get
an STI test without my parents knowing?" (STIs) vs. "I think I might be pregnant, what should
I do?" (pregnancy) vs. "My partner is forcing me to have sex" (GBV-related). A short labeling
guide with worked boundary examples will be produced alongside seed-question writing, so that
annotation decisions are consistent and the later error analysis can reference documented
boundary rules rather than ad-hoc judgment calls.

## 3. Data generation procedure

1. **Seed questions** — 10–15 naturally-phrased example questions per class, hand-written by
   the student, grounded in the source documents above but not copied from formal guideline
   language.
2. **LLM-assisted paraphrasing** — each seed expanded into multiple phrasing variants to
   increase linguistic diversity.
3. **Manual review of every generated example** — checking for: duplicates/near-duplicates,
   unsupported medical claims, unsafe or inappropriate wording, factual alignment with source
   material.
4. **Natural Kenyan phrasing** (English–Swahili code-switching, Sheng where appropriate) —
   only included where reviewed by a person competent in the language and domain; never
   generated and used without that review.
5. **Dataset labeled explicitly as synthetic/partially synthetic** throughout all
   documentation — no claim of equivalence to real user-generated conversational data.

## 4. Independent test-set construction

The independent test set will be **authored independently** of the training-data generation
process — it will not use the training seeds, the generated paraphrases, or their prompt
template. Independent authorship (not merely a separate generation run) is the requirement,
to avoid any hidden distributional similarity between train and test data.

- Proposed approach: a small set of questions written and validated by an adult reviewer
  (domain expert or another qualified adult) — not generated via the LLM/prompt procedure
  used for training data, and not collected from minors.
- **Reviewer identification is an open item** — currently being confirmed with supervisor
  input on suitable candidates.

## 5. Splits and leakage prevention

- Train, validation, and test splits (target ~70/15/15) will be performed **at the
  seed-question level**, not the individual paraphrase-example level — all paraphrased
  variants of a given seed stay together within a single split, so no near-duplicate
  examples are shared across splits.
- The independent test set, per Section 4, is authored entirely separately and is not
  subject to this grouping rule since it shares no seeds with the training pipeline.

## 6. Role of KDHS 2022

KDHS 2022 is used strictly for **contextual and demographic grounding** — informing the
problem framing and background already established in the literature review. It is **not**
used as a source of classification labels, and no KDHS content is copied or adapted into
training or test examples.

## 7. Ethical safeguards

- No conversational data will be collected from real adolescent users at any stage.
- Adult reviewer involvement (domain expert, test-set validator) will be confirmed with
  supervisor as to whether formal ethics sign-off is required, even though no minors are
  directly involved.
- Generated content will be checked to ensure it does not imply the system provides medical
  diagnosis or replaces a qualified professional — consistent with the in-app disclaimer
  requirement.
- Any distress/GBV-related content generated for training or testing purposes will be
  reviewed for appropriateness and will not be used to train a distress-detection model
  directly — that function remains a separate, non-ML, keyword-based safety net.
- The GBV-related class's source material will be finalized and approved by the supervisor
  and/or domain expert **before** seed generation begins for that class, given its
  sensitivity and the current gap in dedicated source coverage.

## 8. Reproducibility

A generation and review log will be maintained (not necessarily included in this document,
but committed to as project practice) covering: model/provider used, date of generation,
prompt version, generation parameters where available, number of generations per seed,
seeds used, examples rejected during review and why, and the final dataset version used for
training.

## 9. Open items for discussion

- [ ] Confirm domain expert(s) for content and safety-net review
- [ ] Confirm independent test-set reviewer
- [ ] Confirm whether adult-reviewer involvement requires formal ethics sign-off
- [ ] Select and approve GBV-specific source document before seed generation for that class
- [ ] Confirm target dataset size per class — to be determined after seed count, paraphrase
      diversity, and deduplication/validation results are established, rather than fixed
      upfront

## 10. Requested feedback

Feedback is requested on whether this plan is sound before data generation begins at scale.
Happy to walk through any section in more detail.
