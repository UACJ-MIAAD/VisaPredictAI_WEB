"use client";

// Feature engineering (FE): the master cleaning + feature decisions of the
// pipeline, documented one by one from the REAL modules (fe_facts.json is
// built by the data repo's experiments/build_fe_facts.py, which imports the
// canonical constants from vp_model/config and the ledger from the panel
// build). Reads the baked /data/fe_facts.json (fetched at build time by
// scripts/fetch-data.mjs) — every number rendered here comes from that JSON,
// nothing is hardcoded. The standalone report ships as /data/fe_report.pdf
// (Spanish) and /data/fe_report_en.pdf (real English translation).

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { FeGallery } from "@/components/sections/fe-gallery";
import { loadFeFacts, type FeFacts, type FeDecision } from "@/lib/data/fe";

const T = {
  es: {
    eyebrow: "Ingeniería de características",
    title: "Cómo la celda cruda se vuelve objetivo entrenable",
    intro:
      "Las decisiones magistrales de limpieza y de construcción de características, documentadas una a una desde los módulos reales del pipeline: qué se interpola, qué se anota y qué jamás se inventa; cómo se codifica el calendario fiscal, por qué los árboles predicen el avance y no el nivel, y cómo se depura el catálogo de características. Se regenera con cada boletín nuevo.",
    decisions: "decisiones magistrales documentadas",
    decisionsSub: (c: number, f: number) => `${c} de limpieza + ${f} de características`,
    selection: "características del catálogo tras la selección (FRESH + mRMR)",
    gap: "hueco máximo interpolable",
    months: "meses",
    trainable: "filas con fecha específica (F)",
    contract: (mtFad: number, mtDff: number, hold: number, lags: number) =>
      `Contrato del regresor: ventana mínima de entrenamiento de ${mtFad} meses (FAD) y ${mtDff} (DFF), hold-out de ${hold} meses y ${lags} rezagos mensuales como memoria — constantes canónicas externalizadas en la configuración del pipeline, no enterradas por modelo.`,
    cleanTitle: "Limpieza con carácter",
    cleanSub: (n: number) =>
      `${n} decisiones de limpieza, cada una con su módulo y su porqué. Nada se corrige en silencio: la celda cruda se conserva siempre.`,
    feTitle: "Características para pronosticar",
    feSub: (n: number) =>
      `${n} decisiones de ingeniería de características: del objetivo en días desde la época fija a la selección estadística del catálogo.`,
    moduleLabel: "Módulo:",
    download: "Descargar el reporte de ingeniería de características (PDF)",
    otherLang: "También disponible en inglés (PDF)",
    otherHref: "/data/fe_report_en.pdf",
    pdfHref: "/data/fe_report.pdf",
    vintageNote:
      "Reporte y censo generados automáticamente ({vintage}, contrato de características v{ver}); se regeneran con cada boletín nuevo del Visa Bulletin.",
    asOf: "corte",
  },
  en: {
    eyebrow: "Feature engineering",
    title: "How a raw cell becomes a trainable target",
    intro:
      "The master cleaning and feature-construction decisions, documented one by one from the pipeline's real modules: what gets interpolated, what gets annotated and what is never invented; how the fiscal calendar is encoded, why the trees predict the advance rather than the level, and how the feature catalog is pruned. It regenerates with every new bulletin.",
    decisions: "documented master decisions",
    decisionsSub: (c: number, f: number) => `${c} cleaning + ${f} feature`,
    selection: "catalog features after selection (FRESH + mRMR)",
    gap: "largest interpolable gap",
    months: "months",
    trainable: "rows with a specific date (F)",
    contract: (mtFad: number, mtDff: number, hold: number, lags: number) =>
      `Regressor contract: minimum training window of ${mtFad} months (FAD) and ${mtDff} (DFF), a ${hold}-month hold-out and ${lags} monthly lags as memory — canonical constants externalized in the pipeline configuration, not buried per model.`,
    cleanTitle: "Cleaning with character",
    cleanSub: (n: number) =>
      `${n} cleaning decisions, each with its module and its why. Nothing is silently corrected: the raw cell is always preserved.`,
    feTitle: "Features for forecasting",
    feSub: (n: number) =>
      `${n} feature-engineering decisions: from the target in days since the fixed epoch to the statistical selection of the catalog.`,
    moduleLabel: "Module:",
    download: "Download the feature-engineering report (PDF)",
    otherLang: "También en español (PDF)",
    otherHref: "/data/fe_report.pdf",
    pdfHref: "/data/fe_report_en.pdf",
    vintageNote:
      "Report and census generated automatically ({vintage}, feature contract v{ver}); they regenerate with every new Visa Bulletin.",
    asOf: "as of",
  },
};

