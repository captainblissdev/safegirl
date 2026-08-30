# AI-Use Log

Maintained per course requirement: tool used, purpose, significant prompts/
tasks, output retained, modifications made, verification performed. Backfilled
from `decision-log.md` and session records; maintained going forward as work
happens.

**Tool used throughout:** Claude (Anthropic), referred to in project
correspondence as "C9," used in an advisor capacity — flags risks, proposes
designs, generates code/diagrams; Captain (student) makes all final decisions.

---

| Date | Purpose/Task | Output Retained | Modifications Made | Verification Performed |
|---|---|---|---|---|
| 2026-08-20 | Evidence extraction guidance (Prompt 0 design), NotebookLM output review | Evidence map review notes; 9 KB entries drafted | Entries revised after cross-checking against primary WHO/MoH source text, not NotebookLM summary alone | Verified each KB claim against primary source documents directly (WHO 2018, MoH 2005) before finalizing |
| 2026-08-20 | Use case diagram (#1) generation and review of external critiques (Segearnt, DeepSeek, ChatGPT, Gemini) | Final SVG/PNG/.drawio/spec doc | Multiple rounds: UC-4 retention debate, "Display" rename, guard-condition placement fix, removal of "functional decomposition" anti-pattern proposed by DeepSeek | Rendered and visually inspected after each change; UML notation claims (arrow direction, include/extend semantics) checked against actual coordinates before accepting or rejecting each external critique |
| 2026-08-20/27 | Keyword baseline classifier (`baseline_classifier.py`) design and testing | Frozen Python file | Word-boundary regex fix, plural coverage, priority-order tie-breaking documented, "pep" keyword gap fixed, parental-consent keyword overlap fixed | Full regression test run against 58 hand-labeled seeds after every change; results (pass/fail counts) recorded before declaring frozen |
| 2026-08-27 | Classifier notebook skeleton (`prepare_dataset.py`) — split/leakage logic | Python file | Dummy-data smoke test only; `load_real_dataset()` stubbed to raise `NotImplementedError` until real data exists | Split-by-seed and leakage-check logic verified independently in sandbox; tokenizer/full pipeline verified separately by Captain running it in Colab (live Hugging Face access unavailable in this sandbox) |
| 2026-08-27/28 | System architecture diagram (#2) generation and fixes | Final SVG/PNG/.drawio/spec doc | Rebuilt after Captain-supplied and Gemini-supplied versions found real routing bugs (connector crossing annotation box, missing return arrows, cylinder text-clipping) | Every fix verified via cropped close-up render, not just full-diagram glance, before being accepted |
| 2026-08-28 | Sequence diagrams #3 (normal query) and #4 (safety/GBV query) | Final SVG/PNG/.drawio/spec docs | Design change from initial proposal: Branch B short-circuited on Safety Net FLAGGED rather than running to an empty GBV KB result (Captain's design call, reasoned through jointly) | #3 verified via label-collision fix in sandbox render, then cross-verified by Captain opening it in the real draw.io application |
| 2026-08-28 | Class diagram (#5) generation and fixes | Final SVG/PNG/.drawio/spec doc | Added `Backend` and `SafetyNet → ResponseOrchestrator` (missing from an initial leaner proposal); fixed a connector routing through an annotation box; fixed multiplicity-label placement | Verified against the actual `baseline_classifier.py` return type (confirmed `classify_baseline()` returns a plain string, justifying the value-object collapse) |
| 2026-08-29 | Real-world precedent research (AIMEE, Crisis Text Line) for data-retention design decision | Web search results cited in conversation; informed decision-log entries | N/A (research task) | Claims checked against primary sources (Crisis Text Line's own privacy policy page; press coverage of AIMEE quoting its developer directly) |
| 2026-08-29 | Gemini API / OpenAI / Anthropic terms-of-service verification for LLM provider compliance | Verified findings logged in `risk-and-review-register.md` (R12) | N/A (verification task) | Fetched Gemini's Additional Terms of Service directly from `ai.google.dev` (primary source) rather than relying on a third-party AI tool's summary; cross-checked OpenAI and Anthropic claims against their own policy pages before treating any claim as established |
| 2026-08-29 | Decision to proceed with Gemini API despite verified ToS conflict | Decision logged with Captain's stated rationale (academic prototype scope) | N/A | Risk explicitly logged as R12, flagged for supervisor sign-off, not treated as resolved |

---

## Standing practice

External AI-tool critiques (ChatGPT/Segearnt, NotebookLM, Gemini, DeepSeek)
brought into the project are verified against the actual artifact (rendered
diagram, source code, primary-source document) before being accepted or
rejected — never trusted or dismissed on description alone. Multiple instances
recorded in `decision-log.md` where an external critique was partially or
fully incorrect (e.g., DeepSeek's "functional decomposition" proposal
independently rejected twice; a claimed inverted arrow direction that was
verified to already be correct).

No AI-generated citation, statistic, or technical claim has been used in
project documentation without independent verification against a primary or
authoritative source.
