# Test log

Every automated suite and manual check in the project, with its command,
count, date, result and source. Compiled on 15 October 2026 on
`docs/setup-and-test-log`, branched from `development` at `5904805`
(PR #40, the J08 fix).

**How to read the results.**
- **Independent** means the system was not changed with that data in view.
  Only two results here are independent: the sealed Safety Net hold-out 3
  run, and V2's blind DR-04 test.
- **Post-patch, not independent** means the Safety Net rules were written or
  changed with those queries in view. These numbers show the rules work on
  the cases they were built for. They are not a measure of recall for real
  users.
- **Development set** means owner-written queries, used to build and tune
  the system. They are not an independent test.

Commit hashes in older sources are given as written there; since the
history cleanup the new hashes are in
[`docs/history-rewrite-map.md`](../history-rewrite-map.md).

## Automated suites (re-run 15 October 2026)

Re-run on a fresh clone of `development` at `5904805` (Node 24.18.1,
npm 12.0.2). None needs `ml_service`, Firebase or credentials.

| Suite | What it checks | Command (directory) | Count | Date | Result | Source |
|---|---|---|---|---|---|---|
| Gateway tests | 6 integration check groups (`backend.test.js`), then `node:test` tests: classifier client, wiring, server errors, session auth, HTTP auth, help signposting, held entries, Safety Net rules and fixture, offline Safety Net parity | `npm test` (`app/gateway`) | 6 groups + 354 tests (2 regression tests and 10 relevance-gate tests added 2026-10-15) | 2026-10-15 | Pass: 354/354, 0 failed | [`app/gateway/package.json`](../../app/gateway/package.json), [`app/gateway/test/`](../../app/gateway/test/) |
| Safety Net fixture (inside gateway tests) | Each rule against 91 must-flag and 53 must-not-flag cases | `npm test` (`app/gateway`) | 144 cases | 2026-10-15 | Pass | [`app/gateway/test/fixtures/safetyCases.js`](../../app/gateway/test/fixtures/safetyCases.js), [`docs/safety-net-evaluation.md`](../safety-net-evaluation.md) |
| Offline parity (inside gateway tests) | Gateway and offline Safety Net have identical keywords, rules, normalisation, results on shared cases, messages, numbers and verified flag | `npm test` (`app/gateway`) | 153 shared cases | 2026-10-15 | Pass | [`app/gateway/test/offlineSafetyParity.test.js`](../../app/gateway/test/offlineSafetyParity.test.js) |
| Gateway lint | ESLint | `npm run lint` (`app/gateway`) | – | 2026-10-15 | Pass | [`app/gateway/eslint.config.mjs`](../../app/gateway/eslint.config.mjs) |
| Interface tests | Offline pipeline, query client (including limited mode), timeouts, anonymous session, component render tests, font setup | `npm test` (`app/interface`) | 6 suites | 2026-10-15 | Pass: all 6 | [`app/interface/package.json`](../../app/interface/package.json) |
| Interface typecheck | TypeScript, no emit | `npm run typecheck` (`app/interface`) | – | 2026-10-15 | Pass | [`app/interface/package.json`](../../app/interface/package.json) |
| Interface lint | ESLint | `npm run lint` (`app/interface`) | – | 2026-10-15 | Pass | [`app/interface/package.json`](../../app/interface/package.json) |
| Interface format | Prettier check | `npm run format:check` (`app/interface`) | – | 2026-10-15 | Pass | [`app/interface/package.json`](../../app/interface/package.json) |
| Interface build | Production build with the PWA service worker | `npx vite build` (`app/interface`) | 12 precache entries | 2026-10-15 | Pass | [`app/interface/vite.config.ts`](../../app/interface/vite.config.ts) |
| CI | Gateway tests; interface lint, format, typecheck, tests, build. No `ml_service` job | GitHub Actions on push | – | every push | See the Actions tab | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |

## Automated suites (re-run 20 October 2026)

Re-run on `fix/response-clarity` at `3a066fa` (Node 24.18.1), after the
response-clarity changes. The gateway and interface suites need no
`ml_service`, Firebase or credentials.

| Suite | Command (directory) | Count | Date | Result |
|---|---|---|---|---|
| Gateway tests | `npm test` (`app/gateway`) | 6 integration check groups + 390 `node:test` tests in 37 suites (was 354 on 15 Oct) | 2026-10-20 | Pass: 390/390, 0 failed |
| of which: reply kind and matched question | `test/responseKind.test.js` | 10 tests | 2026-10-20 | Pass |
| of which: vague-query rule and health terms | `test/vagueQuery.test.js` | 17 tests (DR-04 interception pinned at the recorded 3/31, TC-079) | 2026-10-20 | Pass |
| of which: offline parity | `test/offlineSafetyParity.test.js` | 14 tests (the 9 of 15 Oct, 1 message test, 4 help and vague-rule tests) | 2026-10-20 | Pass |
| Gateway lint | `npm run lint` (`app/gateway`) | – | 2026-10-20 | Pass |
| Interface tests | `npm test` (`app/interface`) | 6 suites, 212 checks | 2026-10-20 | Pass: all 6, 0 failed |
| Interface typecheck, lint, format | `npm run typecheck`, `npm run lint`, `npm run format:check` (`app/interface`) | – | 2026-10-20 | Pass |
| Interface build | `npm run build` (`app/interface`) | 12 precache entries | 2026-10-20 | Pass |
| `ml_service` | – | No automated test suite exists | 2026-10-20 | Not run (none to run). `python ml_service/build_kb.py --check`: `knowledge_base.json` up to date, 21 entries. The live checks TC-073, TC-074 and TC-081 ran against `ml_service` v3 |

**After step 7 (extra health terms)**, re-run at `3bac650`:

| Suite | Count | Result |
|---|---|---|
| Gateway `npm test` | 6 integration check groups + 395 `node:test` tests in 38 suites | Pass: 395/395, 0 failed |
| of which: vague-query rule and health terms (`vagueQuery.test.js`) | 22 tests | Pass |
| of which: offline parity (`offlineSafetyParity.test.js`) | 14 tests (the 9 of 15 Oct included) | Pass |
| Gateway lint; `node scripts/build-health-terms.js --check` | – | Pass; both lists up to date |
| Interface `npm test` | 6 suites, 212 checks | Pass: all 6, 0 failed |
| Interface typecheck, lint, format check, build | – | Pass |

## Vague-query rule interception (20 October 2026)

How many queries of each set the vague-query rule answers itself
(`isVagueQuery` in `app/gateway/src/vagueQuery.js`; the same counts are
asserted in `app/gateway/test/vagueQuery.test.js`). Development and
DR-04 sets are read from `resources/`; the example questions from
`app/interface/src/content/uiText.ts`.

| Set | Required | Knowledge-base terms only (step 3) | With the extra terms (step 7) |
|---|---|---|---|
| 8 vague test queries | all | 8/8 | 8/8 |
| 13 example questions | none | 0/13 | 0/13 |
| 35 labelled development-set queries | none | 0/35 | 0/35 |
| 31 DR-04 test queries | none | 3/31 (TC-079, Fail) | 1/31 (TC-090, non-blind) |

DR-04 catches with the extra terms: "What can I do when I mess up ?"
only. "How is a coil inserted?" and "Tell me how to use a tampon?" are
no longer caught. The extra terms were added after those catches were
seen, so the DR-04 recheck is non-blind for this rule; no word was added
to remove the remaining catch.

For reference, of the 23 development-set rows with no class label, 7
reach the rule and are caught with the extra terms: the 5 off-topic
queries and the Safety Net negatives "my teacher threatened to fail me"
and "I am so tired of exams". "When should I start antenatal visits?"
(Q43, Q53) is no longer caught.

## Held-topic rule (20 October 2026)

Interception, live gateway and `ml_service` v3, gate on, before the
rule (`development` at `743679a`) and after; per query in
[`held-topics-proof.csv`](held-topics-proof.csv).

| Set | Intercepted | Before, for those intercepted |
|---|---|---|
| Demo-risk set (**non-blind**) | 8/20: A #1, #2, #4, #5, #6, #7; B #18, #19 | 4 no-answer; #6 KB-G3, #7 KB-C4, #18 KB-P6, #19 KB-P7 |
| Example questions | 0/13 | – |
| Labelled development set | 0/35 | – |
| DR-04 | 5/31: B #5, #6, #24; A #18, #30 | 3 no-answer; #24 and #30 KB-P5 (school re-entry) |

No intercepted development or DR-04 query was answered correctly
before. No reply outside the intercepted rows changed. Demo-risk #3
("Condom iliburst 😭 what do I do?") is not caught; no pattern was
added for it.

Suite runs at `513442e`:

| Suite | Count | Result |
|---|---|---|
| Gateway `npm test` | 6 integration check groups + 412 `node:test` tests in 43 suites | Pass: 412/412 |
| of which: held-topic rule (`heldTopics.test.js`) | 14 tests | Pass |
| of which: offline parity (`offlineSafetyParity.test.js`) | 17 tests (the earlier 14 included) | Pass |
| Gateway lint; `build-held-topics.js --check`; `build-health-terms.js --check` | – | Pass; up to date |
| Interface `npm test` | 6 suites, 216 checks | Pass: all 6 |
| Interface typecheck, lint, format check, build | – | Pass |

## Held-topic group C (20 October 2026)

Live gateway and `ml_service` v3, gate on, before group C
(`development` at `9741bd8`) and after; per query in
[`held-topics-c-proof.csv`](held-topics-c-proof.csv).

| Set | Caught after (all groups) | Newly caught by C | Before, for those |
|---|---|---|---|
| Demo-risk set (**non-blind**) | 11/20 (A 6, B 2, C 3) | #15, #16, #17 | KB-P6, KB-P5, KB-P1 |
| Example questions | 0/13 | – | – |
| Labelled development set | 2/35 | Q27 "why is my period late", Q29 "I missed my period" | Q27 KB-P1 (acceptable KB-G3); Q29 no answer |
| DR-04 | 6/31 | #10 "How long does it take to test pregnancy?" | KB-P5 |

None of the newly caught queries was answered correctly before. "Is
my period normal, and when should I see a health worker?" is still
answered (KB-G3). No other reply changed.

Suite runs at `60ee19a`: gateway `npm test` 6 integration check groups
and 416/416 `node:test` tests in 43 suites (held-topic 18, offline
parity 17); lint and both drift checks pass. Interface `npm test`: all
6 suites (217 checks); typecheck, lint, format check and build pass.

## Setup checks (15 October 2026)

| Check | What it checks | Command | Date | Result | Source |
|---|---|---|---|---|---|
| Fresh-clone setup | Following the README on a fresh clone of `development` | See the README | 2026-10-15 | The old README lacked the venv, checkpoint, interface `.env` and start-up steps; rewritten | [`README.md`](../../README.md) |
| `ml_service` install | A fresh Python 3.12.10 venv from `ml_service/requirements.txt` installs, `pip check` is clean, and `ml_service` answers `/health` (V3, retriever ok, 21 entries) | `py -3.12 -m venv`, `pip install -r ml_service/requirements.txt`, `uvicorn`, `curl /health` | 2026-10-15 | Pass. Direct dependencies match the working environment exactly | [`ml_service/requirements.txt`](../../ml_service/requirements.txt) |

## Safety Net evaluation

| Set | What it checks | Command | Count | Date | Result | Label | Source |
|---|---|---|---|---|---|---|---|
| Hold-out 3 (K01–K24), sealed | Recall on disclosures and false referrals, run once before any rule was changed for it, at `8a083cf` (now `be91073`) | Reproduced from a clean checkout of that commit | 14 disclosures, 10 non-disclosures | Sealed run; reproduced 2026-10-14 | **Recall 6/14; false referrals 2/10**; gateway and offline agree | **Independent** | [`safety_holdout_3_SEALED_8a083cf.csv`](../../research/eval/results/safety_holdout_3_SEALED_8a083cf.csv), [`docs/safety-net-evaluation.md`](../safety-net-evaluation.md) |
| Hold-out 1 (H01–H30) | Recall and false referrals after the patches | Gateway and offline pipeline | 19 disclosures, 10 non-disclosures | 2026-10-14; unchanged by the J08 fix (2026-10-15) | Recall 18/19; false referrals 0/10 | Post-patch, not independent | [`safety_holdout_1_postpatch.csv`](../../research/eval/results/safety_holdout_1_postpatch.csv), [`docs/decision-log.md`](../decision-log.md#safety-net-at-exclusion-narrowed-the-one-freeze-exception-2026-10-15) |
| Hold-out 2 (J01–J26) | As above | As above | 16 disclosures, 10 non-disclosures | 2026-10-15 (after the J08 fix) | Recall 16/16; false referrals 2/10 | Post-patch, not independent | [`docs/decision-log.md`](../decision-log.md#safety-net-at-exclusion-narrowed-the-one-freeze-exception-2026-10-15). The per-row file [`safety_holdout_2_postpatch.csv`](../../research/eval/results/safety_holdout_2_postpatch.csv) predates the fix and still shows J08 as missed (15/16) |
| Hold-out 3 (K01–K24) | As above | As above | 14 disclosures, 10 non-disclosures | 2026-10-14; unchanged by the J08 fix | Recall 9/14; false referrals 2/10 | Post-patch, not independent | [`safety_holdout_3_postpatch.csv`](../../research/eval/results/safety_holdout_3_postpatch.csv) |
| 58-query set, safety rows (Q44–Q52) | As above | As above | 6 disclosures, 3 non-disclosures | 2026-10-14; unchanged by the J08 fix | Recall 6/6; false referrals 0/3 | Post-patch, not independent | [`retrieval_eval_set_safety_postpatch.csv`](../../research/eval/results/retrieval_eval_set_safety_postpatch.csv) |
| 58-query set, all other rows | False referrals on ordinary questions | As above | 49 queries | 2026-10-15 | False referrals 0/49 | Post-patch, not independent | [`docs/decision-log.md`](../decision-log.md#safety-net-at-exclusion-narrowed-the-one-freeze-exception-2026-10-15) |
| Missed disclosures through the full pipeline | What a disclosure the Safety Net misses receives | Full gateway run | 10 queries | 2026-10-06 | All 10 got an unrelated knowledge-base answer; the 0.35 abstain cut-off never fired (lowest confidence 0.374) | Development set | [`holdout3_missed_pipeline.csv`](../../research/eval/results/holdout3_missed_pipeline.csv), [`docs/safety-net-evaluation.md`](../safety-net-evaluation.md#what-a-missed-disclosure-receives) |

## Retrieval and classifier evaluation (development set)

All on `resources/eval/retrieval_eval_set.csv` (58 owner-written queries),
not the independent DR-04 test set.

| Run | What it checks | Command | Count | Date | Result | Label | Source |
|---|---|---|---|---|---|---|---|
| Retrieval evaluation, before the Safety Net patches | End-to-end answers by group, classifier accuracy, retrieval hit rates | `node research/eval/run_eval.js` | 58 queries | 2026-10-06 | 40 correct, 3 partial, 15 wrong. Classifier accuracy against the acceptable entry's class: keyword baseline 30/35. Hit@1: scoped 21/34, unscoped 32/34, keyword fallback 26/34 | Development set | [`retrieval_eval_2026-10-06-0715.summary.md`](../../research/eval/results/retrieval_eval_2026-10-06-0715.summary.md) |
| Retrieval evaluation, after the patches | As above | `node research/eval/run_eval.js` | 58 queries | 2026-10-14 | 45 correct, 3 partial, 10 wrong. Classifier accuracy: V3 21/35 (0.600), keyword baseline 30/35 (0.857). Hit@1: scoped 21/34, unscoped 32/34, keyword fallback 26/34 | Development set; post-patch, not independent | [`retrieval_eval_2026-10-14-0744_postpatch.summary.md`](../../research/eval/results/retrieval_eval_2026-10-14-0744_postpatch.summary.md) |
| Classifier accuracy and calibration | V3 against the frozen keyword baseline on the 29 queries with a clear class; calibration | `run_eval.js --analysis --extra`, then `analyze_classifier.py` | 29 queries | 2026-10-14 | V3 20/29 (69.0%, 95% Wilson 50.8%–82.7%); baseline 28/29 (96.6%, 82.8%–99.4%); exact McNemar p = 0.021; expected calibration error 0.231 | Development set | [`classifier_analysis.md`](../../research/eval/results/classifier_analysis.md), [`classifier_calibration.md`](../../research/eval/results/classifier_calibration.md) |
| Relevance signal | Which signal best separates "should answer" from "should not answer" | As above | 34 against 20 queries | 2026-10-14 | AUC: top-1 retrieval score 0.882, top-1/top-2 margin 0.869, classifier confidence 0.731. No gate implemented | Development set; thresholds found on the scored data | [`relevance_signal.md`](../../research/eval/results/relevance_signal.md), [`classifier_analysis.md`](../../research/eval/results/classifier_analysis.md) |

## Classifier training evaluations

| Evaluation | What it checks | Command | Count | Date | Result | Label | Source |
|---|---|---|---|---|---|---|---|
| V2, 5-fold CV | Accuracy and macro-F1 across folds | Training notebook | 910 examples, 182 seeds | 2026-09-17 | Accuracy 82.9% (mean; no SD recorded); macro-F1 0.8274 ± 0.0726 | Cross-validation | [`docs/development-log.md`](../development-log.md) |
| V2, DR-04 test | Expert-verified test set, run once | Training notebook | 31 | 2026-09-17 | Accuracy 90.3%; macro-F1 0.8832 | **Independent** (blind) | [`docs/development-log.md`](../development-log.md), [`docs/DR04_record.md`](../DR04_record.md) |
| V3, 5-fold CV | Accuracy and macro-F1 across folds | `train_distilbert_v3.py` | 776 examples | Log committed 2026-09-24 | Accuracy 0.8041 ± 0.0427; macro-F1 0.7965 ± 0.0482 | Cross-validation | [`v3_1_training_log.txt`](../../research/experiments/logs/v3_1_training_log.txt) (UTF-16) |
| V3, euphemism hold-out | 4 seeds and their paraphrases, held out of CV and training | As above | 13 | As above | 9/13 correct (diagonal of the log's confusion matrix) | Held out | [`v3_1_training_log.txt`](../../research/experiments/logs/v3_1_training_log.txt) |
| V3, DR-04 test | The same 31 questions, reused | As above | 31 | As above | 27/31 correct (diagonal of the log's confusion matrix); general 1/3 | **Not independent**: disclosed, non-blind reuse | [`v3_1_training_log.txt`](../../research/experiments/logs/v3_1_training_log.txt) |
| V3, fresh independent expert test | – | – | – | – | **Pending** | – | – |

## PWA audit and Lighthouse (manual)

| Check | What it checks | How | Date | Result | Source |
|---|---|---|---|---|---|
| Installability | Chrome's installability check on the production build | `npm run build`, `vite preview`, headless Chrome | 2026-10-14 | No errors (before the fix: missing icons) | [`docs/testing/pwa-audit.md`](pwa-audit.md) |
| Service worker caching | What is precached; whether `/api` is ever cached | As above | 2026-10-14 | App shell only; `/api` never cached; `/api` and `/health` page loads go to the network | [`docs/testing/pwa-audit.md`](pwa-audit.md) |
| Offline behaviour | Reload offline, typed question and disclosure offline, Google unreachable, first visit offline | As above | 2026-10-14 | Shell loads; limited-mode answer; offline referral with the help numbers; limited mode with no error banner; first visit offline shows the browser's error page | [`docs/testing/pwa-audit.md`](pwa-audit.md) |
| Timeouts | Query 20 s and sign-in 10 s, then limited mode | `src/api/timeouts.test.ts` and manual | 2026-10-14 | Pass | [`docs/testing/pwa-audit.md`](pwa-audit.md) |
| Browser storage after a session | Whether any query or answer text is stored | Text search of every store | 2026-10-14 | None found; IndexedDB holds only the Firebase heartbeat | [`docs/testing/pwa-audit.md`](pwa-audit.md) |
| Lighthouse, before the PWA fixes | Mobile profile, simulated throttling, `localhost` | Lighthouse 13.5.0 | 2026-10-14 | Performance 100, Accessibility 100, Best Practices 96, SEO 91 | [`lighthouse_mobile_2026-10-14_before.report.html`](../../research/eval/results/lighthouse_mobile_2026-10-14_before.report.html), [`pwa-audit.md`](pwa-audit.md#lighthouse) |
| Lighthouse, after the PWA fixes | As above | As above | 2026-10-14 | Performance 99, Accessibility 100, Best Practices 100, SEO 91 | [`lighthouse_mobile_2026-10-14_after.report.html`](../../research/eval/results/lighthouse_mobile_2026-10-14_after.report.html), [`pwa-audit.md`](pwa-audit.md#lighthouse) |
| Lighthouse, after the re-theme | As above | As above | 2026-10-14 | Performance 99, Accessibility 100, Best Practices 100, SEO 91 | [`lighthouse_mobile_2026-10-14_theme.report.html`](../../research/eval/results/lighthouse_mobile_2026-10-14_theme.report.html), [`docs/design/ui-comparison.md`](../design/ui-comparison.md#lighthouse) |
| Lighthouse, after the playful update | As above | As above | 2026-10-14 | Performance 99 (an earlier run 98), Accessibility 100, Best Practices 100, SEO 91 | [`lighthouse_mobile_2026-10-14_playful.report.html`](../../research/eval/results/lighthouse_mobile_2026-10-14_playful.report.html), [`docs/design/ui-comparison.md`](../design/ui-comparison.md#lighthouse) |

Lighthouse ran against `localhost`, so its Performance score says little
about real phones on mobile networks. SEO loses points only because
`vite preview` answers `/robots.txt` with `index.html`.

## Corrections made

| Date | What changed | Why | Tests updated | Source |
|---|---|---|---|---|
| 2026-10-15 | Flagged queries are no longer classified, in the gateway and in the offline pipeline. Referrals now report `classificationSkipped: true` and null `predictedCategory`, `classifierSource` and `confidence` | The Safety Net never reads the classifier's result; the call was left over from the proposal's parallel design and made referrals wait on `ml_service`. FR-04 is now met | `backend.wiring.test.js`, `backend.test.js` (Test 2) and `helpSignposting.test.js` now expect no `/classify` call and `classificationSkipped: true`; `safetyNet.test.js` asserts zero classify calls on flagged queries and adds a regression test (a classifier that hangs or throws is never called, and the referral returns at once). Gateway tests: 344 (was 342), all passing; interface: 6 suites passing | [`docs/decision-log.md`](../decision-log.md#classifier-skipped-on-flagged-queries-a-freeze-exception-2026-10-15) |
| 2026-10-15 | A relevance gate in the gateway, behind `RELEVANCE_GATE` (off by default; on by default from 2026-10-20, see below): below a top-1 unscoped retrieval score of 0.8439, a clear query gets the standard no-answer message instead of the retrieved entry | Low-relevance queries got unrelated answers; the gate was validated once on 15 October (in-scope 18/20 answered, off-topic 8/8 and out-of-scope health 4/6 rejected) | New `app/gateway/test/relevanceGate.test.js` (10 tests: flag parsing; just below, at and just above the threshold; scoped gating; no score; flagged and signposting paths; no entry text in abstain responses; flag off unchanged). Gateway tests: 352 (342 + 10), all passing. Interface: unchanged, 6 suites passing; it already renders the no-answer reply | [`docs/decision-log.md`](../decision-log.md#relevance-gate-behind-a-flag-2026-10-15) |
| 2026-10-20 | Every gateway response carries `kind` (answer-scoped, answer-unscoped, abstain, help, vague, referral) and `matchedQuestion` (the served entry's "User question", verbatim, or null). The interface's `QueryResponse` type has both fields and a `ReplyKind` union | UI audit UI-01: a loosely matched answer was shown with no sign of the question it answers | New `app/gateway/test/responseKind.test.js` (10 tests, TC-066 to TC-070). Gateway tests: 364 (354 + 10), all passing; interface typecheck passes | [`docs/decision-log.md`](../decision-log.md#reply-kind-and-matched-question-in-every-response-2026-10-20) |
| 2026-10-20 | The relevance gate is on by default; `RELEVANCE_GATE=false` turns it off. Threshold unchanged (0.8439) | With the gate off, vague queries got unrelated entries as answers (UI audit UI-01). Validation (15 Oct, unchanged): V03 and V19 wrongly rejected (2 of 20 in-scope); all 13 example questions pass (live check, 20 Oct) | `relevanceGate.test.js`: flag test rewritten (off only for exactly `false`), "off (the default)" replaced by two default-on tests and one `false` override test (TC-071, TC-072); `helpSignposting.test.js` now expects the gate's extra unscoped `/retrieve` on a scoped query. Gateway tests: 366 (364 + 2 net), all passing. Live checks TC-073, TC-074 | [`docs/decision-log.md`](../decision-log.md#relevance-gate-on-by-default-2026-10-20) |
| 2026-10-20 | A vague-query rule after the Safety Net and the help rule: a query with at most three content words and no health term gets a clarifying question (`outcome: "clarification"`, `kind: "vague"`), without classification or retrieval. The 122 health terms are generated from the knowledge base by `app/gateway/scripts/build-health-terms.js` | Vague queries got unrelated entries stated as answers (UI audit UI-01, UI-02). Interception: vague 8/8; example questions 0/13; labelled development set 0/35; DR-04 3/31 (open failure, TC-079) | New `app/gateway/test/vagueQuery.test.js` (16 tests, TC-075 to TC-080); `backend.wiring.test.js` switches the rule off in one test whose query ("antenatal") the rule now answers. Gateway tests: 382 (366 + 16), all passing; interface typecheck passes. Live check TC-081 | [`docs/decision-log.md`](../decision-log.md#vague-query-rule-2026-10-20) |
| 2026-10-20 | Help reply opens "You're not alone. These people can help right now." instead of "I don't have information on that yet."; the no-answer reply now opens "I couldn't find a good answer to that.". Text only; numbers unchanged. Mirrored in `app/interface/src/offline/helpContent.ts` | UI audit UI-02, UI-03 | `helpSignposting.test.js`: the old wording test replaced by three (TC-082, TC-083); `offlineSafetyParity.test.js` gains a message parity test (TC-084; 10 tests, was 9). Gateway tests: 385 (382 + 3), all passing | [`docs/decision-log.md`](../decision-log.md#help-and-no-answer-wording-2026-10-20) |
| 2026-10-20 | The offline pipeline the app ships (`offlinePipeline.ts`) now runs the help rule and the vague-query rule, in the gateway's order, from `app/interface/src/offline/queryRules.ts` (ports of the gateway rules; health terms written by the gateway's build script) | Offline, "Help" and vague queries got a general category sentence (UI audit UI-07) | `offlineSafetyParity.test.js`: 4 rule parity tests (14 in the file; the earlier 9 still pass); `vagueQuery.test.js`: offline health-term block up to date; help and query-set cases moved to `test/fixtures/helpCases.js` and `querySets.js`. Gateway tests: 390 (385 + 5), all passing. Interface `offlinePipeline.test.ts`: Tests 5 to 8 run `offlinePipeline.ts` (TC-085 to TC-088) | [`docs/decision-log.md`](../decision-log.md#offline-parity-for-the-help-and-vague-query-rules-2026-10-20) |
| 2026-10-20 | Health terms from outside the knowledge base: `app/gateway/src/content/extraHealthTerms.json`, 122 terms (113 words, 9 phrases) in four categories with stated criteria, used by the gateway and copied into the offline `queryRules.ts` by `build-health-terms.js`. Function-word list frozen (166 words, hashed) | Decisions by Cindy, 20 Oct: confirm the content-word reading, add documented outside-KB terms, accept the side effects as limitations | `vagueQuery.test.js`: the "antenatal" known-limit test now expects no interception; new tests for extra words, plurals and phrases, the extra file's form, and the function-word freeze; the DR-04 pin is now the retest's 1/31 (TC-090). `offlineSafetyParity.test.js` compares the extra list. Gateway tests: 395 (390 + 5), all passing (TC-089) | [`docs/decision-log.md`](../decision-log.md#health-terms-from-outside-the-knowledge-base-2026-10-20) |
| 2026-10-20 | Held-topic rule after the Safety Net and the help rule, before the vague rule: group A (after sex or contraception failure) and group B (pregnancy decisions) get a neutral signpost (`outcome: "held"`, `kind: "held-topic"`, `heldTopicGroup`). Patterns in `app/gateway/src/content/heldTopics.json` (A 41, B 21), copied offline by `scripts/build-held-topics.js`. Replies provisional, pending clinician sign-off | The demo-risk run showed confident wrong answers on topics the knowledge base does not cover. Patterns written after those results were seen (non-blind) | New `heldTopics.test.js` (14 tests, TC-091 to TC-096); `responseKind.test.js` expects seven kinds; live proof TC-097 ([`held-topics-proof.csv`](held-topics-proof.csv)). Gateway tests: 409 (395 + 14) | [`docs/decision-log.md`](../decision-log.md#held-topic-rule-2026-10-20) |
| 2026-10-20 | The offline pipeline runs the held-topic rule in the same order, with the same patterns and replies | Parity with the gateway | `offlineSafetyParity.test.js`: 3 held-topic parity tests (17 in the file; the earlier 14 still pass); `offlinePipeline.test.ts`: Tests 9 and 10 (TC-098). Gateway tests: 412 (409 + 3) | [`docs/decision-log.md`](../decision-log.md#held-topic-rule-2026-10-20) |
| 2026-10-20 | Held-topic group C, possible pregnancy and testing (35 patterns; priority A, B, C), online and offline. Reply provisional, pending clinician sign-off | The demo-risk run gave late-period and pregnancy-test questions unrelated entries. Patterns written after those results were seen (non-blind) | `heldTopics.test.js`: group C, priority, general-period negatives and the C reply (18 tests, was 14); fixtures gain `HELD_C`, and "I missed my period" moves from the no-match list to it; parity runs the C cases; `offlinePipeline.test.ts` Test 9 covers C (TC-099 to TC-105). Gateway tests: 416 (412 + 4) | [`docs/decision-log.md`](../decision-log.md#held-topic-group-c-possible-pregnancy-and-testing-2026-10-20) |
| 2026-10-20 | Redesign Step 2: app shell on every screen (header with wordmark, Help, Exit), quick exit (Exit button and double Escape; `location.replace` to one `EXIT_URL`), footer line with the GBV helpline built from its constant; chips and the close button moved to the 3:1 control border | Stage B2 brief; quick exit did not exist | New `quickExit.test.ts`; component tests for the header, Exit and footer on every screen and reply kind; token contrast for control edges (TC-106 to TC-112). Interface: 8 suites, 370 checks (was 7, 293) | [`docs/decision-log.md`](../decision-log.md#quick-exit-2026-10-20) |
| 2026-10-20 | Redesign Step 3: the splash replaces the disclaimer (once per session, works with storage blocked); the Help sheet replaces the support panel behind Help (focus moved in, trapped and returned; its own Exit); an Escape that closes a panel no longer counts towards the double-Escape exit | Stage B2 brief; audit UI-06 (help dialog focus) | New `splashSession.test.ts`, `focusTrap.test.ts`; component Tests 22 to 25; splash contrast (TC-113 to TC-122). A browser check (22 checks, scratch script) found the closing Escape counted and confirmed the capture-phase fix. Interface: 10 suites, 451 checks (was 8, 370); gateway unchanged, 416/416 | [`docs/decision-log.md`](../decision-log.md#splash-and-help-sheet-2026-10-20) |
| 2026-10-20 | Redesign Step 3b: the splash becomes a full-bleed screen (no header, own Exit pill, decoration, glass promise cards); the shared shield-and-heart mark replaces the header's heart; the sources line is one constant reading "Most answers come from …" | Cindy's correction of Step 3; four KB entries cite other sources | Component Tests 21, 22, 26, 27; token Tests 7 and 8 (worst-case contrast with the glows); a browser check at 320, 360 and 390px (TC-123 to TC-127). Interface: 10 suites, 479 checks (was 451); gateway unchanged, 416/416 | [`docs/decision-log.md`](../decision-log.md#splash-and-help-sheet-2026-10-20) |
| 2026-10-20 | Redesign Step 4: Home as the chat's empty state (hero with the h1, sources line and ask pill; topic tiles; footer); one shared ask bar; rotating placeholder of knowledge-base questions | Stage B2 brief | New `placeholderRotation.test.ts`, `app/gateway/test/homeExamples.test.js` (5 tests); component Tests 5, 17, 19 and 28; offline Test 11; token Test 9 (TC-128 to TC-135). A browser check (scratch script) against the live gateway and `ml_service`. Interface: 11 suites, 540 checks (was 10, 479); gateway 421/421 (was 416) | [`docs/decision-log.md`](../decision-log.md#home-2026-10-20) |
| 2026-10-20 | Redesign Step 5: the Topic list (from Home tiles and Help sheet topic buttons), its questions generated from the knowledge base without answers, one path to an answer through the full pipeline, focus on open and back; Home's h1 and the referral heading take focus | Stage B2 brief; audit UI-14 | New `app/gateway/test/kbQuestions.test.js` (3 tests); component Tests 29 and 30; token Test 10 (TC-136 to TC-143). Browser check (scratch script, live gateway and `ml_service`): all 21 rows send their exact text; 20 return their own entry, KB-P1 returns KB-G3. Interface: 11 suites, 595 checks (was 540); gateway 424/424 (was 421) | [`docs/decision-log.md`](../decision-log.md#topic-list-2026-10-20) |
| 2026-10-20 | Redesign Step 6: the answer screen for knowledge-base answers (closest question as the h1, answer and source as sent, shared disclaimer, related questions of the same class, back link to the Topic list or Home, docked footer line and ask bar); latest exchange only; example chips and follow-ups removed; the rule tests' example set rebuilt from the 21 knowledge-base questions | Stage B2 brief; audit UI-12, UI-16 | Component Tests 7, 8, 15, 16 and 18 replaced (they tested the chips, follow-ups and visible history), Tests 19, 20, 29 and 30 extended, Tests 31 to 36 new; token Test 11 (TC-144 to TC-157). Browser check (scratch script, live gateway and `ml_service`): all pass. Interface: 11 suites, 646 checks (was 595); gateway 424/424 (unchanged; one test renamed for the new set) | [`docs/decision-log.md`](../decision-log.md#answer-screen-2026-10-20) |
| 2026-10-20 | Redesign Step 7: a screen for each reply kind (clarify, held topic, help, no answer, referral), the reply text as the only h1 with focus and one announcement; her question shown back on clarify and no answer only; call buttons and the emergency line from the constants; the footer line points to the call button instead of repeating the number; the session end's h1 | Stage B2 brief; audit UI-01, UI-02, UI-04, UI-09, UI-10, UI-13, UI-16, UI-17 | Component Tests 19, 20, 30 and 36 updated, Tests 37 to 43 new; token Test 12 (TC-158 to TC-165). Browser check (scratch script, live gateway and `ml_service`, synthetic queries): all pass. Interface: 11 suites, 805 checks (was 646); gateway 424/424 (unchanged) | [`docs/decision-log.md`](../decision-log.md#reply-screens-2026-10-20) |
| 2026-10-20 | Redesign Step 7b: the topic grid fits narrow phones (two shrinkable columns, wrapping labels, the icon above the label when the grid is narrow, 14px under 360px); one shared `TopicChoices` for clarify, no answer and the Help sheet; the footer and emergency lines at line-height 1.35 with 44px tap areas | Cindy's bug report (clarify grid clipped at 390px) | Component Tests 20, 23 and 40 updated, Test 44 new (TC-166 to TC-170). Browser check at 320, 360, 390 and 430px (scratch script, live gateway and `ml_service`, synthetic queries): 160 of 160. Interface: 11 suites, 817 checks (was 805); gateway 424/424 (unchanged) | [`docs/decision-log.md`](../decision-log.md#reply-screens-on-narrow-phones-2026-10-20) |
| 2026-10-20 | Redesign Step 8: the loop limit (3 consecutive vague or abstain replies show Talk to a person; in memory only; reset by any other reply kind, a Topic list, Home, a new session or Exit); the ask bar sends only the text from every screen, one request at a time; audit finding UI-19 recorded (keyword fallback without the gate) | Stage B2 brief | New `loopLimit.test.ts` and `askFlow.test.ts` (a mocked gateway recording each request); component Test 45; token Test 13 (TC-171 to TC-183). Browser check with a mocked gateway, and one live sequence (synthetic): 29 of 29. Interface: 13 suites, 887 checks (was 11 suites, 817); gateway 424/424 (unchanged) | [`docs/decision-log.md`](../decision-log.md#loop-limit-and-the-ask-bar-2026-10-20) |
