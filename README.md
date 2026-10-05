# SafeGirl

**Privacy-preserving digital mentorship for adolescent reproductive health in Nairobi's informal settlements.**

SafeGirl is an academic research prototype investigating whether a fine-tuned multilingual intent classifier can improve the routing of adolescent sexual and reproductive health (SRH) questions to an appropriate knowledge category, compared with a frozen, interpretable keyword baseline.

The system is designed around an anonymous, session-based privacy architecture with **no user accounts, no login for core functionality, and no persisted conversation data**.

> **Research prototype:** SafeGirl is not a deployed healthcare service, diagnostic system, or replacement for professional medical or crisis support. Its knowledge base is an unreviewed draft.

---

## Research Question

> **Does a fine-tuned multilingual DistilBERT intent classifier improve category routing for adolescent SRH queries compared with a frozen keyword-based baseline, while keeping the surrounding privacy and safety architecture constant?**

The classifier is evaluated as a **retrieval-routing component**, rather than as a clinical or diagnostic decision-making system.

The primary comparison is:

```text
Frozen Keyword Baseline
        │
        ▼
   Category Routing
        │
        ▼
     Retrieval
```

versus:

```text
Fine-tuned DistilBERT
        │
        ▼
   Category Routing
        │
        ▼
     Retrieval
```

The surrounding safety and privacy architecture is kept separate from the classifier evaluation.

---

## Status at a Glance

| Component                         | Status                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Keyword baseline classifier       | ✅ Frozen (2026-08-27); also the runtime fallback when `ml_service` is unreachable       |
| DistilBERT classifier (V3)        | ✅ Trained: 5-fold CV, final retrain, and independent test complete                      |
| `ml_service` (FastAPI)            | ✅ `/health`, `/classify` (V3), `/retrieve` (semantic); runs as a separate local process |
| Semantic retrieval                | ✅ `intfloat/multilingual-e5-small`, class-scoped; retrieval evaluation not yet done     |
| Gateway wiring to `ml_service`    | ✅ Implemented with confidence zones and fallback; merge into `development` pending      |
| Backend (gateway)                 | ✅ Working and tested (34 tests)                                                         |
| Frontend                          | ✅ Offline pipeline tests 4/4, builds cleanly; chat interface connected to the gateway is not finished |
| RAG generation (Gemini)           | ⛔ Not implemented: currently stubbed                                                    |
| Firebase Anonymous Authentication | ⛔ Not mounted on the query route                                                        |
| Knowledge base                    | ⚠️ 8 active entries, unreviewed draft; expansion and expert review pending              |
| GBV informational content         | ⛔ Deliberately held pending authoritative legal/clinical sourcing                       |
| Confidence thresholds             | ⚠️ Provisional (0.5 and 0.35); calibration pending in the retrieval evaluation           |
| CI                                | ✅ GitHub Actions: gateway and interface checks (`ml_service` is not covered)            |

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

### V2 (evaluated comparison)

| Evaluation                   |     Accuracy |        Macro-F1 | Notes                             |
| ---------------------------- | -----------: | --------------: | --------------------------------- |
| V1: single split             |        80.0% |          0.7677 | 55 seeds; historical baseline     |
| V2: 5-fold CV                | 82.9% ± 7.0% | 0.8274 ± 0.0726 | 182 seeds; 910 examples           |
| V2: independent expert test  |        90.3% |          0.8832 | n=31; one-time evaluation (DR-04) |

V3 is the checkpoint served by `ml_service`. Its results and the V2 to V3 comparison are recorded in [`docs/decision-log.md`](docs/decision-log.md).

### Known evaluation weakness

The V2 cross-validation evaluation identified a persistent **General ↔ STI boundary confusion**, with 46 misclassifications across the pooled 910-example CV set.

The errors are concentrated in seed questions deliberately probing that boundary, including questions involving discharge, hygiene, and vaccine timing.

The independent test result does **not** establish that this weakness has been resolved. The 31-question independent test set contains no examples exercising this particular confusion boundary and therefore measures a different aspect of performance.

The confusion remains documented and unresolved rather than being patched through post-evaluation retuning.

