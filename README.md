# SafeGirl

**Privacy-preserving digital mentorship for adolescent reproductive health in Nairobi's informal settlements.**

SafeGirl is an academic research prototype investigating whether a fine-tuned multilingual intent classifier can improve the routing of adolescent sexual and reproductive health (SRH) questions to an appropriate knowledge category, compared with a frozen, interpretable keyword baseline.

The system is designed around an anonymous, session-based privacy architecture with **no user accounts, no login for core functionality, and no persisted conversation data**.

> **Research prototype:** SafeGirl is not a deployed healthcare service, diagnostic system, or replacement for professional medical or crisis support. It runs as a local demo only and has not been used by real adolescents.

---

## Research Question

> **Does a fine-tuned multilingual DistilBERT intent classifier improve category routing for adolescent SRH queries compared with a frozen keyword-based baseline, while keeping the surrounding privacy and safety architecture constant?**

The classifier is evaluated as a **retrieval-routing component**, rather than as a clinical or diagnostic decision-making system.

The primary comparison is:

```text
Frozen Keyword Baseline                 Fine-tuned DistilBERT (V3 in the app)
        │                                         │
        ▼                                         ▼
   Category Routing                          Category Routing
        │                                         │
        ▼                                         ▼
     Retrieval                                 Retrieval
```

The surrounding safety and privacy architecture is kept separate from the classifier evaluation.

---

## Status at a Glance

