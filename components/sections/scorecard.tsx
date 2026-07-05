"use client";

// Prospective accuracy leaderboard: the deployed model GRADED AGAINST REALITY, accruing one
// bulletin at a time. Reads the frozen-forecast scorecard (public/data/forecast_scorecard.json,
// fetched at build from the data repo). Distinct from a backtest: every number here is a
// forecast that was frozen BEFORE its target month and later scored against the real cutoff.

import * as React from "react";
import { localeOf } from "@/lib/i18n";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { loadForecasts, type Scorecard } from "@/lib/data/forecasts";
import { SITE_STATS } from "@/lib/content/site-stats.generated";

const T = {
  es: {
    eyebrow: "Evaluación prospectiva",
    title: "Qué tan bien predijo el sistema, contra la realidad",
    intro:
      "A diferencia de un backtest, cada pronóstico aquí se congeló ANTES de su mes objetivo y luego se calificó contra la fecha real del boletín. La precisión se acumula un mes a la vez.",
    nScored: "pronósticos calificados",
    mae: "Error medio absoluto",
    maeUnit: "días",
    mase: "MASE (vs naïve estacional)",
    cov95: "Cobertura del intervalo 95 %",
    nominal: "nominal 95 %",
    chartTitle: "Error por horizonte de pronóstico",
    chartDesc: "El error crece con el horizonte: predecir a 12 meses es más difícil que a 1.",
    horizon: "Horizonte (meses)",
    maeAxis: "MAE (días)",
    caveatFallback:
      "Muestra prospectiva pequeña y creciente; la cobertura 80 % reportada es out-of-sample.",
    methodTitle: "Honestidad radical: a un mes, nadie le gana al random walk",
    methodBody:
      "El marco comparativo de 24 modelos dejó un hallazgo incómodo y valioso: en el pronóstico puntual a un mes, ningún modelo supera al random walk — con cerca de {PCT} % de los meses congelados, la fila que no se mueve es difícil de vencer. El valor del sistema está en lo que el random walk no da: el horizonte de 12 meses, los intervalos calibrados y la coherencia entre tablas. El campeón desplegado (mediana de Theta+ETS+SARIMA en FAD; SARIMA en DFF) sigue en producción; el retador ingenuo pasó el gate de promoción, pero la promoción está retenida hasta confirmarse prospectivamente en todos los horizontes — su añada mensual se congela en un ledger sombra. Las bandas 80 / 95 % se escalan por horizonte con los cuantiles empíricos del propio ledger prospectivo (calibradas solo sobre fechas F, con ajuste adaptativo ACI), y cada publicación respeta un cono de coherencia (FAD ≤ DFF; país ≤ mundial).",
  },
  en: {
    eyebrow: "Prospective evaluation",
    title: "How well the system forecast — against reality",
    intro:
      "Unlike a backtest, each forecast here was frozen BEFORE its target month and later graded against the real bulletin cutoff. Accuracy accrues one month at a time.",
    nScored: "forecasts graded",
    mae: "Mean absolute error",
    maeUnit: "days",
    mase: "MASE (vs seasonal naïve)",
    cov95: "95% interval coverage",
    nominal: "nominal 95%",
    chartTitle: "Error by forecast horizon",
    chartDesc: "Error grows with the horizon: forecasting 12 months out is harder than 1.",
    horizon: "Horizon (months)",
    maeAxis: "MAE (days)",
    caveatFallback:
      "Small and growing prospective sample; the reported 80% coverage is out-of-sample.",
    methodTitle: "Radical honesty: at one month out, nothing beats the random walk",
    methodBody:
      "The 24-model comparison surfaced an uncomfortable, valuable finding: on one-month-ahead point forecasts, no model beats the random walk — with about {PCT}% of months frozen, the row that does not move is hard to outdo. The system's value lies in what the random walk cannot give: the 12-month horizon, calibrated intervals and cross-table coherence. The deployed champion (median of Theta+ETS+SARIMA on FAD; SARIMA on DFF) stays in production; the naïve challenger passed the promotion gate, but promotion is held until it is confirmed prospectively across all horizons — its monthly vintages are frozen in a shadow ledger. The 80 / 95% bands are scaled per horizon with the empirical quantiles of the prospective ledger itself (calibrated on F-status dates only, with adaptive ACI adjustment), and every release respects a coherence cone (FAD ≤ DFF; country ≤ worldwide).",
  },
};

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-ink)",
};

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="min-w-[8rem] flex-1">
      <div className="font-serif text-3xl font-bold text-[var(--color-ink)]">
        {value}
        {unit ? <span className="ml-1 text-base font-normal text-[var(--color-muted)]">{unit}</span> : null}
      </div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