See [`docs/decision-log.md`](docs/decision-log.md) for the full comparison and evaluation caveats.

---

## Architecture

```text
                         User Query
                             │
                             ▼
                    ┌─────────────────┐
                    │ Gateway (Node)  │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
             ┌─────────────┐   ┌───────────────────────┐
             │ Safety Net  │   │ Intent Router         │
             │             │   │ ml_service /classify  │
             │ Independent │   │ (DistilBERT V3)       │
             │ safety path │   │ fallback: keyword     │
             └──────┬──────┘   └───────────┬───────────┘
                    │                      ▼
              Safety event?     Confidence zones
                    │            >= 0.5        scoped retrieval
                    │            0.35 to 0.5   unscoped retrieval
                    │            < 0.35        abstain (no-answer message)
                    │                      │
                    │                      ▼
                    │           ┌───────────────────────┐
                    │           │ Retrieval             │
                    │           │ ml_service /retrieve  │
                    │           │ (e5 embeddings)       │
                    │           └───────────┬───────────┘
                    │                       ▼
                    │           ┌─────────────┐
                    │           │ Generation  │
                    │           │  (stubbed)  │
                    │           └──────┬──────┘
                    │                  │
                    └────────┬─────────┘
                             ▼
                    Response Orchestrator
                             │
                             ▼
                         Response
```

The Safety Net runs in parallel with classification. A flagged query returns a fixed referral message and skips retrieval and generation.

The Safety Net is not part of the intent classifier's training or evaluation scope.

If `ml_service` is unreachable, the gateway falls back to the keyword classifier and local keyword retrieval, and the request still returns a response.

### Response fields

| Field              | Meaning                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `category`         | Category of the entry actually served                                                       |
| `predictedCategory`| Category the classifier predicted (can differ when retrieval ran unscoped)                  |
| `classifierSource` | `distilbert` or `keyword_fallback`                                                          |
| `confidence`       | Classifier confidence; `null` in keyword fallback                                           |
| `retrievalScope`   | `scoped`, `unscoped`, `abstained`, or `local` (keyword fallback)                            |

Full diagrams, including use case, activity, sequence, class, system architecture, and Firestore data design, are available in [`docs/diagrams/`](docs/diagrams/). Some predate the `ml_service` wiring and have not yet been updated.

---

## Tech Stack

| Layer              | Technology                                              |
| ------------------ | ------------------------------------------------------- |
| Gateway            | Node.js, Express                                        |
| Frontend           | React, TypeScript, Vite                                 |
| PWA                | `vite-plugin-pwa`                                       |
| ML service         | Python, FastAPI                                         |
| Classifier         | `distilbert-base-multilingual-cased`                    |
| Retrieval          | `intfloat/multilingual-e5-small` via sentence-transformers |
| ML framework       | Hugging Face Transformers, PyTorch                      |
| Evaluation         | scikit-learn                                            |
| Data               | Firestore (`knowledge_base` collection)                 |
| Planned generation | Gemini                                                  |
| CI                 | GitHub Actions                                          |

Semantic retrieval is implemented directly with sentence-transformers rather than LlamaIndex, which the methodology originally named. This deviation is recorded in the decision log.

Firestore currently uses a single `knowledge_base` collection by design. See [`docs/diagrams/firestore-data-design-specification.md`](docs/diagrams/firestore-data-design-specification.md).

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

### Safety

* Safety detection is independent of intent classification.
* A change to the classifier cannot directly suppress or alter Safety Net outcomes.
* GBV/crisis language is handled through the independent safety path rather than being treated as an ordinary intent-classification category.
* GBV informational content is deliberately held until authoritative legal/clinical sources and appropriate review are available.
* Sheng and English-Swahili code-switched terms are also held from active training until competent review is available rather than being generated speculatively.

---

## Repository Structure

