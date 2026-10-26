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

## Supervisor guidance, 12 October 2026

Decisions given by the supervisor, Kelvin, on 12 October 2026:

- **Clinical and legal review.** Consult the industry mentor and the
  lecturer to find clinical and legal reviewers.
- **Scoped retrieval.** Keep classifier-scoped retrieval experimental.
  Report unscoped retrieval as a finding, with the reason.
- **V3.** Document V3's weaknesses on period and puberty questions.
  Retrain only after the planned evaluation; V4 is future work.
- **Answers.** Keep extractive answers, not an LLM.
- **Safety Net.** The keyword Safety Net is acceptable for a supervised
  prototype demo, provided its limits are stated and the referral numbers
  are verified.
- **Demo.** A rehearsed local demo of about six predefined queries, with
  no real adolescent users.
- **Pilot.** Consult the data protection officer and the ethics committee
  before any pilot with minors.
- **Milestone 2 must show:**
  - an integrated prototype;
  - completed authentication and privacy checks;
  - a keyword baseline against V3 comparison, with metrics and error
    analysis;
  - cross-validation, independent expert test and development-set results,
    reported separately;
  - a scoped against unscoped retrieval analysis;
  - updated diagrams;
  - documented limitations;
  - a rehearsed demo.

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

## "General" topic chip renamed "Periods" (2026-10-14)

The fourth topic chip in the chat was labelled "General", but the example
question it fills in is "is it normal for my period to be irregular"
(Q11 in the retrieval development set), and the greeting's scope line
names periods, not "general" topics. The chip is now labelled "Periods".
Only the label changed: the question, the fact that tapping a chip only
fills the input box, and the backend's category (`general`) are the same.

## Interface re-themed to the approved wireframes (2026-10-14)

The interface's teal, cream and coral palette was replaced with the
purple and lavender of the approved wireframes, to make it calm and
warm, with no alarm colours: coral and amber are gone from every screen,
including the referral and error states, which use deep purple for
emphasis. All colours are CSS variables in `app/interface/src/index.css`.
The screens follow the wireframes: a heart-in-circle logo, icons in lilac
circles, gradient primary buttons, pill-shaped chips and a rounded input.
The app icons and the manifest colours were regenerated to match. The
wireframe image was not yet in the repository, so the palette uses the
agreed starting values, refined by eye.

Rules: system fonts only (no web fonts), inline SVG icons, CSS
gradients, no new runtime dependency, text 16px or larger (the demo-only
details line is 14px), tap targets at least 44 x 44px, one visible 3px
focus ring, and no animation (a `prefers-reduced-motion` guard is in
place). The deliberate differences from the wireframe are listed in
`docs/design/ui-comparison.md`.

Contrast (WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text and UI):

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| ink `#2a1457` | page `#f7f2ff` / white / lilac `#efe6fc` / lilac-strong `#e2d3f8` | 14.29 / 15.72 / 13.02 / 11.16 | body text |
| ink-soft `#5b4a80` | page / white / lilac | 6.98 / 7.68 / 6.36 | secondary text, placeholder, details line |
| primary-deep `#3f1d96` | page / white / lilac / lilac-strong | 10.45 / 11.49 / 9.52 / 8.16 | headings, chip and button labels |
| primary `#5b2fc7` | page / white / lilac | 7.14 / 7.85 / 6.50 | phone-number links, icons, outline buttons, focus ring |
| white | gradient `#5b2fc7` to `#8b3fe0` | 7.85 to 5.41 | gradient buttons, user bubbles, send button |
| control-border `#8570b8` | white / page | 4.19 / 3.81 | input outline (UI, 3:1) |
| border `#d9c9f3` | white | 1.54 | decorative card borders and dividers only (no contrast requirement) |

Size: the production JS grew from 87.05 kB to 87.82 kB gzipped (+0.77 kB,
mostly the inline SVG icons) and the CSS from 2.30 kB to 2.31 kB, both
measured with the same build environment. Lighthouse (mobile) was the same
before and after: Performance 99, Accessibility 100, Best Practices 100,
SEO 91.

## Friendlier, more playful chat; Nunito font and gentle motion (2026-10-14)

The project owner asked for a more "girly", intuitive and fun interface.
This reverses two rules from the re-theme earlier the same day (system
fonts only; no animation):

- **Font.** Nunito, a rounded typeface chosen over Quicksand (thin
  strokes, harder to read in long answers) and Baloo 2 (too heavy for
  answer text). It is self-hosted in the app bundle (39 kB variable
  woff2, Latin, SIL OFL 1.1), never loaded from Google, so the privacy
  design is unchanged, and it is precached for offline use.
- **Motion.** Gentle only: bubbles slide in, controls press in, typing
  dots bounce. It runs only when the device does not ask for reduced
  motion.

Also added: icons and pastel colours on the topic chips, a "Not sure
where to start?" hint, a friendlier placeholder, "You could also ask"
follow-ups (verbatim "clear" development-set queries on the answer's
topic, which only fill the input box), pastel background blobs, sparkles
and a smiling-heart mascot.

**The help panel, the referral screen and error messages stay calm**:
they keep the font and colours but get no motion, decoration or playful
wording, because a girl may see them at a hard moment. The placeholder
does not say "ask me anything", for the same scope reason as the
greeting.

Cost: JS +1.09 kB and CSS +0.79 kB gzipped, plus the 39 kB font
(downloaded once, then cached). Lighthouse (mobile, localhost):
Performance 98 (first paint 1.5 s to 1.8 s while the font loads, no
layout shift), Accessibility 100, Best Practices 100, SEO 91. The chip
tints keep labels at 9:1 or more and icons at 6:1 or more.

## Safety Net patterns frozen (2026-10-15)

Safety Net patterns frozen on 2026-10-15; no pattern changes before
Milestone 2 except a verified defect.

The frozen state is `app/gateway/src/safetyNet.js` as of commit `525b41c` (before history cleanup; now `b4c4d29`):
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
| Knowledge base | `ml_service/knowledge_base.json` as of commit `42366d6` (before history cleanup; now `f27db1f`) (21 entries), SHA-256 `e78a82afd10491fdc81d98bb2fca43119312be6908af7c4372ee2778d9dc1e30`; the gateway's local copy from the same markdown sources |
| Safety Net patterns | As frozen above (`safetyNet.js` at `525b41c` (before history cleanup; now `b4c4d29`)) |
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

## Safety Net "at" exclusion narrowed: the one freeze exception (2026-10-15)

**This is the only exception to the Safety Net pattern freeze above.** It
was agreed as a verified defect: J08 "my uncle drinks and hits us at
home" was missed.

**Why.** The "hits / beats / slaps me or others" rule skipped any match
followed by the bare word "at". That was meant for "beat me at chess",
but it also hid "at home", so violence at home was not referred.

