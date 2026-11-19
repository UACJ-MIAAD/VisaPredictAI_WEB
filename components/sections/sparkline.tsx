"use client";

// Cheap inline SVG sparkline used by every row of the /resultados series list
// (recent history + the projection horizon + 95% band); the full Recharts fan
// chart mounts only in the instrument above the list.
import * as React from "react";

type SparkPoint = { hist: number | null; fc: number | null; band95: [number, number] | null };

// Pure SVG sparkline: solid accent history → dashed accent-2 forecast, with a
// faint 95% band. Themed via tokens; no chart library.
// The 95 % band is NOT drawn here: at row size a years-wide band clamps into a
// solid block; the band lives, labeled, in the row's text and the instrument.
// Months without a dated cutoff (C/U) break the line instead of being bridged,
// and the vertical range is at least one year so a near-static series reads as
// near-flat rather than as a steep climb.
export function Sparkline({ data, w = 128, h = 34 }: { data: SparkPoint[]; w?: number; h?: number }) {
  const vals: number[] = [];
  for (const d of data) {
    if (d.hist != null) vals.push(d.hist);
    if (d.fc != null) vals.push(d.fc);
  }
  if (vals.length < 2 || data.length < 2) return null;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = Math.max(hi - lo, 1);
  const min = (lo + hi) / 2 - span / 2;
  const x = (i: number) => (i / (data.length - 1)) * (w - 2) + 1;
  const y = (v: number) => h - 1 - ((v - min) / span) * (h - 2);
  const path = (pick: (d: SparkPoint) => number | null) => {
    let d = "", pen = false;
    data.forEach((p, i) => {
      const v = pick(p);
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };
  const hist = path((d) => d.hist);
  const fc = path((d) => d.fc);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      {hist && <path d={hist} fill="none" stroke="var(--color-accent)" strokeWidth={1.4} strokeLinejoin="round" />}
      {fc && <path d={fc} fill="none" stroke="var(--color-accent-2)" strokeWidth={1.4} strokeDasharray="3 2" strokeLinejoin="round" />}
    </svg>
  );
}
