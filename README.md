# SafeGirl

**Privacy-preserving digital mentorship for adolescent reproductive health in Nairobi's informal settlements.**

SafeGirl is an academic research prototype investigating whether a fine-tuned multilingual intent classifier can improve the routing of adolescent sexual and reproductive health (SRH) questions to an appropriate knowledge category, compared with a frozen, interpretable keyword baseline.

The system is designed around an anonymous, session-based privacy architecture with **no user accounts, no login for core functionality, and no persisted conversation data**.

> **Research prototype:** SafeGirl is not a deployed healthcare service, diagnostic system, or replacement for professional medical or crisis support.

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
Fine-tuned DistilBERT V2
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

| Component                         | Status                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| Keyword baseline classifier       | ✅ Frozen (2026-08-27)                                               |
| DistilBERT classifier (V2)        | ✅ Trained — 5-fold CV, final retrain, and independent test complete |
| Backend                           | ✅ Working and tested (5/5)                                          |
| Frontend                          | ✅ Working and tested (4/4), builds cleanly                          |
| RAG generation (Gemini)           | ⛔ Not implemented — currently stubbed                               |
| Semantic retrieval (LlamaIndex)   | ⛔ Not implemented — interim keyword-overlap retrieval is used       |
| Firebase Anonymous Authentication | ⛔ Not implemented                                                   |
| GBV informational content         | ⛔ Deliberately held pending authoritative legal/clinical sourcing   |
| CI                                | ✅ GitHub Actions — backend and frontend checks                      |

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

## Model Results — V2

| Evaluation                   |     Accuracy |        Macro-F1 | Notes                             |
| ---------------------------- | -----------: | --------------: | --------------------------------- |
| V1 — single split            |        80.0% |          0.7677 | 55 seeds; historical baseline     |
| V2 — 5-fold CV               | 82.9% ± 7.0% | 0.8274 ± 0.0726 | 182 seeds; 910 examples           |
| V2 — independent expert test |        90.3% |          0.8832 | n=31; one-time evaluation (DR-04) |

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
                    │     Backend     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
             ┌─────────────┐   ┌───────────────┐
             │ Safety Net  │   │ Intent Router │
             │             │   │               │
             │ Independent │   │ Keyword /     │
             │ safety path │   │ DistilBERT V2 │
             └──────┬──────┘   └───────┬───────┘
                    │                  │
              Safety event?            ▼
                    │           ┌─────────────┐
                    │           │  Retrieval  │
                    │           └──────┬──────┘
                    │                  │
                    │                  ▼
                    │           ┌─────────────┐
                    │           │ Generation  │
                    │           │   (stubbed) │
                    │           └──────┬──────┘
                    │                  │
                    └────────┬─────────┘
                             ▼
                    Response Orchestrator
                             │
                             ▼
                         Response
```

The Safety Net is not part of the intent classifier's training or evaluation scope.

Full diagrams — including use case, activity, sequence, class, system architecture, and Firestore data design — are available in [`docs/diagrams/`](docs/diagrams/).

---

## Tech Stack

| Layer              | Technology                           |
| ------------------ | ------------------------------------ |
| Backend            | Node.js, Express                     |
| Frontend           | React, TypeScript, Vite              |
| PWA                | `vite-plugin-pwa`                    |
| Classifier         | `distilbert-base-multilingual-cased` |
| ML framework       | Hugging Face Transformers, PyTorch   |
| Evaluation         | scikit-learn                         |
| Data               | Firestore                            |
| Planned retrieval  | LlamaIndex, sentence-transformers    |
| Planned generation | Gemini                               |
| CI                 | GitHub Actions                       |

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
│   ├── backend/
│   │   └── # Express API, safety, classification, retrieval orchestration
│   │
│   └── frontend/
│       └── # React PWA and offline-capable frontend
│
├── dataset/
│   ├── seeds/
│   │   └── # 182 seed questions + fold assignments
│   ├── reviewed/
│   │   └── # Manually reviewed training paraphrases
│   ├── generated/
│   │   └── # AI-generated paraphrases before review
│   └── test/
│       └── # Independent expert-verified test set (DR-04)
│
├── knowledge-base/
│   └── # Source-grounded SRH content
│
├── notebooks/
│   └── classifier/
│       └── # V2 training notebook and supporting scripts
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

The `dataset/generated/` directory is retained for provenance but is **not accepted as direct training data**. The training pipeline enforces the requirement that training data come from the reviewed dataset.

---

## Getting Started

### Prerequisites

* Node.js 20+
* npm
* Git
* Python 3.10+ for classifier development/training
* CUDA-capable GPU for local model training, or Google Colab for GPU training

---

### Backend

```bash
cd app/backend

npm install
npm test
node server.js
```

The backend test suite currently contains 5 tests.

---

### Frontend

```bash
cd app/frontend

npm install
npx tsc --noEmit
npx tsx src/offline/pipeline.test.ts
npm run dev
```

The frontend currently contains 4 offline pipeline tests.

---

### Production Build

```bash
cd app/frontend

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

`main` is intended to remain the stable branch, with changes introduced through pull requests.

---

## Model Training

V2 training can be performed in Google Colab or locally using a CUDA-capable GPU.

Primary resources:

```text
notebooks/classifier/
├── SafeGirl_V2_Training.ipynb
└── train_distilbert.py
```

The training pipeline intentionally refuses to train directly from:

```text
dataset/generated/
```

Training data must come from:

```text
dataset/reviewed/
```

This prevents unreviewed AI-generated paraphrases from silently entering the evaluated training pipeline.

---

## Known Limitations

### Firebase Anonymous Authentication

Firebase Anonymous Authentication is **not yet implemented**.

When introduced, authentication persistence must be explicitly configured so that anonymous session identity does not survive beyond the intended session lifetime.

The implementation must therefore avoid the Firebase SDK's default persistent browser behavior where it conflicts with the project's privacy requirements.

---

### Generation

Generation is currently stubbed.

`GenerationModule` returns the retrieved knowledge-base answer rather than making a live Gemini API request.

No live Gemini generation is currently part of the implemented pipeline.

---

### Retrieval

Retrieval is currently interim.

The implemented system uses category-scoped keyword-overlap matching over the current knowledge base.

The semantic retrieval pipeline described in the methodology — including LlamaIndex and sentence-transformers — has not yet been implemented.

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

* [`docs/decision-log.md`](docs/decision-log.md) — research and implementation decisions, including rationale and evaluation caveats
* [`docs/development-log.md`](docs/development-log.md) — chronological development record
* [`docs/dr04-test-set-verification-record.md`](docs/dr04-test-set-verification-record.md) — independent test-set provenance and expert review record

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

Changes intended for `main` should be introduced through pull requests.

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

---

## Project Principle

> **Build what can be justified. Measure what can be tested. Document what remains uncertain.**

SafeGirl treats privacy, safety separation, reproducibility, and methodological transparency as first-class engineering requirements.