**What changed.** In that one rule, the bare "at" exclusion is replaced
by "at" followed by a game or sport (the existing GAME list, for example
"at chess", "at football", "at netball", "at the game", "at school
sports") or by maths, practice or training. Every other exclusion is
unchanged, and "class" is still not listed. No other rule, keyword,
threshold or the classifier changed: 43 keyword phrases and 44 pattern
rules, as before. The offline copy has the same regex source and the
parity test passes.

**Effect** (all post-patch, not independent):

| Set | Recall before / after | False referrals before / after |
|---|---|---|
| Hold-out 1 | 18/19 / 18/19 | 0/10 / 0/10 |
| Hold-out 2 | 15/16 / 16/16 (J08 now referred) | 2/10 / 2/10 |
| Hold-out 3 | 9/14 / 9/14 | 2/10 / 2/10 |
| 58-query set, safety rows | 6/6 / 6/6 | 0/3 / 0/3 |
| 58-query set, all other rows | – | 0/49 / 0/49 |

Gateway and offline agree on every row. The sealed hold-out 3 result
(6/14, 2/10) is unchanged and its file was not touched. The per-row
files already in `research/eval/results/` were not rewritten, so
`safety_holdout_2_postpatch.csv` still shows J08 as missed.

## Classifier skipped on flagged queries: a freeze exception (2026-10-15)

**This is an explicit exception to the demo freeze above, for the
pipeline order only.** No model, threshold, knowledge-base entry or
Safety Net pattern changed.

**What was wrong.** The gateway sent every flagged query to the
classifier (`ml_service` `/classify`, or the keyword fallback) before
returning the referral, and reported the prediction in the response.
Nothing used it: the Safety Net never reads the classifier's result.
The call was inherited from the parallel safety and classification
design in the proposal diagrams (`Promise.all` since commit `4a532a2`,
2026-09-04). Commit `ae6f2f1` (2026-10-06) made the Safety-Net-first
order explicit but kept the call ("flagged queries still run the
classifier as before"). The code comment said this "preserves the
independence" of the two components, but there was no independent
reason: the Safety Net result is computed first and never depends on
the classifier.

**What changed.** Flagged queries are no longer classified, in the
gateway (`app/gateway/src/backend.js`) and in the offline pipeline
(`app/interface/src/offline/offlinePipeline.ts`). A referral now
reports `classificationSkipped: true` and null `predictedCategory`,
`classifierSource` and `confidence`.

**Why.** A referral no longer waits on `ml_service`, which could take up
to the 3 s classifier timeout when it was slow or down, and a
disclosure's text is no longer sent to another process. FR-04 ("the
system suppresses the classification-retrieval-generation pipeline and
returns referral guidance instead") is now met.

**Effect on results.** Outcomes are unchanged: a flagged query got the
referral before and gets it now, so no Safety Net, hold-out or
retrieval figure changes. In evaluation runs made after this date,
the `gw_predicted_category`, `gw_classifier_source` and `gw_confidence`
columns are empty for flagged rows; earlier result files keep the old
values. The classifier's prediction for any query can still be read
from `ml_service` directly.

## Scoring rule for expert test sets (2026-10-15)

Fixed before any further expert-test evaluation, for DR-04 and for the
fresh expert test still to be run (R5).

**Rule.**
- **Primary result:** the single-label questions only. A prediction is
  correct if it matches the expert's class.
- **Secondary result:** every question the experts gave two categories
  (in DR-04: TEST-014, TEST-015 and TEST-030) is reported separately. A
  prediction counts as correct if it matches either category.
- The primary and secondary results are **never pooled** into one
  figure.

**DR-04 is not an independent set for V3.** V2 was evaluated on it once,
blind, on 17 September 2026. V3.1 was then run on it as a disclosed
non-blind reuse (`research/experiments/logs/v3_1_training_log.txt`), so
any V3 figure on DR-04 is a sanity check, not an independent result.
No keyword-baseline result on DR-04 was found. See
`docs/requirements-traceability.md`, DR-04.

**The fresh expert test (R5)** is to be run once, after the demo freeze,
for V3 and the frozen keyword baseline under identical conditions (same
questions, same labels, same scoring rule), with the primary and
secondary results reported separately.

## Relevance gate behind a flag (2026-10-15)

**This is an explicit exception to the demo freeze: a new component,
not a change to any frozen item.** No model, threshold, knowledge-base
entry or Safety Net pattern changed. The gate is **off by default** and
on only when `RELEVANCE_GATE` is exactly `true`, so the frozen demo
behaves as before unless it is switched on.

**What it does.** After retrieval, the gateway compares the top-1
unscoped retrieval score from `ml_service` with 0.8439. Below it, the
query gets the existing no-answer response (the standard help message,
with no medical claim, no score and no entry text) instead of the
retrieved entry; at or above it, the answer is unchanged. The order is
Safety Net, help signposting, classifier, retrieval, then the gate, so a
flagged query or a signposting response never reaches it. When
retrieval was scoped, one extra unscoped `/retrieve` call gets the score.
Without an `ml_service` score (keyword fallback, local retrieval or a
classifier abstain) the gate is not applied. The offline pipeline is not
gated, because it has no semantic retrieval scores. Code:
`app/gateway/src/relevanceGate.js` (the threshold is one constant there).

**Where the threshold came from.** 0.8439 was the highest unscoped
score threshold that kept at least 90% of the development set's
answerable queries (`research/eval/results/classifier_analysis.md`). It
was then run once, unchanged, on `resources/eval/relevance_validation.csv`
with a pass criterion fixed beforehand
(`research/eval/results/labels_and_gate_2026-10-15.md`):
- in-scope answered 18/20 (90.0%, exactly the 90% bar), wrongly
  rejecting V03 and V19;
- off-topic rejected 8/8;
- out-of-scope health rejected 4/6 (V33 and V34 were answered with
  unrelated entries).

It is not to be tuned, and the validation file is not to be re-run to
adjust it.

**Not independent.** 12 of the 20 in-scope validation questions
paraphrase development-set questions, so the validation set is not
independent of the data the threshold was chosen on, and the samples are
small.

**Known failure.** "Can I get pregnant from precum?" has no
knowledge-base entry. Its unscoped score is 0.8440, just above the
threshold, so the gate lets it through and it is still answered with the
wrong entry, KB-P5 (school re-entry)
(`research/eval/results/coverage_gap_examples_2026-10-15.csv`).

## Reply kind and matched question in every response (2026-10-20)

Approved by Cindy on 20 October 2026, as part of the response-clarity
fixes (`fix/response-clarity`). **No frozen item changed**: no model,
threshold, knowledge-base text or Safety Net pattern. Two fields are
added to every gateway response; no existing field changes.

**Why.** The UI audit ([`docs/design/ui-audit-2026-10-20.md`](design/ui-audit-2026-10-20.md),
UI-01) found that a loosely matched answer is shown as a direct reply:
"Am I okay?" got KB-S4, "It could be. Unusual discharge…", with nothing
to say it answers "I have unusual discharge, itching, burning or lower
belly pain. Could it be an STI?". The interface could not show the
matched question because the response did not carry it.

**What changed** (`app/gateway/src/responseOrchestrator.js`):
- `matchedQuestion`: the "User question" of the knowledge-base entry
  the answer came from, verbatim, or `null` when no entry was served
  (no answer, the relevance gate abstained, help, referral).
- `kind`, one of `REPLY_KINDS`:

  | `kind` | When |
  |---|---|
  | `answer-scoped` | An answer retrieved within the predicted category (`retrievalScope: "scoped"`) |
  | `answer-unscoped` | An answer retrieved across all categories (`"unscoped"`), or by local keyword retrieval after the keyword fallback (`"local"`), where the classifier's confidence is unknown |
  | `abstain` | The standard no-answer message: classifier abstain, relevance gate abstain, or no entry found |
  | `help` | A generic help request (`outcome: "signposting"`) |
  | `vague` | Reserved for the vague-query rule (added in a later step) |
  | `referral` | The Safety Net flagged the query |

The interface type (`QueryResponse` in `app/interface/src/types.ts`) has
the same two fields and a `ReplyKind` union; a gateway test checks the
union against `REPLY_KINDS`. The interface does not use the fields yet.

## Relevance gate on by default (2026-10-20)

Approved by Cindy on 20 October 2026 (`fix/response-clarity`). The gate
added on 15 October ("Relevance gate behind a flag", above) is now **on
by default**. `RELEVANCE_GATE=false` turns it off and restores the
earlier behaviour; any other value, or none, leaves it on, so a typo
cannot switch it off. **The threshold stays 0.8439** and was not
re-examined; no model, threshold, knowledge-base entry or Safety Net
pattern changed. Code: `isRelevanceGateEnabled` in
`app/gateway/src/relevanceGate.js`.

**Why.** With the gate off, vague queries got unrelated entries stated
as answers: "Am I okay?", "I feel strange" and "Do I have it?" all got
KB-S4 ("It could be. Unusual discharge…"), and "I'm worried" got the
pregnancy warning signs (UI audit, UI-01).

**Validation result (unchanged, from the one run on 15 October).** 2 of
20 in-scope validation questions are wrongly rejected: V03 "is it true
that family planning makes you barren" (0.8285) and V19 "is clinic
private" (0.8259). Off-topic 8/8 and out-of-scope health 4/6 are
rejected (`research/eval/results/labels_and_gate_2026-10-15.md`).

**Example questions.** All 13 example questions the interface offers (4
topic chips and the "You could also ask" follow-ups) pass the gate.
Checked on 20 October 2026 against the live gateway and `ml_service`,
with the gate on by default: each was answered with the same entry as
before, `relevanceGate: "passed"`. Their top-1 unscoped scores run from
0.8570 ("will the injection make me unable to have kids", KB-C5; 0.013
above the threshold) to 0.9239. This is a check, not a tuning step: the
threshold was not changed with these scores in view.

**Vague queries.** In the same run, 7 of the 8 vague test queries got
the standard no-answer message from the gate ("Am I okay?", "Is this
normal?", "I feel strange", "Can I ask you something?", "I'm worried",
"What should I do?", "Do I have it?"); "hmm" was already a classifier
abstain (confidence 0.302).

**Costs and limits.**
- A scoped query makes one extra unscoped `/retrieve` call for the
  gate's score.
- V03 and V19 type questions (in scope, but worded unlike any entry) now
  get the no-answer message.
- The known failure stands: "Can I get pregnant from precum?" (0.8440)
  still passes the gate and gets KB-P5.
- The offline pipeline is still not gated; it has no retrieval scores.

## Vague-query rule (2026-10-20)

Approved by Cindy on 20 October 2026 (`fix/response-clarity`). **No
frozen item changed**: no model, threshold, knowledge-base text or
Safety Net pattern. A new fixed rule runs after the Safety Net and the
help rule and before the classifier (`app/gateway/src/vagueQuery.js`,
wired in `backend.js`).

**What it does.** A query is vague when it has **at most three content
words and none of them is a health term**. It then gets a clarifying
question instead of an answer: "I'm not sure what you mean. Is your
question about periods, pregnancy, contraception or STIs?"
(`VAGUE_QUERY_MESSAGE` in `content/helpContent.js`; `outcome:
"clarification"`, `kind: "vague"`; no classification or retrieval, so
`ml_service` is not called). A flagged query still gets the referral and
a help request still gets signposting; the rule is never consulted for
either.

**Content words, not all words (a deviation from the brief).** The brief
said "3 words or fewer". Counted literally, three of the eight required
vague queries are longer ("Can I ask you something?" has five words,
"What should I do?" and "Do I have it?" four), so the rule could not
intercept them. The rule therefore counts **content words**: the words
left after normalising the query as the help rule does and setting
aside common English function words (pronouns, articles, auxiliaries,
prepositions, conjunctions, question words; `FUNCTION_WORDS` in
`vagueQuery.js`). "What should I do?" has none; "Can I ask you
something?" has two. **This interpretation needs confirming.**

**How the health-term list is built.**
`app/gateway/scripts/build-health-terms.js` reads the active knowledge
base (the entries the gateway serves; HELD content is never read),
collects every word of each entry's user question, answer,
evidence/claim, conditions and safety notes (724 distinct words), and
writes the selected terms to `app/gateway/src/content/healthTerms.json`
(122 terms). It refuses to write a term that is not a knowledge-base
word. The selection is by hand, by one criterion: the word names a body
part, a symptom, a condition or infection, pregnancy, periods, puberty
or sex, a contraceptive method, a medicine, a test or treatment, or a
health service or worker. Words with an everyday meaning are left out
("exam", "exams", "irregular", "tired", "emergency", "ring", "fits",
"growth", "care", "normal", "worried", "feel"), as are privacy words
("confidential", "privacy"). A query word matches a term as written or
with a plural "s" or "es" added or removed. `--check` reports a stale
list, and a gateway test fails if the list is out of date.

**Not independent.** The selection was made with the eight vague queries
and the other required sets known, so the counts below show the rule
does what it was built to do; they are not an independent measure.

**Result** (`app/gateway/test/vagueQuery.test.js`, which reads each set
from the repository):

| Set | Intercepted | Required |
|---|---|---|
| 8 vague test queries | **8/8** | all |
| 13 example questions (chips and follow-ups) | **0/13** | none |
| 35 labelled development-set queries | **0/35** | none |
| 31 DR-04 test queries | **3/31** | none: **not met** |

The three DR-04 queries the rule answers itself are "What can I do when
I mess up ?" (the expert's own note says it "can fit into any of the
other categories"), "How is a coil inserted?" and "Tell me how to use a
tampon?". "coil" and "tampon" are not knowledge-base words, so a list
built from the knowledge base cannot contain them. They were **not**
added: choosing words with DR-04 in view would make the rule depend on
the independent test set, and the list would no longer come from the
knowledge base. This is an open failure (TC-079), left for a decision.

Live, on 20 October 2026, all 8 vague queries got the clarifying
question and all 13 example questions were answered as before.

**Other effects and limits.**
- On the 23 unlabelled development-set rows, the 5 off-topic queries
  ("what is the capital of Kenya", ...) now get the clarifying question
  instead of an unrelated entry. So do the in-domain gap "When should I
  start antenatal visits?" (Q43, Q53; "antenatal" is not a
  knowledge-base word, and no entry covers it) and two Safety Net
  negatives, "my teacher threatened to fail me" and "I am so tired of
  exams".
- A health word missing from the knowledge base ("coil", "tampon",
  "antenatal", "doctor", "STD") cannot stop the rule, so a short
  question built on one gets the clarifying question.
- Short questions in Swahili or Sheng with no English health term (for
  example "niko na mimba?") get the clarifying question; before, they
  went to the multilingual retrieval model.
- The offline pipeline does not have the rule yet (see the offline
  parity entry below).

## Help and no-answer wording (2026-10-20)

Approved by Cindy on 20 October 2026 (`fix/response-clarity`). **Text
only**: no number, no `HELP_CONTACTS_VERIFIED` value and no referral
message changed. Both messages keep the shared help text
(`HELP_GUIDANCE`: a nurse or counsellor, the GBV helpline 1195 and
Childline Kenya 116) and get a new first sentence.

| Message | Before | Now |
|---|---|---|
| Help reply (`SIGNPOSTING_MESSAGE`) | "I don't have information on that yet. A nurse or counsellor …" | "You're not alone. These people can help right now. A nurse or counsellor …" |
| No-answer reply (`NO_ANSWER_MESSAGE`) | "A nurse or counsellor …" | "I couldn't find a good answer to that. A nurse or counsellor …" |

**Why.** The UI audit (UI-02, UI-03) found that a request for help was
answered as if a question had gone unanswered, and that the no-answer
reply gave helpline numbers with no word that nothing was found, so it
read like a crisis referral.

The gateway copy (`app/gateway/src/content/helpContent.js`) is the
source of truth. The offline copy (`app/interface/src/offline/helpContent.ts`)
now has the same `HELP_GUIDANCE`, `SIGNPOSTING_MESSAGE` and
`NO_ANSWER_MESSAGE`, and the parity test compares all three. The
evaluation scripts (`research/eval/run_eval.js`, `labels_and_gate.js`)
import `NO_ANSWER_MESSAGE` rather than copying it, so they follow the
change.

## Offline parity for the help and vague-query rules (2026-10-20)

Approved by Cindy on 20 October 2026 (`fix/response-clarity`). **No
frozen item changed.** The offline pipeline the app uses
(`app/interface/src/offline/offlinePipeline.ts`) now runs the gateway's
order: Safety Net, **help rule, vague-query rule**, then the keyword
classifier and a general answer.

**Why.** Offline, "Help" got the general sentence "Youth-friendly health
services should provide respectful, confidential information and
care…", and vague queries got one of the four category sentences (UI
audit UI-07, section 7).

