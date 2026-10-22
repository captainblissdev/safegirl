# V4 classifier data

Tooling and rules for the V4 seed set. Nothing here trains a model, and
nothing here changes the V3 data (`resources/seeds/`, `resources/reviewed/`,
`resources/seeds/fold_assignment_v3.csv`), DR-04
(`resources/test/independent_test_set.csv`), the development set
(`resources/eval/retrieval_eval_set*.csv`) or
`resources/eval/relevance_validation.csv`.

| File | What it is |
|---|---|
| `seeds_v4_template.csv` | The seed schema: header only. Copy it to start a seed file. |
| `check_seeds.py` | Checks a seed file; exits non-zero on any failure. |
| `make_folds.py` | Assigns whole seeds to 5 folds; writes `fold_assignment_v4.csv`. |
| `v3_pool_exclusions.csv` | V3 pool items V4 must not train on, with the reason. |
| `seeds_without_paraphrases.csv` | The 55 V3 seeds with no reviewed paraphrase. |
| `v3_fold_balance.md` | Class balance of the V3 folds. |
| `v3_seeds_held_topic.csv` | The 28 V3 seeds the held-topic rule matches. |
| `v1_paraphrases_restore_candidates.csv` | The 220 deleted V1 paraphrases, each a restore candidate or excluded, with reasons. |
| `seeds_v4_batch*.csv` | V4 seed batches, each checked with `check_seeds.py` before use. |
| `tests/` | Unit tests with small synthetic fixtures. |

## Seed schema

| Column | Required | Values |
|---|---|---|
| `seed_id` | yes | Unique in the file, e.g. `V4-STI-001`. |
| `text` | yes | The question, synthetic, in English. |
| `primary_class` | yes | `contraception`, `sti`, `pregnancy`, `general`, `out_of_scope` or `vague`. |
| `secondary_class` | test items only | Empty on a training seed (see rule 3). On a test item, another class from the same list, different from `primary_class`. |
| `style` | yes | `formal`, `colloquial`, `symptom_only`, `euphemism`, `myth_or_worry` or `short_or_misspelt`. |
| `boundary` | no | The class boundary the item is written to probe, as `<class>_vs_<class>`, e.g. `pregnancy_vs_general`. Both classes from the list above. |
| `source` | yes | For the four topic classes: an active KB entry id (`KB-S9`) or `<document>, <locator>`, several joined by `;`. The locator is a page (`p. 9`, `pp. 14-16`), a numbered section (`Section 3.2`) or a section name (`warning signs section`); a section name with no page passes with a warning, as the page is still to be added. For `out_of_scope` and `vague`: `design rule`. |
| `notes` | no | Free text: why the item exists, what it probes. |

## Labelling rules

1. **The primary label is the topic a clinician would file the question
   under**, not the words it happens to use. "I've got bumps down there"
   is `sti`, even with no STI word in it.
2. **The held-topic rule and the Safety Net are separate and take
   priority.** They run before the classifier, so the classifier never
   sees what they catch. A seed is not labelled for them, and a seed the
   Safety Net would flag teaches the classifier nothing; the checker warns
   on one.
3. **An item with two plausible labels is not a training seed.** If a
   clinician could reasonably file it under either class, leave it out of
   the training seeds. Such an item may go in a test set, with the second
   label in `secondary_class`. A training seed never has a
   `secondary_class` (the checker fails one unless run with
   `--test-items`).
4. **Synthetic text only.** Every item is written for this project. No
   text from real users, forums, social media, DR-04, the development set
   or `relevance_validation.csv`; the checker fails a near-duplicate of
   any of these.
5. **No Sheng.** English only, as in the V2 paraphrasing protocol
   (decision log, 2026-09-18): no Sheng or code-switching.
6. **No held-topic content until it is approved.** Emergency
   contraception, abortion and the other held topics (the groups in
   `app/gateway/src/content/heldTopics.json`) stay out of the seeds until
   a clinician approves the content. The checker fails any item the
   held-topic rule matches, with one exception: a seed that only uses
   held-topic words while its label is a topic class (e.g. a pregnancy
   question the group C patterns catch) passes with a warning when its
   `notes` contain exactly `held-topic phrasing, label is topic only`.

## Checking a seed file

From the repository root:

```
.venv/Scripts/python.exe -I research/v4/check_seeds.py research/v4/seeds_v4.csv
```

It needs Node (for the gateway's held-topic and Safety Net rules) and the
`intfloat/multilingual-e5-small` model. It fails on:

- schema: missing or extra columns, a value outside the lists above, a
  duplicate or empty `seed_id`, an empty `text` or `source`, a `source`
  that is neither an active KB id, `<document>, <locator>` (every
  `;`-separated part with a locator), nor `design rule` for
  `out_of_scope` and `vague`;
- exact or near duplicates inside the file;
- near duplicates of the V3 training pool (seeds and reviewed
  paraphrases) and of the 220 deleted V1 paraphrases
  (`v1_paraphrases_restore_candidates.csv`, all rows);
- near duplicates of DR-04 (reported by row number only; its text is
  never printed);
- near duplicates of `relevance_validation.csv` or the development set;
- an item the held-topic rule matches, unless its notes contain
  `held-topic phrasing, label is topic only` (then a warning).

"Near duplicate" means e5 cosine >= 0.95 or character ratio >= 0.85
(difflib, on lowercased text with punctuation removed).

It reports, without failing: counts per class and per class x style
(warning under 25 seeds in a class), items the Safety Net flags, and
"train overlap": KB questions that are also training items (best match
at cosine >= 0.97), among the V3 seeds or in the new file, with the KB
questions close to one (0.95 to 0.97) listed under them. The list is
computed by the checker for the KB as it is at the time of the run; it
is not a fixed list, and it changes when the KB changes. (On the 41-entry
KB of the `kb/integrate-candidates` branch it was KB-S8, KB-G1, KB-G2 and
KB-S12; the KB on this branch gives a different list.)

### Earlier batches

```
.venv/Scripts/python.exe -I research/v4/check_seeds.py research/v4/seeds_v4_batch2.csv --also research/v4/seeds_v4_batch1.csv
```

`--also PATH` (repeatable) adds earlier seed batches: a seed near a seed
of another batch fails, so the batches do not repeat each other.

### Sealed set

```
.venv/Scripts/python.exe -I research/v4/check_seeds.py SEEDS.csv --sealed PATH
```

`PATH` is a CSV with columns `id,text`, kept **outside the repository**.
Each seed is compared with it on the same thresholds; a near duplicate
fails and is printed as seed_id, sealed id and similarity only. The
sealed text and the path are never printed, so neither can reach a log,
report, fixture or commit. `sealed/` and `*sealed*.csv` are in
`.gitignore` as a second guard. Tests use synthetic sealed sets only.

## Folds

```
.venv/Scripts/python.exe -I research/v4/make_folds.py research/v4/seeds_v4.csv
```

Whole seeds go to 5 folds, stratified by `primary_class` x `style`, with
a fixed random seed, so the same file always gives the same folds.
Paraphrases are never assigned on their own: each one takes its seed's
fold. With `--paraphrases FILE ...`, the builder checks every paraphrase
names a seed in the file.

## Tests

```
.venv/Scripts/python.exe -I -m unittest discover -s research/v4/tests -t research/v4
```
