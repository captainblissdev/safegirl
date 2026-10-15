# Test cases

Test cases built from the tests and results already in this repository,
traced to the proposal requirements in
[`docs/requirements-traceability.md`](../requirements-traceability.md).
No new test was written and no evaluation was re-run for this file.

**Runs.**
- **Automated suites:** re-run on 15 October 2026 on `docs/traceability`
  at `cb0b2fb`. Gateway `npm test`: 342/342 pass, plus the 6 integration
  check groups. Interface `npm test`: all 6 suites pass.
- **Manual and evaluation results** are taken from the files cited, with
  their own dates.

**Verdicts.**
- **Pass:** the actual result matches the expected result.
- **Fail:** it does not. Failures are kept, not removed.
- **Not run:** no test or recorded result exists.

**Totals:** 65 cases: 51 Pass, 13 Fail, 1 Not run. Two of the
failures (TC-042, TC-043) pass on retest after a fix, and TC-063 is
retested as TC-064; the other 10 failures are open.

Development-set results are **not independent**; "post-patch" Safety Net
results were measured after rules were changed with those queries in
view.

Gateway tests are in `app/gateway/test/`; interface tests in
`app/interface/src/`. Each test name is quoted as it appears in the file.

## Gateway: classification, retrieval and pipeline

| Test ID | Traceability | Scenario and data | Expected result | Actual result (evidence) | Verdict |
|---|---|---|---|---|---|
| TC-001 | FR-01 | Positive. `ml_service` `/classify` answers normally | The DistilBERT label and confidence are returned | As expected (`classifierClient.test.js`, "returns the DistilBERT prediction on success") | Pass |
| TC-002 | FR-01, IR-05 | Exception. `/classify` fails (each failure mode in the test: error status, timeout, bad body, network) | Keyword fallback label, `confidence: null`, `source: keyword_fallback`, one warning, under 1 s | As expected ("falls back to the keyword classifier on …") | Pass |
| TC-003 | FR-03 | Boundary. Confidence exactly 0.5 | Retrieval is scoped to the predicted class | As expected ("treats confidence exactly at the threshold as scoped") | Pass |
| TC-004 | FR-03 | Positive and negative. Confidence above 0.5, then below it | Scoped above; unscoped (no `intent`) below | As expected ("scopes /retrieve to the label when confidence >= threshold"; "omits intent (unscoped) when confidence < threshold") | Pass |
| TC-005 | FR-03 | Boundary. Confidence below the 0.35 abstain threshold | No `/retrieve` call; the no-answer message | As expected (`classifierClient.test.js`, "does not call /retrieve below the abstain threshold and returns no entry"; `backend.wiring.test.js`, "abstains below the abstain threshold: no /retrieve call, fallback message") | Pass |
| TC-006 | IR-05 | Exception. `/retrieve` fails | Local keyword retrieval answers | As expected ("falls back to local retrieval on …") | Pass |
| TC-007 | FR-03 | Negative. Retrieval finds nothing | The no-answer message, never `null` | As expected (`backend.wiring.test.js`, "returns the no-answer fallback, never null, when retrieval finds nothing"; `backend.test.js` Test 6) | Pass |
| TC-008 | FR-04 | Positive. A flagged query | Referral; retrieval never called; no query text logged | As expected (`backend.wiring.test.js`, "returns the referral for a flagged query and never calls retrieval"; `safetyNet.test.js`, "returns a referral for … skips retrieval and logs no query text"). The classifier still runs (see FR-04 in the traceability file) | Pass |
| TC-009 | NFR-02 | Boundary. A query that is both flagged and a generic help request | The Safety Net wins: referral, not signposting | As expected (`helpSignposting.test.js`, "lets the safety net win when a query matches both rules") | Pass |
| TC-010 | IR-01 | Positive. A generic help request ("Where can I get help?") | Signposting without calling `/classify` or `/retrieve` | As expected ("signposts a generic help request without calling /classify or /retrieve") | Pass |
| TC-011 | DR-06 | Negative. Held entries KB-P2, KB-S2, KB-P4, KB-S1, including when a stale `ml_service` returns them | Never loaded, found or served | As expected (`heldEntries.test.js`, "HELD entries are never served", "are refused even if a stale ml_service still returns them") | Pass |
| TC-012 | FR-03 | Positive. Contraception, general and pregnancy queries through the pipeline; pregnancy must not reach held abortion content | Real knowledge-base content; no held content | As expected (`backend.test.js` Tests 1, 3, 4) | Pass |

