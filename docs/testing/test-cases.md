# Test cases

Test cases built from the tests and results already in this repository,
traced to the proposal requirements in
[`docs/requirements-traceability.md`](../requirements-traceability.md).
No new test was written and no evaluation was re-run for this file.

**Runs.**
- **Automated suites:** re-run on 15 October 2026 on `docs/traceability`
  at `cb0b2fb`. Gateway `npm test`: 342/342 pass, plus the 6 integration
  check groups. Interface `npm test`: all 6 suites pass.
  Re-run on 20 October 2026 on `fix/response-clarity` at `3a066fa`:
  gateway 390/390 pass plus the 6 integration check groups; interface
  all 6 suites pass (TC-066 onwards).
  After step 7, at `3bac650`: gateway 395/395 pass; interface all 6
  suites pass.
  Held-topic rule, on `fix/held-topics` at `513442e`: gateway 412/412
  pass; interface all 6 suites pass.
- **Manual and evaluation results** are taken from the files cited, with
  their own dates.

**Verdicts.**
- **Pass:** the actual result matches the expected result.
- **Fail:** it does not. Failures are kept, not removed.
- **Not run:** no test or recorded result exists.

**Totals:** 98 cases: 82 Pass, 15 Fail, 1 Not run. Two of the
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

## Response clarity (20 October 2026)

Added on `fix/response-clarity`; each change is in
[`docs/decision-log.md`](../decision-log.md) under its 20 October 2026
entry.

