# SafeGirl — Technical Stack & Today's Work Plan

## Full technical stack

### 1. ML classifier (intent classification)
- **Google Colab** — free-tier GPU, where fine-tuning actually runs
- **Python** — base language
- **Hugging Face `transformers`** — loading/fine-tuning the pretrained model
- **Hugging Face account** — to download `distilbert-base-multilingual-cased`
- **PyTorch** — underlying framework (comes with Colab or via pip)
- **scikit-learn** — keyword baseline, precision/recall/F1, confusion matrix
- **pandas** — dataset handling, train/val/test splits
Status: environment confirmed working today. ✅

### 2. RAG / retrieval layer
- **sentence-transformers** — multilingual embedding model for retrieval
- **LangChain or LlamaIndex** (pick one) — standard RAG pipeline structure
- **LLM API account** — Claude, OpenAI, or Gemini (for grounded answer generation)
Status: not yet set up.

### 3. PWA (user-facing app)
- **Node.js + npm**
- **React with TypeScript**
- **Tailwind CSS**
- **Firebase account** — anonymous auth, Firestore, hosting
Status: not yet set up — not needed until Week 4-5.

### 4. Project management & documentation
- **GitHub account + repo** — course-tracked
- **Google Drive** (or similar) — sharing drafts with supervisor/domain expert
- **Zotero or Mendeley** — citation management (likely already set up from Sem I)
Status: repo not yet created.

---

## Today's work plan

1. **Create GitHub repo** — initialize it, push current drafts (dataset plan, seed questions, knowledge base draft). Establishes a real commit history from day one.
2. **Sign up for an LLM API account** — Claude, OpenAI, or Gemini. Check current student credit/free-tier terms before committing.
3. **Install and sanity-check the RAG stack dependencies** — `sentence-transformers` + `langchain` or `llama-index` — catch dependency issues now rather than mid-build later. (Actual model loading needs Colab, same as the classifier — HF isn't reachable from this sandbox.)
4. **If time remains:** set up Firebase account, even though PWA work isn't scheduled until Week 4-5 — low cost to provision early.

---

## Already done
- Dataset development plan drafted and refined
- Seed questions drafted (first pass, 4 of 5 classes; brainstorm messages sent for crowd-sourced additions)
- Knowledge base drafted (19 entries, first pass)
- Classifier fine-tuning environment confirmed working in Colab