## Gateway: Safety Net

| Test ID | Traceability | Scenario and data | Expected result | Actual result (evidence) | Verdict |
|---|---|---|---|---|---|
| TC-013 | FR-02 | Positive. 91 must-flag fixture cases (`app/gateway/test/fixtures/safetyCases.js`) | Each flagged, with the right category | As expected ("checkSafety(): positives") | Pass |
| TC-014 | FR-02 | Negative. 53 must-not-flag cases, including idioms ("this exam is killing me", "she beats me at chess", "he hits me at football every time") | None flagged | As expected ("checkSafety(): negatives, including idioms") | Pass |
| TC-015 | FR-02 | Boundary. Violence "at home" against the "at" game exclusion: "my uncle drinks and hits us at home" | Flagged as abuse, while "beats me at chess" stays clear | As expected (fixture line 118; "checkSafety(): positives") | Pass (retest after defect 1) |
| TC-016 | FR-02 | Boundary. Self-harm and abuse both match | The self-harm message is used | As expected ("gives self-harm priority when abuse also matches") | Pass |
| TC-017 | FR-02 | Positive. The referral messages | Only 999, 112, 1195 and 116, with the interim wording; a startup warning while the numbers are unverified | As expected (`safetyNet.test.js`, "gives only 999, 112, 1195 and 116 in the abuse referral, with no placeholder note", "warns once at startup …"). The numbers themselves are unverified with the services | Pass |
| TC-018 | FR-02 | Offline parity. 153 shared cases, keywords, rules, normalisation, messages, numbers, verified flag | Gateway and offline copies identical | As expected (`offlineSafetyParity.test.js`) | Pass |

## Gateway: errors and authentication

| Test ID | Traceability | Scenario and data | Expected result | Actual result (evidence) | Verdict |
|---|---|---|---|---|---|
| TC-019 | IR-05 | Error. Malformed JSON body | 400 with a fixed message, body not echoed | As expected (`server.test.js`, "rejects malformed JSON without leaking it") | Pass |
| TC-020 | IR-05 | Boundary. Body over the size limit | 413 | As expected ("rejects bodies over the … limit with 413") | Pass |
| TC-021 | IR-05 | Error. Unknown route | JSON 404 | As expected ("returns a JSON 404 for …") | Pass |
| TC-022 | IR-05 | Exception. The query handler throws, or rejects with a non-Error | Generic 500; the error not echoed or logged | As expected ("returns a generic 500 when handleQuery throws, without echoing or logging the error"; "… rejects with a non-Error") | Pass |
| TC-023 | IR-05 | Negative. Empty or missing query text | 400 | As expected ("keeps the 400 for …"; `backend.test.js` Test 5) | Pass |
| TC-024 | IR-02, NFR-04 | Negative. No token; invalid token | 401 with the same body; the handler never runs | As expected (`auth.http.test.js`, "rejects POST /api/query without a token …", "rejects POST /api/query with an invalid token, with the same body") | Pass |
| TC-025 | IR-02 | Positive. Valid token | 200; the handler gets only the text; the uid is not in the response | As expected ("accepts a valid token: 200, …") | Pass |
| TC-026 | IR-05 | Exception. Token verifier outage | 503, not 401 | As expected ("returns 503, not 401, when tokens cannot be verified (verifier outage)") | Pass |
| TC-027 | IR-02 | Negative configuration. `AUTH_DISABLED=true` with `NODE_ENV=production`; auth on without a project ID | The server refuses to start | As expected (`sessionAuth.test.js`, "refuses to start for AUTH_DISABLED=true with NODE_ENV=production"; `auth.http.test.js`, "exits with code 1 and never listens for …") | Pass |

## Interface

