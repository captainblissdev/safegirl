# Requirements traceability

Each requirement from the approved proposal (Section 4.2, as listed in
`docs/proposal-requirements.md`) traced to where it is implemented and to
the test or result that evidences it. Checked on 15 October 2026 against
`development` at `cb0b2fb`. The preliminary notes in
`docs/proposal-requirements.md` were checked, not copied; where they were
wrong, this file says so.

`docs/proposal-requirements.md` is not tracked in git at the time of
writing; its requirement text is quoted from the working copy.

**Statuses.**
- **Met:** implemented, and a test or recorded result (or, for a
  property of an artefact such as a dataset file, the artefact itself)
  shows it.
- **Partly met:** some of the requirement is met and some is not; what
  differs is stated.
- **Deviated:** built differently from the proposal on purpose or in
  practice; what differs is stated.
- **Not verified:** no test or recorded result in this repository shows
  it, even where the code suggests it is implemented.
- **Met, with limitation:** counted as Met; the row states the
  limitation.

For every Partly met or Deviated row, the justification is a link to the
decision log, the supervisor guidance or the feedback matrix, or
"no recorded justification".

Abbreviations: DL = [`docs/decision-log.md`](decision-log.md);
SG = [Supervisor guidance, 12 October 2026](decision-log.md#supervisor-guidance-12-october-2026);
FRM = [`docs/feedback-resolution-matrix.md`](feedback-resolution-matrix.md).
Gateway tests are in `app/gateway/test/`, interface tests in
`app/interface/src/`.

## Summary

| Status | Count | Requirements |
|---|---|---|
| Met | 10 | FR-06, NFR-01, NFR-04, DR-01, DR-02, DR-04 (with limitation), DR-06, IR-01, IR-02, IR-05 |
| Partly met | 6 | FR-01, FR-02, FR-04, NFR-05, DR-03, DR-05 |
| Deviated | 4 | FR-03, NFR-02, IR-03, IR-04 |
| Not verified | 4 | FR-05, NFR-03, DR-07, DR-08 |

## Functional requirements

| ID | Implemented in | Evidence | Status | Reason |
|---|---|---|---|---|
| FR-01 | `app/gateway/src/classifierClient.js` (calls `ml_service` `/classify`, V3, four labels checked by `validate_model_labels` in `ml_service/app.py`); keyword fallback `app/gateway/src/fallback/keywordClassifier.js` | `classifierClient.test.js`: "returns the DistilBERT prediction on success", "falls back to the keyword classifier on …" (each failure mode); `research/eval/results/labels_and_gate_queries_2026-10-15.csv` (every dev-set query classified) | Partly met | V3 returns one of four classes, but the frozen keyword baseline used as the fallback has a fifth label, `gbv`, which retrieves nothing. Justification: GBV kept as routing-only in the frozen baseline, [DL 2026-08-27](decision-log.md#2026-08-27); GBV scope held, FRM item 3 |
| FR-02 | `app/gateway/src/safetyNet.js`, called first for every query in `app/gateway/src/backend.js`; offline copy `app/interface/src/offline/safetyNet.ts` | `safetyNet.test.js` (positives, negatives, pipeline tests); `offlineSafetyParity.test.js`; sealed hold-out 3: recall **6/14**, false referrals **2/10** ([`docs/safety-net-evaluation.md`](safety-net-evaluation.md#sealed-result-hold-out-3)); validation distress rows: 2/6 referred ([`labels_and_gate_2026-10-15.md`](../research/eval/results/labels_and_gate_2026-10-15.md)) | Partly met | Every query is checked, independently of the classifier, but the keyword check misses most indirect disclosures (independent recall 6/14). Justification: SG accepts the keyword Safety Net for a supervised demo only if its limits are stated and the referral numbers are verified; the numbers are still unverified (`HELP_CONTACTS_VERIFIED = false` in `app/gateway/src/content/helpContent.js`) |
| FR-03 | `app/gateway/src/classifierClient.js` (scoped at confidence ≥ 0.5, unscoped 0.35–0.5, no answer below 0.35); `ml_service/retrieval.py`; `app/gateway/src/generationModule.js` (stub) | `classifierClient.test.js`: "scopes /retrieve to the label when confidence >= threshold", "omits intent (unscoped) when confidence < threshold", "does not call /retrieve below the abstain threshold …"; `backend.wiring.test.js`; retrieval conditions in [`labels_and_gate_2026-10-15.md`](../research/eval/results/labels_and_gate_2026-10-15.md) | Deviated | Answers are the retrieved entry's text (extractive), not generated, and retrieval is category-scoped only when V3 is confident. Justification: SG (keep extractive answers, not an LLM; keep classifier-scoped retrieval experimental) |
| FR-04 | `app/gateway/src/backend.js` (referral when flagged) | `backend.wiring.test.js`: "returns the referral for a flagged query and never calls retrieval"; `safetyNet.test.js`: "returns a referral for … skips retrieval and logs no query text"; `backend.test.js` Test 2 | Partly met | Retrieval and generation are suppressed and the referral is returned, but the classifier still runs on flagged queries; its prediction is reported (`predictedCategory`) and not used ([`README.md`](../README.md#request-order)). No recorded justification (the order is documented in commit `4f00b79`, without a reason) |
| FR-05 | `app/interface/src/App.tsx` (first screen is `disclaimer`; chat only after Continue; "Start new session" returns to it); `app/interface/src/components/Disclaimer.tsx` | `components.test.tsx` Test 6 checks the disclaimer's privacy wording only | Not verified | The code shows the disclaimer first, but no test or recorded result checks that it appears once per session before any query is processed |
| FR-06 | `app/interface/src/App.tsx` (chat held in React state only; End session and Start new session); `app/interface/src/auth/session.ts` (`inMemoryPersistence`) | [`docs/testing/pwa-audit.md`](testing/pwa-audit.md#browser-storage-after-one-chat-session): after a session, no query or answer text in localStorage, sessionStorage, cookies, IndexedDB or Cache Storage; `components.test.tsx` Test 6 (session-end wording) | Met | Nothing from the conversation was found in any browser store after End session. Firebase keeps one anonymous uid per sign-in (README, Known limitations) |

## Non-functional requirements

| ID | Implemented in | Evidence | Status | Reason |
|---|---|---|---|---|
| NFR-01 | `research/experiments/baseline_classifier.py` (frozen 2026-08-27; documented tie-break by priority order); `app/gateway/src/fallback/keywordClassifier.js` (returns `label` and `matchedKeywords`; `PRIORITY` list) | The artefacts themselves: keyword lists, priority order and the returned `matchedKeywords`. No test asserts `matchedKeywords` for the baseline (the `matchedKeywords` assertions in the tests are on the Safety Net) | Met | Each decision is traceable to the matched keywords and the fixed priority order. The traceability itself is not covered by an automated test |
| NFR-02 | `app/gateway/src/backend.js`: Safety Net synchronously first, then the help rule, then the classifier | `helpSignposting.test.js`: "lets the safety net win when a query matches both rules"; `backend.wiring.test.js` (flagged path); [`README.md`](../README.md#request-order) | Deviated | The safety check is independent of the classifier but runs first, sequentially, not in parallel. No recorded justification (commit `4f00b79` corrected the docs to the real order without giving a reason) |
| NFR-03 | Datasets in `resources/seeds/`, `resources/reviewed/`, `resources/eval/`, `resources/test/` | Statements only: [`docs/safegirl_dataset_plan.md`](safegirl_dataset_plan.md) (dataset labelled synthetic), [DL 2026-08-29](decision-log.md#2026-08-29), README (Known limitations: "No real adolescent users") | Not verified | The documents describe the data as synthetic or owner-written, but there is no recorded check of the data files for personal data |
| NFR-04 | `app/interface/src/auth/session.ts` (anonymous sign-in on the first query, in memory); `app/gateway/src/middleware/sessionAuth.js` | `session.test.ts` Tests 1–6; `auth.http.test.js`; `sessionAuth.test.js`; [`pwa-audit.md`](testing/pwa-audit.md#browser-storage-after-one-chat-session) | Met | No account or persistent login; a reload starts a new anonymous identity |
| NFR-05 | Frozen baseline [DL 2026-08-27](decision-log.md#2026-08-27); paired runs in `research/eval/run_eval.js` and `research/eval/labels_and_gate.js` | Paired on the same queries: V3 20/29 against baseline 28/29, p = 0.021 ([`classifier_analysis.md`](../research/eval/results/classifier_analysis.md)); V3 21/35 against 30/35, p = 0.0117 ([`labels_and_gate_2026-10-15.md`](../research/eval/results/labels_and_gate_2026-10-15.md)) | Partly met | Compared under identical conditions only on the development set (not independent). No recorded baseline result on the DR-04 test set or the CV folds; `docs/safegirl_development_plan.md` still lists "Run classifier vs. keyword-baseline comparison on the independent test set" as not done. No recorded justification (SG requires the comparison for Milestone 2) |

## Data requirements

| ID | Implemented in | Evidence | Status | Reason |
|---|---|---|---|---|
| DR-01 | `resources/seeds/seeds.csv`; `resources/reviewed/*_v3_paraphrases.csv` | `seeds.csv`: 211 seeds, contraception 48, sti 56, pregnancy 49, general 58; one reviewed paraphrase file per class; per-class supports in `research/experiments/logs/v3_1_training_log.txt` | Met | Labelled examples cover all four classes |
| DR-02 | `research/experiments/train_distilbert_v3.py` (StratifiedGroupKFold with `seed_id` as the group; frozen `resources/seeds/fold_assignment_v3.csv`; euphemism hold-out by seed) | [DL V2 evaluation methodology](decision-log.md#v2-evaluation-methodology-2026-09-16); `v3_1_training_log.txt` ("Euphemism holdout examples (excluded from CV and training): 13") | Met | Splits are made by seed, so paraphrases of one seed never cross folds. No automated leakage test in the suites |
| DR-03 | Knowledge-base entries carry sources (`ml_service/knowledge_base.json`, `source` field) | `seeds.csv` has only `seed_id`, `class`, `text`; [`docs/safegirl_seed_questions.md`](safegirl_seed_questions.md) is a draft "not yet reviewed by domain expert"; FRM item 2 (seeds grounded in, not copied from, sources) | Partly met | Answers are traceable to sources; seed questions are not, since no seed-to-source record exists. No recorded justification |
| DR-04 | `resources/test/independent_test_set.csv` (31 scored of 34) | Provenance statement from the project owner, recorded on 15 October 2026: "The DR-04 set of 34 questions comes from an external expert source: a licensed medical doctor in Siaya County and her team, through a process separate from the training-data generation. The team had seen the initial training data before the set was written, so overlap in style or topic with the training data cannot be excluded; this is recorded as a limitation. The project proposed an intended class for 29 questions; the expert team confirmed 26, amended 1 (TEST-025, pregnancy to STI), and gave two-category answers on 2 (TEST-014, TEST-030). For the 5 questions with no proposal (TEST-001, 005, 006, 013, 015) the team supplied the class, with a two-category answer on TEST-015. Six questions carry expert notes. The team of three reviewers completed the verification sheet together; individual reviewer labels were not recorded. The verification_status column was never filled. Source workbook: held by the project owner; not yet in the repository. The set was added to the repository on 17 September 2026." First commit of the file: `40319e7` (feat(dataset): resolve DR-04 with expert-verified independent test set), 2026-09-17. [`docs/DR04_record.md`](DR04_record.md) (labels, exclusions); V2 one-time blind result ([`docs/development-log.md`](development-log.md)) | Met, with limitation | The questions and labels came from a process separate from training-data generation. Limitation: the team had seen the initial training data, so overlap in style or topic cannot be excluded. V3's DR-04 run is a disclosed non-blind reuse, and a fresh expert test is pending |
| DR-05 | Seed → paraphrase → review pipeline ([DL protocol](decision-log.md#v2-paraphrasing-protocol-frozen-2026-09-18)); training refuses `resources/generated/` (`train_distilbert_v3.py`); label review of the eval set | [`research/eval/results/label_review.md`](../research/eval/results/label_review.md); [`DR04_record.md`](DR04_record.md) (exclusions of dual-label rows) | Partly met | The protocol defines structural and manual checks, but the per-batch records it promises in `docs/ai-use-log.md` (requested, accepted, rejected counts) are not there, so the review cannot be confirmed from the repository. No recorded justification |
| DR-06 | `resources/knowledge_base/gbv.md` ("STATUS: HELD. No finalized entries."); `app/gateway/src/retrievalModule.js` (GBV not a retrievable category) | `ml_service/knowledge_base.json`: 21 entries, all contraception, STI, pregnancy or general; FRM item 3 (supervisor sign-off holding GBV content) | Met | No GBV content is in the knowledge base |
| DR-07 | Paraphrase protocol: "English only, no Sheng or code-switching" and an automated "no Swahili/Sheng markers" check ([DL](decision-log.md#v2-paraphrasing-protocol-frozen-2026-09-18)) | No recorded result of that check | Not verified | The exclusion is stated policy, but no recorded check of the dataset files shows it was applied |
| DR-08 | As NFR-03 | As NFR-03 | Not verified | As NFR-03 |

## Interface and integration requirements

| ID | Implemented in | Evidence | Status | Reason |
|---|---|---|---|---|
| IR-01 | `app/interface/` (React PWA); `app/gateway/server.js` (`POST /api/query`) | `client.test.ts` Test 1; `components.test.tsx`; topic chips through the full stack in [`pwa-audit.md`](testing/pwa-audit.md#topic-chips-through-the-full-stack) | Met | A user can submit a query anonymously and get a response |
| IR-02 | `app/interface/src/auth/session.ts`; `app/gateway/src/middleware/sessionAuth.js` | `session.test.ts`; `sessionAuth.test.js` ("needs only a project ID …" with the real firebase-admin); `auth.http.test.js` | Met | Anonymous sign-in, no credentials asked for. The tests use mocked tokens; a sign-in against a live Firebase project is not recorded as a test result |
| IR-03 | None in `development`. A standalone probe exists only on the local, unpushed branch `experiment/gemini-probe` | `app/gateway/src/generationModule.js` is a stub; every answer carries `generated: false` | Deviated | No Gemini call in the system. Justification: SG (keep extractive answers, not an LLM). The 2026-08-29 decision to use Gemini ([DL](decision-log.md#2026-08-29)) is superseded in practice |
| IR-04 | `ml_service/retrieval.py` (`sentence_transformers.SentenceTransformer`, `intfloat/multilingual-e5-small`) | No LlamaIndex import anywhere in the code; `app/gateway/src/retrievalModule.js` still has a comment about replacing keyword overlap "with LlamaIndex retrieval" | Deviated | sentence-transformers is used; LlamaIndex is not (it was only installed and imported in a Colab check: [DL](decision-log.md), entry "2026-08-28 (cont.)", "Step 5 CONFIRMED"). No recorded justification |
| IR-05 | `app/gateway/server.js` (fixed 400/404/413/500 bodies); `classifierClient.js` (fallback on `ml_service` failure); `app/interface/src/api/client.ts` (offline pipeline, limited mode, timeouts) | `server.test.js` ("returns a generic 500 when handleQuery throws, without echoing or logging the error", malformed JSON, 413, 404); `classifierClient.test.js` (fallbacks); `client.test.ts` Tests 4, 5, 7, 9, 10; `timeouts.test.ts` Tests 2–4; `auth.http.test.js` (503 on verifier outage) | Met | Service failures fall back or return fixed messages without internal details |

## Preliminary notes that were wrong or incomplete

- **FR-04 "Likely met. Verify suppression."** Retrieval and generation are
  suppressed, but classification is not: the classifier runs on flagged
  queries.
- **FR-01 "Likely met."** The keyword fallback can return a fifth label,
  `gbv`.
- **NFR-05 "Likely met."** Met only on the development set; there is no
  baseline result on DR-04 or the CV folds.
- **DR-04.** The repository did not record how the questions were
  written; the project owner's provenance statement now does (see the
  DR-04 row).
- **IR-03 "Extractive answers approved by the supervisor on 12 October
  2026."** Confirmed in the decision log; the probe is on a local branch
  only.