| Test ID | Traceability | Scenario and data | Expected result | Actual result (evidence) | Verdict |
|---|---|---|---|---|---|
| TC-066 | FR-03 | Positive. A clear query answered with retrieval scoped to the predicted class (mocked `ml_service`, confidence 0.9, KB-S4) | `kind: "answer-scoped"`; `matchedQuestion` is KB-S4's question, verbatim | As expected (`responseKind.test.js`, "scoped answer: answer-scoped, with the entry's question verbatim") | Pass |
| TC-067 | FR-03 | Positive. Unscoped retrieval (confidence 0.45), then the keyword fallback (`/classify` fails, local retrieval) | `kind: "answer-unscoped"` in both; `matchedQuestion` is the served entry's question | As expected ("unscoped answer: …"; "keyword fallback (local retrieval): …") | Pass |
| TC-068 | FR-03 | Negative. Classifier abstain (confidence 0.2), and relevance gate abstain (unscoped score 0.80, gate on) | `kind: "abstain"`; `matchedQuestion: null`; no entry text in the response | As expected ("classifier abstain: …"; "relevance gate abstain: …") | Pass |
| TC-069 | FR-04, FR-03 | Generic help request and a flagged query | `kind: "help"` and `kind: "referral"`, both with `matchedQuestion: null` | As expected ("help request: …"; "flagged query: …") | Pass |
| TC-070 | FR-03 | Every active knowledge-base entry served through the orchestrator; the interface's `ReplyKind` type | Each response's `matchedQuestion` is that entry's own question, unchanged; the interface union lists the six gateway kinds in order | As expected ("matchedQuestion is each active entry's own question, unchanged"; "the interface's ReplyKind type lists the same kinds") | Pass |
| TC-071 | FR-03 | Boundary. `RELEVANCE_GATE` unset; unscoped score 0.50, then exactly 0.8439 (mocked `ml_service`) | Gate on by default: 0.50 gets the no-answer message with no entry text; 0.8439 is answered (`relevanceGate: "passed"`) | As expected (`relevanceGate.test.js`, "abstains below the threshold with RELEVANCE_GATE unset"; "answers at or above the threshold with RELEVANCE_GATE unset") | Pass |
| TC-072 | FR-03 | Exception. `RELEVANCE_GATE=false`, and other values ("", "true", "FALSE", "0", "no", " false") | Off only for exactly `false`: the response and the `ml_service` calls are as before the gate (no `relevanceGate` field, no extra `/retrieve`); every other value leaves it on | As expected ("is off only for RELEVANCE_GATE exactly 'false', and on otherwise"; "leaves the response and the ml_service calls as before the gate") | Pass |
| TC-073 | FR-03 | Positive, live. The 13 example questions (chips and follow-ups) through the gateway with the gate on by default, `ml_service` v3 (20 Oct) | All 13 answered, gate passed | 13/13 answered with the same entry as before, `relevanceGate: "passed"`; lowest unscoped score 0.8570 ([DL, Relevance gate on by default](../decision-log.md#relevance-gate-on-by-default-2026-10-20)) | Pass |
| TC-074 | FR-03 | Negative, live. The 8 vague queries ("Am I okay?" … "hmm") with the gate on by default (20 Oct) | None gets a knowledge-base entry | 8/8 get the no-answer message: 7 by the gate, "hmm" by the classifier abstain (same source) | Pass |
| TC-075 | FR-03 | Unit. Content words and health-term matching ("What should I do?", "Can I ask you something?", "I'm worried"; plurals such as "pills", "breasts") | Function words set aside; at most 3 content words; terms match with a plural added or removed; "normal", "worried", "okay", "exams" are not terms | As expected (`vagueQuery.test.js`, "vague-query rule: the rule itself", 5 tests) | Pass |
| TC-076 | FR-03 | Positive. The 8 vague test queries, through the rule and through `handleQuery()` | 8/8 intercepted; each gets the clarifying question (`outcome: "clarification"`, `kind: "vague"`) with no `/classify` or `/retrieve` call | As expected ("intercepts all 8 vague test queries"; "returns the clarifying question without classifying or retrieving") | Pass |
| TC-077 | FR-03 | Negative. The 13 example questions (read from `uiText.ts`) and the 35 labelled development-set queries | None intercepted | 0/13 and 0/35 ("intercepts none of the 13 example questions"; "intercepts none of the 35 labelled development-set queries") | Pass |
| TC-078 | FR-02, FR-04 | Precedence. A flagged query (stubbed Safety Net), "Help", and a short health question ("what is PrEP") | Referral without consulting the rule; signposting for "Help"; the health question goes on to the classifier | As expected ("never overrides the Safety Net"; "leaves 'Help' to the help rule, which runs first"; "sends a short health question on to the classifier") | Pass |
| TC-079 | FR-03 | Negative. The 31 DR-04 test queries | None intercepted | 3/31 intercepted: "What can I do when I mess up ?", "How is a coil inserted?", "Tell me how to use a tampon?" ("coil" and "tampon" are not knowledge-base words); pinned in "intercepts exactly the 3 recorded DR-04 queries of 31 (open failure)" | Fail |
| TC-080 | DR (knowledge base) | The health-term list against the knowledge base | Every term is a word of the active knowledge base; the committed list is up to date | 122 terms of 724 knowledge-base words; up to date ("health-term list", 2 tests; `node scripts/build-health-terms.js --check`) | Pass |
| TC-081 | FR-03 | Live. The 8 vague queries and the 13 example questions through the gateway and `ml_service` v3 (20 Oct) | Vague queries get the clarifying question; example questions answered as before | 8/8 clarifying question; 13/13 answered with the same entries ([DL, Vague-query rule](../decision-log.md#vague-query-rule-2026-10-20)) | Pass |
| TC-082 | FR-03 | The help reply's wording | Starts "You're not alone. These people can help right now.", then the help text; never "I don't have information" | As expected (`helpSignposting.test.js`, "opens the help reply plainly, then gives the help information") | Pass |
| TC-083 | FR-03 | The no-answer reply's wording | Starts "I couldn't find a good answer to that.", then the help text; both messages keep 1195 and 116 | As expected ("says no answer was found before the help information"; "keeps the help numbers in both messages") | Pass |
| TC-084 | NFR (offline) | The offline copy of the help, signposting and no-answer messages | Identical to the gateway's | As expected (`offlineSafetyParity.test.js`, "has the same help, signposting and no-answer messages") | Pass |
| TC-085 | NFR (offline) | Offline (`offlinePipeline.ts`, the pipeline the app ships): "Help" | The signposting message, `kind: "help"` | As expected (`offlinePipeline.test.ts`, Test 5) | Pass |
| TC-086 | NFR (offline) | Offline: the 8 vague test queries | Each gets the clarifying question (`outcome: "clarification"`, `kind: "vague"`) | 8/8 (`offlinePipeline.test.ts`, Test 6) | Pass |
| TC-087 | FR-02, NFR (offline) | Offline: a safety phrase ("someone touched me") and a health question ("what is PrEP") | The abuse referral (`kind: "referral"`); a general limited-mode answer | As expected (`offlinePipeline.test.ts`, Tests 7 and 8) | Pass |
| TC-088 | NFR (offline) | Gateway and offline copies of the help and vague-query rules: patterns, function words, word limit, health terms, clarifying question, and every shared case (help cases, vague queries, example questions, 58 development-set and 31 DR-04 queries, Safety Net cases) | Identical tables and identical results; the 9 earlier parity tests still pass | As expected (`offlineSafetyParity.test.js`, "gateway and offline help and vague-query rule parity", 4 tests; the file's 14 tests all pass); the offline health-term block is up to date (`vagueQuery.test.js`) | Pass |
| TC-089 | FR-03 | The extra health-term list and the frozen function words | Every category has a name and criterion; terms are well formed and unique; the rule uses the list's words and phrases ("is a coil safe", "tampons or pads", "I took P2", "he pulled out early" not vague; "he pulled the door out" has no phrase); no vague query's content word is listed; the function-word list matches its frozen hash; the offline copy is up to date | As expected (`vagueQuery.test.js`, "extra health terms (outside the knowledge base)", 3 tests; "knows extra terms as words, with plurals, and as phrases"; "uses the frozen function-word list"; `offlineSafetyParity.test.js`, "has the same function words, word limit and health terms (KB and extra)") | Pass |
| TC-090 | FR-03 | Retest of TC-079, **non-blind**: the 31 DR-04 queries after the extra health terms were added (with TC-079's three catches already seen) | None intercepted | 1/31 intercepted: "What can I do when I mess up ?". The coil and tampon questions now pass (`vagueQuery.test.js`, "intercepts exactly the 1 recorded DR-04 query of 31 (non-blind retest)"; [DL, Health terms from outside the knowledge base](../decision-log.md#health-terms-from-outside-the-knowledge-base-2026-10-20)) | Fail |
| TC-091 | FR-03 | The held-topic pattern file and its offline copy | Groups A and B, each with a name, criterion and patterns; patterns well formed and unique; the offline copy up to date | As expected (`heldTopics.test.js`, "held-topic patterns", 2 tests; `node scripts/build-held-topics.js --check`) | Pass |
| TC-092 | FR-03 | Positive. Synthetic group A queries (P2, postinor, morning after, plan b, condom broke or slipped in any word order, forgot or missed pill, pulled out, withdrawal, unprotected, without a condom, pre-cum) | Each matches group A | 14/14 (`heldTopics.test.js`, "matches group A …"; cases in `test/fixtures/heldCases.js`) | Pass |
| TC-093 | FR-03 | Positive. Synthetic group B queries (positive pregnancy test, unwanted pregnancy, "don't want to be pregnant", abortion, terminate, "get rid of the pregnancy"); a query matching both groups | Each matches group B; a query matching both gets group A | 8/8; both-groups query gives A ("matches group B …"; "gives group A when a query matches both groups") | Pass |
| TC-094 | FR-03 | Negative. "I missed my period", "how do I get rid of period cramps", "I don't want to get pregnant, which method is best", two example questions, "what is PrEP", "is my HIV test positive forever", "Am I okay?" | No match | 8/8 unmatched ("leaves other questions alone") | Pass |
| TC-095 | FR-02, FR-03, FR-04 | Pipeline. A group A and a group B query; a flagged query naming a held topic (stubbed and real); "Help"; "plan b?" (also vague); an example question | The group's signpost (`outcome: "held"`, `kind: "held-topic"`, `heldTopicGroup`) with no `/classify` or `/retrieve`; referral wins; help rule first; held before vague; other questions classified | As expected ("held-topic rule in handleQuery()", 6 tests) | Pass |
| TC-096 | FR-03 | The two held-topic replies (provisional, pending clinician sign-off) | Exactly the approved provisional wording, with the existing numbers 1195 and 116 | As expected ("held-topic replies", 2 tests) | Pass |
| TC-097 | FR-03 | Live, gateway and `ml_service` v3, gate on, before and after the rule: demo-risk set (20, **non-blind**), example questions (13), labelled development set (35), DR-04 (31) | No example question intercepted; no development or DR-04 query that was answered correctly before is intercepted | Intercepted: demo-risk 8/20; examples 0/13; development 0/35; DR-04 5/31 (#5, #6, #24, #18, #30), none answered correctly before (3 no-answer, 2 KB-P5 school re-entry); no other reply changed ([`held-topics-proof.csv`](held-topics-proof.csv), [DL](../decision-log.md#held-topic-rule-2026-10-20)) | Pass |
| TC-098 | NFR (offline) | Offline: the rule in `offlinePipeline.ts` and parity with the gateway | Same order, groups, patterns, replies and results on every shared case | As expected (`offlineSafetyParity.test.js`, "gateway and offline held-topic rule parity", 3 tests; `offlinePipeline.test.ts`, Tests 9 and 10) | Pass |

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
TC-060, TC-062 (retrieval errors and the precum gap), TC-079 (three
DR-04 queries caught by the vague-query rule) and its non-blind retest
TC-090 (one still caught). They are documented
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
- **DR-04:** V3's fresh independent expert test is pending. The set's
  provenance is recorded as a statement from the project owner (15
  October 2026), not as a test: "The DR-04 set of 34 questions comes
  from an external expert source: a licensed medical doctor in Siaya
  County and her team, through a process separate from the training-data
  generation. The team had seen the initial training data before the set
  was written, so overlap in style or topic with the training data
  cannot be excluded; this is recorded as a limitation. The project
  proposed an intended class for 29 questions; the expert team confirmed
  26, amended 1 (TEST-025, pregnancy to STI), and gave two-category
  answers on 2 (TEST-014, TEST-030). For the 5 questions with no
  proposal (TEST-001, 005, 006, 013, 015) the team supplied the class,
  with a two-category answer on TEST-015. Six questions carry expert
  notes. The team of three reviewers completed the verification sheet
  together; individual reviewer labels were not recorded. The
  verification_status column was never filled. Source workbook: held by
  the project owner; not yet in the repository. The set was added to the
  repository on 17 September 2026." (First commit of
  `resources/test/independent_test_set.csv`: `40319e7`.) How the set has
  been used: V2 was evaluated on it once, blind, on 17 September 2026
  (accuracy 90.3%, macro-F1 0.8832; `docs/development-log.md`). V3.1 was
  then run on it as a disclosed non-blind reuse ("SECONDARY, NON-BLIND
  SANITY CHECK" in `research/experiments/logs/v3_1_training_log.txt`,
  committed 24 September 2026; 27/31, derived from its confusion
  matrix), so DR-04 figures for V3 are not independent. The first V3
  attempt's log (`v3_training_log.txt`) stops during fold 4, so whether
  that run also reached DR-04 is not recorded. No keyword-baseline
  result on this set was found in the repository, the results folders,
  git history or the stashes.
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