```text
SafeGirl/
├── app/
│   ├── gateway/
│   │   └── # Express API, safety, classification client, retrieval orchestration
│   │
│   └── interface/
│       └── # React PWA and offline-capable frontend
│
├── ml_service/
│   └── # FastAPI service: /classify, /retrieve, /health; build_kb.py
│
├── resources/
│   ├── seeds/
│   │   └── # 182 seed questions + fold assignments
│   ├── reviewed/
│   │   └── # Manually reviewed training paraphrases
│   ├── generated/
│   │   └── # AI-generated paraphrases before review
│   ├── test/
│   │   └── # Independent expert-verified test set (DR-04)
│   └── knowledge_base/
│       └── # Source-grounded SRH content (markdown is the single source of truth)
│
├── research/
│   └── experiments/
│       └── # Training notebook, scripts, and logs/
│
└── docs/
    ├── diagrams/
    ├── chapter1-introduction-draft.md
    ├── chapter2-*.md
    ├── chapter3-*.md
    ├── chapter4-*.md
    ├── decision-log.md
    ├── development-log.md
    └── dr04-test-set-verification-record.md
```

The `resources/generated/` directory is retained for provenance but is **not accepted as direct training data**. The training pipeline enforces the requirement that training data come from the reviewed dataset.

---

## Getting Started

### Prerequisites

* Node.js 20+
* npm
* Git
* Python 3.10+ for `ml_service` and classifier development/training
* CUDA-capable GPU for local model training, or Google Colab for GPU training

---

### ML service

`ml_service` listens on port 8001. It loads the V3 classifier and the retrieval index at startup.

The knowledge base is built from the markdown files, not edited by hand:

```bash
cd ml_service

python build_kb.py          # writes knowledge_base.json from resources/knowledge_base/*.md
```

<!-- KEEP: the exact PowerShell start command and checkpoint settings already documented on feature/gateway-classifier-wiring -->

Check that it is up with `GET /health`.

---

### Backend

```bash
cd app/gateway

npm install
npm test
node server.js
```

The gateway test suite currently contains 34 tests.

<!-- KEEP: the environment-variable table (ml_service URL, scoped threshold, abstain threshold, timeouts) already documented on feature/gateway-classifier-wiring -->

`CLASSIFIER_ABSTAIN_THRESHOLD` (default 0.35) is the confidence below which the gateway returns the no-answer message without calling `/retrieve`. Invalid values fall back to the default. Both thresholds are provisional.

---

### Frontend

```bash
cd app/interface

npm install
npx tsc --noEmit
npx tsx src/offline/offlinePipeline.test.ts
npm run dev
```

The frontend currently contains 4 offline pipeline tests.

---

### Production Build

```bash
cd app/interface

npx vite build
```

The production build also verifies the PWA/service-worker build pipeline.

---

## Testing and CI

GitHub Actions runs the project's automated checks on every push and on pull requests targeting `main`.

The CI pipeline currently performs:

```text
Backend
├── Install dependencies
└── Run backend tests

Frontend
├── Install dependencies
├── Type-check
├── Run offline pipeline tests
└── Production build
```

The workflow is defined in:

```text
.github/workflows/ci.yml
```

`ml_service` has no CI job yet. Its behaviour is checked through the gateway tests (with a mocked service) and manual end-to-end runs.

`main` is intended to remain the stable branch, with changes introduced through pull requests.

---

## Model Training

Training can be performed in Google Colab or locally using a CUDA-capable GPU.

Primary resources:

```text
research/experiments/
├── SafeGirl_V2_Training.ipynb
└── train_classifier.py
```

The training pipeline intentionally refuses to train directly from:

```text
resources/generated/
```

Training data must come from:

```text
resources/reviewed/
```

This prevents unreviewed AI-generated paraphrases from silently entering the evaluated training pipeline.

---

## Known Limitations

### Firebase Anonymous Authentication

Firebase Anonymous Authentication is **not yet mounted** on the query route.

When introduced, authentication persistence must be explicitly configured so that anonymous session identity does not survive beyond the intended session lifetime.

The implementation must therefore avoid the Firebase SDK's default persistent browser behavior where it conflicts with the project's privacy requirements.

---

### Generation

Generation is currently stubbed.

`GenerationModule` returns the retrieved knowledge-base answer rather than making a live Gemini API request.

