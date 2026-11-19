"use client";

// Cheap inline SVG sparkline used by every row of the /resultados series list
// (recent history + the projection horizon + 95% band); the full Recharts fan
// chart mounts only in the instrument above the list.
import * as React from "react";

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