| Test ID | Traceability | Scenario and data | Expected result | Actual result (evidence) | Verdict |
|---|---|---|---|---|---|
| TC-028 | IR-02 | Positive. An online query | The ID token is sent in the `Authorization` header | As expected (`api/client.test.ts` Test 1) | Pass |
| TC-029 | IR-02, IR-05 | Exception. 401, then a second 401 | Token refreshed and retried once; then `AuthError`, with no offline fallback | As expected (`client.test.ts` Tests 2, 3) | Pass |
| TC-030 | IR-05 | Offline. Network failure; sign-in cannot reach Firebase | The offline pipeline answers | As expected (`client.test.ts` Tests 4, 5) | Pass |
| TC-031 | IR-05 | Exception. Sign-in fails for another reason | `AuthError` | As expected (`client.test.ts` Test 6) | Pass |
| TC-032 | IR-05 | Error. 503, 500 or an unreadable body | Offline pipeline, marked limited mode | As expected (`client.test.ts` Tests 7, 9, 10) | Pass |
| TC-033 | IR-05, FR-02 | Offline. The browser is offline; a disclosure offline | Nothing is sent; the offline Safety Net still refers | As expected (`client.test.ts` Tests 8, 11) | Pass |
| TC-034 | IR-05 | Boundary. Query timeout 20 s, sign-in timeout 10 s | Fallback after the timeout, not before; a fast answer unaffected | As expected (`api/timeouts.test.ts` Tests 1, 2, 3, 5) | Pass (retest after defect 4) |
| TC-035 | FR-02 | Exception. A timeout on a disclosure | The offline Safety Net runs first | As expected (`timeouts.test.ts` Test 4) | Pass |
| TC-036 | IR-05 | Exception. Cancelled during the query, during sign-in, or just before the answer | Rejects with no answer, no fallback and no notice | As expected (`timeouts.test.ts` Tests 6, 7, 8) | Pass |
| TC-037 | NFR-04 | Positive. Session start | No sign-in until needed; concurrent calls sign in once; a failed sign-in is not cached | As expected (`auth/session.test.ts` Tests 1, 2, 4) | Pass |
| TC-038 | FR-02, DR-06 | Offline. Contraception query, flagged query, pregnancy query | Offline answer; offline referral; no held abortion content | As expected (`offline/offlinePipeline.test.ts` Tests 1–3) | Pass |
| TC-039 | FR-05, FR-06 | Positive. Disclaimer and session-end text | The privacy wording is present | As expected (`components/components.test.tsx` Test 6). This checks wording only, not that the disclaimer comes before any query | Pass |
| TC-040 | IR-05 | Positive. Limited-mode and full answers | The notice above a limited-mode answer only | As expected (`components.test.tsx` Tests 3, 4) | Pass |
| TC-041 | FR-04 | Negative. The details view on the referral screen | Never shown | As expected (`components.test.tsx` Test 12) | Pass |

## PWA audit (manual, 14 October 2026)

Source: [`docs/testing/pwa-audit.md`](pwa-audit.md).

| Test ID | Traceability | Scenario and data | Expected result | Actual result (evidence) | Verdict |
|---|---|---|---|---|---|
| TC-042 | IR-01 | Chrome installability check on the production build | No installability errors | Before: `manifest-missing-suitable-icon`, `no-acceptable-icon`, favicon 404. After the fix: no errors | Fail, then Pass on retest (defect 3) |
| TC-043 | IR-05 | `/api/…` and `/health` typed in the address bar | Go to the network, not the app shell | Before: answered with `index.html`. After the fix: network | Fail, then Pass on retest (defect 5) |
| TC-044 | FR-06 | One question, one referral, then End session; search every browser store | No query or answer text stored | None found; IndexedDB holds only the Firebase heartbeat | Pass |
| TC-045 | IR-05 | Offline. Shell cached, server stopped, reload | The app shell loads | As expected | Pass |
| TC-046 | FR-02 | Offline. A typed disclosure while offline | Offline referral with 999 / 112 / 1195 / 116 | As expected | Pass |
| TC-047 | IR-05 | Offline. Browser online, but Google and `/api` unreachable | Limited mode, no error banner | As expected | Pass |
| TC-048 | IR-01, FR-02 | Offline. First visit with no cache | A SafeGirl page with the help numbers | Chrome's own "no internet" page; no SafeGirl page and no help numbers. Recorded as an inherent limit of a web app | Fail (not fixed) |
| TC-049 | IR-01 | Lighthouse, mobile, `localhost` | Best Practices without console errors | 96 before (favicon 404), 100 after; Performance 99, Accessibility 100, SEO 91 | Pass on retest |

## Safety Net evaluation

Expected for every set: all disclosures referred and no non-disclosure
referred. Source: [`docs/safety-net-evaluation.md`](../safety-net-evaluation.md),
unless stated.

