# Decision Log

## 2026-08-20
- **Decision:** RAG framework = LlamaIndex over LangChain. 
  Rationale: RAG-first design, more stable API, faster path within 7-week timeline.
- **Decision:** Generation LLM = Gemini (Google AI Studio free tier) over Azure/Claude.
  Rationale: renewing daily quota fits repeated eval/generation runs better than a 
  fixed depleting credit balance. Caveat logged: free-tier prompts may be used by 
  Google to improve their models — no real user/PII data will ever be sent.
- **Decision:** KDHS treated as contextual/demographic evidence only, never as 
  source for individual clinical KB answers. MOH/WHO are the clinical authorities.
- **Decision:** KB built entry-by-entry from verified evidence, not generated in bulk.
- **Decision:** Source hierarchy = Kenya MoH (primary, service delivery) > WHO 
  (supporting clinical/rights guidance) > KDHS (context only).

## 2026-08-21

Completed:
- Processed and verified NotebookLM Prompt 0 evidence.
- Established the source evidence map.
- Identified and documented the EC timing discrepancy between Kenya MoH and WHO guidance.
- Identified unresolved legal and clinical claims requiring review.
- Drafted five initial source-grounded knowledge-base entries:
  - KB-C1 — Adolescent contraceptive eligibility
  - KB-C2 — Parental/guardian authorization
  - KB-S1 — HIV testing/self-testing
  - KB-S2 — PEP after possible HIV exposure
  - KB-G1 — Privacy/confidentiality at youth-friendly services.

Decisions:
- Unresolved clinical, legal, and safety-sensitive claims will not enter dataset seeds.
- KDHS remains primarily contextual evidence.
- Current Kenyan legal requirements will not be inferred from the 2005 YFS guideline.
- The EC 72-hour/120-hour discrepancy remains open for supervisor/domain-expert review.

Current status:
- Prompt 0: CLOSED
- Initial KB: 5 entries drafted
- Dataset generation: NOT STARTED
- Fine-tuning: NOT STARTED

## 2026-08-27
- **Superseding freeze:** Replaced 2026-08-20 baseline with expanded version 
  (Captain-authored). Full changelog per new file docstring: removed standalone 
  "period" (fixed false-positive on general menstrual questions), removed 
  broad "symptoms" from STI, added high-signal phrasing across all classes, 
  scoped ML evaluation explicitly to 4 classes (GBV routing-only, per R8).
- **Pre-freeze regression (round 2):** Found 2 regressions introduced by the 
  above changes — (1) "birth control...without parents knowing" misrouted to 
  general due to overlapping/double-counting parental-consent phrases outscoring 
  the single contraception hit; (2) "period isn't here" phrasing lost all 
  pregnancy signal after "period" removal, zero-hit fallback to general.
- **Fixes applied:** removed redundant "parents knowing"/"parent knowing" 
  general keywords (overlap with "without my parents"); added "period isn't 
  here"/"period is not here" to pregnancy.
- **Final regression: 58/58 (100%)** across all previously-cleared seeds plus 
  today's additions. Verified before freeze, not after.
- **Open scope question (not yet resolved, not blocking freeze):** fertility-
  awareness/natural-method keywords (ovulation, safe days, calendar method) 
  route correctly but have no grounded KB source. Same category of decision 
  as puberty-topic scoping — needs an explicit in/out call before any KB 
  content or seeds are written for this subtopic.