export function Scorecard() {
  const { lang } = useLang();
  const t = T[lang];
  const [sc, setSc] = React.useState<Scorecard | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    loadForecasts().then((store) => {
      if (alive) {
        setSc(store.scorecard);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // the #scorecard anchor must exist even while loading / on failure — the home
  // evidence teaser, the nav TOC and deep links all target it (same as #eda).
  if (!loaded)
    return (
      <section id="scorecard" className="section">
        <div className="section-inner">
          <Skeleton className="h-64 w-full" />
        </div>
      </section>
    );
  if (!sc) return <section id="scorecard" aria-hidden="true" />; // ledger not yet seeded

  const o = sc.overall;
  const cov80 = sc.band80_calibration?.cov80_heldout;
  const byH = Object.entries(sc.by_horizon)
    .map(([h, v]) => ({ h: Number(h), mae: Math.round(v.mae_days) }))
    .sort((a, b) => a.h - b.h);

  return (
    // AX1: same editorial scaffold as every other section (.section >
    // .section-inner with section-tag/-title/-sub), on the shared rail.
    <section id="scorecard" className="section" aria-labelledby="scorecard-title">
      <div className="section-inner">
      <span className="section-tag">{t.eyebrow}</span>
      <h2 id="scorecard-title" className="section-title">
        {t.title}
      </h2>
      <p className="section-sub">{t.intro}</p>

      {/* stats as a typographic group under a module rule — no boxed card */}
      <div className="flex flex-wrap gap-x-10 gap-y-6 border-t-2 border-[var(--color-rule)] pt-5">
        <Stat value={o.mae_days.toFixed(0)} unit={t.maeUnit} label={t.mae} />
        <Stat value={o.mase.toFixed(3)} label={t.mase} />
        <Stat
          value={`${Math.round(o.cov95 * 100)}%`}
          label={`${t.cov95} (${t.nominal}${cov80 != null ? ` · 80 %: ${Math.round(cov80 * 100)}%` : ""})`}
        />
        <Stat value={sc.n_scored.toLocaleString(localeOf(lang))} label={t.nScored} />
      </div>

      <div className="mt-6 border-l-2 border-[var(--color-accent)] pl-4">
        <h3 className="font-serif text-lg font-bold text-[var(--color-ink)]">{t.methodTitle}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-muted)]">
          {/* {PCT} is interpolated from the build-time census (eda_facts.json), never typed by hand. */}
          {t.methodBody.replace("{PCT}", String(SITE_STATS.pctFrozen))}
        </p>
      </div>

      {/* chart keeps a subtle editorial rule as its container (AX1) */}
      <figure className="mt-10 border-t-2 border-[var(--color-rule)] pt-4">
        <figcaption className="mb-1 font-serif text-lg font-bold text-[var(--color-ink)]">{t.chartTitle}</figcaption>
        <p className="mb-3 max-w-3xl text-sm text-[var(--color-muted)]">{t.chartDesc}</p>
        <div role="img" aria-label={`${t.chartTitle}. ${t.chartDesc}`}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byH} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="h"
              tick={{ fontSize: 11, fill: "var(--color-muted)" }}
              label={{ value: t.horizon, position: "insideBottom", offset: -2, fontSize: 11, fill: "var(--color-muted)" }}
            />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ${t.maeUnit}`, t.maeAxis]} />
            <Bar dataKey="mae" name={t.maeAxis} fill="var(--color-accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </figure>

      <p className="mt-3 text-xs text-[var(--color-muted)]">{sc.caveat ?? t.caveatFallback}</p>
      </div>
    </section>
  );
}
