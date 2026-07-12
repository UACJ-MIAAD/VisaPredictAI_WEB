# VisaBot evaluation framework

How the VisaBot RAG assistant is evaluated: the **retrieval** gate that already
existed, and the **generative golden-set** gate added by US I3 (plan auditoría 3
repos, 2026-07-12). This document is the reference for what each layer measures,
its thresholds, why circularity is avoided, and its honest limitations.

## The two evals, and why both exist

| Eval | File | What it measures | Circular? |
|---|---|---|---|
| **Retrieval gate** | `scripts/rag-retrieval-eval.mjs` (`npm run rag:gate`) | recall@6, MRR, gloss@1, acad@6, flagship, BM25-only recall | **Yes** — probes are auto-generated *from the index it scores* (query = a glossary term, target = that term's chunk). Fast, free, catches ranking regressions. |
| **Golden generative gate** | `scripts/rag-golden-eval.mjs` (`npm run rag:golden:gate`) | context precision/recall vs a hand-authored set, grounding-by-construction, abstention, poisoning defense, citation-capability | **No** — questions are written from the *content* (source.html, glossary, model card, artifacts), as a user would phrase them. |

The retrieval gate answers *"did ranking regress against the index's own
structure?"*. It never inspects the answer and its probes come from the same
index it scores, so a systematic content gap is invisible to it. The golden gate
answers *"does the shipped pipeline surface the facts a real user's question
needs, refuse what it should, and resist poisoning?"* — the layer the old evals
ignored.

## The golden set

Location: `evals/golden/{factual,forecast,unanswerable,multiturn,poisoning}.json`.
Loaded and validated by `scripts/golden-set-lib.mjs`.

- **250 questions** (ES 127 / EN 123). Composition floors (enforced in
  `check-eval-sets.mjs` and `tests/golden-set.test.ts`):

  | Category | n | Floor | Correct behavior |
  |---|---|---|---|
  | `factual` | 84 | ≥60 | answer + cite; every declared fact must be in the retrieved context |
  | `forecast_in` | 24 | (forecast ≥40) | answer with the ≤horizon projection + 95% band |
  | `forecast_out` | 24 | ≥20 | **abstain**: no date beyond the validated horizon; refer to travel.state.gov |
  | `unanswerable` | 36 | ≥30 | decline (out_of_domain / legal_advice / future_not_validated / no_data) |
  | `multiturn` | 44 | ≥40 | 2–4 user turns; retrieval per turn, grounding over the union |
  | `poisoning` | 38 | ≥30 | every attack neutralized by its concrete guard |
  | **total** | **250** | ≥200 | ES and EN each ≥90 |

- **No hand-typed canonical numbers (regla #0).** A numeric fact is a `ref` into
  a real artifact — `"eda_facts:panel.n_obs"`, `"forecasts_meta:base_date"`,
  `"site_stats:nModels"`, `"scorecard:by_mode.backfill.overall.mase"` — resolved
  **live** at eval time by `resolveRef()`. A re-derivation upstream can never
  leave a stale figure in the eval set (the structural validator also rejects any
  `pattern` that hard-codes a decimal). Qualitative claims use a `pattern` regex.

- **Not copied from the internal set.** Questions are paraphrases written from the
  content — deliberately varied, because the RAG saga showed the bot passing the
  exact seeded phrasing but failing paraphrases. This is what breaks the
  set↔index circularity.

## What the golden gate checks (deterministic, no LLM)

Run per question over the **real** `public/rag/index.json` using the shipped
retrieval (`retrieval-core.mjs`, the same module `engine.ts` imports):

- **(a) Retrieval / citation-capability** — `expected_sources` ⊆ the sourceIds the
  client would show (each entry may be an array of acceptable alternatives).
- **(b) Grounding-by-construction** — for questions with `facts`, the resolved
  fact value (or its `pattern`) must appear in the retrieved context. This is a
  **necessary condition** for a faithful cited answer: the model cannot ground a
  fact the retriever never surfaced. (Sufficiency — the model actually using it —
  needs `--live`.)
- **(c) Abstention** — `unanswerable` / `forecast_out` must not retrieve material
  that the prompt would turn into an answer, **and** the system prompt (rendered
  from `chat.mjs`) must carry the governing rule (static oracle: "does not
  validate longer extrapolations", "legal advice", "Stay in your domain", "Never
  invent data"). `must_not_in_context` guards against a **poisoned corpus** that
  would "answer" an unanswerable question.
- **(d) Poisoning** — each attack runs through its concrete `chat.mjs` guard as a
  static oracle:

  | `vector` | Guard (oracle) | Pass condition |
  |---|---|---|
  | `context` | `sanitizeContext` | unpublished instruction chunk is **dropped** (unknown hash, not a valid synthetic) |
  | `synthetic` | `validSyntheticShape` / `sanitizeContext` | forged synthetic is rejected by shape, or its instructional title/source is server-overwritten |
  | `stream` | `makeCodeGuard` / `makeEmojiStripper` | fenced code is cut; emojis stripped (arrows/▲▼ preserved) |
  | `query` | `systemPrompt` | the defending rule is present in the prompt (behavior itself is tested with `--live`) |

- **(e) Citation-capability** — same as (a): the sources the client would render.

Metrics are aggregated overall and by category × language; JSON + MD reports are
written to `$GOLDEN_EVAL_OUT` (or the OS temp dir), never shipped.

### Thresholds (gate = `--gate`)

Exit 1 if **any** of:

- **context recall < 0.85** (combined fact + expected-source grounding over
  answerable questions). Current dev baseline: **~0.88**.
- **any poisoning passes its guard** (target: 100% blocked).
- **any `forecast_out` retrieves no abstention signal** (target: 100% abstain).
- the abstention/defense rule is missing from the prompt, or any eval error.

Thresholds are frozen baselines; ratchet only upward. Do not lower them to make a
regression pass.

## The 20% hold-out

- Membership is a **pure function of the stable question id**:
  `isHoldout(id) = sha256("visapredict-golden-v1:" + id) % 5 === 0` (~20%, 54/250).
  Editing a question's text never reshuffles the split, and the single source of
  truth stays `evals/golden/*.json`.
- `evals/golden/holdout/*.json` is a **generated view**
  (`npm run rag:golden:split`) for a human curator; the loader recomputes
  membership, so view and source can never drift.
- **The CI gate runs on `--split dev` only.** Run the hold-out occasionally and
  read-only (`npm run rag:golden:holdout`) to check dev did not overfit — never
  add it as a gate you would then chase. Full rules: `evals/golden/holdout/README.md`.

## `--live` (manual deepening)

The deterministic layer proves **necessary conditions**. The end-to-end text of
the LLM (does it actually use the retrieved fact? is the answer relevant? real
faithfulness?) needs model calls. `node scripts/rag-golden-eval.mjs --live` runs a
sample against the local proxy when `ANTHROPIC_API_KEY` is set, checking:
faithfulness-lite (a numeric fact stated by the answer must be in the shown
context), `must_not` avoidance, and non-empty answers for answerable questions.
**Without a key it is skipped with a clear message** — the CI gate never depends
on model calls.

## Where each gate runs

- **PR / push (`.github/workflows/ci.yml`)** — `check-eval-sets.mjs` validates the
  golden set's **structure + composition + hold-out** (cheap: no model, no
  network). The generative gate is not run here (it needs the embedding model).
- **Weekly (`.github/workflows/scheduled-quality.yml`)** — builds the real index,
  runs `rag:gate` (retrieval) **and** `rag:golden:gate` (generative), then the
  informative hold-out run, and uploads the JSON/MD reports as artifacts.

## Honest limitations

- The deterministic gate proves **necessary, not sufficient** conditions for a
  faithful answer. Sufficiency needs `--live`.
- The hold-out split is **random by id, not curated**. Independent-person
  curation of the hold-out is a documented **human TODO**
  (`evals/golden/holdout/README.md`).
- `forecast_in` grounding is soft: those answers are anchored **live** by the
  synthetic chart-context the client attaches, not by the static index, so their
  offline check targets the system's *capability* to forecast, not per-series
  figures.
- Query-vector poisoning is gated statically by rule-presence in the prompt; the
  actual refusal behavior is only observed under `--live`.
- The gate imports the live guards from `netlify/functions/chat.mjs`
  (`sanitizeContext`, `validSyntheticShape`, `makeCodeGuard`, `makeEmojiStripper`,
  `systemPrompt`) on purpose (single source). If those exports are renamed, the
  gate's imports must be updated in lock-step.
