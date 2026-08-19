# SafeGirl — Semester 2 Development Plan
Mapped to ICS 4101's official course calendar (System Implementation: 17 Aug – 2 Oct)
Weeks 1–2 compressed into Week 1 — extra buffer added at the end as a result.

## Week 1 (17–23 Aug) — you are here — COMPRESSED (originally 2 weeks)
**Course expectation:** embark on development with supervisor guidance; divide work into sprints.

Send today / early this week (not in your control once sent — don't let these block the rest):
- [ ] Send the dataset-development plan to Kevin and supervisor for sign-off
- [ ] Ask supervisor directly: can adult reviewers help write/review example questions, and does this need formal ethics sign-off?

Do this week regardless of replies (fully in your control):
- [ ] Finalize intent categories with source-document mapping (contraception / STIs / pregnancy / GBV-related / general)
- [ ] Write 10–15 seed questions per category, grounded in MOH/WHO/KDHS material but phrased naturally
- [ ] Generate LLM-assisted paraphrases of seed questions (document the exact procedure: model, prompts, count per seed)
- [ ] Manually review every generated example — remove duplicates, flag unsafe/inaccurate wording
- [ ] Identify and reach out to your domain expert(s) for content review
- [ ] Begin sourcing your independent test set (separate person, separate process from the LLM-paraphrase pipeline)
- [ ] Draft the first 15–20 knowledge base entries (contraception + STI categories first)
- [ ] Test your fine-tuning environment (Colab) on a toy example

Note: if sign-off or the domain expert take longer than a week to confirm, don't stall — proceed with the dataset work using your best judgment and flag any changes needed once you hear back, rather than losing days waiting.

## Week 2 (24–30 Aug) — was Week 3
- [ ] Finalize the labeled training dataset — confirm split (train/val), confirm no leakage between paraphrase siblings
- [ ] Finalize independent test set, validated by your separate adult reviewer
- [ ] Begin fine-tuning DistilBERT-multilingual on the classifier task
- [ ] Build the keyword-matching baseline for comparison

## Week 3 (31 Aug – 6 Sep) — was Week 4
- [ ] Complete first fine-tuning run; evaluate on validation set
- [ ] Iterate on hyperparameters/data if performance is weak in any category
- [ ] Run classifier vs. keyword-baseline comparison on the independent test set
- [ ] Draft confusion matrix + per-category precision/recall/F1
- [ ] Complete remaining knowledge base entries (pregnancy, GBV-related, general)

## Week 4 (7–13 Sep) — was Week 5
- [ ] Build the RAG retrieval layer (embeddings + knowledge base search)
- [ ] Wire the intent classifier's output into retrieval (category-narrowed search)
- [ ] Build the keyword-based distress/safety-net check as a separate module
- [ ] Discuss safety-net design specifically with your supervisor (per Kevin's instruction)

## Week 5 (14–20 Sep) — was Week 6
- [ ] Build the minimal PWA shell: anonymous session, chat screen, resources screen
- [ ] Integrate classifier → retrieval → LLM answer generation → safety-net check end-to-end
- [ ] Add the visible in-app disclaimer (not a diagnosis tool, doesn't replace professionals)
- [ ] Begin error analysis: pull real misclassified examples, write up why they failed

## Week 6 (21–27 Sep) — was Week 7
- [ ] Run retrieval-precision comparison: classifier-narrowed search vs. full-knowledge-base search
- [ ] Full integration testing — simulate a complete user session end to end
- [ ] Draft the limitations/ethics/bias section while the design decisions are still fresh

## Week 7 (28 Sep – 2 Oct) — NEW: extra buffer, gained from compressing Weeks 1–2
- [ ] Full buffer week — do not plan new features here
- [ ] Use it for whatever slipped: dataset delays, model retraining, integration bugs, or a second review pass on the ethics/limitations section
- [ ] If nothing slipped, use it to strengthen the results chapter — more error analysis examples, a second baseline comparison, or extra polish on the demo

## Week 8 (5–9 Oct) — Semester Break (7th–9th)
- [ ] Light week: consolidate notes, back up all work, rest

## Weeks 8–9 (12–16 Oct) — Final Documentation
- [ ] Write up methodology: dataset development, model choice justification, evaluation design
- [ ] Write up results: comparison tables, confusion matrix, per-category performance, error analysis
- [ ] Write up limitations, bias, privacy, and ethical considerations as a dedicated section
- [ ] Write up the AI-tool distinction: runtime LLM component vs. development-time tool use, clearly separated
- [ ] Supervisor review pass, incorporate corrections, submit corrected copy

## Weeks 10–14 (19 Oct – 20 Nov) — Final Presentation Prep
- [ ] Finalize any pending modules/sprints
- [ ] Polish the working system for a live demo
- [ ] Build the 5-slide defense deck — lead with the classifier vs. baseline comparison as the centerpiece slide
- [ ] Rehearse the demo end to end, including a fallback plan if connectivity/live demo fails

## Week 15 (23 Nov – 1 Dec) — Final Defenses
- [ ] Present, demo, and upload the final document for examination

---

## Standing open items (resolve as early as possible)
- Domain expert not yet confirmed — needed for content and safety-net review
- Ethics sign-off status for adult-reviewer involvement — confirm with supervisor
- Dataset-development plan — send this week; don't let approval delay block your own progress
