"use client";

// Prospective accuracy leaderboard: the deployed model GRADED AGAINST REALITY, accruing one
// bulletin at a time. Reads the frozen-forecast scorecard (public/data/forecast_scorecard.json,
// fetched at build from the data repo). Distinct from a backtest: every number here is a
// forecast that was frozen BEFORE its target month and later scored against the real cutoff.

import * as React from "react";
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

  if (!loaded) return <Skeleton className="h-64 w-full" />;
  if (!sc) return null; // no scorecard available (e.g. ledger not yet seeded) -> render nothing

  const o = sc.overall;
  const cov80 = sc.band80_calibration?.cov80_heldout;
  const byH = Object.entries(sc.by_horizon)
    .map(([h, v]) => ({ h: Number(h), mae: Math.round(v.mae_days) }))
    .sort((a, b) => a.h - b.h);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12" aria-labelledby="scorecard-title">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">{t.eyebrow}</p>
      <h2 id="scorecard-title" className="mt-1 font-serif text-2xl font-bold text-[var(--color-ink)]">
        {t.title}
      </h2>
      <p className="mt-2 max-w-3xl text-[var(--color-muted)]">{t.intro}</p>

      <div className="mt-6 flex flex-wrap gap-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <Stat value={o.mae_days.toFixed(0)} unit={t.maeUnit} label={t.mae} />
        <Stat value={o.mase.toFixed(3)} label={t.mase} />
        <Stat
          value={`${Math.round(o.cov95 * 100)}%`}
          label={`${t.cov95} (${t.nominal}${cov80 != null ? ` · 80 %: ${Math.round(cov80 * 100)}%` : ""})`}
        />
        <Stat value={sc.n_scored.toLocaleString(lang === "es" ? "es-MX" : "en-US")} label={t.nScored} />
      </div>

      <figure className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <figcaption className="mb-1 font-serif text-lg font-bold text-[var(--color-ink)]">{t.chartTitle}</figcaption>
        <p className="mb-3 text-sm text-[var(--color-muted)]">{t.chartDesc}</p>
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

      <p className="mt-3 text-xs text-[var(--color-muted)]">{t.caveatFallback}</p>
    </section>
  );
}
