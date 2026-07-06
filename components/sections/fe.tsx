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
import { localeOf } from "@/lib/i18n";
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
  const month = new Intl.DateTimeFormat(localeOf(lang), {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
  return `${month} ${y}`;
}

function DecisionItem({ d, lang, moduleLabel }: { d: FeDecision; lang: "es" | "en"; moduleLabel: string }) {
  // EN comes from the data repo's own translation (fe_facts.json); Spanish is the
  // canonical fallback for any decision without one (visible drift beats a hole).
  const title = (lang === "en" && d.title_en) || d.title;
  const rationale = (lang === "en" && d.rationale_en) || d.rationale;
  return (
    <details className="group border-b border-[var(--color-border)] py-3">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 break-words font-semibold leading-snug text-[var(--color-ink)]">{title}</span>
        <span
          aria-hidden="true"
          className="shrink-0 text-[var(--color-muted)] transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="mt-2 min-w-0 pr-6">
        <p className="text-sm leading-relaxed text-[var(--color-muted)] break-words">{rationale}</p>
        <p className="mt-1.5 text-xs text-[var(--color-muted)] break-words">
          {moduleLabel}{" "}
          <code className="rounded bg-[var(--color-surface-soft)] px-1.5 py-0.5 font-mono text-[0.7rem] [overflow-wrap:anywhere]">
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

      <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2 [&>div]:min-w-0">
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
