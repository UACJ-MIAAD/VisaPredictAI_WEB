# Golden hold-out (20%) — do NOT tune on these

This directory holds a **generated view** of the ~20% of the VisaBot golden set
reserved as a hold-out. It exists so a reviewer can see exactly which questions
are set aside.

## Rules

- **Never tune retrieval, prompts, chunking or thresholds against these
  questions.** They are the honest test of generalization: if you optimize the
  system until the hold-out passes, it stops being a hold-out. Iterate on the
  **dev** split (`node scripts/rag-golden-eval.mjs --split dev`) only.
- The CI gate runs on `--split dev`. Run the hold-out **occasionally and read-only**
  (`node scripts/rag-golden-eval.mjs --split holdout`) to check the dev score did
  not overfit — do not add it to CI as a pass/fail gate you would then chase.

## How the split is made

Membership is deterministic: `isHoldout(id)` in `scripts/golden-set-lib.mjs`
computes `sha256("<seed>:" + id)` and reserves ~1 in 5 ids (seed
`visapredict-golden-v1`). Because it is a pure function of the **stable question
id**, editing a question's text never reshuffles the split, and the source of
truth stays the single set of files in `evals/golden/*.json`. These `holdout/*.json`
files are regenerated (never hand-edited) with:

```
node scripts/golden-holdout-split.mjs
```

## Pending human task (documented, not automated)

The split is **random by id**, not curated. Independent-person curation of the
hold-out — a reviewer other than the author confirming each reserved question is
answerable, unambiguous, and representative — remains a **human TODO**. Until
then, treat hold-out results as indicative, not authoritative.
