# SafeGirl — ML Documentation & Prep Checklist

## Core ML documentation (per Dr. Khakata's guidance)

- [ ] Intent classes defined, with clear rationale for how each was chosen
- [ ] Dataset source, size, composition, and annotation process documented
- [ ] Train / validation / test splits defined (e.g. 70/15/15), stratified by category
- [ ] Leakage prevention: paraphrased variants of the same seed question kept within a single split, not spread across train/test
- [ ] Baseline defined (keyword-matching) for comparison against the fine-tuned model
- [ ] Evaluation metrics: precision, recall, F1-score, confusion matrix — not accuracy alone
- [ ] Per-class performance reported, with attention to imbalanced classes (e.g. GBV-related)
- [ ] Error analysis: concrete examples of misclassifications, with reasoning on why they happened
- [ ] Limitations, bias, privacy, and ethical considerations written up as a dedicated section
- [ ] Research question stated explicitly: does fine-tuning outperform the baseline, and by how much

## System design & safety

- [ ] Clear disclaimer in the app UI: not a medical diagnosis tool, does not replace professionals
- [ ] Safety/escalation mechanism for distress, abuse, or GBV disclosures — separate from the learned classifier
- [ ] Safety mechanism design and limitations discussed directly with supervisor (not just documented)

## AI/LLM tool documentation

- [ ] Runtime AI component (LLM API used in the RAG chat) documented: provider, model, role in architecture, configuration, limitations, how its outputs are evaluated, relevant citations
- [ ] Development-time AI tool use (e.g. Claude, ChatGPT for coding/writing help) disclosed transparently
- [ ] Clear separation maintained: the RAG chat's LLM output quality is never conflated with the trained classifier's own evaluated performance

## Dataset — open items

- [ ] Confirm defensible dataset size with lecturer/supervisor, given timeline
- [ ] Confirm acceptable annotation process (self-labeled + later expert review vs. other approach)
- [ ] Confirm leakage-prevention approach for LLM-paraphrased data
- [ ] Domain expert identified for content review (still open — ask supervisor/lecturer for contacts)

## Before 17 August (implementation start)

- [ ] Supervisor confirms the pivot in writing
- [ ] Lecturer's dataset-sourcing question answered
- [ ] Intent categories finalized
- [ ] Knowledge base first-pass draft (10-15 entries) started
- [ ] Colab/fine-tuning environment tested on a toy example
- [ ] Domain expert contact secured or in progress
