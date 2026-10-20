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
