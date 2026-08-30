# Feedback-Resolution Matrix

Per course guide requirement: tracks feedback received, its source, the
section(s) affected, the corrective action taken, and current status.
Maintained as a living document.

| # | Feedback | Source | Section(s) Affected | Corrective Action | Status |
|---|---|---|---|---|---|
| 1 | Original proposal "sounds like a CRUD application" (25/40) | Proposal panel | Entire project scope; core contribution framing | Reframed project around a genuine ML contribution: fine-tuned intent classifier evaluated against a keyword baseline, improving RAG retrieval quality. Non-negotiables added explicitly ruling out admin dashboards, session history, and CRUD-pattern features. | ✅ Resolved — reflected in master-project-plan.md Section 8 and all subsequent design decisions |
| 2 | Dataset should not be generated directly from MoH/WHO/KDHS source language; sources ground answers, seeds must be naturally phrased | Kevin Khakata (lecturer) | Dataset development plan, methodology chapter | Adopted seed→paraphrase→review pipeline: hand-written seeds grounded in but not copied from source documents, controlled LLM paraphrasing, manual review before any data enters the training set | ✅ Resolved — dataset-development-plan.md rewritten; standing rule enforced throughout (evidence → verification → KB → seeds → paraphrases → review → dataset → classifier) |
| 3 | Methodology sign-off: proceed with dataset/classifier work on cleared categories; GBV scaling held pending domain expert, GBV source material, independent test-set reviewer, ethics clarification | Supervisor | Dataset scope, KB scope | GBV-related dataset/KB content formally held (R1, R2, R8); non-GBV categories (contraception, STI, pregnancy, general) proceeded to seed-writing and baseline development | 🟡 Partially resolved — non-GBV work proceeding; GBV-related sub-items (R1, R2, R8) remain open pending supervisor/domain-expert input |
| 4 | Question on whether optional persistent accounts would help/harm the "CRUD" framing and privacy design | Lecturer (Kevin) | Use case diagram (UC-4), privacy architecture, future-work section | Decision: do NOT implement optional accounts or saved conversation history in current project scope. Documented as considered future work with associated privacy/security requirements (authentication, recovery, consent, secure storage, retention/deletion policy) | ✅ Resolved — logged in decision-log.md 2026-08-29; UC-4 wording to be refined to distinguish active-session context from cross-session persistence |
| 5 | Verify whether "no data persisted" claim is technically accurate given third-party services (Gemini, Firebase, application logs) | Lecturer (Kevin) | Privacy architecture, UC-4, limitations section | Verified Gemini API terms directly against primary source (ai.google.dev). Found a more serious issue than retention: Gemini's terms prohibit use in apps directed at/accessed by under-18s. Firebase/Node logging verification remains incomplete (requires actual backend source code, not yet written) | 🟡 Partially resolved — Gemini finding verified and logged (R12); Firebase Hosting/Cloud Functions/application-level logging verification still pending actual backend implementation |
| 6 | (Emergent finding, not external feedback) Gemini API terms conflict with SafeGirl's target population | Self-identified during retention verification (per item 5) | LLM provider choice, architecture diagram (#2), limitations section | Decision: proceed with Gemini for the academic prototype, with explicit documented rationale (research prototype scope, not live deployment to real minor end users during project period). Logged as accepted risk (R12), flagged for supervisor sign-off | 🟡 Logged and decided; supervisor sign-off still pending (Captain informed supervisor will be updated directly, outside this chat) |

---

## Notes on alignment checks (per course guide requirement)

When feedback item 1 changed the core project framing, the following were
checked for consistency and updated accordingly:
- **Objectives:** reframed around classifier evaluation vs. baseline, not
  "build a chatbot"
- **Research questions:** now center on whether fine-tuned classification
  meaningfully improves retrieval-grounded answer quality vs. keyword baseline
- **Methodology:** DSR (research paradigm) + OOAD (design paradigm) + Agile/
  Scrum (development methodology) explicitly separated, per course guide's
  three-paradigm structure
- **System features:** non-negotiables list (master-project-plan.md, Section 8)
  updated to explicitly exclude anything reintroducing CRUD-pattern scope
- **Evaluation metrics:** precision/recall/F1/confusion matrix adopted over
  accuracy alone, consistent with course guide's AI-project evaluation
  template
