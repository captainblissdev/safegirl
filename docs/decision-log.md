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

## Knowledge base integrated before clinician sign-off (2026-10-22)

Step K2a (`kb/integrate-candidates`, not merged), by owner decision.
Decision owner: project owner.

**Decision.** The 34 non-held candidates in
`resources/knowledge_base/incoming/kb-candidate-entries.md`, plus
NEW-P-04, are built into the knowledge base **before clinician
sign-off**. The KB now has 41 entries: contraception 9, STIs 16,
pregnancy 5, general 11. IDs follow
[`docs/kb/id-mapping-2026-10-22.md`](kb/id-mapping-2026-10-22.md): the
15 replacements keep the live ID; new entries continue after the highest
number ever used in each class, counting the reserved held numbers.

**Status.** Every entry carries "- **Status:** approved" or "pending".
**32 entries are pending**; 9 are approved (the live entries no candidate
touches, KB-C1, KB-C2, KB-S3, KB-P1, KB-G1, KB-G2, and the replacements
whose answer and sources are unchanged, KB-P5 to KB-P7). The three
loaders (`retrievalModule.js`, `build_kb.py`, `generate-kb-json.py`) fail
on a missing or unknown status. The status is internal: it is in no
response, `kbQuestions.json`, `knowledge_base.json` or `Kbdata.json`
(`kbStatus.test.js`).

**Demo restricted to approved entries.** Pending entries must stay out
of the defence demo. `npm run release:check` (app/gateway, live
`ml_service`, outside `npm test`) fails if an entry reached by the
demo-risk set or Home's placeholder examples is pending. On 22 October
2026 it **fails**: demo #3, #8, #9, #10, #12, #13 and #14 are answered
with pending entries (KB-C4, KB-C3, KB-S8, KB-C7, KB-S12), and five of
the six placeholders are pending entries (KB-S5, KB-G4, KB-C3, KB-S7,
KB-G5; KB-P6 is approved). Demo #3 ("Condom iliburst…", expected:
abstain, emergency contraception is held) is now answered with KB-C4.

**Not built.** The held candidates NEW-C-06 (KB-C6 stays reserved) and
NEW-S-06; KB-S3 (PEP) is unchanged.

**NEW-G-08 (KB-G10).** Its last answer sentence, "If there is no bin,
wrap the pad and keep it until you can dispose of it safely.", is
excluded as unverified. Every other word is copied exactly.

**Gate not re-validated.** The relevance gate (0.8439) and the
thresholds (0.35/0.5) were set on the 21-entry KB and are unchanged; they
are re-validated in K2b. The health-term list was not rebuilt (as
briefed), so its drift test now fails: five selected terms (abortion,
nurse, pharmacies, sexuality, violence) are no longer KB words. The vague
rule itself is unchanged.

**Known limitations (K1, confirmed live by `npm run kb:self-retrieval`).**

- **KB-S16 (NEW-S-14) is mis-scoped.** V3 classes it general (0.87), so
  scoped retrieval cannot reach it and it is answered with KB-G5;
  unscoped it would be its own top entry (+0.076). Kept in the STI list,
  as KB-P1 is (`knownLimitations.test.js`). KB-P1 is now answered with
  KB-G6 (was KB-G3).
- **KB-G7 (NEW-G-05) against KB-G1.** In K1, on question and answer
  alone, KB-G7 ranked second behind KB-G1 by 0.002. With the full
  passage as served, it is top by 0.012: still a near-miss.
- **Long answers.** Answers reach 779 characters (KB-C10; KB-G9 706),
  against 443 before.
- **Reading level (UI-08).** The audit found a median Flesch–Kincaid
  grade of 10.0 for readers aged 10–19; the new entries were not
  rewritten for reading level and go to the clinical review with it.

Self-retrieval on 22 October 2026: 39 of 41 questions get their own
entry both unscoped and with live scoping; the two failures are KB-S16
and KB-P1 above. 16 entries are near-misses (margin under 0.03).

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

## KB expansion, 22 Oct 2026

Step K3 (`kb/integrate-candidates`, not merged). Decision owner: project
owner. This supersedes the K2a statuses in "Knowledge base integrated
before clinician sign-off (2026-10-22)" above.

**Medic verification.** All 60 candidate entries in
`resources/knowledge_base/kb-final-60-approved-2026-10-22.md` were
checked against the source documents by a medic on 22 October 2026 and
marked `[x] approve`.
Reviewer: [reviewer name and title: to be added by Cindy].
That file is now the only candidate source;
`incoming/kb-candidate-entries.md` (37 entries) is removed. Entry text is
copied verbatim (the review lines are not), and Status is derived from
the review mark (`docs/kb/id-mapping-2026-10-22.md`).

**56 entries approved after medic verification against the sources**,
joining the 6 earlier entries no candidate replaced (KB-C1, KB-C2, KB-S3,
KB-P1, KB-G1, KB-G2): **62 entries are served** (contraception 19, STIs
18, pregnancy 7, general 18).

**4 remain pending**, whatever their review mark:

- KB-C6 (NEW-C-06, condom breaks or slips), KB-C14 (NEW-C-14, a
  forgotten pill) and KB-S19 (NEW-S-06, medicine after unprotected sex):
  the held-topic rules for these subjects have not been reviewed.