**What changed.**
- `app/interface/src/offline/queryRules.ts`: ports of the help rule
  (`helpSignposting.js`) and the vague-query rule (`vagueQuery.js`) in
  one file with no imports, so Node can load it in the parity test, as
  it does `safetyNet.ts`. Its health terms are a generated block written
  by `app/gateway/scripts/build-health-terms.js` with the gateway's
  list, so both copies change together.
- `offlinePipeline.ts`: "Help" gets the signposting message
  (`outcome: "signposting"`, `kind: "help"`); a vague query gets the
  clarifying question (`outcome: "clarification"`, `kind: "vague"`); a
  referral now carries `kind: "referral"`. The general limited-mode
  answers carry no `kind`: they come from no knowledge-base entry.
- `offline/helpContent.ts` gains `VAGUE_QUERY_MESSAGE`.

**Tests.** The gateway parity test (`offlineSafetyParity.test.js`) now
also compares the help patterns, the function words, the word limit, the
health terms and the clarifying question, and runs every shared case
(help cases, the vague queries, the example questions, all 58
development-set queries, the 31 DR-04 queries and the Safety Net cases)
through both copies of both rules. The original 9 parity tests still
pass; with the message test added on 20 October the file has 14. The
interface's offline test now also runs the pipeline the app ships
(`offlinePipeline.ts`): until now it ran only `pipeline.ts`, which the
app does not use.

`offline/pipeline.ts` is unchanged and still unused by the app.

## Health terms from outside the knowledge base (2026-10-20)

Decided by Cindy on 20 October 2026, after the vague-query rule's first
results (`fix/response-clarity`, Stage A step 7). **No frozen item
changed**: no model, threshold, knowledge-base text or Safety Net
pattern.

**Decisions.**
1. **The content-word reading of "3 words or fewer" is confirmed**, and
   the function-word list is frozen as below.
2. **A small, documented list of health terms from outside the
   knowledge base is added**, built from whole categories of general
   vocabulary, not from individual queries.
3. **The rule's side effects are accepted** and recorded as
   limitations: the clarifying question is English-only, and Swahili and
   Sheng are out of scope (DR-07). See `docs/chapter5-notes.md`.

**Frozen function-word list** (`FUNCTION_WORDS` in
`app/gateway/src/vagueQuery.js`, copied in
`app/interface/src/offline/queryRules.ts`). 166 words, written as the
rule normalises a query (lowercase, apostrophes removed). SHA-256 of
the words sorted and joined with newlines:
`78c4667147a1b043a0ae9428435c7cd9a9e8108b308c3dd0b6f3c251b1339a7b`.
A gateway test fails if the list changes, and the parity test keeps the
offline copy identical.

a, about, above, after, again, against, all, am, an, and, any, are,
arent, as, at, be, because, been, before, being, below, between, both,
but, by, can, cannot, cant, could, couldnt, did, didnt, do, does,
doesnt, doing, dont, down, during, each, few, for, from, further, had,
hadnt, has, hasnt, have, havent, having, he, hed, her, here, hers,
herself, hes, him, himself, his, how, hows, i, id, if, ill, im, in,
into, is, isnt, it, its, itself, ive, just, lets, may, me, might, more,
most, must, my, myself, no, nor, not, of, off, on, once, only, or,
other, ought, our, ours, ourselves, out, over, own, r, same, shall,
she, shes, should, shouldnt, so, some, such, than, that, thats, the,
their, theirs, them, themselves, then, there, theres, these, they,
theyre, this, those, through, to, too, u, under, until, up, ur, very,
was, wasnt, we, were, werent, what, whats, when, where, which, while,
who, whom, why, will, with, wont, would, wouldnt, you, youd, youll,
your, youre, yours, yourself, yourselves, youve.

**The extra list.** `app/gateway/src/content/extraHealthTerms.json`,
written by hand. The gateway reads it; `scripts/build-health-terms.js`
checks its form (lowercase words, single spaces, no duplicates, a
criterion for every category) and copies it into the generated block of
the offline `queryRules.ts`, so the same drift test covers both lists. A
term with a space is a phrase ("pulled out", "emergency pill"), matched
against the whole normalised query, function words included; a single
word matches with a plural "s" or "es" added or removed, as for the
knowledge-base list. The criterion per category, also in the file:

| Category | Criterion | Terms |
|---|---|---|
| Contraceptive methods and names | A contraceptive method, device or brand name in common use in Kenya, or a common way of describing one (including withdrawal) | 35 |
| Menstrual and body | Menstrual products and periods, the reproductive and urinary body, and common words for genital symptoms or sexual activity | 46 |
| STIs and HIV | A sexually transmitted infection, HIV, a common genital infection, or a medicine or test for one | 19 |
| Pregnancy | Pregnancy, conception, its care and its end, and the words commonly used for a pregnancy scare (a late or missed period, a positive or negative test) | 22 |

122 terms: 113 single words and 9 phrases. 20 of the words are also in
the knowledge-base list. With the 122 knowledge-base terms the rule
knows 215 distinct single words and 9 phrases. Beyond the terms named in
the brief, the additions come from general knowledge of each category
(for example spelling variants such as "gonorrhea", Kenyan brand names
such as "postinor" and "jadelle", and body words such as "cervix"), not
from any test query; `docs/testing/demo-risk-set.csv` was not opened.

Some extra terms are everyday words ("late", "missed", "positive",
"negative", "test", "scan", "cup", "ring", "patch", "burn"). They were
asked for; a short query containing one now goes to the classifier
rather than getting the clarifying question.

**The DR-04 recheck is non-blind for this rule.** The extra terms were
added **after** the vague-query rule's three DR-04 catches had been seen
("What can I do when I mess up ?", "How is a coil inserted?", "Tell me
how to use a tampon?"; TC-079). The terms were chosen by category of
general vocabulary, not to fit those queries, but "coil" and "tampon"
are among them and were chosen knowing those catches. The recheck (1/31
caught, TC-090) therefore does not measure how the rule would do on
unseen expert questions, and DR-04 is no longer an independent test of
the vague-query rule. TC-079 keeps its original Fail. No word was added
for the remaining catch, "What can I do when I mess up ?", which names
no topic.

## Held-topic rule (2026-10-20)

Requested by Cindy on 20 October 2026 (`fix/held-topics`). **No frozen
item changed**: no model, knowledge-base text, threshold (0.35, 0.5,
gate 0.8439), Safety Net pattern, help number or
`HELP_CONTACTS_VERIFIED`.

**Why.** The demo-risk run (`docs/testing/demo-risk-results.csv`)
showed that topics the knowledge base does not cover get confident
wrong answers: with the gate on, "I forgot my pill, am I still
protected?" got KB-C4 ("Yes, if you want protection from STIs…"), "I
don't want to be pregnant, what are my options?" got KB-P7 (iron and
folic acid), and "I got a positive pregnancy test… now what?" got KB-P6
(danger signs). Until a clinician approves content, these topics get a
neutral signpost instead of a guess.

**What it does.** A fixed rule after the Safety Net and the help rule,
before the vague-query rule and the classifier
(`app/gateway/src/heldTopics.js`, wired in `backend.js`). A query that
matches a held-topic pattern gets the signpost for its group, with no
classification or retrieval, so `ml_service` is not called:
`outcome: "held"`, `kind: "held-topic"` (a new reply kind), and a new
field `heldTopicGroup` ("A" or "B"). A flagged query still gets the
referral and a help request still gets signposting.

**Patterns** (`app/gateway/src/content/heldTopics.json`, one
hand-written file; copied into the offline pipeline by
`scripts/build-held-topics.js`, with a drift test). Queries are
tokenised as for the health-term lists. A pattern is a single word
(matching with a plural added or removed), a phrase (consecutive
words), or a word set written "a+b" (every word present, in any order,
so "he broke the condom" matches `condom+broke`). Groups are checked in
order, so a query matching both gets group A's reply.

