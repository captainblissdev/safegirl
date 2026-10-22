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
  Group C, on `fix/held-topics-c` at `60ee19a`: gateway 416/416 pass;
  interface all 6 suites pass.
- **Manual and evaluation results** are taken from the files cited, with
  their own dates.

**Verdicts.**
- **Pass:** the actual result matches the expected result.
- **Fail:** it does not. Failures are kept, not removed.
- **Not run:** no test or recorded result exists.

**Totals:** 212 cases: 192 Pass, 19 Fail, 1 Not run. Two of the
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
| TC-099 | FR-03 | Group C in the pattern file and its offline copy | Groups A, B and C, each with a name, criterion and patterns; the offline copy up to date | As expected (`heldTopics.test.js`, "has groups A, B and C …"; "is copied, up to date, into the offline queryRules.ts"; `build-held-topics.js --check`) | Pass |
| TC-100 | FR-03 | Positive. Synthetic group C queries: late, missed, overdue or delayed period; no period; period has not come; "could I be pregnant?", "am I pregnant", "I think I'm pregnant"; pregnancy test timing; negative test with no period | Each matches group C | 13/13 ("matches group C: possible pregnancy and testing"; cases in `test/fixtures/heldCases.js`) | Pass |
| TC-101 | FR-03 | Priority. "I took P2 and my period is late"; "my period is late and I want an abortion" | A, then B, then C: the first gets A, the second B | As expected ("checks the groups in the order A, B, C") | Pass |
| TC-102 | FR-03 | Negative. "Is my period normal", "irregular periods", "period pain", the knowledge-base question "Is my period normal, and when should I see a health worker?", "is it normal for my period to be irregular", "how do I deal with period cramps" | No match | 6/6 unmatched ("leaves general period questions alone"; the first four also in the no-match fixture) | Pass |
| TC-103 | FR-03 | Group C reply (provisional, pending clinician sign-off) and pipeline | Exactly the provisional wording; `outcome: "held"`, `kind: "held-topic"`, `heldTopicGroup: "C"`, no `/classify` or `/retrieve` | As expected ("uses the provisional wording for group C"; "returns the group's signpost without classifying or retrieving") | Pass |
| TC-104 | FR-03 | Live, gateway and `ml_service` v3, gate on, before and after group C: demo-risk (20, **non-blind**), example questions (13), labelled development set (35), DR-04 (31), and the knowledge-base question "Is my period normal, and when should I see a health worker?" | No example question caught; no query answered correctly before is caught; the knowledge-base question still answered | Newly caught by C: demo-risk #15, #16, #17; examples 0/13; development Q27, Q29 (Q27 got KB-P1, acceptable KB-G3; Q29 no answer); DR-04 #10 (KB-P5). None answered correctly before. The knowledge-base question gets KB-G3. No other reply changed ([`held-topics-c-proof.csv`](held-topics-c-proof.csv), [DL](../decision-log.md#held-topic-group-c-possible-pregnancy-and-testing-2026-10-20)) | Pass |
| TC-105 | NFR (offline) | Offline: group C in `offlinePipeline.ts` and parity | Same patterns, reply and results on every shared case; the offline pipeline gives the group C signpost | As expected (`offlineSafetyParity.test.js`, held-topic parity, now with the group C cases; `offlinePipeline.test.ts`, Test 9) | Pass |
| TC-106 | FR-05, NFR (privacy) | Quick exit: the Exit action | In-memory chat and screen state cleared, then sessionStorage, then `location.replace` called with `EXIT_URL` ("https://www.google.com", one constant) | As expected (`quickExit.test.ts`, Tests 1 and 2) | Pass |
| TC-107 | FR-05, NFR (privacy) | Exception. sessionStorage throws or is missing; the state reset throws | The page is still replaced with `EXIT_URL` | As expected (`quickExit.test.ts`, Tests 3 and 4) | Pass |
| TC-108 | FR-05 | Escape pressed twice, 400 ms apart and exactly 1000 ms apart | Exit runs once each time | As expected (`quickExit.test.ts`, Test 5) | Pass |
| TC-109 | FR-05 | Negative. One Escape; two Escapes 1001 ms apart; another key between two Escapes; three quick Escapes | No exit, except that a new window starts after a slow press; three quick presses exit once | As expected (`quickExit.test.ts`, Tests 6 and 7) | Pass |
| TC-110 | FR-05 | The header on every screen and reply kind that exists today (disclaimer; chat empty, answer, no answer, help, vague, held, limited mode; referral; session end), as App.tsx composes them in `AppShell` | The wordmark, a Help button and a visible Exit button (not in a menu) before the content; App wires Exit to `location.replace` and double Escape to a keydown listener, never `window.close` | As expected (`components.test.tsx`, Tests 2, 19 and 21) | Pass |
| TC-111 | FR-04 | The footer line "In danger? Call … free and open 24 hours." on the same screens | Exactly once on every screen; its `tel:` link equals `telHref(GBV_HELPLINE)`; on chat screens directly above the ask bar; no component types a phone number | As expected (`components.test.tsx`, Tests 19 and 20) | Pass |
| TC-112 | NFR (accessibility) | Control edges and the shell's new colour pairs | Every control has a 3:1 edge or fill (chips and the dialog's close button moved off the light card border); the control border 3:1 or more on every light surface; plum and white on plum 4.5:1 or more | Control border 3.10:1 at worst (lilac glow); plum 10.59:1; white on plum 14.32:1 (`styles/tokens.test.ts`, Test 6) | Pass |
| TC-113 | FR-05 | Escape rules with a panel open: Escape closes the Help sheet, then another Escape within 1 s; and two Escapes with nothing open | The closing Escape does not count, so the next one does not exit; two Escapes with nothing open exit | As expected (`quickExit.test.ts`, Test 8; `components.test.tsx`, Test 25). The first browser run found the closing Escape counted (React re-renders before a bubbling window listener runs); fixed by listening in the capture phase, then the browser check passed | Pass |
| TC-114 | FR-05 | Splash once per session: new session, continue, reload, new session | Splash, then home; a reload in the same session skips it; a new session shows it again | As expected (`splashSession.test.ts`, Tests 1 and 2; browser check) | Pass |
| TC-115 | FR-05 | Exception. sessionStorage blocked (getter throws; getItem and setItem throw; none) | The splash shows on every load and Continue still works, with no error | As expected (`splashSession.test.ts`, Test 3; browser check with sessionStorage blocked: no page error) | Pass |
| TC-116 | FR-05 | "I understand, continue" | Leads to home and remembers the splash for the session | As expected (`splashSession.test.ts`, Test 1; `components.test.tsx`, Test 25; browser check) | Pass |
| TC-117 | FR-05 | Exit on the splash and inside the open Help sheet | Both replace the page with `EXIT_URL`; Back does not return to SafeGirl | As expected (`components.test.tsx`, Tests 22 and 23; browser check) | Pass |
| TC-118 | FR-05 | Splash content | Tagline, the three promises, the privacy line "We don't save your questions or your answers." kept from the disclaimer, a 58px "I understand, continue" button, the footer line on the dark surface, the wordmark as `<h1>` | As expected (`components.test.tsx`, Tests 6 and 22; browser check: 58px) | Pass |
| TC-119 | NFR (accessibility) | Help sheet focus: open, Tab and Shift+Tab 20 times, Escape | Focus moves to the close button; never leaves the sheet; Escape closes it and focus returns to the Help button; `role="dialog"`, `aria-modal`, labelled | As expected (`focusTrap.test.ts`; `components.test.tsx`, Tests 23 and 25; browser check: 9 distinct stops, all inside) | Pass |
| TC-120 | FR-04 | Help sheet numbers | Every `tel:` link and number from the constants (1195, 116, 999, 112); no other helpline; the 116 line states no cost or age; no component types a number | As expected (`components.test.tsx`, Tests 20 and 23) | Pass |
| TC-121 | FR-05 | Copy on the splash, Help sheet, support panel, session end and chat | No claim that content is clinician reviewed | As expected (`components.test.tsx`, Test 24) | Pass |
| TC-122 | NFR (accessibility) | Splash contrast | White text and the white focus ring 4.5:1 or more on both ends of the plum-to-orchid gradient; plum on the white button 4.5:1 or more; the button's edge 3:1 or more | White 4.71:1 at the orchid end; plum on white 14.32:1 (`styles/tokens.test.ts`, Test 7) | Pass |
| TC-123 | FR-05 | The splash as a full-bleed screen | No app header and no Help button; exactly one `<h1>` (the wordmark); a compact Exit pill above the hidden decoration; the shared mark at 84px; the three promises; privacy line, button and footer line in that order | As expected (`components.test.tsx`, Tests 21 and 22; browser check at 320, 360 and 390px: no sideways scroll, full width, pill 69x44, button 58px) | Pass |
| TC-124 | FR-05 | Quick exit from the splash | Double Escape and the Exit pill both leave for `EXIT_URL`; the first Tab stop is the pill, with the white focus ring | As expected (`components.test.tsx`, Test 21: one listener for every screen; browser check) | Pass |
| TC-125 | FR-05 | The sources line | One constant, "Most answers come from Kenyan Ministry of Health and WHO guidance.", used on the splash and in the Help sheet; no file retypes it; the old wording is gone | As expected (`components.test.tsx`, Test 26) | Pass |
| TC-126 | NFR (design) | The shield-and-heart mark | One shared component in the header (gradient tile, white shield and heart) and on the splash (light tile, violet shield, rose heart) | As expected (`components.test.tsx`, Tests 22 and 27; browser check after Continue) | Pass |
| TC-127 | NFR (accessibility) | Splash contrast, worst case (lightest stop with a glow on top) | Text 4.5:1 or more; edges and the focus ring 3:1 or more | White 5.01; glass cards and Exit pill 4.52 (fill darkened from 14% to 7%); tagline #F6E9FF 4.95 (the rose glow ends above it, measured); button text 10.95; icons 6.04 or more; header mark 4.60 (`styles/tokens.test.ts`, Tests 7 and 8) | Pass |
| TC-128 | FR-03 | Home's hero | One `<h1>` ("Ask about your body, periods, pregnancy or sex."); the shared sources line, then "This can't diagnose you."; the "Private and anonymous" tag with its lock icon | As expected (`components.test.tsx`, Tests 5 and 28) | Pass |
| TC-129 | FR-01 | The ask pill | One input with the hidden label "Type your question", a send button labelled "Ask"; exactly one input before and after the first question; asking from the hero runs the full pipeline | As expected (`components.test.tsx`, Tests 17 and 28; browser check: "What can I do about period pain?" got KB-G4 through the live gateway and `ml_service`) | Pass |
| TC-130 | FR-03 | Topic tiles | Four buttons with the labels, classes and subtitles of `content/topics.ts`, subtitles 3 to 5 words, at least 88px tall; a tile focuses the ask bar until step 5 | As expected (`components.test.tsx`, Test 28; browser check: tiles 135 to 137px tall, a tile focuses the input) | Pass |
| TC-131 | FR-03 | Placeholder examples | Each is a knowledge-base question, from neither DR-04 nor the demo-risk set, retrieved as its own entry, and answered with it by the full pipeline without `ml_service` | As expected (`app/gateway/test/homeExamples.test.js`, 5 tests); live with `ml_service`, all six get their own entry | Pass |
| TC-132 | NFR (accessibility) | Placeholder rotation | Every 6 s to the next example and wrapping; none with reduced motion; the input not inside a live region | As expected (`placeholderRotation.test.ts`; `components.test.tsx`, Test 28; browser check with and without reduced motion) | Pass |
| TC-133 | FR-04, FR-05 | Exit and the footer line on Home; the first screen | Both present; at 390x844 the footer line shows without scrolling | As expected (`components.test.tsx`, Tests 19 and 28; browser check: the line ends at 813 of 844px) | Pass |
| TC-134 | NFR (accessibility) | Home contrast | Text 4.5:1 or more, edges, icons and the focus ring 3:1 or more | Tag pill 4.94; hero text 6.32; placeholder 6.80; send arrow 4.71; tile edges 3.02 to 3.09; icons on tints 4.84 to 5.47; subtitles 6.80; footer 5.03 (`styles/tokens.test.ts`, Test 9) | Pass |
| TC-135 | NFR (offline) | Home's examples offline | Each gets the general answer for its own entry's category; no rule intercepts it | As expected (`offlinePipeline.test.ts`, Test 11) | Pass |
| TC-136 | FR-03 | Each Home tile and each Help sheet topic button | Opens the Topic list of its own class; the Help sheet closes | As expected (browser check: 4 tiles and 4 sheet buttons; `components.test.tsx`, Test 30) | Pass |
| TC-137 | FR-03 | The list for each class | "N questions" with N from the data (general 7, pregnancy 4, contraception 5, STIs 5); one row button per knowledge-base question of the class, its accessible name the question text, at least 44px tall | As expected (`components.test.tsx`, Test 29; browser check: rows 52px or taller) | Pass |
| TC-138 | FR-01, FR-02 | Tapping each of the 21 questions | The exact question text goes through the full pipeline (request body exactly `{"text": …}`) | As expected for all 21 (browser check). 20 return their own entry; KB-P1 returns KB-G3 (classed general 0.852, similarity 0.8453) and stays listed | Pass |
| TC-139 | FR-01 | The Topic list's ask bar ("what is PrEP" asked from the Pregnancy list) | Not scoped to the topic: the body is `{"text": "what is PrEP"}` and the PrEP answer comes back | As expected (browser check; `components.test.tsx`, Test 30) | Pass |
| TC-140 | NFR (accessibility) | Focus on the Topic list and screen changes | Focus to the h1 on open; "All topics" returns focus to the opening tile, or to Help; Home's h1 and the referral heading take focus when they appear | As expected (browser check; `components.test.tsx`, Tests 29 and 30) | Pass |
| TC-141 | FR-04, FR-05 | The Topic list's frame | One h1; Exit in the header; the footer line under the list, directly above the ask bar; no sideways scroll at 390px | As expected (`components.test.tsx`, Test 29; browser check) | Pass |
| TC-142 | NFR (privacy) | The questions data | Generated from the active knowledge base, up to date, with id, class and question only (no answers) | As expected (`app/gateway/test/kbQuestions.test.js`, 3 tests; `build-kb-questions.js --check`) | Pass |
| TC-143 | NFR (accessibility) | Topic list contrast | Text 4.5:1 or more; edges, icons and the focus ring 3:1 or more | Back link 5.25; h1 10.59; count 5.03; rows 16.52; card edge 3.10; chevron 5.16; ring 7.10 (`styles/tokens.test.ts`, Test 10) | Pass |
| TC-144 | FR-03 | An answer-scoped reply (KB-S5, "Can STIs be cured, and can they harm me if I leave them?") | The matched question is the h1 under "The closest question I have"; her own text is not shown as it | As expected (`components.test.tsx`, Test 31; browser check, live gateway) | Pass |
| TC-145 | FR-03 | The answer text | Equal to the response's text, line breaks kept | As expected (Test 31; browser check: KB-S5 equals the response and the knowledge base) | Pass |
| TC-146 | FR-03 | The source line, with and without `source` in the response | "Source: " and the response's source; no line (nothing invented) when the response has none | As expected (Test 32; browser check: all 21 live answers carry a source) | Pass |
| TC-147 | NFR (safety) | The disclaimer under every answer | The one shared constant `ANSWER_DISCLAIMER` | As expected (Test 32) | Pass |
| TC-148 | NFR (safety) | The answer screen, details off and on | No confidence, "strong match", similarity or score anywhere in the DOM | As expected (Test 33; browser check) | Pass |
| TC-149 | FR-03 | Related questions for each of the 21 matched entries | Two other questions of the same class (fewer if the class has fewer), never the matched one | As expected (Test 34; browser check for KB-S5) | Pass |
| TC-150 | FR-01 | Tapping a related question | Its exact text goes through the full pipeline (body exactly `{"text": …}`) and the new answer replaces the last | As expected (Test 34; browser check) | Pass |
| TC-151 | NFR (accessibility) | The back link from Home and from a Topic list | "Back to home" to Home (focus on its h1); "Back to <topic>" to that list with focus on the tapped row; 44px tall | As expected (Test 35; browser check for KB-S5 and KB-G7) | Pass |
| TC-152 | FR-01 | The answer screen's ask bar | Labelled "Ask something else"; sends the text only, never scoped | As expected (Test 35; browser check: `{"text": "what is PrEP"}`) | Pass |
| TC-153 | FR-04, FR-05 | The answer screen's frame; the latest exchange only | Exit in the header; the footer line directly above the ask bar; a new question replaces the last exchange | As expected (Tests 16, 19 and 35; browser check) | Pass |
| TC-154 | NFR (accessibility) | A new answer arriving | Focus moves to the h1; one polite live region says "New answer." once; the answer is in no live region; headings h1, h2, h2 | As expected (Test 36; browser check) | Pass |
| TC-155 | NFR (accessibility) | Answer screen contrast | Text 4.5:1 or more; focus ring 3:1 or more | Label 7.35; matched question 13.52; ring on its card 5.81; "Answer" pill 7.54; answer 16.52; source and disclaimer 6.80; "Related questions" 10.59; dock line 16.52 and link 7.10 (`styles/tokens.test.ts`, Test 11) | Pass |
| TC-156 | FR-03 | The rule tests' example-question set, rebuilt from the 21 knowledge-base questions | The vague rule intercepts none; the help, vague and held rules agree offline and online on every case, held-topic inputs included | 0/21 intercepted (`vagueQuery.test.js`); parity tests pass | Pass |
| TC-157 | NFR (usability) | Layout at 390 by 844 | KB-S5's whole card fits above the dock; the longest entry (KB-G7, 443 characters) scrolls with the footer line and ask bar in view, nothing hidden at the end; no sideways scroll | As expected (browser check; `answer-after.png`, `answer-long-after.png`) | Pass |
| TC-158 | NFR (accessibility) | Each reply kind: clarify, held A, B and C, help, no answer, referral (abuse and self-harm), the limited-mode plain view, the session end | Exactly one h1, the reply text exactly; focus moves to it on arrival | As expected (`components.test.tsx`, Test 37; browser check, live gateway) | Pass |
| TC-159 | NFR (privacy) | Her question on each reply, tested with `<b>x</b>` | Shown as plain text under "You asked" on clarify and no answer only; not on held, help or referral, nor while loading, after an error or after a referral | As expected (Test 38; browser check: shown as typed, no `<b>` element) | Pass |
| TC-160 | FR-04 | Call buttons on held, help and referral | GBV helpline then Childline Kenya; `tel:` hrefs equal the constants; descriptions from `SUPPORT_SECTIONS`; 44px or taller (58px minimum, 69px measured); help and referral add the emergency line from `EMERGENCY_NUMBERS` | As expected (Test 39; browser check) | Pass |
| TC-161 | FR-03 | The four topic buttons (clarify) and pills (no answer) | Each opens its own Topic list; back returns to the reply with focus on that button | As expected for all eight (Test 40; browser check) | Pass |
| TC-162 | FR-05 | Exit and the footer line on every reply screen | Exit in the header; the footer line once, directly above the ask bar (after "Continue chat" on the referral); beside a call button it points to the button without repeating the number | As expected (Tests 19 and 41; browser check) | Pass |
| TC-163 | NFR (safety) | Score, confidence and the details line on the reply screens, `?details=1` off and on | None on any reply screen; the details line only in the plain view, only with `?details=1` | As expected (Test 42; browser check with `?details=1`) | Pass |
| TC-164 | NFR (accessibility) | Announcements | One polite live region outside the screens names each reply once; no reply text in a live region; the referral's alert removed | As expected (Test 43; browser check) | Pass |
| TC-165 | NFR (accessibility) | Reply screen contrast | Text 4.5:1 or more; edges and focus rings 3:1 or more | Clarify text 13.60, pill 8.24, button edge 3.45; held text 7.15, 116 edge 3.80; white on the lightest dark stop 8.24, 116 glass text 6.43, its edge 4.31 and 5.52; no-answer text 8.41, pill edge 3.68 (`styles/tokens.test.ts`, Test 12) | Pass |
| TC-166 | NFR (usability) | The four topic buttons (clarify) and pills (no answer, Help sheet) at 320, 360, 390 and 430px | Every button inside its card and the viewport; each label fully visible (label `scrollWidth` ≤ `clientWidth`); no word broken; 44px or taller | As expected at all four widths (browser check; `clarify-fixed-320.png`, `clarify-fixed-390.png`, `noanswer-fixed-320.png`) | Pass |
| TC-167 | NFR (usability) | Clarify, held, help, referral, no answer and the Help sheet at 320, 360, 390 and 430px | `scrollWidth` ≤ `innerWidth`; no element past the viewport or clipped | As expected on all 24 (browser check; `held-fixed-320.png`, `help-fixed-320.png`, `referral-fixed-320.png`) | Pass |
| TC-168 | FR-03 | Each topic button and pill at each width | Opens its own Topic list | As expected: 32 of 32 on clarify and no answer, and the Help sheet's STIs pill at each width (browser check) | Pass |
| TC-169 | NFR (accessibility) | The footer line and the emergency line when they wrap | Line-height 1.35; each phone link keeps a 44px-tall tap area | As expected at all four widths (browser check: the link is hit 20px above and below its centre; `components.test.tsx`, Test 44) | Pass |
| TC-170 | NFR (maintainability) | Where the four topics appear | One shared component and one set of grid rules (`TopicChoices`) on clarify, no answer and the Help sheet | As expected (`components.test.tsx`, Tests 23, 40 and 44) | Pass |
| TC-171 | FR-03 | Three vague or abstain replies in a row | The 1st and 2nd show their own screens; the 3rd shows Talk to a person; a 4th shows it again | As expected (`loopLimit.test.ts`, Test 2; browser check with a mocked gateway: clarify, clarify, person, then person) | Pass |
| TC-172 | FR-03 | What resets the count | An answer, help, held-topic or referral reply, a limited-mode answer, opening a Topic list, "Ask a different question", a new session and quick exit all reset it | As expected (`loopLimit.test.ts`, Tests 3 and 5; browser check for answer, help, held, Topic list and Ask a different question) | Pass |
| TC-173 | FR-04 | Help, held-topic and referral replies at or above the limit | Never replaced, counted or delayed | As expected (`loopLimit.test.ts`, Test 4) | Pass |
| TC-174 | NFR (privacy) | Browser storage during the loop | Nothing written to localStorage or sessionStorage (only the splash flag, as before) | As expected (`loopLimit.test.ts`, Test 6; browser check: localStorage `{}`, sessionStorage only `safegirl.splashSeen`) | Pass |
| TC-175 | NFR (accessibility) | The Talk to a person screen | One h1 (the message) with focus, announced once; no echo; "See who can help" opens the Help sheet; the four pills open their Topic lists; Exit and the footer line | As expected (`components.test.tsx`, Test 45; browser check) | Pass |
| TC-176 | NFR (usability) | The Talk to a person screen at 320, 360, 390 and 430px | `scrollWidth` ≤ `innerWidth`; pills inside the card; labels fully visible | As expected (browser check; `person-after-320.png`, `person-after-390.png`) | Pass |
| TC-177 | NFR (accessibility) | Talk to a person contrast | Text 4.5:1 or more; edges and focus ring 3:1 or more | Message 8.41; pill 9.59; button text 14.32; its edge 12.56; focus ring 6.23; pill edges 3.68 (`styles/tokens.test.ts`, Test 13) | Pass |
| TC-178 | FR-01, FR-04 | Mocked gateway: after a clarify reply, a help phrase and a Safety Net phrase from the shared test lists | The help reply, then the referral | As expected (`askFlow.test.ts`, Test 1; browser check) | Pass |
| TC-179 | FR-01 | Mocked gateway: after an answer, a held-topic query | The held reply (group A) | As expected (`askFlow.test.ts`, Test 2; browser check) | Pass |
| TC-180 | FR-01 | Mocked gateway: a question typed after opening a Topic list and returning | The body is exactly `{"text": …}`: no topic or scope | As expected (`askFlow.test.ts`, Test 3; browser check) | Pass |
| TC-181 | FR-06 | Mocked gateway: a sequence of questions | No request carries the previous query or reply | As expected (`askFlow.test.ts`, Test 4; browser check) | Pass |
| TC-182 | FR-01 | The ask bar | Enter submits; disabled while empty or loading; one request at a time; cleared after sending; focus to the reply's h1 | As expected (`askFlow.test.ts`, Test 5; browser check: a second Enter while loading sent nothing) | Pass |
| TC-183 | FR-01, FR-04 | Live, synthetic: "Am I okay?", then "I want to kill myself", then "What can I do about period pain?" | vague, referral, an answer; each body only `{ text }` | vague (clarify), referral, answer-scoped (browser check, live gateway and `ml_service`) | Pass |
| TC-184 | NFR (accessibility) | axe-core 4.10.2 (WCAG 2.0 to 2.2 A/AA, best practice) on 14 screens at 390 and 320px | No violations | 0 violations on all 28 scans; colour contrast "incomplete" on gradients, covered by TC-196 (`evidence/axe/`) | Pass |
| TC-185 | NFR (accessibility) | Keyboard on every screen | Every control reached by Tab in DOM order; visible focus ring on each; no trap; Escape closes the Help sheet and returns focus to Help; double Escape exits | As expected on all 14 screens (`evidence/a11y-checks.json`) | Pass |
| TC-186 | NFR (accessibility) | Focus hidden by the docked ask bar (WCAG 2.4.11), before fixes | No focused control entirely hidden | A related question (answer, 390px) and Call 116 (held and help, 200% zoom) were entirely under the dock | Fail |
| TC-187 | NFR (accessibility) | Retest of TC-186 after the fix | No focused control entirely hidden | None hidden on 14 screens at 390px and at 200% zoom | Pass |
| TC-188 | NFR (accessibility) | Structure on every screen | One h1; one main; at most one header and one nav; the ask bar named; one live region per reply, never holding reply text | As expected on all 14 screens | Pass |
| TC-189 | NFR (accessibility) | Target size at 390px | Every control 44 by 44 CSS px or more (inline phone links by their tap area) | None smaller on 14 screens | Pass |
| TC-190 | NFR (accessibility) | Reflow at 320px | No horizontal scroll | None on 14 screens | Pass |
| TC-191 | NFR (accessibility) | 200% zoom (195 CSS px), before fixes | No horizontal scroll; nothing lost or overlapping | 13 screens 299px wide (header, Home tiles); the splash wordmark clipped | Fail |
| TC-192 | NFR (accessibility) | Retest of TC-191 after the fixes | As TC-191 | No scroll, overlap or clipping on 14 screens (`evidence/zoom/`) | Pass |
| TC-193 | NFR (accessibility) | Text-only 200% (default font size 32px), before fixes | No horizontal scroll; nothing lost or overlapping | 13 screens 443px wide (header actions) | Fail |
| TC-194 | NFR (accessibility) | Retest of TC-193 after the fixes | As TC-193 | No scroll, overlap or clipping on 14 screens. Text set in px does not grow (audit UI-23, open) | Pass |
| TC-195 | NFR (accessibility) | prefers-reduced-motion | No animation or transition on the splash, while loading, or with the sparkle | 0 running with reduce; only the loading dots without it | Pass |
| TC-196 | NFR (accessibility) | Contrast of every token pair | Text 4.5:1, edges, icons and focus 3:1 | All 109 pairs pass; lowest 3.02 (tile edge) and 4.52 (text) (`evidence/contrast.txt`) | Pass |
| TC-197 | NFR (accessibility) | Page language and phone-link names, before fixes | `lang` set; every `tel:` link named with its service | `lang="en"`; links named only "1195", "999", "112", "Call 1195", "Call 116" | Fail |
| TC-198 | NFR (accessibility) | Retest of TC-197 after the fix | As TC-197 | Every link named with its service in Chrome's accessibility tree ("1195, GBV helpline") | Pass |
| TC-199 | NFR (performance) | Lighthouse 12.3.0 mobile on Home, three runs | Scores recorded, failing audits listed | 98, 100, 100, 91 in all three; FCP 1.8 s, LCP 2.0 s, TBT 0 ms, CLS 0.023; SEO fails `robots-txt` (UI-18) | Pass |
| TC-200 | NFR (performance) | Lighthouse 12.3.0 user flow on the answer screen, three runs | Scores recorded | Time span performance 100; snapshot 100, 100, 80 (`robots-txt`) in all three; TBT 50, 50, 60 ms | Pass |
| TC-201 | NFR (installability) | Lighthouse 11.7.1 PWA checks on Home, three runs | Installable | 100 in all three runs | Pass |
| TC-202 | FR-01 | Home's hero, ask card and footer card | The "Private and anonymous" pill with a lock above the h1; the visible label "Type your question" tied to the field; the anonymous line and the footer line in the footer card; End session directly below it | As expected (`components.test.tsx`, Test 48; browser check at 320, 360, 390 and 430px) | Pass |
| TC-203 | NFR (accessibility) | Home's send button | Named "Get an answer"; disabled while the field is empty or only spaces, enabled with text; disabled, still a mid-violet button at full opacity | As expected (Test 48; browser check: #8B5CF6, opacity 1, 48 by 48) | Pass |
| TC-204 | FR-03 | Topic cards | Labels and classes unchanged; the new subtitles; each card opens its Topic list; coloured edges kept | As expected (Test 48; browser check at all four widths) | Pass |
| TC-205 | FR-05 | The footer card's 1195 link | `tel:` href from the constant; 44px tap area | As expected (Test 48; browser check) | Pass |
| TC-206 | NFR (usability) | Home at 320, 360, 390 and 430px | No horizontal overflow; no clipped text or broken word; the sparkle touches no text; nothing under the header; header on one row; gutters 20px (16px under 360px) | As expected (browser check; `home-after-4b-390.png`, `home-after-4b-320.png`). Step 7b and step 9 checks re-run: no regressions | Pass |
| TC-207 | NFR (accessibility) | Home contrast | Text 4.5:1; control edges, icons and focus 3:1 | Headline 4.71 (over the circles); paragraph 4.52; pill 7.88; label 6.80; field edge 3.69 (design value 1.37, darkened); placeholder 6.17; typed text 15.00; send arrow 4.71, disabled 4.23; footer text 9.35, link 6.16; subtitle 6.80 (`styles/tokens.test.ts`, Test 14) | Pass |
| TC-208 | FR-03 | The Topic list's header card and footnote | The icon tile, the h1 and "Tap a question to read the answer."; the count for screen readers only; the footnote under the list | As expected (`components.test.tsx`, Test 50; browser check at 320, 360, 390 and 430px) | Pass |
| TC-209 | NFR (accessibility) | Programmatic focus | The h1 focused when a screen or reply arrives shows no ring; a Tab-focused question row does | As expected on the Topic list and the answer screen at all four widths (browser check; Test 50) | Pass |
| TC-210 | FR-01, FR-05 | The bottom of the Topic list and the answer screen | The footer line (tel: link from the constant, 44px tap area), then a white ask pill; no panel, not sticky; placeholders "Or type your own question" and "Ask something else…"; send named "Ask"; End session below it on the answer screen | As expected (Test 50; browser check) | Pass |
| TC-211 | NFR (usability) | Both screens at 320, 360, 390 and 430px (a short and a long answer) | No horizontal overflow, nothing clipped, gutters 20px (16px under 360px) | As expected (browser check; `topic-after-6b-*.png`, `answer-after-6b-*.png`, `answer-long-after-6b-390.png`); step 7b and step 9 checks re-run with no regressions | Pass |
| TC-212 | NFR (accessibility) | Step 6b contrast | Text 4.5:1; control edges and icons 3:1 | Topic h1 11.02; hint 8.30; question card edge 4.06 against the rows, 3.00 on the page (design value 1.38, darkened); footnote 5.03; footer line 7.97; closest label 7.35; Answer pill 7.54; source 6.80; ask pill edge 3.00 on the page (`styles/tokens.test.ts`, Test 16) | Pass |

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