| Component | Status |
| --- | --- |
| Keyword baseline classifier | ✅ Frozen (2026-08-27) |
| DistilBERT classifier (V3) | ✅ Trained: 5-fold CV and final retrain. A fresh independent expert test of V3 is **pending** (DR-04 was reused, non-blind; see [Model results](#model-results)) |
| Backend (gateway) | ✅ 342 `node:test` tests plus 6 integration check groups, all passing |
| Frontend (interface) | ✅ 6 test suites; typecheck, lint, format check and build pass |
| `ml_service` (FastAPI) | ✅ `/health`, `/classify` (V3), `/retrieve` (semantic, 21 KB entries); a separate local process |
| RAG generation (Gemini) | ⛔ Not implemented: answers are the retrieved knowledge-base text (extractive) |
| Semantic retrieval | ✅ `intfloat/multilingual-e5-small` (sentence-transformers) in `ml_service`; keyword overlap only as fallback; LlamaIndex not used |
| Firebase Anonymous Authentication | ✅ Gateway token verification and in-memory anonymous sign-in |
| GBV informational content | ⛔ Deliberately held pending authoritative legal/clinical sourcing |
| CI | ✅ GitHub Actions: backend tests; frontend lint, format, typecheck, tests and build. `ml_service` has no CI job |
| Hosting | ⛔ None. Local demo only |

The classifier checkpoint, thresholds, knowledge base and Safety Net patterns are frozen until after Milestone 2 (see [`docs/decision-log.md`](docs/decision-log.md#demo-freeze-until-after-milestone-2-2026-10-15)).

---

## Research Contribution

SafeGirl focuses on three related design concerns:

### 1. Intent-based retrieval routing

The project evaluates whether a fine-tuned multilingual transformer can route SRH questions more effectively than a simple keyword baseline.

### 2. Privacy-preserving interaction

The architecture is designed to avoid requiring accounts or storing identifiable conversation histories.

The intended core architecture contains:

* No user accounts
* No conventional login
* No persistent conversation history
* No `localStorage` or `sessionStorage` for conversation data
* No `sessions`, `queries`, or `conversations` Firestore collections

### 3. Independent safety detection

Safety detection is deliberately separated from intent classification.

A dedicated **Safety Net** handles distress, GBV, and crisis-related language independently of the classifier. The intent classifier is therefore not responsible for deciding whether a query constitutes a safety event.

This separation is intentional and forms part of the system's safety architecture.

---

## Model Results

### V2 (historical)

| Evaluation | Accuracy | Macro-F1 | Notes |
| --- | ---: | ---: | --- |
| V1, single split | 80.0% | 0.7677 | 55 seeds; historical baseline |
| V2, 5-fold CV | 82.9% | 0.8274 ± 0.0726 | 182 seeds; 910 examples |
| V2, independent expert test | 90.3% | 0.8832 | n=31; one-time blind evaluation (DR-04) |

Source: [`docs/decision-log.md`](docs/decision-log.md) and [`docs/development-log.md`](docs/development-log.md). The V2 cross-validation showed a persistent **General ↔ STI boundary confusion** (46 misclassifications across the pooled 910-example CV set), which the 31-question test set does not exercise. It is documented, not patched.

### V3 (the model in `ml_service`)

| Evaluation | Result | Status |
| --- | --- | --- |
| 5-fold CV (CV pool, 776 examples) | Accuracy 0.8041 ± 0.0427; macro-F1 0.7965 ± 0.0482 | Cross-validation |
| Euphemism hold-out (4 seeds and their paraphrases, 13 examples) | 9/13 correct | Held out from CV and training |
| DR-04 test set (n=31) | 27/31 correct | **Disclosed reuse, non-blind**: DR-04 was already used as V2's blind test |
| Fresh independent expert test | – | **Pending** |

Source: [`research/experiments/logs/v3_1_training_log.txt`](research/experiments/logs/v3_1_training_log.txt) (UTF-16 text). The euphemism and DR-04 counts are the diagonals of the confusion matrices printed there.

On the retrieval **development set** (not an independent test), the frozen keyword baseline classifies better than V3: 28/29 against 20/29 (exact McNemar p = 0.021). V3's weakest class is general, especially period and puberty questions (2 of 8 recognised). See [`research/eval/results/classifier_analysis.md`](research/eval/results/classifier_analysis.md).

---

## Architecture

```text
                         User Query
                             │
                             ▼
                    ┌─────────────────┐
                    │     Gateway     │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │ 1. Safety Net   │  independent safety path
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐  generic help request
                    │ 2. Help rule    │──(not flagged)──► Signposting
                    └────────┬────────┘  (no classifier, no retrieval)
                             ▼
                    ┌─────────────────┐
                    │ 3. Intent       │  DistilBERT V3 (ml_service),
                    │    classifier   │  keyword fallback
                    └────────┬────────┘
                             │
             flagged by the Safety Net? ──yes──► Referral
                             │ no                (classifier result not used)
                             ▼
                    ┌─────────────────┐
                    │    Retrieval    │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │   Generation    │
                    │    (stubbed)    │
                    └────────┬────────┘
                             ▼
                    Response Orchestrator
                             │
                             ▼
                         Response
```

### Request order

Every query is handled in this order:

1. **Safety Net.** Checks for self-harm and suicidal statements, and for violence, abuse, blackmail and threats. Self-harm gets its own referral message.
2. **Help rule.** If the query was not flagged and the whole message is a generic help request that names no topic (for example "Where can I get help?"), the gateway returns help information (`outcome: "signposting"`). The classifier and retrieval do not run, and `ml_service` is not called.
3. **Intent classifier.** Runs for every other query, including flagged ones.
4. **If the Safety Net flagged the query,** the gateway returns the referral message. The classifier has already run, and its prediction is reported in the response (`predictedCategory`) but is not used to answer; retrieval and generation do not run.
5. **Otherwise,** retrieval and generation produce the answer.

The Safety Net is synchronous, so it has always finished before the classifier starts; earlier versions of this README and the architecture diagram described the two as dispatched in parallel.

The Safety Net is not part of the intent classifier's training or evaluation scope.

The diagrams in [`docs/diagrams/`](docs/diagrams/) (the system architecture and the use-case diagram) are partly outdated: they show the request order but not the separate `ml_service` process, so the classifier and semantic retrieval appear as gateway modules although they run in `ml_service`.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend (gateway) | Node.js, Express |
| Frontend (interface) | React, TypeScript, Vite |
| PWA | `vite-plugin-pwa` |
| Model service | Python, FastAPI, uvicorn |
| Classifier | `distilbert-base-multilingual-cased`, fine-tuned (V3) |
| Retrieval | `intfloat/multilingual-e5-small` via sentence-transformers |
| ML framework | Hugging Face Transformers, PyTorch |
| Evaluation | scikit-learn, Node evaluation harness |
| Authentication | Firebase Anonymous Authentication |
| Planned generation | Gemini (not implemented) |
| CI | GitHub Actions |

LlamaIndex, named in the methodology, is not used. Firestore holds no conversation data; see the privacy section below.

---

## Scope

SafeGirl is designed to evaluate:

* Multilingual SRH intent classification
* Category-based retrieval routing
* A frozen keyword baseline versus a fine-tuned transformer
* Privacy-preserving session architecture
* Separation of safety detection from intent classification

SafeGirl is **not**:

* A diagnostic system
* A clinical decision-support system
* A replacement for healthcare professionals
* A crisis-response service
* A deployed healthcare service for minors

---

## Privacy and Safety Design

The privacy architecture is a core design constraint rather than an optional feature.

### Privacy

* **No accounts or login** are required for core functionality.
* Conversation data is not persisted after the session ends.
* The frontend does not use `localStorage` or `sessionStorage` for conversation persistence.
* Firestore does not contain `sessions`, `queries`, or `conversations` collections.
* The system avoids requiring personally identifiable information for core interaction.
* In the current pipeline, query text goes only to the local `ml_service` process. No external API receives it, because generation is stubbed. Adding Gemini would change this and must be assessed as a privacy decision.
* Anonymous sign-in is a request from the browser to Google's Firebase Authentication service, so Google sees the user's IP address at sign-in. No query text is sent to Firebase.

### Safety

* Safety detection is independent of intent classification.
* A change to the classifier cannot directly suppress or alter Safety Net outcomes.
* GBV/crisis language is handled through the independent safety path rather than being treated as an ordinary intent-classification category.
* The Safety Net (`app/gateway/src/safetyNet.js`) has two categories, each with its own referral message:
  * **Self-harm and suicidal statements**, first or third person: wanting to die or not be alive, ending one's life, no point or reason in living, wanting it all to end, hating one's life, hurting or cutting oneself, others being happier or better off without them, suicide. The message acknowledges how the person feels and gives the emergency numbers 999 and 112.
  * **Violence, abuse, blackmail and threats**: being hit, beaten, touched, forced or pressured into sex, including violence against siblings or a parent ("hits us", "beats my mum"); secrecy ("our secret", "don't tell anyone what we do", or "told me not to tell" with touch or sexual words); not feeling safe at home or being afraid to go home; "<family member or partner> will kill me"; being taken to be cut (FGM); requests for nude photos or threats to show or share someone's photos; threats to kill or hurt. The message says it is not the person's fault and gives 999, 112, the GBV helpline 1195 and Childline Kenya 116.

  If both match, the self-harm message is used. Detection is rule-based: text is lowercased, apostrophes are normalised and "@" between letters is read as "a"; the patterns cover common verb forms, SMS spellings and typos, and exclude idioms such as "this exam is killing me", "I am dying to know" and "I want to die laughing". A flagged query skips retrieval and generation.
* **The referral wording is interim and not clinically reviewed. All the numbers it gives (999, 112, 1195, 116) are unverified** (see `HELP_CONTACTS_VERIFIED` under [Configuration](#gateway-configuration)).
* The offline interface uses a port of the same rules (`app/interface/src/offline/safetyNet.ts`) and the same two referral messages and numbers (`app/interface/src/offline/helpContent.ts`). A parity test (`app/gateway/test/offlineSafetyParity.test.js`) fails if the rules, messages, numbers or verified flag drift apart.
* GBV informational content is deliberately held until authoritative legal/clinical sources and appropriate review are available.
* Sheng and English-Swahili code-switched terms are also held from active training until competent review is available rather than being generated speculatively.

The measured Safety Net results and its known misses are under [Known limitations](#known-limitations).

---

## Repository Structure

```text
safegirl/
├── app/
│   ├── gateway/      # Express API: Safety Net, help rule, classification client, retrieval orchestration
│   └── interface/    # React PWA with an offline pipeline
├── ml_service/       # FastAPI: DistilBERT V3 /classify and semantic /retrieve
│   └── final/        # Model checkpoint (not in git; see Getting started)
├── resources/
│   ├── seeds/        # 182 seed questions + fold assignments
│   ├── reviewed/     # Manually reviewed training paraphrases
│   ├── generated/    # AI-generated paraphrases before review (provenance only)
│   ├── test/         # Independent expert-verified test set (DR-04)
│   ├── eval/         # Retrieval development set and Safety Net hold-out sets
│   └── knowledge_base/  # Source-grounded SRH content
├── research/
│   ├── experiments/  # Training notebook, scripts and logs
│   └── eval/         # Evaluation harness, analysis scripts and results/
└── docs/             # Decision and development logs, evaluations, testing, diagrams
```

The `resources/generated/` directory is retained for provenance but is **not accepted as direct training data**. The training pipeline enforces the requirement that training data come from the reviewed dataset.

---

## Getting Started

The app is three local processes: `ml_service` (port 8001), the gateway (port 3001) and the interface's Vite dev server (port 5173). The commands below are for PowerShell on Windows, run from the repository root unless stated.

### Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Git | any recent | |
| Node.js | 20.6 or later (tested with 24.18.1) | 20.6 is needed for `node --env-file` |
| npm | comes with Node (tested with 12.0.2) | |
| Python | **3.12** (tested with 3.12.10) | For `ml_service` |
| Firebase project | with Anonymous Authentication enabled | The interface signs in before every online query |
| Model checkpoint | `ml_service/final/` | Not in git; see below |

A CUDA GPU or Google Colab is needed only to retrain the classifier, not to run the app.

### 1. Clone the development branch

```powershell
git clone https://github.com/captainblissdev/safegirl.git
cd safegirl
git checkout development
```

### 2. `ml_service`: virtual environment and checkpoint

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml_service\requirements.txt
```

`ml_service/requirements.txt` pins the direct dependencies to the versions that produced the results in `research/eval/results/`.

**Model checkpoint.** `ml_service/final/` is git-ignored and must be copied in by hand from `<CHECKPOINT_LOCATION>`. It must contain `config.json`, `model.safetensors`, `tokenizer.json`, `tokenizer_config.json` and `training_args.bin`. The frozen checkpoint's `model.safetensors` has SHA-256 `e8bf2e3aa01c920197b51071e736ef6a3d1f16a57dd8d3bdb1565f75152cfb30`; check it with:

```powershell
Get-FileHash ml_service\final\model.safetensors -Algorithm SHA256
```

The retrieval model (`intfloat/multilingual-e5-small`) is downloaded from Hugging Face on the first start and cached.

### 3. Gateway: install and `.env`

```powershell
cd app\gateway
npm install
```

The gateway reads environment variables only; it does not load `.env` files itself. Keep them in `app/gateway/.env` (git-ignored) and start the gateway with `node --env-file=.env server.js`.

For local development:

```dotenv
PORT=3001
NODE_ENV=development
FIREBASE_PROJECT_ID=your-firebase-project-id
```

Or, to test the gateway without Firebase (for example with `curl` or the evaluation harness), replace `FIREBASE_PROJECT_ID` with `AUTH_DISABLED=true`. **Never on a deployed host.**

#### Gateway configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Port the gateway listens on. The interface's dev server sends `/api` to `localhost:3001`, so keep 3001 when using the interface |
| `FIREBASE_PROJECT_ID` | none | Firebase project whose ID tokens are accepted. Required while authentication is enabled; without it the gateway refuses to start |
| `AUTH_DISABLED` | unset | **Local development only.** Exactly `true` disables authentication when `NODE_ENV` is not `production`, and logs a warning at startup. With `NODE_ENV=production` the gateway refuses to start. Any other value leaves authentication on |
| `NODE_ENV` | unset | `production` forbids `AUTH_DISABLED` |
| `CLASSIFIER_SERVICE_URL` | `http://127.0.0.1:8001` | Base URL of `ml_service` |
| `CLASSIFIER_CONFIDENCE_THRESHOLD` | `0.5` | At or above this confidence, retrieval is scoped to the predicted category; below it, retrieval searches all categories. Frozen; leave unset |
| `CLASSIFIER_ABSTAIN_THRESHOLD` | `0.35` | Below this confidence, no retrieval is attempted and the gateway returns its standard "no specific answer" message. Must be below the confidence threshold. Frozen; leave unset |
| `CLASSIFIER_TIMEOUT_MS` | `3000` | Timeout for each request to `ml_service`, in milliseconds |

Empty or invalid values fall back to the defaults, with a logged warning. Each response reports how its answer was found in `retrievalScope`: `scoped`, `unscoped`, `abstained`, or `local` (keyword retrieval).

**`HELP_CONTACTS_VERIFIED` is not an environment variable.** It is a constant in `app/gateway/src/content/helpContent.js` and in the offline copy `app/interface/src/offline/helpContent.ts`, and it is `false`. While it is `false`, the gateway and the interface log a warning at startup that the help numbers (999, 112, 1195, 116) are unverified; it changes nothing else. Putting it in `.env` has no effect. It should be set to `true`, in both files together (the parity test checks they match), only after every number has been confirmed with the services themselves.

**Authentication.** `POST /api/query` requires a Firebase Anonymous Authentication ID token in an `Authorization: Bearer <token>` header; `/health` does not. A missing, malformed, invalid, expired or revoked token returns `401 {"error":"Authentication required."}`. If tokens cannot be checked at all, the gateway returns `503 {"error":"Service temporarily unavailable."}` instead. Only a fixed reason category or an error code is logged, never the token, the error message or the user ID. The gateway needs only the project ID, not a service-account JSON.

**If `ml_service` is down.** The gateway falls back to the keyword classifier and local keyword retrieval, so it keeps answering, but less well: on the development set, keyword retrieval finds the right entry first for 26 of 34 questions against 32 of 34 for `ml_service` unscoped ([summary](research/eval/results/retrieval_eval_2026-10-14-0744_postpatch.summary.md)).

`ml_service` has **no authentication** of its own. Bind it to `127.0.0.1` (as below); if it is exposed, it bypasses the gateway's authentication.

### 4. Interface: install and `.env`

```powershell
cd app\interface
npm install
Copy-Item .env.example .env
```

Fill in `app/interface/.env` from the Firebase console (Project settings, Your apps, Web app config). The variable names are exactly those in `.env.example`:

| Variable | Value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Web app `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` (the same project as the gateway's `FIREBASE_PROJECT_ID`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_SHOW_DETAILS` | `true` to show the demo details line under every answer; otherwise leave empty |

The interface signs in anonymously before every online query, even when the gateway runs with `AUTH_DISABLED=true`, so these values are needed to use the interface. `.env` is git-ignored; never commit it.

**Demo details view.** The chat can show a small grey line under each answer with the response's `category`, `predictedCategory`, `confidence`, `classifierSource`, `retrievalScope` and `source`. It is off by default. Turn it on with `?details=1` in the page URL (for example `http://localhost:5173/?details=1`) or with `VITE_SHOW_DETAILS=true` (a build made this way shows the line to everyone). It is never shown on the referral screen.

### 5. Start the three processes

Use three terminals, in this order.

**Terminal 1, `ml_service`:**

```powershell
cd ml_service
$env:MODEL_DIR = "./final"; $env:KB_PATH = "./knowledge_base.json"
..\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001
```

**Warm up.** Wait until the log says `Application startup complete`, then check:

```powershell
curl.exe -s http://127.0.0.1:8001/health
```

It should return `"status":"ok"`, `"model_version":"v3"`, `"retriever":"ok"` and `"kb_entries":21`. Both models load before the server accepts requests, which took about 45 seconds on a cold start on the test machine (longer on the very first start, while the retrieval model downloads). After that, classify and retrieve calls take well under a second. Until `/health` answers, the gateway falls back to keyword classification.

**Terminal 2, gateway:**

```powershell
cd app\gateway
node --env-file=.env server.js
```

It should print `SafeGirl backend listening on :3001`, plus the unverified help numbers warning.

**Terminal 3, interface:**

```powershell
cd app\interface
npm run dev
```

Open `http://localhost:5173`.

**Quick check without the interface** (gateway started with `AUTH_DISABLED=true`):

```powershell
curl.exe -s -X POST http://127.0.0.1:3001/api/query -H "Content-Type: application/json" -d '{\"text\":\"Which birth control methods can a teenager use?\"}'
```

It should return `"outcome":"grounded_answer"`, `"category":"contraception"` and `"classifierSource":"distilbert"`.

### Production build

```powershell
cd app\interface
npm run build
npm run preview
```

`npm run build` type-checks and builds the PWA, including the service worker.

---

## Testing

None of the automated tests need `ml_service`, a Firebase project or any credentials. Counts were verified on 15 October 2026 on a fresh clone of `development`.

| Suite | Command (from) | Count |
| --- | --- | --- |
| Gateway integration checks and unit tests | `npm test` (`app/gateway`) | 6 integration check groups, then 342 `node:test` tests |
| Gateway lint | `npm run lint` (`app/gateway`) | – |
| Interface tests | `npm test` (`app/interface`) | 6 suites: offline pipeline, query client, timeouts, session, components, font setup |
| Interface typecheck | `npm run typecheck` (`app/interface`) | – |
| Interface lint and format | `npm run lint`, `npm run format:check` (`app/interface`) | – |
| Interface build | `npm run build` (`app/interface`) | – |

Every result, including the evaluations and manual checks, is listed with its source in [`docs/testing/test-log.md`](docs/testing/test-log.md).

### CI

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push and on pull requests to `main`: the gateway tests, and the interface's lint, format check, typecheck, tests and production build. `ml_service` has no CI job; its behaviour is checked through the gateway tests (with a mocked service) and manual end-to-end runs.

### Retrieval evaluation (development set)

`research/eval/run_eval.js` runs every query in `resources/eval/retrieval_eval_set.csv` through the gateway and `ml_service`. The set is a **development set** written by the project owner; it is **not** the independent DR-04 test set, and the two must not be mixed. It needs `ml_service` and a gateway started with `AUTH_DISABLED=true`:

```bash
node research/eval/run_eval.js --gateway http://127.0.0.1:3016 --ml http://127.0.0.1:8002
```

It writes per-query results to `research/eval/results/retrieval_eval_<UTC timestamp>.csv` and a summary (`.summary.md`): results by group, Safety Net recall and false referrals, classifier accuracy, retrieval hit@1/hit@3, failures, and an offline threshold sweep replayed from the recorded confidences. The sweep only reports; it never changes the live thresholds.

---

## Offline and PWA Behaviour

The interface is an installable PWA. The service worker precaches only the app shell (HTML, JS, CSS, icons); `/api` responses are never cached. When the network or the gateway is unavailable, or a query or sign-in times out (20 s and 10 s), the interface answers from its offline pipeline: the same Safety Net rules and referral messages, then a short general answer marked as limited mode. A first visit while offline shows the browser's own error page, because nothing is cached yet. After a session, browser storage holds no query or answer text. Details: [`docs/testing/pwa-audit.md`](docs/testing/pwa-audit.md).

---

## Model Training

Training can be performed in Google Colab or locally using a CUDA-capable GPU, with its own environment (separate from `ml_service`'s).

```text
research/experiments/
├── SafeGirl_V2_Training.ipynb
├── train_classifier.py
└── train_distilbert_v3.py
```

The training pipeline intentionally refuses to train directly from `resources/generated/`. Training data must come from `resources/reviewed/`. This prevents unreviewed AI-generated paraphrases from silently entering the evaluated training pipeline.

---

## Known Limitations

* **The Safety Net is a keyword net, and its measured recall is low.** On the sealed hold-out 3, run once before any rule was changed for it, it caught **6 of 14** disclosures and wrongly referred **2 of 10** non-disclosures. That is the only independent result; every later figure is post-patch, not independent ([`docs/safety-net-evaluation.md`](docs/safety-net-evaluation.md)). It misses indirect disclosures with no recognisable phrase (such as "my stepfather comes to my room at night"), new phrasings, slang, other languages (including Swahili and Sheng) and heavier obfuscation. It over-triggers on some idioms ("my mum will kill me") and on bare "abuse", "forced" and "circumcision". A missed disclosure gets an ordinary, unrelated answer.
* **Answers are extractive.** Generation is stubbed: every answer is the retrieved knowledge-base entry's text, verbatim. The knowledge base has 21 entries; 15 were ratified by the project owner on 6 Oct 2026 and have not had independent clinical review (KB-C3 to KB-C5, KB-S4 to KB-S7, KB-P5 to KB-P7, KB-G3 to KB-G7).
* **V3 is weak on periods and puberty.** On the development set it recognised only 2 of 8 general-class questions, which include period and puberty questions, and it classified worse than the keyword baseline overall (20/29 against 28/29) ([`classifier_analysis.md`](research/eval/results/classifier_analysis.md)). Some of these questions get the right answer only because low confidence sends them to unscoped retrieval ([decision log](docs/decision-log.md#demo-freeze-until-after-milestone-2-2026-10-15)).
* **Scoped retrieval can hide the right entry.** Retrieval is class-scoped when the classifier is confident, so a wrong classification can hide the right entry. On the development set, scoped retrieval found the right entry first for 21 of 34 questions against 32 of 34 unscoped ([summary](research/eval/results/retrieval_eval_2026-10-14-0744_postpatch.summary.md)).
* **No GBV class.** GBV-adjacent queries that the Safety Net does not flag go through ordinary classification and retrieval: in testing they received unrelated answers, and the 0.35 abstain cut-off never fired ([`docs/safety-net-evaluation.md`](docs/safety-net-evaluation.md)).
* **Local demo only.** `ml_service` has no hosted deployment. It runs locally, so a remote demo needs a decision on where it runs.
* **No real adolescent users.** All evaluation used synthetic, owner-written or expert-reviewed questions; nothing has been tested with the intended users.
* **Firebase sees the IP address at sign-in.** Anonymous sign-in is a request to Google, so Google receives the user's IP address. Firebase also keeps one anonymous user record (a uid) per sign-in; automatic cleanup may require upgrading the project to Identity Platform. The Firebase JS SDK records a small daily "heartbeat" (a date and SDK version, no uid, no conversation content) in IndexedDB.
* **Small test sets.** The independent DR-04 set has 31 examples, only 3 of them general; V3's independent expert test is pending.
* **Unverified help numbers and interim referral wording**, as described under the Safety design above.
* **Held content.** GBV informational content and Sheng/English-Swahili code-switched material remain excluded pending competent, authoritative review. The project does not generate authoritative health, legal or clinical content to fill these gaps.

---

## Documentation

* [`docs/decision-log.md`](docs/decision-log.md): research and implementation decisions, with rationale and evaluation caveats
* [`docs/development-log.md`](docs/development-log.md): chronological development record
* [`docs/DR04_record.md`](docs/DR04_record.md): independent test-set provenance and expert review record
* [`docs/safety-net-evaluation.md`](docs/safety-net-evaluation.md): Safety Net method, sealed result and known misses
* [`docs/testing/test-log.md`](docs/testing/test-log.md): every test suite and manual check, with results and sources
* [`docs/testing/pwa-audit.md`](docs/testing/pwa-audit.md): PWA, offline and Lighthouse audit
* [`docs/chapter5-notes.md`](docs/chapter5-notes.md): organised notes for the evaluation chapter
* [`docs/history-rewrite-map.md`](docs/history-rewrite-map.md): old to new commit hashes after the history cleanup
* [`docs/diagrams/`](docs/diagrams/): system architecture and use-case diagrams (partly outdated, see Architecture)

---

## Branching Strategy

```text
main                Stable project state
├── development     Integration of completed work
├── feature/*       New functionality
├── fix/*           Bug fixes
├── refactor/*      Code restructuring
└── chore/*         Tooling, dependencies and maintenance
```

Changes intended for `main` are introduced through pull requests. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`type(scope): description`, for example `fix(safety): narrow the "at" idiom exclusion`).

---

## Academic Context

SafeGirl is a final-year Computer Science capstone project.

The repository accompanies the project's dissertation, and chapter references throughout the documentation correspond to the academic research and implementation process.

The project is maintained as a **research prototype**, with implementation status, experimental limitations, and unresolved findings intentionally documented rather than concealed.

---

## Project Principle

> **Build what can be justified. Measure what can be tested. Document what remains uncertain.**

SafeGirl treats privacy, safety separation, reproducibility, and methodological transparency as first-class engineering requirements.
