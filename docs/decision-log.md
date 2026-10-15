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

  ## 2026-08-28 (cont.)
- **4.3 CONFIRMED via Colab run:** tokenizer loaded live (distilbert-base-multilingual-cased),
  tokenization verified correct ([CLS]...[SEP][PAD] structure), leakage check 
  passed, split assignment matched sandbox test exactly (seed=42 determinism 
  confirmed across environments). No pip installs beyond transformers/sklearn/
  pandas needed; no file uploads required (smoke test uses inline dummy data).
- **STATUS: Step 4 (Methodology) — fully closed.** Baseline frozen, split 
  methodology confirmed, classifier skeleton verified working end-to-end.

  ## 2026-08-28 (cont.)
- **Step 5 CONFIRMED:** LlamaIndex (0.14.24) and sentence-transformers (5.7.0) 
  installed and imported successfully in the same Colab session as the 
  classifier environment. Classifier tokenizer re-verified working after 
  install — no breaking conflict.
- **Noted, non-blocking:** pip flagged a missing `jedi>=0.16` dependency 
  (IPython autocomplete only, unrelated to ML functionality) during install. 
  Not investigated further as it doesn't affect model/tokenizer/retrieval 
  functionality. Revisit only if interactive Colab behavior becomes an issue.
- **STATUS: Step 5 — closed.** Do NOT build the RAG pipeline yet — import 
  check only, per today's scope.

## 2026-08-28
- **Diagram #1 — final asset swap:** Replaced matplotlib-rendered SVG/PNG 
  with a native hand-coded SVG version (cleaner vector output, UC-numbered 
  labels matching use-case-specifications.md exactly). Fixed one wording 
  drift before adoption: guard condition read "[distress/GBV/crisis detected]", 
  corrected to canonical "[distress/GBV/crisis language detected]" to match 
  the spec doc and .drawio source. Verified via XML validity check and visual 
  re-render post-fix — no overflow, clean fit.
- **Diagram #1: CLOSED, FINAL.** .drawio remains the editable source of truth; 
  .svg/.png are the presentation exports.

## 2026-08-29
- **Decision:** Proceed with Gemini API as generation LLM despite verified 
  ToS conflict (age/consumer-use restrictions).
- **Rationale:** SafeGirl is an academic prototype built to supplement 
  research (classifier evaluation, RAG methodology, safety-net design) — 
  not a live, publicly deployed consumer product reaching real adolescent 
  end users during the current project period. Actual usage during 
  development and evaluation is confined to the developer, supervisor, and 
  domain expert testing against synthetic/seed data, not real minors 
  interacting with the system unsupervised.
- **Mitigation:** limit real usage during project period to synthetic/
  adult-tester queries; document explicitly in limitations section; raise 
  with supervisor for sign-off; note production deployment would require 
  resolving this before any real-world release (self-hosted model or 
  compliance-consent framework).
- **Not resolved, deliberately deferred:** production-readiness question. 
  This decision applies to the academic research prototype scope only.

## V2 Evaluation Methodology (2026-09-16)

V2 evaluation methodology changed from a single seed-level train/validation
split to 5-fold StratifiedGroupKFold cross-validation. The change was made
because the expanded V2 dataset and the small V1 validation set make a
single validation split less stable. seed_id is used as the grouping
variable to prevent paraphrase leakage, while stratification preserves
class proportions across folds. V1 results remain reported under their
original single-split methodology and are not retroactively re-evaluated.

V1 (55 seeds, single train/val split, 80% accuracy / macro-F1 0.7677) is
locked as a historical baseline -- not merged into the 182-seed set, not
redistributed into folds, not retrained.

The V1-to-V2 comparison reflects overall development improvement (more/
better data AND a more robust evaluation protocol), not a claim that
cross-validation itself improved the model. A controlled ablation
isolating the data effect alone is a possible future-work item, not part
of the current comparison.

Final V2 model definition: the 5-fold CV estimates expected performance
and validates configuration; the deployed/tested V2 model is a fresh
retrain on all 182 seeds using that validated configuration, not simply
the best-performing individual fold.

## V2 Paraphrasing Protocol Frozen (2026-09-18)

V2 paraphrasing protocol frozen. The 127 new seeds will each receive
exactly four English paraphrases, producing 508 new paraphrases.
Existing V1 paraphrases (220, covering the original 55 seeds) are
untouched. Generation uses a fixed prompt and category-level batching.

Fixed prompt: "Generate exactly 4 paraphrases for each seed question
below. Vary phrasing and register naturally, as if different people
asked the same question differently. Do not use back-translation
through any other language -- English only, no Sheng or code-switching.
Do not introduce new medical claims, recommendations, numbers,
timeframes, diagnoses, treatment details, eligibility criteria, or
other substantive specifics beyond the semantic scope of the seed
question. Keep a respectful, non-judgmental tone throughout, especially
for sensitive or embarrassing topics. Output as CSV:
seed_id,paraphrase_id,class,text."

Generation metadata recorded contemporaneously in ai-use-log.md per
batch: tool, model/version, temperature (N/A where not exposed --
never inferred), prompt, generation date, seed IDs covered,
number requested/generated/accepted/rejected/replaced.

All paraphrases undergo automated structural checks (no exact
duplicates, no entries under 10 characters, none identical to source
seed, exactly 4 per seed, valid seed_id references, no Swahili/Sheng
markers) and manual semantic/safety review (no scope drift, tone,
no held-content leakage, no overclaiming on boundary-sensitive topics).
Rejected paraphrases are regenerated until each seed has exactly four
accepted paraphrases.

Final V2 dataset: 182 seeds + 728 total paraphrases (220 existing +
508 new) = 910 examples.

