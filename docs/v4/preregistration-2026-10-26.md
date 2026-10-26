## V4 triage classifier: pre-registration (26 Oct 2026)

**Status:** FINAL once committed. Must be committed BEFORE any V4 training, cross-validation or evaluation run.
**Class design confirmed with Mr. Ouma on:** [FILL date, or "pending"]
**Supersedes:** the DRAFT V4 entry in this log (22 Oct 2026). Differences are listed in section 10.

### 1. Question
Does a V4 triage classifier (contraception, sti, pregnancy, general, out_of_scope, vague) decide better than the frozen keyword baseline whether SafeGirl should answer, ask for more detail, or decline, on a test set it has never seen?

### 2. Design
- Classes: the four topic classes plus `out_of_scope` and `vague` (6 classes).
- `distress` is NOT a class. The Safety Net stays rule-based and always wins. A classifier error on distress is the worst case, and the rule must not depend on a model.
- Precedence in the pipeline, unchanged by V4: (1) Safety Net, (2) help signposting, (3) held-topic rules A, B, C, (4) vague-query rule, (5) classifier triage, then retrieval and the relevance gate (0.8439). The classifier only acts on questions that reach step 5.
- Held-topic content gets no new seeds unless an override note says "held-topic phrasing, label is topic only".
- Reason: oracle topic scoping equalled unscoped retrieval, so the classifier's value is triage, not routing.

### 3. Knowledge base the decision is measured on
The 62 served entries (60 medic-verified plus the earlier approved set). Pending entries (KB-C6, KB-C14, KB-S19, KB-C22) are never served and are not part of this measurement. Results are reported at two levels, separately and never merged:
- **Classifier level:** class predictions against the sealed labels.
- **System level:** the final reply kind and, for answers, the matched entry, on the 62-entry KB.

### 4. Data
- Seeds: traceable to an authoritative source with a page (DR-03). `out_of_scope` and `vague` seeds cite the design rule. Seed batches 1 to 3 (123 seeds) are committed; batch 4 (about 46 seeds) is committed before the folds are frozen. All batches are checked by `research/v4/check_seeds.py`, including `--sealed`.
- Paraphrases: synthetic only, the frozen paraphrasing protocol, no real user text sent to any external service.
- Duplicate and ambiguity review (DR-05) before use. Split at seed level, never paraphrase level (DR-02). A new fold file (`fold_assignment_v4.csv`), stratified by class and phrasing style, frozen before training. The V3 fold file is not changed.
- Sheng and code-switched queries stay excluded (DR-07). No real adolescent data (DR-08, NFR-03).
- DR-04 is never trained on and never used for tuning. `relevance_validation.csv` and the development set are dev-only and are not seeds.
- **V1-paraphrase ablation.** Two training sets are compared by CV only: with and without the restored V1 paraphrases listed in `research/v4/v1_paraphrases_restore_candidates.csv`. The one with the better CV macro-F1 is used; ties go to the smaller set.

### 5. Sealed test set
- 205 questions kept outside the repo: 145 written earlier plus 60 (FS-201 to FS-260) derived from situations in the gynaecologist's question list and reworded by the author with AI assistance. This provenance is disclosed in Chapter 5.
- Labels: one primary label per question, assigned blind by two reviewers, one of whom is not the author. Disagreements are settled by the clinician or recorded as ambiguous and reported separately. Labelling is finished before any V4 result exists. Final per-class counts: [FILL after labelling; aim for at least 20 per class].
- Sealed seed checks guarantee no near-duplicate between any seed and any test question.
- Evaluated ONCE. No threshold, rule or class change after the result is seen.
- DR-04 is reported only as a non-blind reference.

### 6. Comparators
Frozen keyword baseline and V3 (frozen). Both stay in the demo until the gate in section 8.

### 7. Models and selection (CV only)
Candidates: (1) keyword baseline, (2) logistic regression on e5 embeddings, (3) DistilBERT fine-tune with gentler settings (lower learning rate, per-fold early stopping, class weights), (4) hybrid of keyword evidence and the model. Choose by 5-fold CV on macro-F1, then confident-wrong rate. Thresholds are calibrated on CV folds only. The winner is frozen with its checkpoint hash before the sealed set is opened.

### 8. Metrics and decision rule
Metrics: macro-F1, per-class precision and recall, confusion matrix, sti and pregnancy recall reported separately, confident-wrong rate (wrong with confidence above 0.5), expected calibration error, learning curve by seeds per class, and system-level correct-reply rate.

**Comparison method.** Paired bootstrap over test questions (10,000 resamples, fixed random seed 42) for the macro-F1 difference between V4 and the baseline. McNemar's exact test for the system-level correct-reply rate. The 95% interval is reported as is, even when wide.

**Margin: 0.05 macro-F1**, fixed here before any run.

V4 enters the demo only if ALL hold on the sealed set:
1. V4 macro-F1 exceeds the baseline's by at least 0.05 and the paired bootstrap 95% interval for the difference excludes 0.
2. V4 recall for sti and for pregnancy is not lower than the baseline's.
3. The system-level correct-reply rate is not lower than the baseline's.
4. No safety regression: Safety Net, held-topic and help behaviour unchanged and all existing tests pass.

Otherwise V4 is reported as a finding and the demo keeps the frozen pipeline. Swapping V4 in requires its own decision-log entry. Demo gate: 13 Nov 2026.

### 9. Fallback
By 6 Nov 2026, if the sealed labels or the CV results are not ready, V4 is reduced to this documented design plus a learning curve on existing data, and the demo keeps the frozen pipeline.

### 10. Changes from the 22 Oct draft
Measured on the 62-entry KB (was 41). Test set 205 questions (was about 150). Margin fixed at 0.05. V1-paraphrase ablation, paired-bootstrap and McNemar methods, and the precedence order added. Classifier-level and system-level results reported separately.

### 11. Deviations
Any change after this entry is recorded here with date and reason: [none yet].