// English titles/rationales for the master decisions, keyed by their stable id.
// The Spanish strings in fe_facts.json are the source of truth (same wording as
// the report, regla #0); these mirror them 1:1 for the /en/* pages. An id
// missing here (a future 21st decision) falls back to the Spanish original
// rather than hiding — visible drift beats a silent hole.
const DECISION_EN: Record<string, { title: string; rationale: string }> = {
  // ── cleaning ──
  status_regime: {
    title: "C/F/U/UNK regime as annotation, F as the only target",
    rationale:
      "Flattening C→date and U→NaN destroyed the administrative regime. The status column preserves it; only F cells (a specific date) are the predictive target (formulation v5.1) and the evaluation masks everything else (B1).",
  },
  unk_sentinel: {
    title: "UNK sentinel (never the string NA)",
    rationale:
      "The literal 'NA' collides with pandas.read_csv's default coercion (it reads it as NaN) and erased the annotation. UNK distinguishes 'no data' from 'Unavailable' and survives any downstream consumer.",
  },
  century_pivot: {
    title: "Century pivot with an epoch guard",
    rationale:
      "Cells publish two-digit years ('01MAY16'); strptime pivots 69..99→19xx. An F date earlier than t0=1975 would make days_since_base negative: build_panel aborts (underflow) and the warehouse's days_is_datediff CHECK re-verifies the full arithmetic.",
  },
  footnote_tolerance: {
    title: "Tolerance to the source's footnotes and typos",
    rationale:
      "Twenty years of bulletins carry footnotes (C*/U*), stray spaces and typos ('4rd'). The parser normalizes without discarding the month; whatever cannot be parsed stays UNK with its raw_value intact (nothing is silently corrected: the raw cell is preserved).",
  },
  dedup_regime_preference: {
    title: "Deduplication preferring the regime F>C>U>UNK",
    rationale:
      "In label transitions (e.g. EB-5 'Unreserved' 2022) a canonical category appears twice in the same month. 'first' was a coin flip that could drop a trainable F observation; F is preferred and the build ABORTS if two F's from the same month disagree (a source conflict a human resolves).",
  },
  date_failfast: {
    title: "Unparseable dates abort at the cause",
    rationale:
      "An F date coerced to NaT would violate days_iff_F far from its cause (in the warehouse CHECK); a NaT bulletin_date would travel all the way to the dim_date merge. Both abort in build_panel with the offending rows (AA3).",
  },
  domain_validation: {
    title: "Category domains validated on read",
    rationale:
      "keep_default_na=False protects the UNK sentinel but disables NA coercion for the whole frame; a stray literal in F_level/EB_level would pass as a string. The domain is validated explicitly after every read_csv (AA4).",
  },
  gap_policy_training: {
    title: "Gaps: interpolate ≤3 months; long ones NaN; filling only to train",
    rationale:
      "Gaps are C/U months (MNAR: the absence is signal). Runs ≤3 months are linearly interpolated; long ones stay NaN (all-or-nothing per run, no partial ramps). to_timeseries fills the residual NaNs ONLY to give the training continuity — they are never a target: the evaluation scores real F dates only (B1 mask, single source metrics._aligned).",
  },
  eda_kalman: {
    title: "EDA characterization imputes with Kalman, never uncapped ramps",
    rationale:
      "STL/spectrum/catch22 demand complete series. Long gaps are imputed with Kalman smoothing (state space, imputeTS::na_kalman), not with multi-year linear interpolation or edge extrapolation: an invented ramp fabricates trend and contaminates Hurst/changepoints/entropy (AB1).",
  },
  stationarity_on_raw_F: {
    title: "Formal tests on the raw F observations (with a spacing caveat)",
    rationale:
      "ADF/KPSS/DF-GLS run on the unimputed F observations: imputing before a unit-root test biases it toward 'integrated'. Accepted, documented cost: in gappy series the index is compressed and the lag structure assumes regular spacing (AB3).",
  },
  outliers_as_signal: {
    title: "Retrogressions = signal; outliers are counted, never trimmed",
    rationale:
      "Retrogressions and >8-year jumps are real administrative events the model must tolerate (the thesis argues this). No step winsorizes or removes extreme values; they are only COUNTED with robust statistics (STL z-scores, Hampel) and the figures annotate whatever falls out of range instead of silently clipping it (AC1/AC2).",
  },
  schema_contract: {
    title: "The contract is re-verified declaratively in the warehouse",
    rationale:
      "The cleaning invariants do not live only in Python: the star schema's CHECK/PK/FK constraints reject, at load time, any row that violates them — naming the exact broken invariant.",
  },
  // ── feature engineering ──
  target_days_since_base: {
    title: "Target = days since t0 (1975-01-01), F status only",
    rationale:
      "The priority date becomes an integer count of days since a fixed epoch earlier than the oldest observed priority (1979-11, Philippines F4). A continuous numeric target, with the arithmetic contract re-verified in the warehouse, instead of raw dates impossible to regress on.",
  },
  gap_regularization: {
    title: "Regular monthly grid with bounded gaps",
    rationale:
      "The models demand a regular index; C/U months are not targets. Gap runs ≤3 months are interpolated linearly; long ones stay NaN (all-or-nothing per run) and the later continuity fill is never scored (F-only mask B1).",
  },
  differencing_trees: {
    title: "Trees predict the first difference, not the level",
    rationale:
      "A tree does not extrapolate outside the range it saw: on the level (decades of rising trend) it saturates at the historical maximum. Modeling the monthly Δy (stationary) and reintegrating causally (a cumsum anchored at the last observed level) solves extrapolation for free.",
  },
  calendar_cyclic: {
    title: "Fiscal calendar encoded cyclically (sine/cosine)",
    rationale:
      "The visa fiscal year starts in October (quotas reset there). Encoding the month and its fiscal position with sine/cosine avoids imposing a false order between December and January — an integer 1..12 would make the model see those neighboring months as the farthest apart.",
  },
  lags_24: {
    title: "24 monthly lags as the regressors' memory",
    rationale:
      "Two years of history per origin: covers a full fiscal cycle with margin and leaves enough degrees of freedom (evaluable series have ≥84 F observations). The constant is externalized in the config, not buried per model.",
  },
  scaling_leakage_free: {
    title: "Scaling fitted ONLY on the initial window",
    rationale:
      "The torch networks operate poorly on magnitudes of ~18,000 days. The Scaler is fitted exclusively on the explicit training window and inverted after predicting: fitting it on the full series would leak the future into the past (leakage).",
  },
  covariate_policy: {
    title: "Explicit covariate policy per model family",
    rationale:
      "Only the differenced trees receive the calendar (the canonical campaign was derived that way); rlinear and the neural networks deliberately go without covariates. 'year' is kept for provenance of the published figures and is documented as a removal candidate for the next re-campaign.",
  },
  selection_fresh_mrmr: {
    title: "FRESH selection (FDR) + mRMR de-redundancy of the catalog",
    rationale:
      "With n=130–296 observations every degree of freedom counts. The united set of characterization features (catch22 + descriptors) is filtered for relevance with the Benjamini-Yekutieli correction and collinearity is collapsed keeping one representative per group (|Spearman|>0.9), against each series' real forecasting difficulty (the champion's MASE).",
  },
};

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="min-w-[8rem] flex-1">
      <div className="font-serif text-3xl font-bold text-[var(--color-ink)]">
        {value}
        {sub ? <span className="ml-2 text-base font-normal text-[var(--color-muted)]">{sub}</span> : null}
      </div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

