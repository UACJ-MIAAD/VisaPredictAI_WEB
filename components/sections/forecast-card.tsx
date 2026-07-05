"use client";

// A collapsed forecast-gallery card: a cheap inline SVG sparkline preview
// (recent history + the projection horizon + 95% band) + the series metadata.
// Clicking opens the lightbox (where the full Recharts fan chart mounts), so no
// heavy chart renders per card — the whole grid stays light.
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { countryLabel } from "@/lib/data/visa-panel";
import { buildForecast, type PanelIndex } from "@/lib/visabot/analytics";
import type { Panel } from "@/lib/data/panel-core";
import type { ForecastStore } from "@/lib/data/forecasts";
import { maseTier, type GallerySeries } from "@/lib/visabot/gallery";

type SparkPoint = { hist: number | null; fc: number | null; band95: [number, number] | null };

// Pure SVG sparkline: solid accent history → dashed accent-2 forecast, with a
// faint 95% band. Themed via tokens; no chart library.
export function Sparkline({ data, w = 128, h = 34 }: { data: SparkPoint[]; w?: number; h?: number }) {
  // Scale to the informative line (history + forecast) only — NOT the 95% band,
  // whose long-horizon width would otherwise squash the line toward flat. The
  // band still renders, clamped into the viewport (finding: viz-scaling).
  const vals: number[] = [];
  for (const d of data) {
    if (d.hist != null) vals.push(d.hist);
    if (d.fc != null) vals.push(d.fc);
  }
  if (vals.length < 2 || data.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (w - 2) + 1;
  const y = (v: number) => h - 1 - ((v - min) / rng) * (h - 2);
  const yc = (v: number) => Math.max(0.5, Math.min(h - 0.5, y(v))); // clamp band to frame
  const line = (pick: (d: SparkPoint) => number | null) =>
    data.map((d, i) => { const v = pick(d); return v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`; }).filter(Boolean).join(" ");
  const histPts = line((d) => d.hist);
  const fcPts = line((d) => d.fc);
  const top: string[] = [], bot: string[] = [];
  data.forEach((d, i) => { if (d.band95) { top.push(`${x(i).toFixed(1)},${yc(d.band95[1]).toFixed(1)}`); bot.unshift(`${x(i).toFixed(1)},${yc(d.band95[0]).toFixed(1)}`); } });
  const band = top.length >= 2 ? `M ${top.join(" L ")} L ${bot.join(" L ")} Z` : "";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      {band && <path d={band} fill="var(--color-accent)" fillOpacity={0.12} />}
      {histPts && <polyline points={histPts} fill="none" stroke="var(--color-accent)" strokeWidth={1.4} strokeLinejoin="round" />}
      {fcPts && <polyline points={fcPts} fill="none" stroke="var(--color-accent-2)" strokeWidth={1.4} strokeDasharray="3 2" strokeLinejoin="round" />}
    </svg>
  );
}

export function ForecastCard({ series, panel, forecasts, index, terciles, onOpen }: {
  series: GallerySeries;
  panel: Panel;
  forecasts: ForecastStore | null;
  index?: PanelIndex | null;
  terciles?: { t1: number; t2: number } | null;
  onOpen: () => void;
}) {
  const { lang } = useLang();
  // sparkline spec: a short recent window (24 mo) + the pipeline projection horizon
  // (forecasts.horizonMonths; undefined → buildForecast's own default). Never hand-typed.
  // The pre-built panel index keeps this O(1) instead of re-scanning the panel.
  const horizon = forecasts?.horizonMonths || undefined;
  const spark = React.useMemo(
    () => buildForecast(panel, series.country, series.category, series.table, lang, horizon, 24, forecasts, index ?? undefined),
    [panel, series, lang, forecasts, horizon, index],
  );
  const tint = series.block === "familia" ? "var(--color-accent)" : "var(--color-accent-2)";
  const tier = maseTier(series.mase, terciles ?? null);
  const tierColor = tier === "good" ? "var(--color-success)" : tier === "weak" ? "var(--color-danger)" : "var(--color-accent-2)";
  const mv = series.movementPerYear;
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
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.66rem] text-[var(--color-muted)]">
          {series.mase != null && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              {tier && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tierColor }} aria-hidden />}
              MASE {series.mase.toFixed(3)}
            </span>
          )}
          {series.backlogYears != null && (
            <span className="tabular-nums">· {series.backlogYears.toFixed(1)} {tr(lang, "resYr")} {tr(lang, "resWait")}</span>
          )}
          {mv != null && Math.abs(mv) >= 1 && (
            <span className="tabular-nums font-medium" style={{ color: mv >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
              {mv >= 0 ? "▲" : "▼"} {Math.abs(Math.round(mv))} {tr(lang, "resPerYear")}
            </span>
          )}
          {series.models.length > 0 && <span className="truncate">{series.models.join("+")}</span>}
        </div>
      </div>
      {spark && spark.kind === "forecast" ? <Sparkline data={spark.data} /> : <span className="text-[0.6rem] text-[var(--color-muted)]">—</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition group-hover:text-[var(--color-accent)]" aria-hidden />
    </button>
  );
}
