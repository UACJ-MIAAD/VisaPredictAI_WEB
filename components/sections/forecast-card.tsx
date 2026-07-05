"use client";

// A collapsed forecast-gallery card: a cheap inline SVG sparkline preview
// (recent history + the 12-month projection + 95% band) + the series metadata.
// Clicking opens the lightbox (where the full Recharts fan chart mounts), so no
// heavy chart renders per card — the whole grid stays light.
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { countryLabel } from "@/lib/data/visa-panel";
import { buildForecast, monthLabel } from "@/lib/visabot/analytics";
import type { Panel } from "@/lib/data/panel-core";
import type { ForecastStore } from "@/lib/data/forecasts";
import type { GallerySeries } from "@/lib/visabot/gallery";

type SparkPoint = { hist: number | null; fc: number | null; band95: [number, number] | null };

// Pure SVG sparkline: solid accent history → dashed accent-2 forecast, with a
// faint 95% band. Themed via tokens; no chart library.
export function Sparkline({ data, w = 128, h = 34 }: { data: SparkPoint[]; w?: number; h?: number }) {
  const vals: number[] = [];
  for (const d of data) {
    if (d.hist != null) vals.push(d.hist);
    if (d.fc != null) vals.push(d.fc);
    if (d.band95) { vals.push(d.band95[0]); vals.push(d.band95[1]); }
  }
  if (vals.length < 2 || data.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (w - 2) + 1;
  const y = (v: number) => h - 1 - ((v - min) / rng) * (h - 2);
  const line = (pick: (d: SparkPoint) => number | null) =>
    data.map((d, i) => { const v = pick(d); return v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`; }).filter(Boolean).join(" ");
  const histPts = line((d) => d.hist);
  const fcPts = line((d) => d.fc);
  const top: string[] = [], bot: string[] = [];
  data.forEach((d, i) => { if (d.band95) { top.push(`${x(i).toFixed(1)},${y(d.band95[1]).toFixed(1)}`); bot.unshift(`${x(i).toFixed(1)},${y(d.band95[0]).toFixed(1)}`); } });
  const band = top.length >= 2 ? `M ${top.join(" L ")} L ${bot.join(" L ")} Z` : "";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      {band && <path d={band} fill="var(--color-accent)" fillOpacity={0.12} />}
      {histPts && <polyline points={histPts} fill="none" stroke="var(--color-accent)" strokeWidth={1.4} strokeLinejoin="round" />}
      {fcPts && <polyline points={fcPts} fill="none" stroke="var(--color-accent-2)" strokeWidth={1.4} strokeDasharray="3 2" strokeLinejoin="round" />}
    </svg>
  );
}

export function ForecastCard({ series, panel, forecasts, onOpen }: {
  series: GallerySeries;
  panel: Panel;
  forecasts: ForecastStore | null;
  onOpen: () => void;
}) {
  const { lang } = useLang();
  // sparkline spec: a short recent window (24 mo) + the 12-mo projection
  const spark = React.useMemo(
    () => buildForecast(panel, series.country, series.category, series.table, lang, 12, 24, forecasts),
    [panel, series, lang, forecasts],
  );
  const tint = series.block === "familia" ? "var(--color-accent)" : "var(--color-accent-2)";
  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-[var(--color-accent)] hover:shadow-sm"
    >
      <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: tint }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate font-serif text-sm font-semibold text-[var(--color-ink)]">
          {countryLabel(series.country, lang)} · {series.category} · {series.table}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.66rem] text-[var(--color-muted)]">
          {series.mase != null && <span className="tabular-nums">MASE {series.mase.toFixed(3)}</span>}
          {series.models.length > 0 && <span>{series.models.join("+")}</span>}
          {series.lastMonth && <span>· {monthLabel(series.lastMonth, lang)}</span>}
        </div>
      </div>
      {spark && spark.kind === "forecast" ? <Sparkline data={spark.data} /> : <span className="text-[0.6rem] text-[var(--color-muted)]">—</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition group-hover:text-[var(--color-accent)]" aria-hidden />
    </button>
  );
}