// "2026-07" -> "julio 2026" / "July 2026" (UTC-pinned; same helper as #eda).
function vintageLabel(vintage: string, lang: "es" | "en"): string {
  const [y, m] = vintage.split("-").map(Number);
  if (!y || !m) return vintage;
  const month = new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
  return `${month} ${y}`;
}

function DecisionItem({ d, lang, moduleLabel }: { d: FeDecision; lang: "es" | "en"; moduleLabel: string }) {
  const en = lang === "en" ? DECISION_EN[d.id] : undefined;
  const title = en?.title ?? d.title;
  const rationale = en?.rationale ?? d.rationale;
  return (
    <details className="group border-b border-[var(--color-border)] py-3">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold leading-snug text-[var(--color-ink)]">{title}</span>
        <span
          aria-hidden="true"
          className="shrink-0 text-[var(--color-muted)] transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="mt-2 pr-6">
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">{rationale}</p>
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          {moduleLabel}{" "}
          <code className="rounded bg-[var(--color-surface-soft)] px-1.5 py-0.5 font-mono text-[0.7rem]">
            {d.module}
          </code>
        </p>
      </div>
    </details>
  );
}

export function Fe() {
  const { lang } = useLang();
  const t = T[lang];
  const [facts, setFacts] = React.useState<FeFacts | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    loadFeFacts().then((f) => {
      if (alive) {
        setFacts(f);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // the #fe anchor must exist even while loading / on failure — the prose
  // deep-link, the RAG link and the nav TOC all target it (same as #eda).
  if (!loaded)
    return (
      <section id="fe" className="section">
        <div className="section-inner">
          <Skeleton className="h-64 w-full" />
        </div>
      </section>
    );
  if (!facts) return <section id="fe" aria-hidden="true" />; // census not shipped

  const led = facts.cleaning_ledger;
  const fs = facts.feature_selection;
  const c = facts.constants;
  const nClean = facts.cleaning_decisions.length;
  const nFe = facts.fe_decisions.length;
  const pctF = led.n_rows > 0 ? Math.round((led.rows_by_status.F / led.n_rows) * 100) : 0;

  return (
    // AX1: same editorial scaffold as every other section (.section >
    // .section-inner with section-tag/-title/-sub), on the shared rail.
    <section id="fe" className="section" aria-labelledby="fe-title">
      <div className="section-inner">
      <span className="section-tag">{t.eyebrow}</span>
      <h2 id="fe-title" className="section-title">
        {t.title}
      </h2>
      <p className="section-sub">{t.intro}</p>

      {/* stats as a typographic group under a module rule — no boxed card */}
      <div className="flex flex-wrap gap-x-10 gap-y-6 border-t-2 border-[var(--color-rule)] pt-5">
        <Stat value={String(nClean + nFe)} sub={t.decisionsSub(nClean, nFe)} label={t.decisions} />
        <Stat value={`${fs.n_features_in} → ${fs.n_selected}`} label={t.selection} />
        <Stat value={`≤${c.max_interpolable_gap}`} sub={t.months} label={t.gap} />
        <Stat value={`${pctF}%`} label={t.trainable} />
      </div>
      <p className="mt-3 max-w-3xl text-sm text-[var(--color-muted)]">
        {t.contract(c.min_train.FAD, c.min_train.DFF, c.holdout, c.lags)}
      </p>

      <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
        <div>
          <h3 className="font-serif text-xl font-bold text-[var(--color-ink)]">{t.cleanTitle}</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t.cleanSub(nClean)}</p>
          <div className="mt-4">
            {facts.cleaning_decisions.map((d) => (
              <DecisionItem key={d.id} d={d} lang={lang} moduleLabel={t.moduleLabel} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-serif text-xl font-bold text-[var(--color-ink)]">{t.feTitle}</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t.feSub(nFe)}</p>
          <div className="mt-4">
            {facts.fe_decisions.map((d) => (
              <DecisionItem key={d.id} d={d} lang={lang} moduleLabel={t.moduleLabel} />
            ))}
          </div>
        </div>
      </div>

      <FeGallery facts={facts} />

      <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a
          href={t.pdfHref}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          {t.download}
        </a>
        <a
          href={t.otherHref}
          target="_blank"
          rel="noopener"
          className="text-sm text-[var(--color-muted)] underline underline-offset-2 transition-colors hover:text-[var(--color-accent)]"
        >
          {t.otherLang}
        </a>
        <p className="w-full text-xs text-[var(--color-muted)]">
          {t.vintageNote
            .replace("{vintage}", `${t.asOf} ${vintageLabel(facts.vintage, lang)}`)
            .replace("{ver}", facts.fe_version)}
        </p>
      </div>
      </div>
    </section>
  );
}