No live Gemini generation is currently part of the implemented pipeline.

---

### Retrieval

Retrieval is semantic but not yet evaluated.

* Retrieval is class-scoped when the classifier is confident, so a wrong classification can hide the right entry.
* Similarity scores cluster in a narrow band (about 0.75 to 0.87), so a score threshold cannot separate relevant from irrelevant entries. The confidence zones use classifier confidence instead.
* The thresholds (0.5 scoped, 0.35 abstain) are provisional and sit close to real queries. In a five-query run, one correct answer was about 0.06 above the abstain line. Calibration needs a labelled evaluation set that includes off-topic queries.
* The classifier has no GBV class. GBV-adjacent queries that the Safety Net does not flag are handled by the abstain zone, not by a dedicated path.
* In keyword fallback mode, retrieval ranks some queries differently (for example, "when should I start antenatal visits" returns the pelvic exam entry rather than the antenatal entry).
* `ml_service` has no hosted deployment. It runs locally, so a remote demo needs a decision on where it runs.

---

### Knowledge Base

The knowledge base has 8 active entries and has not been reviewed by a clinician or subject-matter expert. Some live entries may be out of date or may overstate the legal position on parental consent for adolescents. Candidate additions are being verified and are not part of the active set.

---

### Independent Test Set

The independent expert test set contains only **31 examples**.

The `general` category contains only 3 examples in this set, meaning category-specific metrics should be interpreted with appropriate statistical caution.

---

### General ↔ STI Confusion

The V2 classifier continues to exhibit General ↔ STI boundary confusion in cross-validation.

This issue is documented rather than patched after evaluation, in accordance with the project's standing rule against retuning the model based on observed evaluation results.

---

### Held Content

GBV informational content and Sheng/English-Swahili code-switched material remain deliberately excluded from active training and knowledge-base deployment pending competent, authoritative review.

The project does not generate or invent authoritative health, legal, or clinical content to fill these gaps.

---

## Documentation

### Dissertation chapters

Draft dissertation chapters are maintained under:

```text
docs/
```

including:

```text
chapter1-introduction-draft.md
chapter2-*.md
chapter3-*.md
chapter4-*.md
```

Chapters 5–6 will incorporate the final results and discussion once the remaining implementation and evaluation work is complete.

### Decision and development records

* [`docs/decision-log.md`](docs/decision-log.md): research and implementation decisions, including rationale and evaluation caveats
* [`docs/development-log.md`](docs/development-log.md): chronological development record
* [`docs/dr04-test-set-verification-record.md`](docs/dr04-test-set-verification-record.md): independent test-set provenance and expert review record

### Diagrams

[`docs/diagrams/`](docs/diagrams/) contains the project's system diagrams and accompanying specifications.

---

## Branching Strategy

The repository uses the following branch structure:

```text
main
│
├── development
│   └── Integration branch
│
├── feature/*
│   └── Scoped feature development
│
├── fix/*
│   └── Bug fixes
│
├── refactor/*
│   └── Structural/code-quality changes
│
└── chore/*
    └── Maintenance and tooling
```

### Branch responsibilities

| Branch        | Purpose                                |
| ------------- | -------------------------------------- |
| `main`        | Stable project state                   |
| `development` | Integration of completed feature work  |
| `feature/*`   | New functionality                      |
| `fix/*`       | Bug fixes                              |
| `refactor/*`  | Code restructuring                     |
| `chore/*`     | Tooling, dependencies, and maintenance |

Feature branches are merged into `development` through pull requests. Changes intended for `main` are introduced through pull requests as well.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

Examples:

```text
feat: add category routing
fix: prevent duplicate safety responses
refactor: separate classifier from retrieval service
test: add offline pipeline coverage
docs: update architecture documentation
chore: update dependencies
```

---

## Academic Context

SafeGirl is a final-year Computer Science capstone project.

The repository accompanies the project's dissertation, and chapter references throughout the documentation correspond to the academic research and implementation process.

The project is maintained as a **research prototype**, with implementation status, experimental limitations, and unresolved findings intentionally documented rather than concealed.
