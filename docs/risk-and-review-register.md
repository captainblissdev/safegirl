# Risk and Review Register

| ID | Item | Risk Type | Status | Notes |
|---|---|---|---|---|
| R1 | EC timing conflict: MoH (2005) says 72hrs, WHO (2018) says 120hrs post-assault | Clinical accuracy | Open — awaiting supervisor guidance | Sent [date] |
| R2 | Age-of-consent / "defilement" claim sourced only to 2005 MoH doc, predates 2006 Sexual Offences Act | Legal accuracy | Open — awaiting supervisor/legal input | KB entry held, not finalized |
| R3 | Safe abortion / PAC wording | Legal + political sensitivity | Open — awaiting supervisor sign-off | Most sensitive topic in KB; hold until reviewed |
| R4 | Domain expert for content/safety-net review | Process | Open | Outreach sent [date] |
| R5 | Independent test-set reviewer (separate from LLM-paraphrase process) | Methodology/leakage prevention | Open | Outreach pending |
| R6 | Ethics sign-off needed for adult-reviewer involvement | Ethics/compliance | Open | Question sent to supervisor [date] |

| R8 | GBV-specific authoritative source material — current sourcing (2005 MoH) 
predates Sexual Offences Act 2006 and 2010 Constitution | Legal/clinical accuracy | 
Open — raised in supervisor update [27.08.2026] | Blocks GBV dataset scaling |

| R12 | Gemini API terms (effective 2026-03-23) prohibit use in apps "directed 
towards or likely to be accessed by individuals under 18" and restrict use to 
"professional/business purposes, not consumer use" — verified against primary 
source. OpenAI/Anthropic APIs offer compliance pathways but require parental/
guardian consent, which conflicts with SafeGirl's anonymity design. | 
Legal/compliance | ACCEPTED RISK — proceeding with Gemini for academic 
prototype scope | Decision made 2026-08-29. Requires supervisor sign-off. 
Must be revisited before any real-world deployment. Mitigation: actual usage 
during project period limited to synthetic/adult-tester queries, not real 
minor end users. |