- KB-C22 (NEW-C-22, parents' permission for contraception): the consent
  wording is an open decision.

**Pending entries are never served** (a change from K2a, where pending
entries were served but kept out of the demo): the gateway, ml_service's
`knowledge_base.json`, `kbQuestions.json` and the offline `Kbdata.json`
hold approved entries only (`kbStatus.test.js`). `release:check` passes.

**NEW-G-08 (KB-G10)** includes its last sentence again ("If there is no
bin, wrap the pad…"): K2a left it out as unverified, and the medic has
now verified it. NEW-P-04 (KB-P8) has a wording fix in its Conditions.

**Gate unchanged** at 0.8439, as are the thresholds (0.35 / 0.5), the
classifier, the Safety Net and the held-topic and vague rules. On the 35
labelled development-set questions
([`docs/kb-integration-eval-2026-10-22.md`](kb-integration-eval-2026-10-22.md)),
correct replies fall from 29 to 23 under labels that predate the new
entries: nine replies change, and wrong answers now score up to 0.8947,
inside the range of correct ones. Re-validating the gate on the larger KB
is open (K2b).

**Also recorded:**

- Self-retrieval: 58 of 62 questions get their own entry; KB-C11,
  KB-S16, KB-P1 and KB-G13 are classed outside their class and answered
  with another entry (`knownLimitations.test.js`).
- KB-P9's question ("I think I am pregnant…") is caught by held-topic
  group C, so tapping it gives the held-topic signpost, not its answer.
- Sealed-set guard (`research/v4/check_kb_vs_sealed.py`): two KB
  questions reach cosine 0.95 with the sealed set, KB-C14 (0.961,
  pending) and KB-G9 (0.954). No text was changed.
- Health terms and numbers new to the KB, for review:
  [`docs/kb-health-terms-diff-2026-10-22.md`](kb-health-terms-diff-2026-10-22.md).
- The health-term list for the vague rule was not rebuilt; its drift
  test still fails (abortion, nurse, pharmacies, sexuality are no longer
  KB words).

## KB wording resolved, 22 Oct 2026

Step K4 (`kb/integrate-candidates`, not merged). The medic passed all 60
entries and delegated the wording to the project team. The team changed
wording only, **with no change in clinical content**, to remove
conflicts and provider language. The changes are listed in the "Wording
resolutions (22 Oct 2026)" table at the top of
`resources/knowledge_base/kb-final-60-approved-2026-10-22.md`, which
stays the source of truth; the class files and `knowledge_base.json`,
`kbQuestions.json` and `Kbdata.json` are rebuilt from it.

Entries changed (12 fields in 9 entries; all other text unchanged):

| Entry | Field | Change |
|---|---|---|
| NEW-C-03 (KB-C5) | Answer | "(DMPA)" removed |
| NEW-C-09 (KB-C9) | Answer | fertility after the injection now "four months or longer, and sometimes up to 12 months", matching KB-C5 and KB-C21 |
| NEW-C-09 (KB-C9) | Evidence/claim, Source | the p. 32 quote and page added |
| NEW-C-09 (KB-C9) | Conditions | the NEW-C-21 reference and the combined injectable figure (about 5 months, from the guideline) added |
| NEW-C-18 (KB-C18) | Answer | "nulliparous" removed; "for your age and health" added |
| NEW-C-19 (KB-C19) | Answer | named "the breastfeeding method (LAM)" |
| NEW-C-20 (KB-C20) | Answer | "(category 1)" removed; the progestin-only pill explained |
| NEW-S-09 (KB-S11) | Answer | "reactive" changed to "positive" |
| NEW-P-05 (KB-P9) | User question | no longer starts "I think I am pregnant" |
| NEW-P-05 (KB-P9) | Conditions | "not yet verified" note replaced by "the medic checked the entry against the sources on 22 Oct 2026" |
| NEW-P-06 (KB-P10) | Conditions | the same note replaced |

Outside the entries, the file also records the medic's confirmation of
the consent rule (open question 1) and updates the HTML review comments
of NEW-P-05 and NEW-P-06; none of that reaches the build.

Unchanged: the review marks, the pending set (KB-C6, KB-C14, KB-S19,
KB-C22), the gate (0.8439), the thresholds, the classifier and every
rule. `release:check` passes.

**Effects found on rebuilding:**

- KB-P9's question no longer matches held-topic group C, but V3 classes
  it general (0.773), so tapping it in the Topic list is answered with
  KB-G14, not KB-P9 (unscoped, KB-P9 is top). It joins KB-C11, KB-S16,
  KB-P1 and KB-G13 as a mis-scoped entry (`knownLimitations.test.js`).
- KB-C4 ("Do I still need a condom if I'm on the pill or the implant?")
  now loses to KB-C18 even unscoped (0.893, rank 2): the reworded KB-C18
  answer names pills, the injection, the implant and the female condom.
- Self-retrieval: 56 of 62 questions get their own entry.

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
Marker list: V2's was never committed; research/v4/sheng_swahili_markers.txt (2026-10-26) is a recorded addition.

## V4 DR-05 ambiguity review (2026-10-26)

Duplicate and ambiguity review (DR-05) of the V4 training data, before
training. `research/v4/review_dr05.py` pooled **1,841 texts** with their
class labels: the V3 training pool minus `v3_pool_exclusions.csv` (788),
the V4 seeds (169), the reviewed V4 paraphrases (664) and the 220 V1
restore candidates. `out_of_scope` and `vague` count as classes.
It found **108 pairs** with different class labels at e5 cosine 0.93 or
above (`research/v4/dr05_ambiguity_report.csv`, ids and scores only), and
no exact duplicate text across classes.

**Rule.** Cross-class pairs at cosine 0.95 or above are resolved; pairs
from 0.93 to 0.95 are disclosed only. Six pairs reach 0.95.

**Resolved by exclusion** (`research/v4/dr05_exclusions.csv`; V4 training
and the V1-paraphrase ablation drop these exact ids, not the rest of
their seeds):

- SEED-CONTRA-12-P4 (V1 candidate, contraception): near the three
  paraphrases of SEED-PREG-18 (pregnancy), 0.951 to 0.964.
- SEED-CONTRA-01-P4 (V1 candidate, contraception): near SEED-GEN-02-P01
  and -P04 (general), 0.952 to 0.955.
- SEED-PREG-21-P3 and SEED-STI-29-P1 (both V3; pregnancy and sti): near
  each other, 0.954.

**Reworded.** SEED-V4-CON-019-P3 ("Can I use more than one condom at once
to be extra safe?") was close to SEED-STI-33 and its paraphrases (more
than one STI at once; 0.932 to 0.942). It now reads "does putting a
second condom over the first make sex safer" and passes
`check_paraphrases.py`.

**V3 data is not edited.** The two V3 items are excluded for V4 only;
the V3 files, `v3_pool_exclusions.csv` and the V3 readers are unchanged,
so the frozen V3 run stays reproducible.

**Under review.** Two V4 vague paraphrases sit near general V3 seeds
about using the service: SEED-V4-VAG-017-P3 ~ SEED-GEN-09 (0.932) and
SEED-V4-VAG-023-P3 ~ SEED-GEN-08 (0.930). They are disclosed and kept for
now.

**Closed (2026-10-26).** After the CON-019-P3 reword the refreshed
report holds 105 pairs (the three CON-019-P3 pairs dropped out). The two
vague pairs above and the three other remaining V4 pairs (SEED-PREG-12
~ SEED-V4-CON-005-P1, SEED-PREG-37 ~ SEED-V4-GEN-032-P3, SEED-V4-CON-008-P1
~ SEED-V4-GEN-012-P1; cosine 0.930 to 0.935) were read: each pair
differs in meaning (similar wording, a different question), so none is a
label conflict. They are disclosed and nothing is changed. DR-05 is
closed.

## V4 pre-registration: clarifications (2026-10-26)

Clarifications to "V4 triage classifier: pre-registration (26 Oct
2026)", made before any V4 training or cross-validation.

- **The V3 pool joins the V4 folds.** The 211 V3 seeds
  (`resources/seeds/seeds.csv`) and their reviewed paraphrases are
  folded together with the 169 V4 seeds, at seed level, by
  `research/v4/make_folds.py --v3-seeds`. Every V3 seed is included,
  also the 55 with no paraphrases.
- **V3 seeds have no phrasing style**, so they are stratified by class
  only, with the placeholder style `v3_unlabelled`; V4 seeds are
  stratified by class and style. The fold file's `source` column says
  which is which.
- **DR-05 exclusions apply at training time**, not at fold time: the ids
  in `research/v4/dr05_exclusions.csv` and
  `research/v4/v3_pool_exclusions.csv` keep their seed's fold and are
  dropped from training.
- **The fold file** `research/v4/fold_assignment_v4.csv` (380 seeds, 5
  folds of 76) has sha256
  9fa96d80c22d020b62ada028d87c0679004c0d68be87e6b2f40d4bff46361cbf.
  Its summary, with counts per fold and class and the 19 same-class
  near-duplicate pairs that fall in different folds (disclosed, not
  changed), is `research/v4/fold_assignment_v4.summary.txt`.
- **The folds are frozen from this commit.** No V4 training or
  cross-validation has run.

## V4 pre-registration: clarification 2 (2026-10-26)

Written before any CV run.

1. Evaluation unit in CV: the seeds of the held-out fold, original
   wording only. Paraphrases of held-out seeds are never scored in the
   primary result. Training rows: seeds of the other folds plus their
   paraphrases, minus ids in dr05_exclusions.csv and
   v3_pool_exclusions.csv. A paraphrase always follows its seed's fold.
2. Baseline comparator. The frozen keyword baseline cannot output
   out_of_scope or vague (and can output gbv), which would cap its
   macro-F1 and make the 0.05 margin trivially easy. Two mappings are
   fixed now: M1 raw: label as is, gbv -> general. M2 pipeline-style:
   the existing vague-query rule first -> vague; else zero keyword
   hits -> out_of_scope; gbv -> general; else the baseline label. The
   baseline code is not changed. The mapping with the higher CV
   macro-F1 is "the baseline" for the sealed decision; both are
   reported. Neither mapping changes after results are seen.
3. Selection: highest mean-over-folds macro-F1. Candidates within 0.01
   of the best count as tied; among tied, lowest confident-wrong rate
   (wrong with top probability > 0.5); if still tied, the simpler
   model. The baseline has no probability, so its rate is its plain
   error rate, flagged as such. ECE uses 10 equal-width bins.
   Selection optimism (small grid tuned on the same folds) is
   disclosed in Chapter 5.
4. Grids fixed now. Logistic regression on e5 embeddings: L2,
   C in {0.1, 1, 10}, class_weight balanced, max_iter 2000, seed 42.
   DistilBERT (step 2): distilbert-base-multilingual-cased, lr in
   {5e-6, 1e-5}, max 8 epochs, batch 16, max length 64, weight decay
   0.01, label smoothing 0.1, balanced class weights computed from
   training rows, seed 42. Early stopping and best-epoch choice use an
   INNER validation fold (one of the four training folds, seed-level),
   never the held-out fold. Hybrid (step 3): logistic regression on
   [e5 embedding, keyword hit counts for the baseline's classes,
   vague-rule flag], scalers fitted inside the training folds, same C
   grid.
5. V1-paraphrase ablation: with and without
   research/v4/v1_paraphrases_restore_candidates.csv, decided by CV
   macro-F1 on logistic regression; ties go to the smaller set; the
   winner applies to all candidates.
6. Thresholds are calibrated on CV out-of-fold predictions only.

Note for Chapter 5: V3's CV picked its best epoch on the held-out fold,
so V3's CV score is slightly optimistic.

## V4 CV selection (2026-10-26)

The rule in clarification 2, item 3, applied as written to the four
candidates, each at its best setting by mean macro-F1. Scored on the
380 held-out seeds only, with the frozen folds and no V1 restore
paraphrases. Files: `research/v4/results/cv_selection.json` and
`cv_selection.md`, written by `research/v4/cv_selection.py`.

| Candidate | Setting | Macro-F1 +/- sd | STI rec. | Preg. rec. | Conf.-wrong | ECE |
|---|---|---|---|---|---|---|
| Baseline M2 | M2 | 0.6194 +/- 0.0525 | 0.756 | 0.627 | 0.384* | n/a |
| LR on e5 | C 10 | 0.8606 +/- 0.0616 | 0.927 | 0.827 | 0.068 | 0.118 |
| DistilBERT | lr 1e-5 | 0.7609 +/- 0.0262 | 0.817 | 0.747 | 0.108 | 0.095 |
| Hybrid | C 10 | 0.8835 +/- 0.0507 | 0.963 | 0.827 | 0.055 | 0.066 |

\* Plain error rate: the baseline has no probability.

- **Decision.** The best mean macro-F1 is 0.8835 (hybrid). The tie
  threshold is 0.8735, and no other candidate reaches it (LR on e5 has
  0.8606). So the confident-wrong and simpler-model steps are not
  reached.
- **Winner: the hybrid**, logistic regression on [e5 embedding,
  keyword hit counts, vague-rule flag], C 10, L2, class_weight
  balanced, max_iter 2000, seed 42.
- **Not frozen.** No final model is trained yet; that is step 4.
- **Notes for Chapter 5.**
  - (a) The best C (10) is at the top edge of the grid, for both the
    hybrid and LR on e5. A larger C might score higher; the grid is
    not extended after results are seen.
  - (b) The winner's lead over LR on e5 is +0.0230 mean macro-F1.
    That is smaller than the fold-to-fold spread: the sd is 0.0507
    for the hybrid and 0.0616 for LR on e5. Per fold the difference
    runs from -0.0361 to +0.0714, and the hybrid is ahead in 3 of 5
    folds.
  - (c) CV is optimistic. 19 same-class near-duplicate pairs (e5
    cosine >= 0.95) fall in different folds
    (`fold_assignment_v4.summary.txt`), so some held-out seeds have a
    near-copy in training. The sealed test set is the unbiased
    estimate.

## V4 pre-registration: deviation 1 (2026-10-26), before the sealed set is opened

- **Reason.** The step 2 DistilBERT grid (lr 5e-6 and 1e-5, max 8
  epochs) was set to be gentler than V3. Some folds were still
  improving at the 8-epoch cap: lr 5e-6 fold 1 and lr 1e-5 fold 5
  picked epoch 8, the last allowed. Seven of the ten folds ran all 8
  epochs without early stopping. So DistilBERT may have been
  undertrained.
- **Change.** Add lr 2e-5 and 3e-5, with max 12 epochs.
- **Unchanged.** Everything else stays as before:
  - the inner validation fold (the next fold, wrapping 5 -> 1);
  - patience 2, label smoothing 0.1, weight decay 0.01;
  - balanced class weights from each fold's training rows;
  - batch 16, max length 64, seed 42;
  - no V1 restore paraphrases;
  - linear schedule with 10% warmup.
- **Step 2 results stay as reported**, with the 8-epoch cap. The
  selection rule (clarification 2, item 3) is unchanged.
- **Disclosure for Chapter 5.** The DistilBERT grid grew after the
  first CV results were seen. The sealed set has not been opened.

## V4 pre-registration: deviation 2 (2026-10-26), before the sealed set is opened

- **Reason.** The pre-registration names a "hybrid of keyword evidence
  and the model". This project's classifier is a fine-tuned
  DistilBERT, so a DistilBERT hybrid is a fair candidate alongside the
  e5 hybrid.
- **Definition.** DistilBERT keeps its own pre_classifier, ReLU and
  dropout. The final classifier layer becomes Linear(768 + 6, 6). Its
  input is the 768-wide first-token representation concatenated with
  6 features: the 5 keyword hit counts from explain_baseline and the
  vague-rule flag from vague_rule.py, in the same order as the e5
  hybrid. The 6 features are scaled with a StandardScaler fitted on
  that fold's training rows only.
- **Learning rate.** The one with the highest mean macro-F1 among the
  four plain DistilBERT runs (5e-6, 1e-5, 2e-5, 3e-5); a tie goes to
  the lower rate. There is no other grid. Max 12 epochs.
- **Unchanged from steps 2 and 3c:**
  - the inner validation fold and patience 2;
  - label smoothing 0.1, weight decay 0.01;
  - balanced class weights;
  - batch 16, max length 64, warmup 10%, seed 42;
  - no V1 restore paraphrases.
- **Selection rule unchanged.**
- **Disclosure for Chapter 5.** The candidate list grew after the
  first CV results were seen, and more candidates mean a larger
  selection optimism. The sealed set has not been opened.

## V4 CV selection (2026-10-26)

Re-run over every candidate after deviations 1 and 2. This supersedes
the earlier entry of the same name, which covered four candidates;
that entry is kept as it was.

The rule in clarification 2, item 3, applied as written. Each family
enters at its best setting by mean macro-F1; a tie between settings
goes to the lower C or lr. Scored on the 380 held-out seeds only, with
the frozen folds and no V1 restore paraphrases. The simpler-model
order is LR on e5 < hybrid e5 < DistilBERT < DistilBERT + keyword.
Files: `research/v4/results/cv_selection.json` and `cv_selection.md`,
written by `research/v4/cv_selection.py`.

| Candidate | Setting | Macro-F1 +/- sd | STI rec. | Preg. rec. | Conf.-wrong | ECE |
|---|---|---|---|---|---|---|
| Baseline M2 | M2 | 0.6194 +/- 0.0525 | 0.756 | 0.627 | 0.384* | n/a |
| LR on e5 | C 10 | 0.8606 +/- 0.0616 | 0.927 | 0.827 | 0.068 | 0.118 |
| Hybrid e5 | C 10 | 0.8835 +/- 0.0507 | 0.963 | 0.827 | 0.055 | 0.066 |
| DistilBERT | lr 3e-5 | 0.7883 +/- 0.0832 | 0.841 | 0.787 | 0.142 | 0.053 |
| DistilBERT + keyword | lr 3e-5 | 0.7866 +/- 0.0644 | 0.854 | 0.787 | 0.147 | 0.075 |
| Baseline M1 (reference only) | M1 | 0.5166 +/- 0.0179 | 0.756 | 0.627 | 0.311* | n/a |

\* Plain error rate: the baseline has no probability.

- **Decision.** The best mean macro-F1 is 0.8835 (hybrid e5). The tie
  threshold is 0.8735, and no other candidate reaches it (LR on e5 has
  0.8606). So the confident-wrong and simpler-model steps are not
  reached.
- **Winner: the hybrid e5**, logistic regression on [e5 embedding,
  keyword hit counts, vague-rule flag], C 10, L2, class_weight
  balanced, max_iter 2000, seed 42.
- **Not frozen.** No final model is trained yet.
- **Notes for Chapter 5.**
  - (a) The best C (10) is at the top edge of the grid, for both the
    hybrid e5 and LR on e5. The grid is not extended after results are
    seen.
  - (b) Plain DistilBERT converged at about 0.79: 0.7854 at lr 2e-5
    and 0.7883 at 3e-5, with no fold at the 12-epoch cap. The keyword
    features did not help it: 0.7866 with them against 0.7883 without,
    at the same lr.
  - (c) The winner's lead over the other e5 model (LR on e5) is
    +0.0230 mean macro-F1. That is smaller than the fold-to-fold
    spread: the sd is 0.0507 and 0.0616. Per fold the difference runs
    from -0.0361 to +0.0714, and the winner is ahead in 3 of 5 folds.
  - (d) The candidate list grew after the first results (deviations
    1 and 2). Three more settings were tried (DistilBERT at lr 2e-5
    and 3e-5, and DistilBERT + keyword at 3e-5), which increases
    selection optimism.
  - (e) CV is optimistic. 19 same-class near-duplicate pairs (e5
    cosine >= 0.95) fall in different folds
    (`fold_assignment_v4.summary.txt`), so some held-out seeds have a
    near-copy in training. The sealed test set is the unbiased
    estimate.

## V4 threshold rule (2026-10-26)

Written before any threshold figure is computed.

- **Data.** The pooled out-of-fold predictions of the CV winner, the
  e5 hybrid at C 10 without V1 paraphrases
  (`research/v4/results/cv_hybrid_C10_oof.csv`). The sealed set is not
  used.
- **Candidates.** Thresholds t on the top predicted probability: 0.30,
  0.35, ..., 0.70 (nine values).
- **Rule.** t_act is the smallest t such that, among the OOF
  predictions with confidence >= t, all three hold:
  - accuracy is at least 0.90;
  - the precision of sti is at least 0.90;
  - the precision of pregnancy is at least 0.90.

  If no t qualifies, that is reported and the step stops. The rule is
  not relaxed.
- **Below t_act.** Predictions with confidence below t_act go to the
  low-confidence path the pipeline already uses. There is no new
  behaviour.
- **Reference rows.** The existing 0.35 and 0.50 are also reported, as
  reference rows. They are not tuned to anything.
- **Fixed for the sealed run.** t_act is fixed here for the sealed
  run. It is not changed after the sealed result.

## V4 frozen candidate (2026-10-26)

- **Model.** The e5 hybrid at C 10: logistic regression on [e5
  embedding (384), keyword hit counts (5), vague-rule flag (1)]. The
  6 rule columns are scaled; the embedding is not. L2, class_weight
  balanced, max_iter 2000, seed 42.
- **Training data.** All 380 seeds and their 1,239 paraphrases (1,619
  rows), with the dr05 and V3-pool exclusions and no V1 restore
  paraphrases.
- **Follows** "V4 CV selection (2026-10-26)" (the re-run over all
  candidates) and "V4 threshold rule (2026-10-26)".
- **File.** `research/v4/frozen/v4_hybrid_c10.json`, sha256
  89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd.
  - It was written by `research/v4/freeze_hybrid.py` at commit
    7a1c134.
  - A refit in a separate process gave byte-identical output.
  - The sidecar `v4_hybrid_c10.sha256` holds the hash.
  - `research/v4/v4_infer.py` loads only this file. It refuses the
    file if its hash, the feature code or the local e5 weights differ
    from what is recorded.
- **Threshold.** t_act = 0.45. Predictions with confidence below 0.45
  take the existing low-confidence path.
- **Rule.** Nothing about this model, its features, C or threshold
  changes before the sealed run. Any change needs a dated deviation
  and a new hash.
- **Not done.** The model is not integrated into ml_service or the
  gateway; integration happens only after the sealed gate. The sealed
  set has not been opened, and no sealed result is recorded here.

## V4 pre-registration: deviation 3 (2026-10-27), labelling guide and timing

- **Departure.** The pre-registration says of the sealed labels:
  "Labelling is finished before any V4 result exists." The sealed
  labels will be assigned after the CV results and the frozen model
  exist.
- **Safeguards.**
  - The model is frozen before labelling: `research/v4/frozen/v4_hybrid_c10.json`,
    sha256 89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd
    ("V4 frozen candidate (2026-10-26)").
  - Labellers see no model output.
  - The guide was derived from the training seeds only. No sealed
    question was read.
- **Disclosed.** The guide was written after the CV confusions were
  seen; the most frequent were pregnancy and general.
- **The guide.** `research/v4/LABELLING_GUIDE.md` documents the
  existing labelling conventions. For V4 it supersedes the class text
  in the V1 dataset plan (`docs/safegirl_dataset_plan.md`, "Intent
  classes").
- **Nothing changed.** No seed, label, fold or frozen file was changed,
  and no refit was needed.
- **Training seeds that disagree with the guide.** They are not
  relabelled and are treated as label noise. Disclosed for Chapter 5:
  - SEED-CONTRA-11 is labelled contraception. Rule 3 makes a question
    about precum pregnancy, since withdrawal and precum are a sex act,
    not a method.
  - SEED-V4-CON-004 is labelled contraception. The sti class covers
    condoms as infection protection.
  - SEED-V4-STI-006 is borderline. Under rule 5 it is sti (discharge
    not tied to the cycle, puberty or age), though the question
    describes discharge with no smell or itch.

  Their paraphrases follow their seeds' labels.

## V4 pre-registration: deviation 4 (2026-10-27), system-level measure

- **The measure.** The system-level measure becomes triage
  correctness: the reply kind only. There is no retrieval, no KB entry
  matching and no relevance gate.
- **How a reply kind is decided.** The real upstream rules run first,
  in the gateway's order: `checkSafety`, `isGenericHelpRequest`,
  `matchHeldTopic`, `isVagueQuery`. If none fires, the classifier
  decides.

  | Classifier result | V4 (frozen e5 hybrid) | Baseline under M2 |
  |---|---|---|
  | top probability < 0.45 (t_act) | abstain | (no probability) |
  | vague | ask | ask |
  | out_of_scope | abstain | abstain |
  | topic class (contraception, sti, pregnancy, general) | answer | answer |

  For V4 the threshold is applied first.
- **Expected reply kind, from the final labels:**

  | Final label | Expected reply kind |
  |---|---|
  | route held | held |
  | route safety | referral |
  | vague | ask |
  | out_of_scope | abstain |
  | topic class | answer |
- **Scoring.** All 205 items are scored, and so is the subset where no
  upstream rule fires. V4 is compared with M2 by McNemar's exact test.
- **Descriptive only.** Retrieval and matched-entry results are
  reported for description only, on the KB the demo uses.
- **Weaker than pre-registered.** This is a weaker measure than the
  pre-registered "matched entry", and Chapter 5 will disclose that.
  There is no dependency on the KB branch.
- **Integration.** Integration into the gateway happens only after the
  sealed gate, with its own decision-log entry.

## V4 pre-registration: deviation 5 (2026-10-27), comparators and the help row

- **Two baseline comparators at triage level.** At the triage
  (system) level the baseline comparators are BOTH M1 and M2.
  Criterion 3 requires V4's reply-kind correct rate to be not lower
  than M1's AND not lower than M2's.
- **Reason.** M2 abstains on many topic questions with no keyword hits
  (626 of the 1,677 training and dev items), which makes it a weak
  triage baseline. M1 is closer to the demo's behaviour.
- **Classifier level unchanged.** Criterion 1 still uses M2, chosen by
  CV macro-F1 in clarification 2.
- **The help row.** For items labelled vague, both "ask" and "help"
  count as correct.
- **Timing.** Both statements were fixed before any sealed run and do
  not refer to any sealed result.

## V4 sealed run procedure (2026-10-27)

- **Every item gets a topic label.** All 205 items get a topic label.
  A clinician forces a primary label on any item that cannot be
  settled. Such items are flagged ambiguous in a separate column of the
  labels file (`ambiguous`, 0 or 1).
- **What the gate uses.** The gate uses all 205 items. A descriptive
  table without the flagged items is added to the report.
- **Upstream catches.** Topic-labelled items that an upstream rule
  catches while their route is none lower every system's reply-kind
  rate equally, and they do not affect McNemar's test. This will be
  disclosed in Chapter 5.
- **The lock is permanent.** It may be removed only if the run crashed
  before any metric was produced, and only with a dated note in this
  log. If any result was shown, the lock stays and the result stands.
- **Subsets.** Conditions 1 to 3 of the gate use all items. The subset
  where no upstream rule fires is descriptive only.
- **Run once.** The sealed evaluation is run once and reported as it
  comes out (`research/v4/sealed_eval.py`).

## V4 sealed final labels (2026-10-27)

The sealed set's final labels, kept outside the repository with the
sealed questions. No question text is recorded here.

**Files (sha256)**
- Pre-review record, `sealed_final_combined_raw.xlsx`:
  1155667b0798deecba64f86c183f6076e22a93c653ba737734a42e1a03527d4c
- Reviewed sheet, `sealed_final_combined_v3.csv`:
  43aaaa478ad764116886230add1ba8d7351919d2d78d3cd9b565d551806628bb
- Labels used by `research/v4/sealed_eval.py`, `sealed_final_labels.csv`
  (id, topic_label, route, ambiguous; no text):
  99380b532b02f4f41cd7f4cdc4e61b0e96413230a3ff2966ec46ab384f850f39

**Counts (205 items)**
- Topic label: contraception 37, sti 37, pregnancy 34, general 48,
  out_of_scope 26, vague 23.
- Route: none 185, held 19, safety 1. The 20 held and safety items have
  these topic labels: contraception 7, general 5, pregnancy 4, sti 3,
  vague 1.
- Flagged ambiguous: 4 (FS-004, FS-021, FS-031, FS-110).
- The check-only run of `sealed_eval.py` passed all 14 pre-run checks.
  No lock was written and nothing was computed.

**Notes**
- **Topic labels for held and safety items.** The 20 held and safety
  items received topic labels and a route column on 27 Oct, after the
  freeze, under the labelling guide (`research/v4/LABELLING_GUIDE.md`).
- **Re-keyed ids.** In v3 the id column had been renumbered, so the
  rows were re-keyed to the original ids by text hash. All 205 texts
  were found, all distinct, and 146 rows took a different id. Each
  row's label, route and ambiguous value stayed with its text. After
  re-keying, the held and safety sets matched the pre-edit lists
  exactly:
  - held: FS-012, FS-014, FS-021, FS-031, FS-062, FS-063, FS-064,
    FS-065, FS-078, FS-105, FS-136, FS-201, FS-208, FS-209, FS-224,
    FS-226, FS-243, FS-252, FS-255;
  - safety: FS-079.
- **v2 not retained.** The v2 file was not retained.

**To complete**
- Adjudicated by: [role]
- Date: [FILL]
- Second reviewer labelled blind: [yes]
- Author read reviewer 2 labels before adjudicating: [yes]

## V4 sealed result (2026-10-27)

The one sealed run of `research/v4/sealed_eval.py` with --confirm-final,
run at commit edf3778.
- Labels sha256: 99380b532b02f4f41cd7f4cdc4e61b0e96413230a3ff2966ec46ab384f850f39
- Frozen model sha256: 89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd
- Full aggregate report: `research/v4/results/sealed_result.md` and
  `sealed_result.json`.
- The lock and the per-item predictions stay next to the labels file,
  outside the repository.

Gate report, copied exactly from the script's output:

- [PASS] 1 macro-F1 gain >= 0.05 and the 95% interval excludes 0
- [PASS] 2 sti and pregnancy recall not lower than M2's
- [PASS] 3 reply-kind correct rate not lower than M1's and than M2's
- [PASS] 4 app/ unchanged since the frozen model's commit
- **Overall: PASS**

git diff --stat of app/ against the frozen model's commit 7a1c134: (empty)

## V4 post-gate descriptive comparison with V3 (2026-10-27)

- **Descriptive only.** This follows the sealed gate result ("V4
  sealed result (2026-10-27)") and is descriptive only. No decision,
  gate condition or integration step depends on it, and it does not
  change the decision on V4.
- **V3 is frozen.**
  - Checkpoint: `ml_service/final/` (gitignored), `model.safetensors`
    sha256 e8bf2e3aa01c920197b51071e736ef6a3d1f16a57dd8d3bdb1565f75152cfb30,
    as already recorded in this log.
  - Settings: DistilBertForSequenceClassification, 6 layers, 4 labels
    (0 contraception, 1 sti, 2 pregnancy, 3 general). Each text is
    classified on its own, as `ml_service/app.py` does: truncation at
    max length 64, softmax, argmax, confidence = top probability.
  - Gateway thresholds: abstain below 0.35, scoped retrieval at 0.5
    (`app/gateway/src/classifierClient.js`). V3 is loaded offline from
    the checkpoint, with no server and no network.
- **Same items, own run.** It uses the same sealed items and the same
  final labels (sha256 99380b53...). It has its own script
  (`research/v4/v3_comparison.py`) and its own one-run lock,
  `V3_COMPARISON_RUN.lock`, next to the labels file. It is run once
  and reported as it comes out.
- **Scope.** V3 knows only contraception, sti, pregnancy and general.
  So the classifier comparison covers the 156 items whose topic label
  is one of those four classes.
- **Reply-kind column (all 205).** V3 is treated as: the upstream rules
  first (as in `triage_sim`), then confidence < 0.35 -> abstain,
  otherwise answer. Expected kinds and V4's kinds are as in deviations
  4 and 5.
- **Reported on the 156 items, for V3 and V4:** accuracy, macro-F1 over
  the four classes, per-class precision and recall, the confusion
  matrix, confident-wrong (> 0.5), ECE (10 bins), and V3's abstain rate
  at 0.35. V4 is reported twice:
  - as is: the six-class argmax; out_of_scope and vague predictions
    count as errors; confidence = top of the six probabilities;
  - restricted to the four topic classes: the argmax over the four
    topic probabilities; confidence = the top of those four,
    renormalised to sum to 1.

  The same is reported on the subset where no upstream rule fires.
- **Tests.** McNemar's exact test on correct/incorrect over the 156
  items, for V4 as is against V3 and V4 restricted against V3, with
  the discordant counts. A paired bootstrap (10,000 resamples, numpy
  default_rng(42), the same item resamples for both pairs) of each
  macro-F1 difference, with a 95% percentile interval, reported as is.

## V3 vs V4 sealed descriptive comparison result

- **Descriptive only.** This is the one run under "V4 post-gate
  descriptive comparison with V3 (2026-10-27)", on 27 Oct. No decision,
  gate condition or integration step depends on it, and the sealed
  gate result ("V4 sealed result (2026-10-27)") stands as recorded.
- **Deviations unchanged.** The five pre-registration deviations (1 to
  5) are unchanged.
- **Which comparisons are four-class and which six-class.**
  - V3 predicts four classes.
  - "V4 as is" predicts six classes; its out_of_scope and vague
    predictions count as errors on the four-class items.
  - "V4 restricted" is V4 limited to the four topic classes.
  - The reply-kind rate covers all 205 items.
- **Where the report is.** `research/v4/results/sealed_v3_comparison.md`
  and `.json`. It is copied exactly below.

```markdown
# V4 post-gate descriptive comparison with V3

Descriptive only; no decision depends on it.

V3 checkpoint sha256 e8bf2e3aa01c920197b51071e736ef6a3d1f16a57dd8d3bdb1565f75152cfb30; V4 frozen model sha256 89eee2b41634c896d7e03b49d184680c843df183f1e628bd71fb0fb9ee96ecdd; labels sha256 99380b532b02f4f41cd7f4cdc4e61b0e96413230a3ff2966ec46ab384f850f39; script sha256 c90459e42fed488a4c15c7518e8cbe495665f635563853a6adcf784e7acfd1a7; git 26925494d483924237f5179ab3bdd12aa727d9c0.

## Counts

205 items; 156 with a topic label in V3's four classes; 133 of those where no upstream rule fires. Topic labels: {'contraception': 37, 'sti': 37, 'pregnancy': 34, 'general': 48, 'out_of_scope': 26, 'vague': 23}.

## four-class items (n = 156)

| | Accuracy | Macro-F1 (4) | Confident-wrong | ECE |
|---|---|---|---|---|
| V3 | 0.6090 | 0.5984 | 0.1538 | 0.1113 |
| V4 as is | 0.8526 | 0.8810 | 0.1154 | 0.0855 |
| V4 restricted | 0.8718 | 0.8727 | 0.0962 | 0.0694 |

V3 abstain rate at 0.35: 0.0128.

Per-class precision / recall:

| Class | V3 | V4 as is | V4 restricted | Support |
|---|---|---|---|---|
| contraception | 0.781 / 0.676 | 0.882 / 0.811 | 0.886 / 0.838 | 37 |
| sti | 0.578 / 0.703 | 0.969 / 0.838 | 0.861 / 0.838 | 37 |
| pregnancy | 0.508 / 0.941 | 0.886 / 0.912 | 0.889 / 0.941 | 34 |
| general | 0.750 / 0.250 | 0.911 / 0.854 | 0.857 / 0.875 | 48 |

V3 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general |
|---|---|---|---|---|
| contraception | 25 | 4 | 7 | 1 |
| sti | 4 | 26 | 4 | 3 |
| pregnancy | 0 | 2 | 32 | 0 |
| general | 3 | 13 | 20 | 12 |

V4 as is confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 30 | 0 | 2 | 1 | 3 | 1 |
| sti | 3 | 31 | 0 | 2 | 1 | 0 |
| pregnancy | 1 | 0 | 31 | 1 | 0 | 1 |
| general | 0 | 1 | 2 | 41 | 2 | 2 |

V4 restricted confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general |
|---|---|---|---|---|
| contraception | 31 | 1 | 2 | 3 |
| sti | 3 | 31 | 0 | 3 |
| pregnancy | 1 | 0 | 32 | 1 |
| general | 0 | 4 | 2 | 42 |

McNemar exact on correct/incorrect (V4 right and V3 wrong / V4 wrong and V3 right):

- v4 as is vs v3: 47 / 9, p = 0.0000
- v4 restricted vs v3: 48 / 7, p = 0.0000

## four-class items, no upstream rule fires (n = 133)

| | Accuracy | Macro-F1 (4) | Confident-wrong | ECE |
|---|---|---|---|---|
| V3 | 0.6241 | 0.6157 | 0.1429 | 0.0990 |
| V4 as is | 0.9173 | 0.9269 | 0.0602 | 0.1040 |
| V4 restricted | 0.9248 | 0.9251 | 0.0526 | 0.0676 |

V3 abstain rate at 0.35: 0.0150.

Per-class precision / recall:

| Class | V3 | V4 as is | V4 restricted | Support |
|---|---|---|---|---|
| contraception | 0.741 / 0.667 | 0.931 / 0.900 | 0.933 / 0.933 | 30 |
| sti | 0.610 / 0.714 | 0.969 / 0.886 | 0.939 / 0.886 | 35 |
| pregnancy | 0.510 / 0.963 | 0.897 / 0.963 | 0.897 / 0.963 | 27 |
| general | 0.857 / 0.293 | 0.950 / 0.927 | 0.927 / 0.927 | 41 |

V3 confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general |
|---|---|---|---|---|
| contraception | 20 | 3 | 7 | 0 |
| sti | 4 | 25 | 4 | 2 |
| pregnancy | 0 | 1 | 26 | 0 |
| general | 3 | 12 | 14 | 12 |

V4 as is confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general | out_of_scope | vague |
|---|---|---|---|---|---|---|
| contraception | 27 | 0 | 2 | 0 | 1 | 0 |
| sti | 2 | 31 | 0 | 1 | 1 | 0 |
| pregnancy | 0 | 0 | 26 | 1 | 0 | 0 |
| general | 0 | 1 | 1 | 38 | 1 | 0 |

V4 restricted confusion (rows true, columns predicted):

| | contraception | sti | pregnancy | general |
|---|---|---|---|---|
| contraception | 28 | 0 | 2 | 0 |
| sti | 2 | 31 | 0 | 2 |
| pregnancy | 0 | 0 | 26 | 1 |
| general | 0 | 2 | 1 | 38 |

McNemar exact on correct/incorrect (V4 right and V3 wrong / V4 wrong and V3 right):

- v4 as is vs v3: 43 / 4, p = 0.0000
- v4 restricted vs v3: 43 / 3, p = 0.0000

## Paired bootstrap, four-class items

- v4 as is minus v3: 0.2826, 95% interval [0.2029, 0.3643]
- v4 restricted minus v3: 0.2743, 95% interval [0.1943, 0.3569]

(10000 resamples, seed 42.)

## Reply-kind correct rate

V3: upstream rules first, then confidence < 0.35 -> abstain, otherwise answer. V4 as in triage_sim.

| Subset | n | V3 | V4 |
|---|---|---|---|
| all | 205 | 0.7561 | 0.8195 |
| no_upstream | 163 | 0.7853 | 0.8650 |
```

## V4 integration behind a flag

Recorded 27 Oct 2026, before any integration code, on branch
`v4/integration`.

- **Flag.** `V4_TRIAGE_ENABLED`, on only when it is exactly `"true"`;
  off by default. With the flag off, V3 behaviour is unchanged
  (byte-for-byte on the tested paths): V4 is not loaded and `/triage`
  is never called.
- **Mapping when on** (deviation 4). After the upstream rules (Safety
  Net, help, held topics A/B/C, vague rule), V4 classifies:
  - vague class -> `clarify()`;
  - out_of_scope, or confidence < 0.45 -> abstain, without retrieval;
  - topic class -> the existing `retrieve` (0.35 and 0.5 unchanged),
    then the relevance gate 0.8439.

  V4's vague and out_of_scope are never passed to `/retrieve`.
- **Fail-safe.**
  - Any `/triage` failure (network, timeout, 503, malformed body) falls
    back to V3 `/classify`, then to the keyword fallback, as today.
  - The log records the reason only (status or error code), never
    query text.
  - V4 refuses to load on any hash, feature-code or e5-revision
    mismatch, and `/triage` is then unavailable (503).
- **e5 is shared with the retriever.** V4 reuses the retriever's
  `intfloat/multilingual-e5-small` instance, with a check that its
  revision is the one V4 was frozen with (614241f6...).
- **Frozen and unchanged:**
  - the V4 model JSON and its sha256 (89eee2b4...);
  - thresholds 0.35, 0.5 and t_act 0.45, and the relevance gate 0.8439;
  - KB text, Safety Net patterns, helplines and HELP_CONTACTS_VERIFIED;
  - the order of checks;
  - the offline interface pipeline, which stays keyword-only.
- **Status.** Experimental and off by default. Turning it on for the
  demo is a separate logged decision, after the rehearsal and Mr. Ouma's
  sign-off. The DPO/ethics point on automated triage still applies.
- **Acceptance criteria.** Dev queries are used for equivalence checks
  only, never for tuning.
  - **Step 2, parity (research side).**
    - Node-vs-Python tests of the vague flag on synthetic edge cases
      (accents, apostrophes, mixed case, non-ASCII).
    - One keyword-count comparison, Node `matchedKeywords` against
      Python `explain_baseline`, that reports mismatches without
      blocking.
  - **Step 3, ml_service.**
    - With the flag off, `/classify`, `/retrieve` and `/health`
      responses are identical to a snapshot, and `/triage` is
      unavailable.
    - A fixture test that `/triage` probabilities equal `v4_infer` on
      synthetic queries only (within 1e-6).
    - A tampered sidecar or feature file gives 503, with no query text
      in the logs.
  - **Step 4, gateway.**
    - With the flag off, all existing tests pass, and `handleQuery`
      responses on the 58 dev queries with a stubbed ml_service are
      byte-identical before and after.
    - With the flag on (fake fetch):
      - vague -> clarify; out_of_scope -> abstain; below 0.45 ->
        abstain;
      - 0.45 to 0.5 -> unscoped; 0.5 or above -> scoped;
      - a 503 or malformed `/triage` -> the V3 path;
      - the log never contains query text.
    - Safety Net, help, held and vague still fire before `/triage`,
      which is never called for them.
  - **Step 5, end to end.**
    - With the flag on, reply kinds equal
      `research/v4/triage_sim.py` on the dev queries and seeds (no
      sealed data).
    - Latency per query (median and 95th percentile) and RAM, measured
      with the flag on and off.
    - A closing decision-log entry and a README note.
- **Update, 2026-10-27 (timeouts).** After a `/triage` timeout or
  network error, the gateway skips `/classify` and goes straight to the
  keyword fallback. ml_service is not answering, so waiting out a
  second 3 s timeout would double the worst case. The worst case with
  the flag on therefore stays about 3 s, as with the flag off. The V3
  `/classify` fallback is kept for a 503, other non-2xx responses, a
  malformed body, an unknown label or a bad confidence. `npm test` now
  clears a stray `V4_TRIAGE_ENABLED` from the shell
  (`test/clearV4Flag.js`).

## V4 integration: keyword fallback list differences (2026-10-27)

A note to "V4 integration behind a flag", from plan step 2
(`research/v4/tests/test_keyword_parity.py`, non-blocking).

- **The finding.** The gateway's keyword fallback
  (`app/gateway/src/fallback/keywordClassifier.js`) does not use the
  same keyword lists as the evaluated Python baseline
  (`research/experiments/baseline_classifier.py`), although its comment
  says the set is preserved.
  - gbv: `consent` is only in Node. `female genital mutilation`,
    `molestation` and the `without my agreement/approval/permission`
    phrases are only in Python.
  - pregnancy: `pregnancy risk(s)` is only in Node.
  - The two also differ on word boundaries: JavaScript's `\b` is
    ASCII-only and Python's is Unicode-aware. This shows only in
    synthetic strings where a keyword is directly followed by an
    accented letter.
  - On real data, 7 items differ, all in gbv: SEED-GEN-11, its
    paraphrases P1 to P4, DEV-Q19 and DEV-Q42.
- **V4 is unaffected.** It computes its keyword features in Python only,
  in training, in the frozen evaluation and in `/triage`.
- **Nothing changed.** Neither classifier was changed.
- **Not separately evaluated.** The gateway's keyword fallback path
  (used when ml_service is unreachable) was not evaluated on its own.
  The M1/M2 baseline results come from the Python baseline.

## V4 integration complete (flag off by default)

Closes "V4 integration behind a flag" (27 Oct 2026, branch
`v4/integration`).

- **What exists.** `V4_TRIAGE_ENABLED` is off by default and is on only
  when it is exactly `"true"`.
  - **ml_service:** `/triage`, with the frozen model and its checks:
    the sidecar hash, the feature code, and the e5 revision and
    weights.
  - **Gateway:** the deviation 4 mapping. After a `/triage` timeout or
    network error it goes straight to the keyword fallback; after any
    other failure, to V3 `/classify`.
  - **With the flag off:** the snapshots of ml_service (23 responses)
    and the gateway (74 replies) are byte-identical to before.
- **Unchanged.** Thresholds 0.35, 0.5 and 0.45, the gate 0.8439, KB
  text, Safety Net, helplines, HELP_CONTACTS_VERIFIED, the order of
  checks, `generationModule` and the offline interface pipeline (still
  keyword-only).
- **Not evaluated on its own.** The gateway's keyword fallback, whose
  lists differ from the evaluated Python baseline (see "V4
  integration: keyword fallback list differences (2026-10-27)").
- **Status.** The flag stays off. Turning it on for the demo is a
  separate logged decision, after the rehearsal and Mr. Ouma's
  sign-off. The DPO/ethics point on automated triage still applies.
- **End-to-end results.** From `research/v4/integration_e2e.py`, at
  commit 4da9e85: synthetic, seed and dev queries only, nothing tuned.
  Copied exactly from `research/v4/results/integration_e2e.md`:

```markdown
# V4 integration, end to end

Synthetic warm-up query, the 58 dev queries and the 380 V4 training seeds; ids only. Seeds are training data: the route comparison is an equivalence check, not an accuracy claim. Nothing was tuned.

## Startup, memory and latency

| | Flag off | Flag on |
|---|---|---|
| ml_service startup (s) | 24.44 | 26.19 |
| gateway startup (s) | 1.06 | 1.09 |
| ml_service memory after startup (MB) | 989.3 | 1377.9 |
| ml_service memory after queries (MB) | 1168.0 | 1388.8 |
| gateway memory after queries (MB) | 78.9 | 126.6 |
| first request (ms) | 569.3 | 211.6 |
| dev queries, median (ms) | 87.0 | 95.7 |
| dev queries, 95th percentile (ms) | 140.3 | 137.5 |
| dev queries, max (ms) | 154.6 | 179.7 |

e5 tensor check at startup (flag on only): median 0.81 s over 3 runs; result: match.

The flag-off run goes first, so it starts from a colder disk cache: its startup and first request include that, and the startup difference between the two runs is not the cost of V4. The e5 tensor check above is the measured startup cost V4 adds.

## Route equivalence with triage_sim (flag on)

| Set | Compared | Matching | Mismatch reasons |
|---|---|---|---|
| dev | 58 | 55 | {'gate': 3} |
| seeds | 380 | 286 | {'gate': 94} |

dev mismatches (id: live / triage_sim, reason):

- DEV-Q23: abstain / answer, gate
- DEV-Q53: abstain / answer, gate
- DEV-Q57: abstain / answer, gate

seeds mismatches (id: live / triage_sim, reason):

- SEED-V4-GEN-003: abstain / answer, gate
- SEED-V4-GEN-005: abstain / answer, gate
- SEED-V4-GEN-006: abstain / answer, gate
- SEED-V4-GEN-008: abstain / answer, gate
- SEED-V4-GEN-011: abstain / answer, gate
- SEED-V4-GEN-016: abstain / answer, gate
- SEED-V4-GEN-018: abstain / answer, gate
- SEED-V4-GEN-019: abstain / answer, gate
- SEED-V4-GEN-020: abstain / answer, gate
- SEED-V4-GEN-022: abstain / answer, gate
- SEED-V4-PREG-011: abstain / answer, gate
- SEED-V4-CON-007: abstain / answer, gate
- SEED-V4-CON-010: abstain / answer, gate
- SEED-V4-CON-013: abstain / answer, gate
- SEED-V4-STI-010: abstain / answer, gate
- SEED-V4-STI-011: abstain / answer, gate
- SEED-V4-STI-012: abstain / answer, gate
- SEED-V4-STI-014: abstain / answer, gate
- SEED-V4-STI-015: abstain / answer, gate
- SEED-V4-CON-025: abstain / answer, gate
- SEED-V4-CON-028: abstain / answer, gate
- SEED-V4-STI-017: abstain / answer, gate
- SEED-V4-STI-018: abstain / answer, gate
- SEED-V4-STI-022: abstain / answer, gate
- SEED-V4-STI-023: abstain / answer, gate
- SEED-V4-PREG-018: abstain / answer, gate
- SEED-V4-PREG-019: abstain / answer, gate
- SEED-V4-PREG-022: abstain / answer, gate
- SEED-V4-PREG-025: abstain / answer, gate
- SEED-V4-GEN-027: abstain / answer, gate
- SEED-CONTRA-06: abstain / answer, gate
- SEED-CONTRA-14: abstain / answer, gate
- SEED-CONTRA-20: abstain / answer, gate
- SEED-STI-07: abstain / answer, gate
- SEED-STI-10: abstain / answer, gate
- SEED-PREG-04: abstain / answer, gate
- SEED-PREG-05: abstain / answer, gate
- SEED-PREG-07: abstain / answer, gate
- SEED-PREG-20: abstain / answer, gate
- SEED-PREG-22: abstain / answer, gate
- SEED-GEN-04: abstain / answer, gate
- SEED-GEN-05: abstain / answer, gate
- SEED-GEN-06: abstain / answer, gate
- SEED-GEN-07: abstain / answer, gate
- SEED-GEN-08: abstain / answer, gate
- SEED-GEN-09: abstain / answer, gate
- SEED-GEN-11: abstain / answer, gate
- SEED-GEN-12: abstain / answer, gate
- SEED-GEN-13: abstain / answer, gate
- SEED-GEN-14: abstain / answer, gate
- SEED-GEN-15: abstain / answer, gate
- SEED-GEN-16: abstain / answer, gate
- SEED-GEN-18: abstain / answer, gate
- SEED-GEN-23: abstain / answer, gate
- SEED-GEN-24: abstain / answer, gate
- SEED-GEN-28: abstain / answer, gate
- SEED-GEN-30: abstain / answer, gate
- SEED-GEN-31: abstain / answer, gate
- SEED-GEN-33: abstain / answer, gate
- SEED-GEN-35: abstain / answer, gate
- SEED-GEN-42: abstain / answer, gate
- SEED-GEN-43: abstain / answer, gate
- SEED-GEN-44: abstain / answer, gate
- SEED-GEN-49: abstain / answer, gate
- SEED-GEN-51: abstain / answer, gate
- SEED-GEN-52: abstain / answer, gate
- SEED-STI-42: abstain / answer, gate
- SEED-PREG-28: abstain / answer, gate
- SEED-PREG-29: abstain / answer, gate
- SEED-PREG-32: abstain / answer, gate
- SEED-PREG-33: abstain / answer, gate
- SEED-PREG-34: abstain / answer, gate
- SEED-PREG-36: abstain / answer, gate
- SEED-PREG-39: abstain / answer, gate
- SEED-PREG-44: abstain / answer, gate
- SEED-CONTRA-48: abstain / answer, gate
- SEED-STI-45: abstain / answer, gate
- SEED-STI-46: abstain / answer, gate
- SEED-STI-47: abstain / answer, gate
- SEED-STI-48: abstain / answer, gate
- SEED-STI-50: abstain / answer, gate
- SEED-PREG-46: abstain / answer, gate
- SEED-PREG-47: abstain / answer, gate
- SEED-PREG-48: abstain / answer, gate
- SEED-PREG-51: abstain / answer, gate
- SEED-GEN-54: abstain / answer, gate
- SEED-GEN-55: abstain / answer, gate
- SEED-GEN-57: abstain / answer, gate
- SEED-GEN-58: abstain / answer, gate
- SEED-STI-51: abstain / answer, gate
- SEED-STI-52: abstain / answer, gate
- SEED-STI-53: abstain / answer, gate
- SEED-STI-54: abstain / answer, gate
- SEED-STI-55: abstain / answer, gate

Machine: AMD64 Family 25 Model 124 Stepping 0, AuthenticAMD; Python 3.14.6; Node v24.18.1; git 4da9e85.
```

## Gemini generation behind a flag

Recorded 27 Oct 2026, before any generation code, on branch
`gemini/integration`. Mr. Ouma's decision stands: SafeGirl gives
extractive answers (the KB entry's answer verbatim). Gemini generation
is an experiment for the comparison only.

- **Flag.** `GENERATION_ENABLED`, on only when it is exactly `"true"`;
  off by default. With the flag off, `generationModule` returns the
  extractive answer exactly as before, Gemini is never contacted, and
  the flag-off snapshots are unchanged.
- **Key.** Read only from the `GEMINI_API_KEY` environment variable and
  sent only in the `x-goog-api-key` request header, never in the URL.
  It is never logged or put in an error message. With the flag on and
  no key, every reply is extractive.
- **Model, pinned: `gemini-3.6-flash`** (REST `generateContent`, plain
  `fetch`, no SDK).
  - It is a stable model, and stable codes "usually don't change". The
    `-latest` aliases are hot-swapped with each release, so they would
    break the comparison.
  - No shutdown date has been announced. It has been stable since 21 Jul
    2026, longer than `gemini-3.8-flash` (2 Sep 2026).
  - The Gemini API offers no dated (`-001`) code for current Flash
    models. The 2.5 models are limited to earlier users, and 2.0 was shut
    down on 1 Jun 2026.
  - Checked against ai.google.dev (models and deprecations pages, last
    updated 22 Oct 2026). Re-check before the first real call.
- **Fixed settings.**
  - Temperature 0, for the most repeatable output.
  - `maxOutputTokens` 512, about five times the longest KB answer (76
    words). If the model's thinking tokens count toward this limit, a
    `MAX_TOKENS` finish falls back to the extractive reply. Check this at
    the first real call.
  - Timeout 8 s, with no retry. Generation runs after classification and
    retrieval, so the worst case adds 8 s to the reply.
- **Extractive fallback on any failure.** These all return the extractive
  reply, byte-identical to the flag-off reply:
  - a missing key, network error, timeout or non-2xx status;
  - a malformed body, a blocked prompt or a finish reason other than
    `STOP`;
  - an empty text;
  - the output guard.
  The log records the reason only, never the query, the answer or the
  key.
- **Output guard.** The generated text is rejected (extractive reply) if
  it contains a phone number (a run of three or more digits) that is not
  in the KB entry, or omits a helpline number (GBV 1195, Childline 116,
  999, 112, or any number of seven or more digits) that the entry has.
- **Prompt.** Answer only from the supplied KB entry, add no new medical
  facts, keep helpline text and numbers as written, and refer to a
  clinic when the entry does.
- **What is sent.** Only the query text and the retrieved KB entry's
  question, answer, conditions/limitations and safety/referral notes. No
  session, user or device data, history, or classifier output is sent.
- **Where it runs.** Only on a clear query that retrieved an entry and
  passed the relevance gate. Referral, help, held-topic, vague and
  abstain replies never reach Gemini.
- **Synthetic queries only** until ethics clearance. No real user query
  is sent to Gemini. Sending data to Google is a DPO/ethics point. The
  API tier, and whether Google may keep or train on the data, must be
  settled before any non-synthetic use.
- **Unchanged.**
  - The frozen list as before: the V4 model JSON and hash, thresholds
    0.35, 0.5 and 0.45, and the gate 0.8439.
  - The order of checks, KB text, Safety Net patterns, helplines and
    HELP_CONTACTS_VERIFIED.
  - The offline interface pipeline, which is extractive and keyword-only.
- **Status.** Experimental and off by default. Step 7a builds and tests
  it offline with a fake `fetch` only; no real API call is made.
  Turning the flag on, even for the comparison, is a separate logged
  step.

## Gemini smoke test (2026-10-27)

Step 7b, on `gemini/integration` at commit 3df122e. One run of
`research/experiments/gemini_smoke.js` with `GENERATION_ENABLED=true`:
four author-written synthetic queries, one real call each, no retries.
Settings unchanged (temperature 0, `maxOutputTokens` 512, timeout 8 s).
ml_service was not running, so every query took the keyword fallback
and local retrieval.

- **Result.** All four calls returned HTTP 200 with finish reason
  `MAX_TOKENS`, so all four answers fell back to extractive, as
  designed. The guard was not reached.
- **Cause.** Thinking tokens (487 to 491 per call) used almost all of
  the 512-token limit. The Gemini thinking docs (updated 14 Oct 2026)
  say `max_output_tokens` includes thought tokens. This is the case the
  "Fixed settings" note asked to check at the first real call.
- **Retrieval, separately.** The local keyword retrieval picked poorly
  matching entries for three queries (KB-C4, KB-P5, KB-G6). This is the
  keyword fallback, not Gemini, and is noted only.
- **Status.** No setting changed. A proposed change waits for approval.

Output copied exactly:

```text
=== contraception
query: How soon after sex should I take the emergency pill?
classified: contraception (keyword_fallback), retrieval: local, entry: KB-C4
HTTP status: 200
finish reason: MAX_TOKENS
tokens: prompt 357, candidates 17, thinking 491, total 865
latency: 4486 ms
answer: extractive ([generationModule] Gemini unavailable, using extractive answer: finish reason MAX_TOKENS)
guard: not reached
text: Yes, if you want protection from STIs. Condoms are the only contraceptive method that prevents both pregnancy and sexually transmitted infections, including HIV. Other methods prevent pregnancy only, so Kenyan guidance strongly encourages young people to use condoms as well, for dual protection.

=== sti
query: Can you get an STI the first time you have sex?
classified: sti (keyword_fallback), retrieval: local, entry: KB-S4
HTTP status: 200
finish reason: MAX_TOKENS
tokens: prompt 358, candidates 21, thinking 487, total 866
latency: 4296 ms
answer: extractive ([generationModule] Gemini unavailable, using extractive answer: finish reason MAX_TOKENS)
guard: not reached
text: It could be. Unusual discharge, genital sores or lower belly pain can be signs of an STI, but many STIs cause no symptoms at all, so only a test can tell. A health worker can examine you and give treatment, and Kenya's guidelines say providers must ensure privacy and confidentiality when serving adolescents.

=== pregnancy
query: What are the first signs that I might be pregnant?
classified: pregnancy (keyword_fallback), retrieval: local, entry: KB-P5
HTTP status: 200
finish reason: MAX_TOKENS
tokens: prompt 402, candidates 19, thinking 489, total 910
latency: 3231 ms
answer: extractive ([generationModule] Gemini unavailable, using extractive answer: finish reason MAX_TOKENS)
guard: not reached
text: Under Kenya's 2020 national school re-entry guidelines, a pregnant learner is allowed to stay in school for as long as possible and to sit national exams if her health allows. After delivery she is re-admitted to the same class she was in before. The guidelines give the return time as six months after delivery and also as the start of the next calendar year, so ask your school's guidance and counselling teacher what applies to you.

=== general
query: Is it normal for my period to come at different times?
classified: general (keyword_fallback), retrieval: local, entry: KB-G6
HTTP status: 200
finish reason: MAX_TOKENS
tokens: prompt 387, candidates 20, thinking 488, total 895
latency: 3627 ms
answer: extractive ([generationModule] Gemini unavailable, using extractive answer: finish reason MAX_TOKENS)
guard: not reached
text: The first sign of puberty in most girls is breast 'buds', followed by body hair and a growth spurt. Most girls get their first period within 2 to 3 years after breast development starts. Timing varies from girl to girl, so if you are worried about your development, talk to a health worker.
```

## Gemini request settings amended (2026-10-27)

Amends the "Fixed settings" in "Gemini generation behind a flag", after
the smoke test (see "Gemini smoke test (2026-10-27)"). The earlier entry
is left as it was.

- **Thinking level `minimal`** (`generationConfig.thinkingConfig.
  thinkingLevel`). At the default level, thinking used 487 to 491 of
  the 512 output tokens on every smoke call, so each stopped at
  `MAX_TOKENS`. The task only rewrites one entry, so it needs little
  reasoning. Google notes that `minimal` does not guarantee thinking is
  off.
- **`maxOutputTokens` 1024** (was 512), as headroom, because thinking
  tokens count toward the limit (Gemini thinking docs, updated 14 Oct
  2026).
- **Temperature 1.0** (was 0), the default Google recommends for all
  Gemini 3 models. The docs warn that a temperature below 1.0 may lead
  to looping or degraded output.
- **Repeatability.** This departs from the earlier aim of the most
  repeatable output. To make up for it, the comparison will run each
  query 3 times and report the spread.
- **Unchanged.** Model `gemini-3.6-flash`, timeout 8 s with no retry,
  the prompt, the output guard, the extractive fallback, synthetic
  queries only, and the flag off by default.

## KB 62 merge rule (written before measurement) (2026-10-27)

Branch `kb/merge-60` (the KB branch merged into development at
dde3f92). Decision owner: project owner. This rule decides whether the
demo serves the 62-entry KB or stays on the 21 entries. It is applied as
written to the K5 measurements that follow.

- **Retrieval index, pass criterion.** Unscoped self-retrieval of at
  least 60 of 62 KB questions in question-only mode
  (`RETRIEVAL_EMBED_MODE=question`, `npm run kb:self-retrieval`). The
  scoped count (live V3 scoping) is reported, not gated, because V3
  mis-scopes five entries (KB-C11, KB-S16, KB-P1, KB-G13, KB-P9), so
  scoped retrieval cannot reach them whatever is embedded.
- **Dev score, pass criterion.** On the 35 labelled development-set
  questions, the 62-entry KB must be within one question of the
  21-entry result (29 of 35), so at least 28 of 35, scored with
  relabelled labels.
  - The existing labels file
    (`resources/eval/retrieval_eval_set_labels_2026-10-15.csv`)
    predates the new entries. The first run uses it as it is and is
    reported as provisional.
  - Relabelling needs a blind review of the 35 questions by Cindy.
  - The development set is not blind to the 62 entries: the K3 and K4
    evaluations and the diagnosis already looked at its replies on
    them.
- **Embed mode.** The default switches from "full" to "question" only
  if the criteria pass, and then as its own logged change. Otherwise
  the demo stays on the 21 entries.
- **Gate.** The 0.8439 relevance gate is re-measured, not changed, in
  this step. Any change is a separate, tested decision.
- **Timing.** This rule was written after the K4 diagnosis
  (`docs/kb-integration-diagnosis-2026-10-22.md`, which includes an
  offline what-if of question-only embedding), but before any
  question-only measurement on the merged tree. The self-retrieval
  wording was corrected before measuring, to gate on the unscoped
  count and report the scoped count.

## K5 measurements (62 entries) (2026-10-27)

Branch `kb/merge-60`, measured at 01fc5ad, data in 8cbada4
(`research/v4/results/k5_*`). Applies "KB 62 merge rule (written before
measurement)" as written. Nothing was tuned; no KB text, threshold, V4
file, snapshot or embed-mode default changed.

**Rule applied:**

- **Retrieval index** (unscoped self-retrieval of at least 60 of 62 in
  question-only mode): 62 of 62. **PASS.**
- **Dev score** (at least 28 of 35 with relabelled labels): first run
  with the existing labels, provisional: 21 of 35 in question-only mode
  (23 of 35 in full mode). **FAIL (provisional).** The relabelled run
  has not been done; it needs Cindy's blind review of the 35 questions.
- **Embed mode:** the criteria did not both pass, so the default stays
  "full". **Not switched.**
- **Demo:** stays on the 21 entries.
- **Gate:** re-measured, not changed (0.8439).

**Read with the numbers:**

- In question-only mode each KB question is embedded as its own
  passage, so self-retrieval queries the same text it indexed; 62 of
  62 with no near-misses is close to certain in that mode and says
  little about other phrasings.
- In question-only mode five dev questions abstain although their
  unscoped top-1 entry is acceptable (Q07, Q16, Q20, Q54, Q57): the
  scores sit on a different scale, and 0.8439 was set on full-mode
  scores. In full mode wrong answers still reach 0.8947, above the
  lowest correct one (0.8580).
- Removing abortion, nurse, pharmacies and sexuality from the
  health-term list would change the vague-rule result on none of the 62
  KB questions, 35 dev questions, 380 seeds or 1,239 paraphrases. The
  list is a V4 feature source, so any change to `healthTerms.json`
  stops V4 loading (feature hash mismatch); it is unchanged.

Results copied exactly from `research/v4/results/k5_summary.md`:

```markdown
# K5 measurements, 62-entry KB (27 October 2026)

Branch `kb/merge-60` at 01fc5ad. ml_service restarted from this tree for each mode (V4 and generation off); gateway with `AUTH_DISABLED=true`, relevance gate on at 0.8439, thresholds 0.35 / 0.5. Produced by `research/eval/k5_measure.js` and `research/eval/k5_health_terms.js`; full per-item ids in `k5_question.json`, `k5_full.json` and `k5_health_terms.json`. Dev labels: `retrieval_eval_set_labels_2026-10-15.csv` as it is (provisional; predates the new entries). Gate set: `resources/eval/relevance_validation.csv`, likely entries also predate the new entries.

## Self-retrieval (62 KB questions)

| | question | full |
|---|---|---|
| unscoped, own entry top-1 | 62 / 62 | 61 / 62 |
| scoped (live V3), own entry top-1 | 57 / 62 | 56 / 62 |
| unscoped failures | none | KB-C4->KB-C18 |
| scoped failures | KB-C11->KB-P5 (scoped pregnancy), KB-S16->KB-G16 (scoped general), KB-P1->KB-G3 (scoped general), KB-P9->KB-G6 (scoped general), KB-G13->KB-P5 (scoped pregnancy) | KB-C4->KB-C18 (scoped contraception), KB-C11->KB-P8 (scoped pregnancy), KB-S16->KB-G16 (scoped general), KB-P1->KB-G14 (scoped general), KB-P9->KB-G14 (scoped general), KB-G13->KB-P8 (scoped pregnancy) |
| near-misses < 0.03 (unscoped / live lines) | 0 / 0 | 24 / 22 |

Near-miss entries, unscoped: question: none; full: KB-C1, KB-C2, KB-C3, KB-C5, KB-C8, KB-C9, KB-C12, KB-C19, KB-C21, KB-S3, KB-S4, KB-S5, KB-S8, KB-S12, KB-P5, KB-P8, KB-G3, KB-G5, KB-G6, KB-G7, KB-G9, KB-G14, KB-G16, KB-G17.

## Dev questions (35, provisional labels)

| | question | full |
|---|---|---|
| correct | 21 / 35 | 23 / 35 |
| 21-entry result (K3 "Before") | 29 / 35 | 29 / 35 |
| replies changed vs 21 entries | Q03, Q07, Q11, Q13, Q16, Q20, Q23, Q28, Q30, Q54, Q55, Q58 | Q02, Q03, Q04, Q11, Q23, Q30, Q50, Q54, Q55 |

Changed replies, question mode (before → now · verdict · gate score):

- Q03: answer-scoped KB-C5 (correct) → answer-scoped KB-C18 · wrong · 0.8675
- Q07: answer-unscoped KB-S7 (correct) → abstain · wrong · 0.8408
- Q11: answer-unscoped KB-G3 (correct) → answer-unscoped KB-G14 · wrong · 0.8908
- Q13: answer-unscoped KB-G5 (correct) → answer-unscoped KB-G9 · wrong · 0.8538
- Q16: answer-unscoped KB-G1 (correct) → abstain · wrong · 0.8279
- Q20: answer-unscoped KB-C3 (correct) → abstain · wrong · 0.8416
- Q23: abstain (wrong) → answer-unscoped KB-S4 · correct · 0.8644
- Q28: answer-scoped KB-P6 (partial) → answer-scoped KB-P8 · wrong · 0.8544
- Q30: answer-scoped KB-P5 (wrong) → answer-scoped KB-P8 · wrong · 0.8899
- Q54: answer-unscoped KB-S7 (correct) → abstain · wrong · 0.8348
- Q55: answer-unscoped KB-G3 (correct) → answer-unscoped KB-G14 · wrong · 0.8785
- Q58: answer-scoped KB-C4 (correct) → answer-scoped KB-C12 · wrong · 0.8536

Changed replies, full mode (before → now · verdict · gate score):

- Q02: answer-scoped KB-C4 (correct) → answer-scoped KB-C18 · wrong · 0.8883
- Q03: answer-scoped KB-C5 (correct) → answer-scoped KB-C18 · wrong · 0.875
- Q04: answer-scoped KB-S4 (correct) → answer-scoped KB-S10 · wrong · 0.8947
- Q11: answer-unscoped KB-G3 (correct) → answer-unscoped KB-C7 · wrong · 0.8862
- Q23: abstain (wrong) → answer-unscoped KB-S21 · wrong · 0.8504
- Q30: answer-scoped KB-P5 (wrong) → answer-scoped KB-P8 · wrong · 0.879
- Q50: answer-scoped KB-P6 (correct) → answer-scoped KB-P8 · correct · 0.8591
- Q54: answer-unscoped KB-S7 (correct) → abstain · wrong · 0.8401
- Q55: answer-unscoped KB-G3 (correct) → answer-unscoped KB-G14 · wrong · 0.8761

## Gate separation (0.8439, unscoped top-1 score)

| | question | full |
|---|---|---|
| dev: correct answers | 0.8456 to 0.9675 (n=21) | 0.8580 to 0.9246 (n=23) |
| dev: wrong or partial answers | 0.8536 to 0.8908 (n=7) | 0.8439 to 0.8947 (n=8) |
| dev: abstentions | 0.8037 to 0.8416 (n=5) | 0.8227 to 0.8401 (n=2) |
| dev: wrong or partial answers passing the gate | 7 (Q03, Q11, Q13, Q28, Q30, Q55, Q58) | 8 (Q02, Q03, Q04, Q11, Q23, Q28, Q30, Q55) |
| dev: abstained although unscoped top-1 is acceptable | 5 (Q07, Q16, Q20, Q54, Q57) | 2 (Q54, Q57) |
| gate set: top-1 = likely entry | 0.8154 to 0.9107 (n=15) | 0.8259 to 0.9173 (n=12) |
| gate set: top-1 ≠ likely entry | 0.8538 to 0.9107 (n=5) | 0.8476 to 0.9258 (n=8) |
| gate set: off-topic (NOT_KB_ANSWER) | 0.7445 to 0.8489 (n=14) | 0.7657 to 0.8622 (n=14) |
| gate set: likely entry below the gate | 5 (V02, V03, V06, V17, V19) | 1 (V19) |
| gate set: wrong entry passing the gate | 5 (V05, V12, V14, V16, V18) | 8 (V01, V02, V03, V05, V12, V14, V17, V18) |
| gate set: off-topic passing the gate | 2 (V31, V34) | 4 (V29, V31, V33, V34) |
| gate set: referral or signpost rows, not scored | 6 | 6 |

## Health-term drift (read-only)

Sets: kb_questions 62, dev_questions 35, seeds 380, paraphrases 1239. Vague now: kb_questions 0, dev_questions 0, seeds 33, paraphrases 137.

| Term | healthTerms.json | extraHealthTerms.json | KB questions | dev | seeds | paraphrases | vague result changes if removed |
|---|---|---|---|---|---|---|---|
| abortion | yes | yes | 0 | 0 | 0 | 0 | none |
| nurse | yes | no | 0 | 0 | 3 | 5 | none |
| pharmacies | yes | no | 0 | 0 | 0 | 0 | none |
| sexuality | yes | no | 0 | 0 | 0 | 0 | none |

All four removed: vague result changes on 0 texts.
```

## KB 62 relabelling (2026-10-27)

Branch `kb/merge-60`. Prepares the relabelled run that "KB 62 merge
rule (written before measurement)" requires. Nothing is measured or
scored in this step.

- **Why.** The dev labels (`retrieval_eval_set_labels_2026-10-15.csv`)
  and the gate set's likely entries name only the 21 old entries, so
  an answer from one of the new entries counts as wrong even when it
  fits. The K5 dev score (21 of 35) is provisional for that reason.
- **What is relabelled.** 75 items: the 35 labelled dev questions and
  all 40 gate-set items (`relevance_validation.csv`), against the 62
  served entries. The 4 pending entries are not offered.
- **Blind protocol.**
  - Cindy labels from the question text and the 62 entries only:
    best entry, other acceptable entries, or "none fits" (the system
    should not answer).
  - The sheet has no system output, score, earlier label or original
    id. Items are in a fixed shuffled order (seed 20261027) under
    opaque ids (R01 to R75). The id key is kept apart from the kit.
  - The dev set is not blind to the 62 entries: the K3, K4 and K5
    evaluations and the diagnosis looked at its replies on them.
  - A clinician or Mr. Ouma may spot-check the filled sheet.
- **Not in git.** The kit, the filled sheet, the key and the converted
  labels files are kept outside the repository
  (`C:\Users\cindy\relabel\`, `C:\Users\cindy\relabel_key\`). The
  repository holds only the tools: `research/eval/relabel_kit.js`,
  `research/eval/relabel_check.js` and its tests (synthetic sheets
  only).
- **Check before use.** No number is computed from the new labels until
  the filled sheet passes `relabel_check.js`: every item has a best
  entry or "none fits", every id is a served entry, no id twice in a
  row, and no blank, changed, missing or extra row. Only then is it
  converted into labels files in the existing schemas.

## K5 on relabelled labels (62 entries) (2026-10-28)

Branch `kb/merge-60`; scoring change in 8764d3e, data in cff6009
(`research/v4/results/k5_*relabelled*`). Applies "KB 62 merge rule
(written before measurement)" as written, now with the relabelled
labels from "KB 62 relabelling". Nothing was tuned; no KB text,
threshold, V4 file, snapshot or embed-mode default changed.

**Labels.** Cindy's blind sheet (75 items) passed `relabel_check.js`.
35 dev rows are labelled, all with an entry; none was marked "none
fits", so the denominator is 35. The gate set has 20 ANSWER, 14
NOT_KB_ANSWER and 6 REFERRAL_OR_SIGNPOST rows (the last not scored).
The labels files are kept outside the repository.

**Rule applied:**

- **Retrieval index** (unscoped self-retrieval of at least 60 of 62 in
  question-only mode): 62 of 62. **PASS.**
- **Dev score** (at least 28 of 35 with relabelled labels): 25 of 35 in
  question-only mode (25 of 35 in full mode). **FAIL.**
- **Embed mode:** the criteria did not both pass, so the default stays
  "full". **Not switched.**
- **Demo:** stays on the 21 entries.
- **Gate:** re-measured, not changed (0.8439).

**For context (not part of the rule):** the 21-entry KB's replies,
rescored on the same relabelled labels, get 28 of 35 (29 of 35 on the
2026-10-15 labels). In full mode the gate still lets six wrong dev
answers through and four off-topic gate-set queries; in question mode
five dev questions abstain although their unscoped top-1 entry is
acceptable.

Results copied exactly from
`research/v4/results/k5_relabelled_summary.md`:

```markdown
# K5 on relabelled labels, 62-entry KB (28 October 2026)

Branch `kb/merge-60`. Labels: Cindy's blind relabelling sheet (75 items), passed by `research/eval/relabel_check.js` and converted to `retrieval_eval_set_labels_kb62.csv` and `relevance_validation_kb62.csv` (kept outside the repository). 35 dev rows relabelled, 0 marked none fits; gate set 20 ANSWER, 14 NOT_KB_ANSWER, 6 REFERRAL_OR_SIGNPOST (not scored). ml_service restarted from this tree for each mode (V4 and generation off); gateway with `AUTH_DISABLED=true`, relevance gate on at 0.8439, thresholds 0.35 / 0.5. Produced by `research/eval/k5_measure.js --labels --gate --tag relabelled` and `research/eval/k5_baseline21.js`; per-item ids in `k5_question_relabelled.json`, `k5_full_relabelled.json` and `k5_baseline21_relabelled.json`.

## Self-retrieval (62 KB questions)

| | question | full |
|---|---|---|
| unscoped, own entry top-1 | 62 / 62 | 61 / 62 |
| scoped (live V3), own entry top-1 | 57 / 62 | 56 / 62 |
| unscoped failures | none | KB-C4->KB-C18 |

## Dev questions (35, relabelled)

| | question | full |
|---|---|---|
| correct | 25 / 35 | 25 / 35 |
| not correct | Q03 (answer-scoped KB-C18, wrong), Q07 (abstain, wrong), Q13 (answer-unscoped KB-G9, wrong), Q16 (abstain, wrong), Q20 (abstain, wrong), Q27 (held-topic, wrong), Q29 (held-topic, wrong), Q54 (abstain, wrong), Q55 (answer-unscoped KB-G14, wrong), Q57 (abstain, wrong) | Q02 (answer-scoped KB-C18, wrong), Q03 (answer-scoped KB-C18, wrong), Q11 (answer-unscoped KB-C7, wrong), Q27 (held-topic, wrong), Q28 (answer-scoped KB-P6, wrong), Q29 (held-topic, wrong), Q54 (abstain, wrong), Q55 (answer-unscoped KB-G14, wrong), Q57 (abstain, wrong), Q58 (answer-scoped KB-C4, wrong) |
| replies changed vs the 21-entry replies | Q03, Q07, Q11, Q13, Q16, Q20, Q23, Q28, Q30, Q54, Q55, Q58 | Q02, Q03, Q04, Q11, Q23, Q30, Q50, Q54, Q55 |

Context, not part of the rule: the 21-entry KB's replies (K3 "Before") scored on the same relabelled labels: 28 / 35 (29 / 35 on the 2026-10-15 labels; verdict changed: Q28, Q58).

## Gate separation (0.8439, unscoped top-1 score)

| | question | full |
|---|---|---|
| dev: correct answers | 0.8456 to 0.9675 (n=25) | 0.8504 to 0.9246 (n=25) |
| dev: wrong or partial answers | 0.8538 to 0.8785 (n=3) | 0.8439 to 0.8904 (n=6) |
| dev: abstentions | 0.8037 to 0.8416 (n=5) | 0.8227 to 0.8401 (n=2) |
| dev: wrong or partial answers passing the gate | 3 (Q03, Q13, Q55) | 6 (Q02, Q03, Q11, Q28, Q55, Q58) |
| dev: abstained although unscoped top-1 is acceptable | 5 (Q07, Q16, Q20, Q54, Q57) | 2 (Q54, Q57) |
| gate set: top-1 acceptable | 0.8154 to 0.9107 (n=16) | 0.8259 to 0.9258 (n=16) |
| gate set: top-1 not acceptable | 0.8538 to 0.8832 (n=4) | 0.8476 to 0.8896 (n=4) |
| gate set: off-topic (NOT_KB_ANSWER) | 0.7445 to 0.8489 (n=14) | 0.7657 to 0.8622 (n=14) |
| gate set: acceptable top-1 below the gate | 5 (V02, V03, V06, V17, V19) | 1 (V19) |
| gate set: wrong top-1 passing the gate | 4 (V12, V14, V16, V18) | 4 (V02, V03, V12, V18) |
| gate set: off-topic passing the gate | 2 (V31, V34) | 4 (V29, V31, V33, V34) |
| gate set: referral or signpost rows, not scored | 6 | 6 |
```

## KB scale validation: gate and ranking (PRE-REGISTRATION), 28 Oct 2026
Status: registered before any candidate is built and before the fresh
set is labelled or run.

1. Question. Can retrieval (relevance gate and ranking) be rebuilt so
   the 62-entry knowledge base serves at least as well as the validated
   21-entry base, so the demo can use it?

2. Background. The 62-entry base scored 25 of 35 on the relabelled dev
   set against a pre-set requirement of 28; the 21-entry base scores 28
   (K5, 01fc5ad and later entries). The failure analysis (04d4e06)
   found gate abstentions (4 of 7 lost questions in question mode) and
   crowding by similar new entries (3 of 7). The dev set favours the 21
   entries. That verdict is not changed by this entry.

3. Data roles.
   - Development data: the 75 relabelled items (35 dev, 40 gate; 6
     distress items are not scored). They were seen and measured, so
     all tuning happens only here, with leave-one-out cross-validation.
   - Test data: C:\Users\cindy\fresh\fresh100.csv, 100 questions,
     SHA-256 8C7F0757A29B3F3ABE3DC2FEA9E5159985EFC42B8BA7CE549437FEA2A29E01FC.
     Provenance: written by [WRITER] on [DATE]; AI tools used: [YES/NO];
     never run through the system. It is not used in any build or
     selection step. A duplicate check against the sealed, dev, gate,
     seed, DR-04 and KB-question sets is done before labelling, and
     near-duplicates are removed from the test and counted.
   - Labelling: by the author against the 62 entries without seeing
     system output (best entry, acceptable entries, or none fits), with
     the same checker as the 75. Unsure items are flagged for clinician
     spot-check. The author knows the system, which is disclosed.
   - Not used: the sealed 205 set, including its 60 items derived from
     the gynaecologist list. The AI assistant read the sealed questions
     on 27 Oct 2026, so the set is not used to design or test this work.

4. Candidates (at most six pipelines, all built on development data):
   - G0: the current gate (0.8439, full mode), the baseline.
   - G1: the same gate with a threshold recalibrated per embed mode.
   - G2: a logistic regression on at most three signals: top-1 score,
     margin to the second entry, agreement between the entry's class
     and the classifier's class.
   - R1: question-only embedding. R2: R1 plus a named reranker (model
     and revision logged before use). R3: a hybrid of keyword and dense
     scores.
   Any combination counts as one pipeline; the total number of
   pipelines tried is reported.

5. Selection (development data only). Choose the pipeline with the
   highest leave-one-out score on the 69 scored items of: answered with
   an acceptable entry, or correctly abstained. Ties within one item go
   to the simpler pipeline, then to fewer wrong answers served. Freeze
   the winner (code hash, parameters, model revisions) and log the
   hashes before the test is run.

6. Test, one run. The frozen pipeline serves the 62-entry base; the
   current pipeline (G0) serves the 21-entry base; both on the fresh set.
   For the 21-entry base, the acceptable entries are those labelled
   entries that exist in it (ids unchanged); a question with none is
   expected to abstain. Outcomes per question: correct answer, wrong
   answer served, correct abstain or ask, missed answer.

7. Decision. The 62-entry base replaces the 21 in the demo only if ALL
   hold: (a) correct answers with the 62 are at least those of the 21;
   (b) wrong answers served with the 62 are no more than with the 21;
   (c) off-topic and vague questions are abstained or asked at least as
   often as with the 21; (d) all safety, held-topic and help tests pass
   and the V4 hash is unchanged. Otherwise the demo stays on 21 entries.
   With 100 questions the intervals are wide and are reported as they
   are. Switching the default is its own decision-log entry.

8. Frozen: V4 model and hash, thresholds 0.35, 0.5 and 0.45, KB text,
   Safety Net patterns, helplines and HELP_CONTACTS_VERIFIED, and the
   check order. The gate stays at 0.8439 until a candidate passes.

9. Time-box. Build and select by 4 Nov; log hashes; run the test on 5
   Nov; decide on 6 Nov. If not ready, the demo stays on 21 entries.

10. Deviations after this entry: [none yet].

## KB scale validation: fresh set exclusions (2026-10-28)

Amends "KB scale validation: gate and ranking (PRE-REGISTRATION), 28 Oct
2026" (3e0bed8), item 3, test data. The pre-registration entry is left
as it was. Recorded before the fresh set is labelled or run through the
system.

- **Duplicate check** (`research/v4/results/fresh100_dedupe.md`,
  d7c6a07; e5-small, cosine of question embeddings; counts only).
  Fresh rows whose nearest neighbour is at cosine 0.95 or above, per
  source: sealed 205 set 12 (one of them an exact duplicate after
  lowercasing and removing punctuation), 35 dev questions 4, 40 gate
  items 1, 380 V4 seeds 0, 1,239 V4 paraphrases 4, DR-04 0, 62 KB
  questions 2; 18 distinct rows in all. None within the fresh set.
- **Rule.** Any fresh row with cosine 0.95 or above to the sealed,
  dev, gate, seed, paraphrase, DR-04 or KB-question sets is excluded.
  18 rows were excluded (10, 13, 15, 21, 22, 28, 29, 30, 33, 37, 44,
  50, 51, 52, 60, 94, 98, 100) and 82 remain.
  - Independent writers converge on common questions, so this is a
    conservative control and not an accusation.
  - It slightly under-represents the most common questions, which is a
    limitation.
- **Provenance (FILL).** Written by [WRITER NAME OR ROLE], a person
  other than the author, on [DATE]. Derived from the gynaecologist list
  or the reserved situations: [YES/NO/NOT RECORDED]. AI tools used:
  [YES/NO/NOT RECORDED]. Never run through the system.
- **Sealed set.** After the exclusion the overlap with the sealed set
  is topic-level only, and no sealed item is used in the gate work.
- **Files** (outside the repository; the rows keep their original
  number in `source_row`):
  - `C:\Users\cindy\fresh\fresh100.csv`, 100 rows, SHA-256
    `8C7F0757A29B3F3ABE3DC2FEA9E5159985EFC42B8BA7CE549437FEA2A29E01FC`
  - `C:\Users\cindy\fresh\fresh_test_v1.csv`, 82 rows, SHA-256
    `667A547C06CDF6B097061D6F096A1585339B3193F439240D98BC202036157C54`
- **Correction (2026-10-28): provenance filled.** The questions were
  written by a remote reviewer, a person other than the author. The
  gynaecologist list was not used (as stated by the author). The date
  of writing is not recorded. Whether AI tools were used is not
  recorded. The set was never run through the system.

## Gate and ranking selection (62 entries) (2026-10-28)

Step 8k-a of "KB scale validation: gate and ranking (PRE-REGISTRATION),
28 Oct 2026", items 4 and 5. Built and selected on the 75 relabelled
development items only (69 scored); the fresh test set was not read or
used. Harness in def55a9, data in 0568918. Production defaults,
thresholds, V4 files and KB text are unchanged, and nothing is wired
into production.

- **Pipelines tried: six** (P0 to P5, as listed below); no other was
  added or dropped. The V4-off fallbacks of P3 and P5 are reported, not
  candidates.
- **K5 reproduced first.** The harness gave the saved K5 dev replies
  (25 of 35 in both modes) and gate-set counts exactly before any
  pipeline was scored.
- **Selection rule applied as registered:** P3 has the highest
  leave-one-out score (57 of 69, P0 52); no other pipeline is within
  one item of it. **Winner: P3.**
- **Frozen:** `research/eval/gate_v2/frozen_gate_v2.json`, SHA-256
  `ad6895a120b538e4cc751ebe4de8944aace640c268e0013f981d29ceabe4bafc`
  (sidecar `frozen_gate_v2.sha256`). It records the logistic gate's
  parameters, the V4-off fallback, the routing thresholds, and the
  hashes of the harness code, the e5 weights (revision
  `614241f622f53c4eeff9890bdc4f31cfecc418b3`), the V3 checkpoint, the
  V4 frozen model and the 62-entry KB.
- **Read with the numbers:**
  - The bootstrap interval of P3's difference to P0 is -1 to +11
    items: it includes no difference.
  - P3 uses V4's class as a signal. V4 is loaded in ml_service only
    when `V4_TRIAGE_ENABLED` is on, so serving P3 needs V4 loaded for
    the gate even with V4 triage off; with V4 off, P3 falls back to its
    score-and-margin gate (54 of 69 here). How it is wired is a later
    decision.
  - These are development numbers. The pre-registered test is the one
    run on the fresh set (item 6), not yet done.

Results copied exactly from `research/eval/gate_v2/selection.md`:

```markdown
# Gate and ranking selection, 62-entry KB (28 October 2026)

Development data only: the 75 relabelled items (35 dev questions, 40 gate-set items); the 6 distress items are not scored, leaving 69. Leave-one-out cross-validation; every threshold, hybrid weight and logistic gate is fitted on the other 68 items. Utility: answered with an acceptable entry, or correctly abstained (Q50, NOT_REFERRAL, counts unless referred). V3 routes in every pipeline (abstain below 0.35, scoped at 0.5 or above); V4 is only the agreement signal of P3 and P5. Produced by `research/eval/gate_candidates.py`; per-item ids in `selection.json`.

Routes of the 69 scored items before retrieval: held 2, referral 0, retrieve 56, vague 11.

K5 reproduced before scoring (dev correct; gate-set counts at 0.8439): full: dev 25/35, correct below gate 1, wrong passing 4, off-topic passing 4; question: dev 25/35, correct below gate 5, wrong passing 4, off-topic passing 2.

## Pipelines (leave-one-out, 69 items)

| Pipeline | LOO score | Correct answers | Wrong answers served | Correct abstains | Missed answers | Difference to P0 (95% bootstrap interval) |
|---|---|---|---|---|---|---|
| P0: full mode, current gate 0.8439 (baseline) | 52 / 69 | 40 | 11 | 12 | 6 | +0 (+0 to +0) |
| P1: full mode, threshold recalibrated | 51 / 69 | 40 | 12 | 11 | 6 | -1 (-3 to +0) |
| P2: question mode, threshold recalibrated | 53 / 69 | 42 | 11 | 11 | 5 | +1 (-5 to +7) |
| P3: question mode, logistic gate (top-1 score, margin, V4 agreement) | 57 / 69 | 42 | 7 | 15 | 5 | +5 (-1 to +11) |
| P4: question mode, hybrid ranking, threshold recalibrated | 54 / 69 | 42 | 8 | 12 | 7 | +2 (-4 to +8) |
| P5: question mode, hybrid ranking, logistic gate | 55 / 69 | 41 | 8 | 14 | 6 | +3 (-3 to +10) |

Bootstrap: 10,000 resamples of the 69 items, seed 20261028, percentile interval of the difference in successes.

## With V4 off

P0, P1, P2 and P4 do not use V4 and behave the same. P3 and P5 fall back to a logistic gate on top-1 score and margin only:

| Pipeline | LOO score | Correct answers | Wrong answers served | Correct abstains | Missed answers |
|---|---|---|---|---|---|
| P3 (V4 off) | 54 / 69 | 41 | 9 | 13 | 6 |
| P5 (V4 off) | 56 / 69 | 43 | 6 | 13 | 7 |

## Selection

Rule (pre-registered): the highest LOO score; within one item of it, the simpler pipeline (P0; then P1 and P2; then P4; then P3; then P5), then fewer wrong answers served. Winner: **P3**. Frozen as `research/eval/gate_v2/frozen_gate_v2.json`, SHA-256 `ad6895a120b538e4cc751ebe4de8944aace640c268e0013f981d29ceabe4bafc`.
```