Breakdown of 127 new seeds by current class: contraception 28,
STI 29, pregnancy 28, general 42.
## Interface wording differs from the wireframe (2026-10-14)

The greeting and two privacy lines in the interface no longer use the
wireframe's wording. The old strings quoted below are the ones the
interface implemented from the wireframe before this change.

**Greeting.** The previous "Hi, I'm here to listen. Ask me anything
about your body, your health, or what's on your mind." invites topics
SafeGirl cannot handle (emotional support, anything at all) and suggests
a listener rather than an information service. It is now "Hi, I'm here to
help. Ask me a question about your body or your health.", followed by a
scope line: "I can answer questions about contraception, STIs, pregnancy
and periods. I'm not a doctor or a counsellor." The scope line sets
expectations before the first question, so an off-topic or crisis
message is less likely to be met by a confident but irrelevant answer
(see the hold-out 3 missed-query results in
research/eval/results/holdout3_missed_pipeline.csv).

**Privacy lines.** "We don't keep anything after you leave" (disclaimer)
and "Nothing was saved on this device" (session end) were not literally
true, because some data does exist (below). They now read "We don't save
your questions or your answers." and "Your questions and answers were
not saved." Each claim was checked against what is actually stored:

| Where | What is stored | Contains questions or answers? |
|---|---|---|
| Firebase Authentication (Google) | One anonymous user record per sign-in: a uid with creation and last sign-in times. Google also receives the device's IP address with each sign-in and token request. | No |
| Browser IndexedDB | The Firebase SDK's usage heartbeat: at most one entry per day, a date and the SDK version string. No uid. | No |
| Browser Cache Storage | The PWA service worker's copy of the app shell (HTML, JS, CSS). `/api` responses are deliberately not cached. | No |
| Browser localStorage / sessionStorage / cookies | Nothing. Firebase Auth uses in-memory persistence. | No |
| Browser memory | The chat log, until the page is reloaded or the session is ended. | Yes, until cleared |
| Gateway logs | Startup messages, authentication rejection reasons (a fixed category, never the token or uid), error names, classifier fallback warnings with the confidence score. The query text and answers are never logged. | No |
| ml_service logs | Startup messages and uvicorn access lines (method, path, status, the gateway's local address). Request bodies are not logged. | No |

Hosting-provider and network logs on a future deployment are outside this
table and must be checked before real users.

## Safety Net patterns frozen (2026-10-15)

Safety Net patterns frozen on 2026-10-15; no pattern changes before
Milestone 2 except a verified defect.

The frozen state is `app/gateway/src/safetyNet.js` as of commit `525b41c`:
43 keyword phrases and 44 pattern rules (22 self-harm, 22 abuse), with the
offline copy in parity. The sealed hold-out 3 result (6/14 recall, 2/10
false referrals) and the post-patch numbers are in
`docs/safety-net-evaluation.md`.

The known misses and over-triggers listed there are accepted limits, not
defects. One is a candidate for "verified defect": J08 "my uncle drinks
and hits us at home" is missed because the "hits ... at" idiom exclusion
(meant for "beat me at chess") also covers "at home". Fixing it would
need an explicit decision under this freeze.

## Demo freeze until after Milestone 2 (2026-10-15)

Frozen until after Milestone 2, so the demo and the reported results stay
reproducible:

| Component | Frozen state |
|---|---|
| Classifier checkpoint | DistilBERT V3, `ml_service/final/` (gitignored); `model.safetensors` SHA-256 `e8bf2e3aa01c920197b51071e736ef6a3d1f16a57dd8d3bdb1565f75152cfb30`; labels contraception, sti, pregnancy, general |
| Thresholds | abstain 0.35, scoped 0.5 (`app/gateway/src/classifierClient.js` defaults; `CLASSIFIER_ABSTAIN_THRESHOLD` and `CLASSIFIER_CONFIDENCE_THRESHOLD` not set) |
| Knowledge base | `ml_service/knowledge_base.json` as of commit `42366d6` (21 entries), SHA-256 `e78a82afd10491fdc81d98bb2fca43119312be6908af7c4372ee2778d9dc1e30`; the gateway's local copy from the same markdown sources |
| Safety Net patterns | As frozen above (`safetyNet.js` at `525b41c`) |
| Python packages (working `.venv`) | torch 2.9.0, transformers 5.0.0, sentence-transformers 6.1.0, pydantic 2.12.5 |

The working `.venv` versions are the ones that produced every result in
`research/eval/results/`. `ml_service/requirements.txt` still pins torch
2.4.1 and pydantic 2.9.2, which differ. It must be brought into line, or a
fresh install will not reproduce this state.

**Known fragile answers.** Three development-set questions are
misclassified by V3. They get the right answer only because their
confidence is below the 0.5 scoping threshold, so retrieval runs unscoped
(`research/eval/results/suggested_questions_2026-10-14.csv`):

| Question | V3 prediction (confidence) | Scoped answer | Unscoped (live) answer |
|---|---|---|---|
| Q11 "is it normal for my period to be irregular" | sti (0.441) | KB-S4 (wrong) | KB-G3 (right) |
| Q14 "when do girls get their first period" | sti (0.368) | KB-S6 (wrong) | KB-G6 (right) |
| Q16 "is the clinic confidential" | contraception (0.414) | KB-C1 (wrong) | KB-G1 (right) |

Any change to the thresholds, the model or the knowledge base can flip
these. Q14 is also only 0.018 above the 0.35 no-answer cut-off. Q11 is the
"Periods" topic chip and Q16 a "You could also ask" follow-up on
`feature/ui-playful`; Q14 has been replaced there by Q15.