| Group | Criterion | Patterns |
|---|---|---|
| A: after sex or contraception failure | Emergency contraception by name or description, a condom that failed, a missed or late pill, withdrawal, sex without protection, or pre-ejaculate | 41 (P2, postinor, morning after, emergency pill or contraception, plan b; condom with burst, broke, slipped, tore, split and similar; pill with forgot, missed, skipped, late; pulled out, withdrawal; unprotected, without a condom, no protection; precum, pre-ejaculate) |
| B: pregnancy decisions | A positive pregnancy test, an unwanted or unplanned pregnancy, or ending a pregnancy | 21 (positive pregnancy test; unwanted or unplanned pregnancy; "don't want to be pregnant", "don't want the baby"; abortion, abort, terminate, termination; "get rid of the pregnancy", "get rid of the baby") |

**"Get rid of" is narrowed.** The brief listed "get rid of". Bare, it
would also match "how do I get rid of period cramps" or itching, so the
patterns are "get rid of the pregnancy", "… a pregnancy", "… my
pregnancy", "… pregnancy" and "… the baby". This needs confirming.

**Replies: provisional, pending clinician sign-off.** In
`content/helpContent.js` (`HELD_TOPIC_MESSAGES`), using the existing
help numbers:
- A: "This is an important question, and I can't answer it safely here
  yet. A nurse, a pharmacist or a clinic can help, and you do not have to
  give a reason. If something happened recently, do not wait: some
  options work best soon after sex. If you are in danger or someone has
  hurt you, call the GBV helpline 1195. Childline Kenya, 116, is free
  for anyone under 18."
- B: "This is an important question, and I can't answer it safely here
  yet. A nurse or counsellor can talk it through with you privately and
  without judgement, and you do not have to give a reason. If you are in
  danger or someone has hurt you, call the GBV helpline 1195. Childline
  Kenya, 116, is free for anyone under 18."

**Not independent: the demo-risk run is non-blind for this rule.** The
patterns were written from general vocabulary, by category, and not
from any single query, but **after the demo-risk results had been
seen**. Counts on the demo-risk set therefore show the rule does what
it was built to do; they are not an independent measure.

**Offline (same date).** The offline pipeline the app ships
(`app/interface/src/offline/offlinePipeline.ts`) runs the held-topic
rule in the gateway's position: Safety Net, help rule, held-topic rule,
vague-query rule, then the keyword classifier. The matcher is ported in
`offline/queryRules.ts`, which holds a generated copy of the patterns
(`scripts/build-held-topics.js`, drift-tested), and the two replies are
mirrored in `offline/helpContent.ts`. The parity test compares the
groups, the patterns and the replies, and runs every shared case
through both matchers.

## Held-topic group C: possible pregnancy and testing (2026-10-20)

Requested by Cindy on 20 October 2026 (`fix/held-topics-c`). **No
frozen item changed**: no model, knowledge-base text, threshold, Safety
Net pattern, help number or `HELP_CONTACTS_VERIFIED`. Extends the
held-topic rule above with a third group, in the same file
(`app/gateway/src/content/heldTopics.json`) and the same matcher.

**Why.** In the demo-risk run, questions about a late period or
pregnancy testing got unrelated entries stated as answers: the
pregnancy danger signs (KB-P6), school re-entry (KB-P5) and the pelvic
exam entry (KB-P1). No entry covers these questions.

**Criterion.** A late, missed, delayed or overdue period, or no
period; a period that has not come; asking whether one could be
pregnant; when to take a pregnancy test; or a negative test with no
period. A question about periods in general (whether they are normal
or irregular, or period pain) is not included. 35 patterns, by
category:

| Category | Patterns |
|---|---|
| Late, missed, delayed or overdue period | `period+late`, `period+missed`, `period+delayed`, `period+overdue`, `period+skipped`, "late period", "missed period" |
| No period | "no period", "no periods" |
| Period has not come | `period+hasnt+come`, `period+has+not+come`, `period+didnt+come`, `period+did+not+come`, `period+not+come`, `period+not+coming`, `period+isnt+coming`, `period+isnt+here`, `period+not+here` |
| Could I be pregnant | "am i pregnant", "could i be pregnant", "might i be pregnant", "can i be pregnant", "i might be pregnant", "maybe i am pregnant", "maybe im pregnant", "i think i am pregnant", "i think im pregnant" |
| Pregnancy test timing | `pregnancy+test+` with when, soon, early, long, days, weeks or after |
| Negative test with no period | `test+negative+period` |

Every period pattern needs a word for lateness or absence, so "Is my
period normal", "irregular periods" and "period pain" do not match
(tested), and the knowledge-base question "Is my period normal, and
when should I see a health worker?" is still answered.

**Priority.** Groups are checked in order A, then B, then C, so "Does
P2 make your period come late?" keeps group A's reply.

**Reply: provisional, pending clinician sign-off** (`HELD_TOPIC_MESSAGES.C`
in `content/helpContent.js`; `kind: "held-topic"`, `heldTopicGroup:
"C"`): "A late period can have many causes, including pregnancy, so it
is worth checking. A pharmacist or clinic can help you do a pregnancy
test, and a nurse can talk it through with you privately and without
judgement. You do not have to give a reason. If you have heavy bleeding
or severe pain, go to a health facility straight away."

**Not independent.** The patterns were written by category of general
vocabulary, not from any single query, but **after the demo-risk
results had been seen**, so the demo-risk count for group C is
non-blind.

The offline copy of the patterns is generated from the same file, and
the offline types and reply map accept group C (same commit), so the
interface keeps compiling; offline tests and parity follow.

**Offline and tests (same date).** The offline pipeline gives the
group C signpost from the same generated patterns and a mirrored reply;
the parity test runs the group C cases through both matchers. Tests:
TC-099 to TC-105.

## Quick exit (2026-10-20)

Decided by Cindy on 20 October 2026 (`fix/ui-redesign`, Stage B2 step
2). The interface had no quick exit; this builds one. **No frozen item
changed.**

**What it does** (`app/interface/src/quickExit.ts`, wired in `App.tsx`):
an "Exit" button in the header of every screen, always visible, 44px
tall, never in a menu. On tap, the app clears its in-memory chat and
screen state and sessionStorage, then calls
`location.replace(EXIT_URL)` with `EXIT_URL = "https://www.google.com"`
(one constant), so the SafeGirl page is replaced in the tab instead of
being left in its back history. Escape pressed twice within one second
does the same. There is no confirmation and no animation.
`window.close()` is not used: browsers and the installed PWA often
ignore it. Blocked storage never stops the exit.

**Limit.** Quick exit does **not** remove the visit from the browser's
own history, and it does not remove SafeGirl from the phone's app
switcher or recent apps. The interface must never claim that it does;
the Help sheet (step 3) will describe the double-Escape shortcut without
that claim.

**Tests:** `app/interface/src/quickExit.test.ts` and
`components.test.tsx` (TC-106 to TC-110).

**Footer line (same step).** Every screen now ends with "In danger?
Call 1195, free and open 24 hours.", with a tap-to-call link built from
`GBV_HELPLINE`; on the chat screen it sits directly above the ask bar
(TC-111). The constants describe 1195 differently: the help panel says
"GBV helpline … For violence or abuse.". **Source of the "free and open
24 hours" claim:** Cindy verified by phone call on 20 October 2026 that
1195 is free, open 24 hours a day, 7 days a week, and answers in
English and Kiswahili. That check covers 1195 only.
`HELP_CONTACTS_VERIFIED` stays `false` (the other numbers are not
confirmed), and the constants were not edited.

## Splash and Help sheet (2026-10-20)

Stage B2 step 3 (`fix/ui-redesign`), on Cindy's brief. **No frozen
item changed.**