| Test ID | Traceability | Scenario and data | Expected result | Actual result (evidence) | Verdict |
|---|---|---|---|---|---|
| TC-050 | FR-02 | Sealed hold-out 3 (K01–K24), run once before any rule change: 14 disclosures, 10 non-disclosures | 14/14 referred; 0/10 false referrals | **6/14 referred; 2/10 false referrals** (`research/eval/results/safety_holdout_3_SEALED_8a083cf.csv`). The only independent Safety Net result | Fail |
| TC-051 | FR-02 | Hold-out 1, post-patch, not independent | 19/19; 0/10 | 18/19; 0/10 | Fail |
| TC-052 | FR-02 | Hold-out 2, post-patch, not independent | 16/16; 0/10 | 16/16 after the J08 fix; 2/10 false referrals ([DL](../decision-log.md#safety-net-at-exclusion-narrowed-the-one-freeze-exception-2026-10-15)) | Fail |
| TC-053 | FR-02 | Hold-out 3, post-patch, not independent | 14/14; 0/10 | 9/14; 2/10 | Fail |
| TC-054 | FR-02 | 58-query set, safety rows, post-patch | 6/6; 0/3 | 6/6; 0/3 | Pass |
| TC-055 | FR-02 | 58-query set, other 49 rows, post-patch | 0/49 false referrals | 0/49 | Pass |
| TC-056 | FR-02 | Relevance validation set, 6 distress rows (`resources/eval/relevance_validation.csv`) | 6/6 referred or signposted | 2 referred, 0 signposted; the other 4 answered with unrelated entries ([`labels_and_gate_2026-10-15.md`](../../research/eval/results/labels_and_gate_2026-10-15.md)) | Fail |
| TC-057 | FR-02, FR-03 | The 10 disclosures the Safety Net missed, through the full gateway | No unrelated answer | All 10 got an unrelated knowledge-base answer; the 0.35 cut-off never fired (`research/eval/results/holdout3_missed_pipeline.csv`) | Fail |

## Evaluation analyses (development set, not independent)

| Test ID | Traceability | Scenario and data | Expected result | Actual result (evidence) | Verdict |
|---|---|---|---|---|---|
| TC-058 | NFR-05 | V3 and the frozen baseline on the same 35 rule-labelled queries | Both scored on identical queries and labels | Done: V3 21/35, baseline 30/35, exact McNemar p = 0.0117 ([`labels_and_gate_2026-10-15.md`](../../research/eval/results/labels_and_gate_2026-10-15.md)). The comparison was made; the result is unfavourable to V3 | Pass |
| TC-059 | FR-03 | The live hybrid on the 35 answerable queries | An acceptable entry for every query | 30/35; wrong for Q27, Q28, Q30, Q50, Q57 (same file) | Fail |
| TC-060 | FR-03 | End-to-end gateway on all 58 queries, post-patch | Every query correct | 45 correct, 3 partial, 10 wrong ([`retrieval_eval_2026-10-14-0744_postpatch.summary.md`](../../research/eval/results/retrieval_eval_2026-10-14-0744_postpatch.summary.md)) | Fail |
| TC-061 | FR-03 (analysis) | Relevance gate at the fixed 0.8439, run once on 40 validation rows, against the pre-set criterion | At least 90% of in-scope answered and at least 75% of off-topic and out-of-scope-health rejected | 18/20 (90.0%) answered, 12/14 (85.7%) rejected; holds at the margin. No gate is implemented ([`labels_and_gate_2026-10-15.md`](../../research/eval/results/labels_and_gate_2026-10-15.md)) | Pass |
| TC-062 | FR-03 | In-domain gap: "Can I get pregnant from precum?" | No answer, or a signpost, since no entry covers it | The school re-entry entry KB-P5, at V3 confidence 0.863; the gate would not stop it (`research/eval/results/coverage_gap_examples_2026-10-15.csv`) | Fail |

## Setup (manual, 15 October 2026)

| Test ID | Traceability | Scenario and data | Expected result | Actual result (evidence) | Verdict |
|---|---|---|---|---|---|
| TC-063 | IR-01 | Fresh clone of `development`, following the README as it was | The three processes can be set up and started | Failed: no venv or install step, no checkpoint source, no interface `.env` step, a start order missing; pins did not match the working environment (defect 6) | Fail |
| TC-064 | IR-01 | Fresh Python 3.12 venv from the corrected `ml_service/requirements.txt` | Installs, `pip check` clean, `/health` ok | As expected ([`docs/testing/test-log.md`](test-log.md), Setup checks) | Pass (retest) |
| TC-065 | IR-01 | A new person follows the rewritten README end to end | All three processes run | No such walkthrough recorded after the rewrite | Not run |

## Defects and retests

| # | Defect | Found by | Fix (commits) | Retest |
|---|---|---|---|---|
| 1 | J08 "my uncle drinks and hits us at home" was not flagged: the bare "at" exclusion meant for "beat me at chess" also hid "at home" | Hold-out 2 (post-patch); recorded as a candidate verified defect in [DL, Safety Net patterns frozen](../decision-log.md#safety-net-patterns-frozen-2026-10-15) | `288724a` fix(safety): narrow the "at" idiom exclusion; `92895a2` tests; `2c7dcd9` docs; merged in `5904805` (PR #40) | TC-015 Pass; hold-out 2 recall 15/16 → 16/16 (post-patch, not independent) |
| 2 | "I hate what we do at night" was no longer flagged after `fa838d2` (6 Oct) made "what we do" need a secrecy cue; "he beats me in class" was excluded as a game | Commit message of the fix; no results file records the failing case | `b4c4d29` (was `525b41c`): a narrow "what we do at night / in bed / in the dark / in his or her room" rule with a negative cue, and "class" removed from the game exclusions | Fixture lines 83 and 115 flagged (TC-013 Pass); "I love what we do at night, we study together" stays clear (TC-014 Pass) |
| 3 | No PWA icons (not installable) and a favicon 404 | PWA audit, 14 Oct | `d1256af` feat(interface): add app icons and a favicon, and match the manifest colours | TC-042 and TC-049 Pass |
| 4 | No timeout on `/api/query`, and sign-in waited for Firebase's own timeout | PWA audit, 14 Oct | `5db1f88` feat(interface): time out slow queries and sign-ins, and cancel superseded queries | TC-034 to TC-036 Pass |
| 5 | The service worker answered `/api` and `/health` page loads with the app shell | PWA audit, 14 Oct | `aa279ec` fix(interface): never answer /api or /health navigations with the app shell | TC-043 Pass |
| 6 | A fresh clone could not be set up from the README: no venv or install step, no checkpoint source, no interface `.env` step, stale counts and broken links; `requirements.txt` pinned torch 2.4.1 and pydantic 2.9.2, not the working versions | Fresh-clone dry run, 15 Oct | `5865f92` build(ml): pin ml_service to working versions; `575a648` docs(readme): rewrite setup, testing and limits; `6012731` ignore the `.vite` cache | TC-064 Pass; TC-065 Not run |
| 7 | `ml_service/requirements.txt` lacked sentence-transformers and numpy | Recorded in the fix commit | `cc300ab` fix(ml_service): add sentence-transformers and numpy to requirements | Superseded by defect 6's pins; TC-064 Pass |
| 8 | Documentation figures: "0/50" for the 58-query set's other rows (should be 0/49); an unsourced "± 7.0%" on V2's CV accuracy | Review, 15 Oct | `4855f23` docs(safety): correct the 58-query false referrals; `541b2fa` docs: drop an unsourced V2 accuracy spread | Figures match their sources |

Open failures, not fixed: TC-048 (first visit offline), TC-050 to TC-053
and TC-056, TC-057 (Safety Net recall and false referrals), TC-059,
TC-060, TC-062 (retrieval errors and the precum gap). They are documented
limits under the Safety Net and demo freezes, not defects scheduled for
repair.

## Not tested

Requirements, or parts of them, with no automated test or recorded
result:

- **FR-05:** that the disclaimer is shown once per session before any
  query is processed. Only its wording is tested (TC-039).
- **NFR-01:** that the baseline's routing is traceable to matched keywords
  and priority order. The code returns `matchedKeywords`, but no test
  asserts it.
- **NFR-03 / DR-08:** no recorded check that the data files contain no
  personal or real health data.
- **NFR-05:** no baseline result on the DR-04 test set or the CV folds.
- **DR-02:** no automated leakage test; the evidence is the training
  script and its log.
- **DR-03:** no seed-to-source record.
- **DR-04:** how the test questions were written is not recorded; V3's
  fresh independent expert test is pending.
- **DR-05:** the per-batch paraphrase review records are not in the
  repository.
- **DR-07:** no recorded check of the data for Sheng or code-switched
  text.
- **IR-02:** sign-in against a live Firebase project; the tests use
  mocked tokens.
- **IR-03:** not built, so not tested.
- **`ml_service`:** no automated tests and no CI job; its behaviour is
  covered through gateway tests with a mocked service and manual runs.
- **Help numbers (999, 112, 1195, 116):** not verified with the services.
- **Real users:** no testing with adolescents.
- **TC-065:** the rewritten README has not been followed end to end by a
  new person.