**Splash.** The splash replaces the disclaimer screen and is the
once-per-session privacy and safety disclaimer (FR-05): a plum-to-orchid
surface with the logo, the wordmark (the page's `<h1>`), the tagline
"Honest answers about your body, health and growing up.", three
promises, the privacy line, "I understand, continue", and the footer
line. A sessionStorage flag (read and written inside try/catch) keeps
it from showing again in the same session; with storage blocked it
shows on every load and still works (`app/interface/src/splashSession.ts`).
Wording against the old disclaimer:

| Old disclaimer | Splash |
|---|---|
| Heading "You're in a safe space" | Wordmark "SafeGirl" and tagline "Honest answers about your body, health and growing up." |
| "You're safe here, no login needed" | "Anonymous. We never ask for your name." |
| "We don't save your questions or your answers." | Kept unchanged, below the promises (the privacy part of FR-05) |
| "We're here to help, but a doctor or nurse can too." | "Not a doctor. This can't diagnose you. A nurse or clinic can." |
| (none) | "Real guidance. Most answers come from Kenyan Ministry of Health and WHO guidance." (step 3b; first "Answers come from … sources") |
| Button "Continue" | "I understand, continue" |
| (none) | The footer line "In danger? Call 1195, free and open 24 hours." |

**"Real guidance" line: resolved (step 3b).** The line now reads "Most
answers come from Kenyan Ministry of Health and WHO guidance.", one
constant (`SOURCES_LINE` in `app/interface/src/content/uiText.ts`) used
on the splash, in the Help sheet and, from step 4, on Home. "Most",
because four of the 21 active entries cite other sources: KB-P5 only
Kenya's Ministry of Education, KB-G6 only the American Academy of
Pediatrics, and KB-G3 and KB-G4 the NHS alongside WHO.

**Help sheet** (`components/HelpSheet.tsx`), replacing the support panel
behind the Help button: "How SafeGirl works" (including how to leave
quickly, without claiming that history is cleared), "Tips for asking",
"Need to talk to someone?" (1195 with "GBV helpline. Free, 24 hours,
English and Kiswahili.", from the phone check recorded above; 116 with
"Childline Kenya, for children and young people.", with no cost or age
claim; "In immediate danger? Call 999 or 112."), and the four topic
buttons. Every number comes from the constants. It is a labelled modal
dialog: focus moves to its close button, Tab stays inside, Escape or
Close closes it and returns focus to the Help button. Because the sheet
covers the header, it has its own Exit button. Until the Topic list
exists (step 5), a topic button closes the sheet and focuses the ask bar.

**Escape rule.** An Escape that closes the sheet does not count towards
the double-Escape exit. App listens in the capture phase, so it sees the
press while the sheet is still open; a bubbling listener saw it already
closed (React re-renders at once after a key press) and counted it,
which the browser check caught (TC-113).

Tests: TC-113 to TC-122.

**Splash layout (step 3b, same date).** The splash is now a full-bleed
screen of its own, as designed: the gradient #3B0F6B, #5B21B6, #A21CAF
at 165 degrees, with no app header and no Help button; a compact Exit
pill top right (double Escape works there too); decoration (two soft
circles and two sparkles) hidden from screen readers; the shared
shield-and-heart mark on an 84px light tile; the wordmark as the only
`<h1>`; three glass promise cards with icon tiles; the privacy line;
the button and the footer line pinned at the bottom. The same
shield-and-heart mark, on a violet-to-rose tile, replaces the
heart-in-a-circle in the header (`ShieldHeartMark` in
`components/Icons.tsx`); the PWA icons are unchanged.

Contrast, worst case (the lightest stop, #A21CAF, with a glow on top):
white text 5.01:1; the glass cards' and the Exit pill's fill was
darkened from 14% to 7% white, because 14% gave white text 4.04:1 (the
pill's 18% gave 3.76:1); at 7% it is 4.52:1. The tagline and privacy
line keep #F6E9FF: 4.95:1, because the rose glow ends 150px from the
top and the tagline starts at 212px (measured in the browser at 320,
360 and 390px); over the rose glow it would be 4.30:1. Button text
#4C1D95 on white 10.95:1; promise icons on their white tiles 6.04:1 or
more; the header mark's white shield and heart 4.60:1.

**Open item: the 116 claim in the replies.** The help-guidance text in
the constants says "Childline Kenya, 116, is free for anyone under 18",
and the abuse referral says "Childline Kenya 116 (for anyone under
18)". Neither the cost nor the age limit is confirmed (the phone check
of 20 October covered 1195 only). The text appears in four reply
types: help (signposting), no answer (abstain), held topics A and B,
and the abuse referral. It is left unchanged for now, because the
constants are frozen, and is to be corrected with the helpline-
constants change once 116 has been verified. The Help sheet already
avoids the claim. **Resolved on 22 October 2026** (see "Helpline 116 wording"): the sentence now reads "Childline Kenya, 116, is a free 24-hour helpline for children."

## Home (2026-10-20)

Stage B2 step 4 (`fix/ui-redesign`), on Cindy's brief. **No frozen item
changed.** Home is the chat's empty state (`components/Home.tsx`); after
the first question the existing conversation view is shown, to be
redesigned in steps 6 and 7.

**What it has.** Under the header: a hero (gradient #5B21B6 to #A21CAF)
with a "Private and anonymous" tag, the page's only `<h1>` ("Ask about
your body, periods, pregnancy or sex."), the shared sources line
followed by "This can't diagnose you.", and the ask pill. "Or browse by
topic", then a 2x2 grid of topic tiles from `content/topics.ts`, then
"Anonymous. We never ask for your name." above the footer line.

**One ask bar.** The input and send button became `components/AskBar.tsx`.
The chat renders exactly one: in the hero on Home (label "Type your
question", button "Ask"), at the bottom once the chat has started. Both
send through the chat's own handler, so every question runs the full
pipeline.

**Placeholder examples** (`PLACEHOLDER_EXAMPLES` in `content/uiText.ts`),
rotating every 6 seconds unless the device asks for reduced motion; the
placeholder is not a live region and the input keeps its label:
1. "Can STIs be cured, and can they harm me if I leave them?" (KB-S5)
2. "What can I do about period pain?" (KB-G4)
3. "Which birth control methods can a teenager use?" (KB-C3)
4. "Can I take PrEP to prevent HIV? I'm a teenager." (KB-S7)
5. "How do I manage my period hygienically?" (KB-G5)
6. "What warning signs in pregnancy mean I should go to hospital right away?" (KB-P6)

Each is the exact text of a knowledge-base question, from neither DR-04
nor the demo-risk set, and is answered with its own entry by keyword
retrieval (the path without `ml_service`, tested) and by the live
pipeline with the gate on (checked on 20 October 2026: 20 of the 21
knowledge-base questions get their own entry; KB-P1 does not, so it is
left out). **The brief's first example, "Can I have an STI without
knowing?", is not used**: it is not a knowledge-base question, and it
is query #10 of the demo-risk set, so it breaks both rules the brief
sets for the examples. The list starts with an STI question instead.

**Topic tiles.** Labels and classes from `content/topics.ts`, which now
also holds each tile's subtitle, describing only what the knowledge base
covers: "Periods, puberty, clinics" (general), "Warning signs, food,
school" (pregnancy), "Methods, condoms, fertility" (contraception),
"Symptoms, treatment, PEP, PrEP" (sti). Until the Topic list exists
(step 5) a tile focuses the ask bar, as the Help sheet's topic buttons
do.

**Deviations, for contrast.** The tiles are buttons, so their edge must
reach 3:1 (step 2). A 1.5px border in the tint (#FFDDEE and so on) gave
about 1.05:1, so each tile's border is the lightest shade of its
topic's hue that reaches 3:1 against the page and both glows: #E5337D,
#9360E3, #CE30DE, #EB315F (3.02 to 3.09:1). The tag pill's fill is 15%
white (white text 4.94:1 at the hero's light end; 22% would give 4.33).
On Home the footer line closes the page under the tiles, as the brief
lays out, rather than sitting directly above the ask bar (step 2's
rule), because the ask bar is inside the hero.

**First screen.** At 390x844 the footer line ends at 813px (header 59,
hero 312, tile grid 284), so it shows without scrolling; no spacing was
reduced. At 360x740 and 320x640 Home scrolls.

The conversation view still has the four example chips; they go with
the redesign of the answer view.

## Topic list (2026-10-20)

Stage B2 step 5 (`fix/ui-redesign`), on Cindy's brief. **No frozen item
changed**: no model, knowledge-base text, threshold or gate.

**What it is.** A screen opened from a Home tile or a Help sheet topic
button (`components/TopicList.tsx`): "All topics" back link, the topic's
icon tile, its label as the only `<h1>`, "N questions" (N from the data),
a card listing that class's knowledge-base questions, the footer line,
and an ask bar labelled "Ask something else".

**One path to an answer.** Tapping a question hands its exact text to
the same send handler as any question, so the full pipeline runs
(Safety Net, help, held topics, vague rule, classifier, retrieval,
gate); the ask bar does the same. Nothing returns an answer directly
and nothing is scoped to the topic: a browser check showed every request
body is exactly `{"text": …}`.

**Where the questions come from.** The interface had a copy of the
knowledge base (`offline/Kbdata.json`), but it is maintained by hand,
holds the answers, and is used only by the unused `offline/pipeline.ts`.
Instead of shipping the answers in the bundle or adding an endpoint, a
build script (`app/gateway/scripts/build-kb-questions.js`) writes
`app/interface/src/content/kbQuestions.json` from the active knowledge
base: id, class and question only, no answers. A gateway test fails if
it is stale or carries any other field. It works offline. No gateway
route was added.

**Known mismatch kept in the list: KB-P1.** "Do I have to get a pelvic
exam right away at my first visit?" is classed general by V3 (0.852;
pregnancy 0.055), so retrieval is scoped to general and serves KB-G3
("Is my period normal…", similarity 0.8453); unscoped, KB-P1 itself
would be top at 0.9023. It stays in the Pregnancy list, as briefed. The
other 20 questions return their own entry when tapped (browser check,
20 October 2026).

**Focus (UI-14).** The Topic list moves focus to its h1 when it opens;
"All topics" returns focus to the tile that opened it, or to the Help
button if the Help sheet did. Home's h1 takes focus when Home appears
(after the splash or a new chat), and the referral heading when the
referral appears.

## Answer screen (2026-10-20)

Stage B2 step 6 (`fix/ui-redesign`), on Cindy's brief. **No frozen item
changed**: no model, knowledge-base text, threshold, gate, Safety Net
pattern or helpline number. Answers are shown exactly as the gateway
returns them.

**Latest exchange only.** A new question replaces the last exchange
(`setTurns([userTurn])` in `App.tsx`); earlier exchanges are not kept on
screen, and they were never stored anywhere else.

**What it shows** (`components/AnswerView.tsx`), for the answer-scoped
and answer-unscoped reply kinds:

1. A back link, 44px tall: "Back to <topic label>" when the question
   came from a Topic list (back there, focus on the tapped row, or on
   the list's h1 if its ask bar was used), otherwise "Back to home". A
   question asked on the answer screen itself (its ask bar or a related
   question) goes back to Home.
2. "The closest question I have" over the knowledge-base question the
   answer came from (`matchedQuestion`, as sent). It is never shown as
   the question she asked; her own text is not shown on this screen.
3. The answer card: an "Answer" pill with a check, the answer text as
   sent (line breaks kept with `white-space: pre-line`), a divider, then
   "Source: " and the `source` the response carries, then the shared
   disclaimer `ANSWER_DISCLAIMER` ("General information, not a diagnosis.
   A nurse or clinic can test and treat you."). With no `source` in the
   response, there is no source line and nothing is invented. All 21
   live answers carry one (browser check, 20 October 2026); the offline
   pipeline's limited-mode answers carry none and have no reply kind, so
   they keep the plain reply view.
4. "Related questions": up to two other knowledge-base questions of the
   matched entry's class, in knowledge-base order. Tapping one sends its
   exact text through the full pipeline.
5. The footer line and the ask bar ("Ask something else"), in a white
   dock that stays at the bottom while a long answer scrolls; the ask
   bar runs the full pipeline and is never scoped.

**No trust signal.** No confidence pill, "strong match" label or score:
similarity does not separate right answers from wrong ones (wrong
answers score as high as 0.8557). The demo details line (`?details=1`)
is not shown on the answer screen.

**Headings and focus (UI-16).** The matched question is the screen's
only h1 (the label is part of it); "Answer" and "Related questions" are
h2s. When a new answer arrives, focus moves to the h1, and one polite
live region outside the screen says "New answer." The answer itself is
in no live region, so it is not read twice.

**Example chips and follow-ups removed (UI-12).** The four topic chips
and the "You could also ask" follow-ups are gone from the chat, with
`TOPIC_EXAMPLES`, `SUGGESTIONS`, `offersFollowUps` and `suggestionsFor`;
nothing else imported them except the gateway's rule-test fixture. Their
13 questions (4 chips and 12 follow-ups, one shared) were the
example-question set of the Stage A rule tests. That set is now the 21
knowledge-base questions in `kbQuestions.json` (what the Topic list and
the related questions offer); the vague rule intercepts none of them,
and the help and vague parity cases now also include the held-topic
test inputs. No DR-04 or demo-risk query was used.

## Reply screens (2026-10-20)

Stage B2 step 7 (`fix/ui-redesign`), on Cindy's brief. **Restyle only**:
no reply, knowledge-base, held-topic or help text changed, nor any
helpline constant, `HELP_CONTACTS_VERIFIED`, gate, threshold or Safety
Net pattern.

**One screen per reply kind** (`components/ReplyViews.tsx`, chosen by
`replyViewOf` in `replyView.ts` from the reply kind): clarify (vague),
held topic (groups A, B, C), help, no answer (abstain), and the referral
(`ReferralScreen.tsx`, the same dark card as help). On each, the reply
text exactly as sent is the screen's only h1 and takes focus when it
arrives; a pill with an icon tops the card. A reply with no kind (the
offline pipeline's limited-mode answer) keeps the plain view, with its
text as the h1. The session end's heading is now its h1.

**Her question shown back only on clarify and no answer**, as plain
text under "You asked" (React escapes it; `<b>x</b>` shows as typed).
Never on held, help or referral. Her question is also no longer shown
while a reply loads or after an error, and after a referral it is
dropped, so "Continue chat" goes to Home.

**Call buttons** on held, help and referral: the GBV helpline, then
Childline Kenya, as `tel:` links built from the constants, each
described by its own `SUPPORT_SECTIONS` label and note ("GBV helpline.
For violence or abuse."; "Childline Kenya. For anyone under 18."). Help
and referral also carry "In immediate danger? Call …" built from
`EMERGENCY_NUMBERS`.

**Footer line beside a call button.** Where the GBV call button is
already on screen (held, help, referral), the footer line points to it
instead of repeating the number: "In danger? Use the GBV helpline call
button above. It is free and open 24 hours." (`DANGER_LINE_CALL_ABOVE`).
On a phone (390 by 844) the line and the button share the first view on
all three, so moving the line lower would not have avoided it. The
reply texts of held A and B, help and the abuse referral name the
number themselves, unchanged.

**Announcements.** App's one polite live region now sits outside the
screens (so it also covers the referral) and names the reply once ("New
reply: Tell me a bit more." and so on; "New answer." for answers). No
reply text is in a live region; the referral's `role="alert"` box is
gone, so its text is read once, from the h1.

**Interface wording added** (constants in `content/uiText.ts`): the pill
labels ("Tell me a bit more", "Talk to a nurse" for held topics, which
had no label, "Support" for help, "We hear you" for the referral, kept
from the old referral heading, "No answer yet"); `CLARIFY_FALLBACK`;
`NO_ANSWER_RETRY`; "Try a topic instead"; `DANGER_LINE_CALL_ABOVE`.

**Removed from the referral screen:** the "We hear you. We want to
help." heading (now the pill) and the full support-options list (still
in the Help sheet and the wide-screen aside); the call buttons and the
emergency line replace it on the card.

**The unconfirmed Childline sentence** ("Childline Kenya, 116, is free
for anyone under 18", in `HELP_GUIDANCE` and the held A and B texts)
appears on the help, no-answer, held A and held B screens. Not on
clarify, held C or the referrals (the abuse referral says "(for anyone
under 18)" without "free"). Unchanged, as briefed. **Resolved on 22 October 2026** (see "Helpline 116 wording"): the sentence now reads "Childline Kenya, 116, is a free 24-hour helpline for children."

## Reply screens on narrow phones (2026-10-20)

Stage B2 step 7b (`fix/ui-redesign`), on Cindy's bug report: on the
clarify screen at 390px the 2x2 topic grid ran past the card, clipping
"Pregnancy" and "STIs and HIV". Layout only; no text changed.

**One shared component.** The four topics are now `TopicChoices`
everywhere they appear: clarify (a grid with icon tiles), no answer and
the Help sheet (pills). The Help sheet's own `topic-button` copy is
gone, so its pills are white with the 3:1 edge instead of tinted. The
held screens have no topic buttons.

**Grid rules.** Two columns of `minmax(0, 1fr)`, 10px apart; each item
`min-width: 0; max-width: 100%`; buttons `box-sizing: border-box`, full
width, padding 10px 12px (pills 8px 12px); labels wrap
(`overflow-wrap: anywhere`); 15px weight 900, 14px under 360px wide.
The reply card is `overflow: visible`.

**No broken words.** With the 32px icon tile beside the label, a column
leaves about 85px for the label at 390px and about 50px at 320px, but
"Contraception" needs 103px (97px at 14px). Wrapping alone broke it
mid-word ("Contracepti-on", "Pregna-ncy"). So when the grid is narrower
than 360px (a container query), the icon sits above the label; under
360px wide, the reply screen and card also give 4px more room each
side. Every word now fits whole at 320, 360, 390 and 430px.

**Lines with a phone link.** The footer line and the help and referral
cards' emergency line had a 44px-tall inline-flex link, which made a
wrapped line very tall. Both now have line-height 1.35; the link stays
inline and its 44px-tall tap area is an invisible `::after`.

## Loop limit and the ask bar (2026-10-20)

Stage B2 step 8 (`fix/ui-redesign`), on Cindy's brief. Interface
behaviour only: no reply text, pipeline rule or order, gate, threshold
or Safety Net pattern changed.

**Loop limit** (`loopLimit.ts`). App counts consecutive vague and
abstain replies, in memory only (a ref; nothing in localStorage or
sessionStorage). Any other reply kind (answer, help, held topic,
referral, or a limited-mode answer with no kind) sets it back to 0, and
so do opening a Topic list, "Ask a different question" (and the other
ways back to Home: Back to home, New chat), a new session and quick
exit. `LOOP_LIMIT = 3`: the third vague or abstain reply in a row, and
each one after it until the count resets, shows the Talk to a person
screen instead of the reply. Help, held-topic and referral replies are
never counted, replaced or delayed; the request is never blocked.

The screen uses the no-answer card, the pill "Let's find a person", and
one new message as its only h1 (`PERSON_MESSAGE`: "I'm having trouble
finding what you need. A nurse or counsellor at a health facility can
help, and you do not have to give a reason."). Her question is not
shown. "See who can help" opens the existing Help sheet (no call
buttons or numbers on the screen itself); then the four topic pills,
the footer line and the ask bar.

**The ask bar runs the whole pipeline every time.** The request body is
built from the typed text alone (`{ "text": … }`), from every screen; no
topic, scope, class, earlier query or earlier reply is ever sent, and
opening a Topic list scopes nothing. Enter submits; the button is
disabled while the bar is empty or a reply loads; the text clears after
sending; focus moves to the reply's h1. New: App sends one request at a
time (a second send while one is in flight is dropped; the Topic list's
ask bar was the one path that could start a second). There is no
character limit in the interface (unchanged); the gateway accepts a
JSON body of up to 10 kB (`BODY_LIMIT`).

**Decision needed: the keyword fallback and the relevance gate.** While
the classifier service was starting, the keyword fallback answered an
off-topic query with a knowledge-base answer and the gate was not
applied (audit UI-19). Whether the fallback path should also apply the
gate is open; nothing was changed.

## Accessibility and performance evidence (2026-10-20)

Stage B2 step 9 (`fix/ui-redesign`), on Cindy's brief: evidence for
Chapter 5. Nothing was tuned to a score; every failure is kept.

**Measured** on 14 screens (splash, Home, Help sheet, Topic list,
answer, clarify, held A, B and C, help, referral, no answer, Talk to a
person, limited mode) plus quick exit, at 390 and 320px: axe-core
4.10.2; a scripted Tab walk (reach, order, focus ring,
focus hidden), structure, target size, live regions, phone-link names,
reflow at 320px, 200% zoom and text-only 200%, reduced motion; the
contrast tests. Lighthouse 12.3.0 three times on Home (navigation) and on
the answer screen (user flow), and Lighthouse 11.7.1 three times for the
PWA checks. Chrome 155.0.8059.80, puppeteer-core
23.11.1. Evidence and versions: `docs/design/audit-2026-10-20/evidence/`.

**Found and fixed** (one commit, presentational and semantic only, no
text changed):

- At 200% zoom (195 CSS px) every screen but the splash scrolled
  sideways (299px wide): the header did not wrap (UI-15) and Home's tiles
  used `1fr` columns; the splash wordmark was clipped. The header now
  wraps, the tiles shrink, and the wordmark is at most 16vw (UI-21).
- With text-only 200% the header actions overflowed (443px wide); fixed
  by the same header wrap.
- Phone links showing only a number were named only by the number; each
  now carries the service from `SUPPORT_SECTIONS` in its accessible name
  ("1195, GBV helpline") (UI-20).
- Tab could land on a control completely hidden under the docked ask bar
  (WCAG 2.4.11), at 390px on the answer screen and at 200% zoom on held
  and help; `scroll-padding-bottom: 40vh` while the dock is present
  (UI-22).

**Left open:** text set in px does not follow the browser's text-size
setting (on most screens about half the text grows; on the splash 1 of
13) (UI-23, P2); no `robots.txt` (UI-18, P2, Lighthouse SEO 91 and 80).
Browser zoom scales all text, so WCAG 1.4.4 is met.

**Results:** axe 0 violations on all 28 scans; Lighthouse Home 98, 100,
100, 91 in all three runs; answer flow 100 (time span), 100, 100, 80 in
all three; PWA 100 in all three.

## Home polish (2026-10-20)

Redesign step 4b (`fix/ui-redesign`), on Cindy's brief with every value
given. Layout and UI copy only; no reply, KB, held or help text, helpline
constant, gate, threshold or Safety Net pattern changed.

**What changed.** The hero is a card (three-stop violet gradient, radius
28) with a white "Private and anonymous" pill and a lock, and a sparkle
and two pink circles behind the text (aria-hidden). The ask bar moved
out of the hero into a white card with the visible label "Type your
question", a pink field and a 48px gradient send button named "Get an
answer" with an up arrow. The anonymous line and the footer line sit in
a pink footer card with a lock; End session stays directly below it.
Topic cards: radius 22, padding 14, 104px tall, 40px icon tiles, a soft
shadow, the coloured 3:1 edges kept.

**New copy** (constants): `HERO_PILL` "Private and anonymous" (the text
was already on screen, now a constant), `ASK_LABEL` "Type your question"
(was a hidden label, now visible), `ASK_SEND_NAME` "Get an answer" (was
"Ask"). Subtitles (`content/topics.ts`): "Periods, puberty, clinics" to
"Cycle, pain, clinics"; "Warning signs, food, school" to "Signs, care,
school"; "Methods, condoms, fertility" to "Methods and myths"; "Symptoms,
treatment, PEP, PrEP" to "Signs, testing, care". Labels and classes
unchanged.

**Design values changed for contrast.** The field edge #F3C6DE is
1.37:1 on the field; the field is a control, so its edge is #C25A92
(3.69:1 on the field, 4.06:1 on the card). The empty field's send button
is #8B5CF6 at full opacity (white arrow 4.23:1; edge on the field
3.84:1). The paragraph colour #F6E9FF would be 4.04:1 over the large
circle; it never meets it (checked at 320 to 430px), and over the small
circle it is 4.52:1, so nothing was changed.

**Gutters.** Before: content 20px at 390 and 320px, the header 12px.
After: content and header 20px from 360px up. Under 360px both are 16px
(the header's logo, Help and Exit need 283px on one row; a 20px gutter
leaves 280px at 320px), and tile titles drop from 16 to 15px, because
"Contraception" at 16px is wider than a tile at 320px.

## Topic list and answer screen polish (2026-10-22)

Redesign step 6b (`fix/ui-redesign`), on Cindy's brief with every value
given. Layout and UI copy only; no reply, KB, held or help text,
helpline constant, gate, threshold or Safety Net pattern changed.

**Topic list.** A header card (pink-to-lilac gradient) with the topic
icon on a white tile, the h1 and "Tap a question to read the answer."
The question count stays for screen readers only. The question card
(radius 24, soft shadow) has 16px rows and 30px chevron circles; under
it, "More questions are being reviewed with doctors and nurses before
they are added." Then the footer line as plain text and the ask bar as
a white pill, placeholder "Or type your own question".

**Answer screen.** The closest-question box loses any border or ring;
the answer card, pill and source block take the given sizes, with
"Source:" in bold (the source text itself unchanged). The related
questions use a smaller version of the question card. The white panel
behind the footer line and ask bar is gone: they are no longer sticky
and sit at the end of the content, or at the bottom of a short screen.
The ask bar is a white pill named "Ask" with the 48px gradient button.

**Focus.** Headings and containers that only code focuses
(`tabindex="-1"`) show no ring; every control keeps its ring. Checked at
four widths: the focused h1 has no outline, a Tab-focused row has one.

**Design values changed for contrast.** The question cards' edge
#F3D3E6 (1.38:1 on white) marks the question buttons, so it is #C25A92
(4.06:1 against the rows, 3.00:1 on the page and its glows); the ask
pill uses the same 3:1 pink (#C25A92) for the design's #F3C6DE.

**New copy** (constants in `content/uiText.ts`): `TOPIC_LIST_HINT`,
`TOPIC_LIST_FOOTNOTE`, `TOPIC_LIST_PLACEHOLDER`.

**Gutters** are unchanged: 20px from 360px up and 16px below, with the
header aligned (from step 4b).

## Reply screens aligned with the design (2026-10-22)

Redesign step 7c (`fix/ui-redesign`), on Cindy's brief with every value
given. Layout and UI copy only: every reply word, its order and
punctuation are unchanged, and so are the helpline constants and their
descriptions and the quick-exit behaviour.

**Split for display (held, help, referral).** The first sentence (up to
the first ".", "?" or "!" followed by a space) is the h1 and the rest a
paragraph under it (`replySplit.ts`). A test proves, for every reply
(held A, B and C, help, both referrals), that h1 + " " + paragraph is
the reply exactly. The live region still says only the pill label.

**Held.** The pink card holds the reply; the call buttons moved into a
white card under it, headed "If you are in danger or someone has hurt
you" (1195 on the violet gradient, 116 outlined). No footer line (the
card carries the GBV call button). The ask bar is a white pill with no
panel.

**Help and referral.** A dark hero with the reply, the call buttons
full width under it (1195 on the pink gradient, 116 outlined), the
emergency line in a pink card ("In immediate danger?" in bold), "Need
to leave quickly? Tap Quick exit at the top." and "Back to questions"
(which does what "Continue chat" did). The header has no Help button
and its exit button reads "Quick exit" (same behaviour). No footer line
and no ask bar.

**Clarify, no answer, Talk to a person.** Only the shared fixes: the
footer line, then the ask bar as a white pill, with no panel.

**No dock anywhere.** With the last sticky dock gone, the step 9 rule
that reserved scroll padding for it was removed; nothing at the bottom
can hide a focused control.

**New copy** (`content/uiText.ts`): `CALL_CARD_HEADING`,
`QUICK_EXIT_LABEL` "Quick exit", `QUICK_EXIT_HINT`, `BACK_TO_QUESTIONS`
"Back to questions". Removed: `DANGER_LINE_CALL_ABOVE` (no screen with
the call buttons shows a footer line now).

**Design values changed for contrast.** The 116 button's edge #E3C4EE
(1.57:1 on white) is #A060B8 (4.32:1 on white, 3.20:1 on the page);
"Back to questions" edge #F0C4DD (1.14:1 on the page) is #B45F8F
(3.12:1). No fill was darkened: white 13px text on #DB2777 is 4.60:1.
The call buttons also get 8px top and bottom padding (the design's 0)
so a two-line description never touches the edge at 320px.

**Unconfirmed Childline sentence** ("…is free for anyone under 18"):
still on the held A, held B, help and no-answer screens (reply text
unchanged); not on held C, the referrals, clarify or Talk to a person. **Resolved on 22 October 2026** (see "Helpline 116 wording"): the sentence now reads "Childline Kenya, 116, is a free 24-hour helpline for children."

## Clarify and help/referral to the redesigned boards (2026-10-22)

Redesign step 7d (`fix/ui-redesign`), on Cindy's brief, replacing the
clarify and help/referral parts of step 7c where they differ. Layout and
UI copy only: every reply word, the helpline constants and their
descriptions, and the quick-exit behaviour are unchanged.

**Clarify.** Her message is a chat bubble on the right (plain text,
escaped), after a visually hidden "You asked" h2; the visible label is
gone. The reply card takes the board's shape and sparkle; inside it,
"Pick the closest" and the four topic buttons, now always a column
(icon tile above the label), 84px, bordered in each topic's own colour,
in a `minmax(0, 1fr)` grid. Under the card: "Not sure which one? Type it
again with a few more words." and the existing fallback line. Then the
footer line and the ask pill (edge #9A6AB5), placeholder "Add a few more
words".

**Help and referral.** The hero gets the board's spacing, a 24px
sparkle and a 300px heading width; the 1195 button runs #C2185B to
#A21CAF; the 116 button and "Back to questions" use the #9A6AB5 edge.
The emergency card now has two buttons, one per number from
`EMERGENCY_NUMBERS`; its line ("In immediate danger?" in bold, then
"Call 999 or 112.") keeps the same words but its numbers are plain text,
so each number is a tap target once. No ask bar and no footer line, as
in 7c.

**New copy** (`content/uiText.ts`): `CLARIFY_PICK_LABEL` "Pick the
closest", `CLARIFY_MORE_WORDS`, `CLARIFY_PLACEHOLDER` "Add a few more
words".

**Contrast.** No fill was darkened: white 13px text is 5.87:1 on
#C2185B and 6.32:1 on #A21CAF. The #9A6AB5 edges are 4.12:1 on white
and 3.04:1 on the page; the 999 and 112 buttons' edge #B8447E is 4.37:1
on the pink card. The clarify ask pill alone uses #9A6AB5; the other ask
pills keep #C25A92 (3.00:1 on the page).

**Unconfirmed Childline sentence** ("…is free for anyone under 18"):
unchanged; still on the held A, held B, help and no-answer screens. **Resolved on 22 October 2026** (see "Helpline 116 wording"): the sentence now reads "Childline Kenya, 116, is a free 24-hour helpline for children."

## Help sheet to the redesigned board (2026-10-22)

Redesign step 3c (`fix/ui-redesign`), on Cindy's brief. Styling and UI
copy only; the helpline constants and their descriptions, every reply
text and the quick-exit behaviour are unchanged.

**A page under the header.** The sheet was a modal overlay that covered
the header, so it carried its own Exit. It is now the page under the
app header: the screen behind stays mounted but hidden (its state is
kept), and the header's Exit stays in view and tappable, so the sheet
no longer duplicates it. It is still a modal dialog (`aria-modal`,
labelled by its h1 "Help"); focus still moves to its close button on
open and stays inside it on Tab; Escape and "Close help" close it and
return focus to the Help button; double Escape still exits; a topic
pill still closes it and opens that Topic list. The brief's tests ask
for focus on the h1 on open; the brief also freezes focus handling, so
focus stays on the close button as built (a one-line change if wanted).

**Layout.** The board's "How SafeGirl works" gradient card, the tips
card, the 1195 (plum) and 116 (outlined) call buttons with icon tiles,
the pink emergency line, wrapping topic pills in each topic's colour,
and the anonymous line at the foot.

**Wording.** Kept as built: the section heading "Topics" (the board
says "Browse topics"); the anonymous line "Anonymous. We never ask for
your name." (the board adds "\"Exit\" closes SafeGirl quickly."); both
how-it-works paragraphs. Moved into constants without changing a word:
the 1195 note `GBV_HELP_SHEET_NOTE` ("GBV helpline. Free, 24 hours,
English and Kiswahili.", as verified by Cindy's call on 20 October) and
`ANONYMOUS_LINE` (now shared with Home). Changed as briefed: the 116
note is now `SUPPORT_SECTIONS` word for word, "Childline Kenya. For
anyone under 18." (it was "Childline Kenya, for children and young
people.", written in step 3 to avoid an age claim); it has no "free".

**Contrast.** Close button and 116 edges #9A6AB5 (3.04:1 on the page).
Topic pill borders, lightened from each text colour while keeping 3:1 on
the page: periods #BA5D82 (3.12), pregnancy #8F68CD (3.09),
contraception #AA5EB1 (3.14), STIs #BE5E78 (3.07). No fill darkened.
The 1195 button's focus ring is white and drawn inside it.

**Wide screens.** The aside "Need more support?" (`SupportContent`) is
different content (local services, helplines and emergency guidance as
a list), so it was not restyled.

## Helpline 116 wording (2026-10-22)

A documented decision by the project owner, taken on 22 October 2026
after checking the Childline Kenya website. The only change in this
step.

**Change.** In the help, no-answer, held A and held B reply texts
(gateway `src/content/helpContent.js` and its offline copy), "Childline
Kenya, 116, is free for anyone under 18." becomes "Childline Kenya, 116,
is a free 24-hour helpline for children." Every other word is
unchanged. The 116 call button's description (`SUPPORT_SECTIONS`)
becomes "Childline Kenya. Free, 24 hours, for children." (it was
"Childline Kenya. For anyone under 18."). The abuse referral's
"(for anyone under 18)" is unchanged, as decided. No claim about
languages, airtime, networks or ages was added.

**Reason.** The old text implied that the line was free only for
under-18s.

**Evidence** (childlinekenya.co.ke, fetched 22 October 2026, quoted):

- "Kenya's only 24-hour, toll-free telephone and web-based helpline for
  children."
- "available on mobile devices for free from anywhere in Kenya"
- "accessible to children and adults who have identified or witnessed
  violence against children"
- "Other members of the public also access the Helpline to report cases
  on behalf of children"
- "The number 116 belongs to the Government and Childline manages it on
  behalf of the Government as a technical partner."

**Not verified:** languages, airtime and network claims, and the
childrenservices.go.ke page, which blocks automated access.

**Decision owner:** the project owner. `HELP_CONTACTS_VERIFIED` stays
`false`, pending the CREAW check. The 1195, 999 and 112 numbers and
text are unchanged.

**Resolves** the open item "the 116 claim in the replies" (Splash and
Help sheet entry) and the later notes listing the screens that showed
the unconfirmed sentence.

## Matched-question banner by how she asked (2026-10-22)

Redesign step 6c (`fix/ui-redesign`), on Cindy's brief. Interface only:
no reply or KB text, matching, retrieval, gate or threshold changed.

**The problem.** Every answer showed "The closest question I have" over
the matched question. After a tapped Topic list or related-question row,
that banner repeated the question she had just tapped under a label
saying "closest".

**Typed or tapped.** App now records, per question, how it was asked
(`via` on the reply turn, in memory only, never sent): typed in an ask
bar (Home, the answer screen or the Topic list's), or tapped on a Topic
list row or a related-question row. The request body is unchanged:
exactly `{"text": …}`.

- **Typed:** the lilac banner stays, labelled "I found a question like
  yours" (`MATCH_LABEL`), with the matched question unchanged; under it,
  "Not what you meant? Try different words or pick a topic."
  (`MATCH_HINT`). The banner shows on this path even when the match is
  exact: no strings are compared.
- **Tapped:** no banner, label or hint. The question is the heading
  above the answer card. It is the response's matched question: the
  same as the tapped row for 20 of the 21 rows; for KB-P1, which the
  pipeline answers with KB-G3, the heading names KB-G3's question, so the
  heading always matches the answer under it.

On both paths the heading is the screen's only h1 and takes the
programmatic focus, with no ring.

## DRAFT: V4 classifier pre-registration (2026-10-22)

Superseded by the 26 Oct 2026 entry below.

**DRAFT.** The full V4 pre-registration entry is to be pasted here by
the project owner; nothing below replaces it. V4 data tooling is in
[`research/v4/`](../research/v4/README.md) (branch `v4/data-tooling`,
Step V4-1). No V4 model has been trained.

**DR-04 near-duplicate in the V3 training pool.** The Step V4-0 audit
(22 October 2026) found no DR-04 text verbatim in any seed, paraphrase
or label file, but the reviewed V3 paraphrase SEED-PREG-19-P2 is a
near-duplicate of DR-04 row 14 (e5 cosine 0.971, character ratio
0.778), and seed SEED-PREG-12 asks DR-04 row 10's question in other
words (cosine 0.967). V3 was trained with both, so its DR-04 results
carry this overlap as well as being non-blind. The V3 files are
unchanged; SEED-PREG-19-P2 is listed in
`research/v4/v3_pool_exclusions.csv` and must not enter V4 training,
and `research/v4/check_seeds.py` fails any V4 item within cosine 0.95
or character ratio 0.85 of a DR-04 row.

## V4 triage classifier: pre-registration (26 Oct 2026)

**Status:** FINAL once committed. Must be committed BEFORE any V4 training, cross-validation or evaluation run.
**Class design confirmed with Mr. Ouma on:** [FILL date, or "pending"]
**Supersedes:** the DRAFT V4 entry in this log (22 Oct 2026). Differences are listed in section 10.

### 1. Question
Does a V4 triage classifier (contraception, sti, pregnancy, general, out_of_scope, vague) decide better than the frozen keyword baseline whether SafeGirl should answer, ask for more detail, or decline, on a test set it has never seen?

### 2. Design
- Classes: the four topic classes plus `out_of_scope` and `vague` (6 classes).
- `distress` is NOT a class. The Safety Net stays rule-based and always wins. A classifier error on distress is the worst case, and the rule must not depend on a model.
- Precedence in the pipeline, unchanged by V4: (1) Safety Net, (2) help signposting, (3) held-topic rules A, B, C, (4) vague-query rule, (5) classifier triage, then retrieval and the relevance gate (0.8439). The classifier only acts on questions that reach step 5.
- Held-topic content gets no new seeds unless an override note says "held-topic phrasing, label is topic only".
- Reason: oracle topic scoping equalled unscoped retrieval, so the classifier's value is triage, not routing.

### 3. Knowledge base the decision is measured on
The 62 served entries (60 medic-verified plus the earlier approved set). Pending entries (KB-C6, KB-C14, KB-S19, KB-C22) are never served and are not part of this measurement. Results are reported at two levels, separately and never merged:
- **Classifier level:** class predictions against the sealed labels.
- **System level:** the final reply kind and, for answers, the matched entry, on the 62-entry KB.

### 4. Data
- Seeds: traceable to an authoritative source with a page (DR-03). `out_of_scope` and `vague` seeds cite the design rule. Seed batches 1 to 3 (123 seeds) are committed; batch 4 (about 46 seeds) is committed before the folds are frozen. All batches are checked by `research/v4/check_seeds.py`, including `--sealed`.
- Paraphrases: synthetic only, the frozen paraphrasing protocol, no real user text sent to any external service.
- Duplicate and ambiguity review (DR-05) before use. Split at seed level, never paraphrase level (DR-02). A new fold file (`fold_assignment_v4.csv`), stratified by class and phrasing style, frozen before training. The V3 fold file is not changed.
- Sheng and code-switched queries stay excluded (DR-07). No real adolescent data (DR-08, NFR-03).
- DR-04 is never trained on and never used for tuning. `relevance_validation.csv` and the development set are dev-only and are not seeds.
- **V1-paraphrase ablation.** Two training sets are compared by CV only: with and without the restored V1 paraphrases listed in `research/v4/v1_paraphrases_restore_candidates.csv`. The one with the better CV macro-F1 is used; ties go to the smaller set.

### 5. Sealed test set
- 205 questions kept outside the repo: 145 written earlier plus 60 (FS-201 to FS-260) derived from situations in the gynaecologist's question list and reworded by the author with AI assistance. This provenance is disclosed in Chapter 5.
- Labels: one primary label per question, assigned blind by two reviewers, one of whom is not the author. Disagreements are settled by the clinician or recorded as ambiguous and reported separately. Labelling is finished before any V4 result exists. Final per-class counts: [FILL after labelling; aim for at least 20 per class].
- Sealed seed checks guarantee no near-duplicate between any seed and any test question.
- Evaluated ONCE. No threshold, rule or class change after the result is seen.
- DR-04 is reported only as a non-blind reference.

### 6. Comparators
Frozen keyword baseline and V3 (frozen). Both stay in the demo until the gate in section 8.

### 7. Models and selection (CV only)
Candidates: (1) keyword baseline, (2) logistic regression on e5 embeddings, (3) DistilBERT fine-tune with gentler settings (lower learning rate, per-fold early stopping, class weights), (4) hybrid of keyword evidence and the model. Choose by 5-fold CV on macro-F1, then confident-wrong rate. Thresholds are calibrated on CV folds only. The winner is frozen with its checkpoint hash before the sealed set is opened.

### 8. Metrics and decision rule
Metrics: macro-F1, per-class precision and recall, confusion matrix, sti and pregnancy recall reported separately, confident-wrong rate (wrong with confidence above 0.5), expected calibration error, learning curve by seeds per class, and system-level correct-reply rate.

**Comparison method.** Paired bootstrap over test questions (10,000 resamples, fixed random seed 42) for the macro-F1 difference between V4 and the baseline. McNemar's exact test for the system-level correct-reply rate. The 95% interval is reported as is, even when wide.

**Margin: 0.05 macro-F1**, fixed here before any run.

V4 enters the demo only if ALL hold on the sealed set:
1. V4 macro-F1 exceeds the baseline's by at least 0.05 and the paired bootstrap 95% interval for the difference excludes 0.
2. V4 recall for sti and for pregnancy is not lower than the baseline's.
3. The system-level correct-reply rate is not lower than the baseline's.
4. No safety regression: Safety Net, held-topic and help behaviour unchanged and all existing tests pass.

Otherwise V4 is reported as a finding and the demo keeps the frozen pipeline. Swapping V4 in requires its own decision-log entry. Demo gate: 13 Nov 2026.

### 9. Fallback
By 6 Nov 2026, if the sealed labels or the CV results are not ready, V4 is reduced to this documented design plus a learning curve on existing data, and the demo keeps the frozen pipeline.

### 10. Changes from the 22 Oct draft
Measured on the 62-entry KB (was 41). Test set 205 questions (was about 150). Margin fixed at 0.05. V1-paraphrase ablation, paired-bootstrap and McNemar methods, and the precedence order added. Classifier-level and system-level results reported separately.

### 11. Deviations
Any change after this entry is recorded here with date and reason: [none yet].

## V4 paraphrasing: protocol applied (2026-10-26)
The V2 paraphrasing protocol (2026-09-18) is applied unchanged to
the V4 seeds: exactly 4 English paraphrases per seed, the fixed
prompt, automated checks, manual semantic and safety review, and
only reviewed files are trained on. Recorded here because the V2
record lacks them: generator Claude (Anthropic), model
claude-sonnet-5-5, in a chat session; temperature not settable and
not recorded; prompt = the fixed V2 prompt applied per seed. Seeds
are synthetic; no real user text is used. The three seeds carrying
the note 'held-topic phrasing, label is topic only' (PREG-012,
PREG-013, PREG-024) get no paraphrases, so held-topic phrasing is
not multiplied. Every paraphrase file must pass
research/v4/check_paraphrases.py (sealed set, DR-04, dev set,
relevance_validation, held-topic rules and Safety Net) before
manual review. Counts per batch are in docs/ai-use-log.md.
