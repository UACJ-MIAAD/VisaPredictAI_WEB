"use client";

// Recharts renderer for a VisaBot ChartSpec. Lazy-loaded (next/dynamic) so
// Recharts only ships when the first chart renders. Themed via tokens.
import * as React from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Legend,
} from "recharts";
import type { ChartSpec } from "@/lib/visabot/analytics";
import { countryLabel } from "@/lib/data/visa-panel";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";

const MON_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtDate = (d: string) => { const [y, m, da] = d.split("-").map(Number); return `${String(da || 1).padStart(2, "0")} ${MON_ABBR[m - 1]} ${y}`; };

const AXIS = { fontSize: 11, fill: "var(--color-muted)" };
const SERIES = ["var(--color-accent)", "var(--color-accent-2)", "var(--color-success)", "var(--color-danger)", "var(--color-muted)"];
const tip = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  color: "var(--color-ink)",
  fontSize: "0.78rem",
};
const GRID = "color-mix(in srgb, var(--color-border) 70%, transparent)";

export default function VisaChart({ spec }: { spec: ChartSpec }) {
  const { lang } = useLang();
  const yr = lang === "en" ? "y" : "a";

  return (
    <figure className="mt-2 max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-[var(--color-bg)] p-3">
      <figcaption className="mb-0.5 font-serif text-sm font-bold text-[var(--color-ink)]">{spec.title}</figcaption>
      <p className="mb-2 text-[0.72rem] text-[var(--color-muted)]">{spec.subtitle}</p>

      {spec.kind === "line" && (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={spec.data} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="vbLineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickFormatter={(m: string) => m.slice(0, 4)} minTickGap={36} />
            <YAxis tick={AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => String(Math.round(v))} width={44} />
            <Tooltip contentStyle={tip} labelFormatter={(m) => String(m)} formatter={(_v, _n, item) => [item?.payload?.date ?? "—", lang === "en" ? "Priority date" : "Fecha prioridad"]} />
            <Area type="monotone" dataKey="year" stroke="var(--color-accent)" strokeWidth={2.4} fill="url(#vbLineFill)" dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {spec.kind === "multiline" && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={spec.data} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickFormatter={(m: string) => String(m).slice(0, 4)} minTickGap={36} />
            <YAxis tick={AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => String(Math.round(v))} width={44} />
            <Tooltip contentStyle={tip} />
            <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
            {spec.series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i % SERIES.length]} strokeWidth={2.2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {spec.kind === "forecast" && (
        <>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={spec.data} margin={{ top: 6, right: 14, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickFormatter={(m: string) => String(m).slice(0, 7)} minTickGap={40} />
            <YAxis tick={AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => String(Math.round(v))} width={44} />
            <Tooltip
              contentStyle={tip}
              labelFormatter={(m) => String(m)}
              formatter={(value, name, item) => {
                if (name === "band95" || name === "band80") return [null, null] as unknown as [string, string];
                const p = item?.payload;
                const isF = p?.fc != null && p?.hist == null;
                return [p?.date ?? "—", isF ? (lang === "en" ? "Forecast cutoff" : "Corte pronosticado") : (lang === "en" ? "Priority date" : "Fecha prioridad")];
              }}
            />
            {/* prediction bands (outer 95 %, inner 80 %) */}
            <Area dataKey="band95" stroke="none" fill="var(--color-accent)" fillOpacity={0.1} isAnimationActive={false} connectNulls />
            <Area dataKey="band80" stroke="none" fill="var(--color-accent)" fillOpacity={0.2} isAnimationActive={false} connectNulls />
            <Line dataKey="hist" name="hist" stroke="var(--color-accent)" strokeWidth={2.4} dot={false} connectNulls isAnimationActive={false} />
            <Line dataKey="fc" name="fc" stroke="var(--color-accent-2)" strokeWidth={2.4} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
            <ReferenceLine x={spec.splitMonth} stroke="var(--color-muted)" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.7rem] text-[var(--color-muted)]">
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: "var(--color-accent)" }} />{lang === "en" ? "History" : "Histórico"}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--color-accent-2)" }} />{lang === "en" ? "Forecast" : "Pronóstico"}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm" style={{ background: "color-mix(in srgb, var(--color-accent) 20%, transparent)" }} />{lang === "en" ? "80 % / 95 % band" : "Banda 80 % / 95 %"}</span>
        </div>
        </>
      )}

      {spec.kind === "radar" && (
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={spec.data} outerRadius="72%">
            <PolarGrid stroke={GRID} />
            <PolarAngleAxis dataKey="cat" tick={AXIS} />
            <PolarRadiusAxis tick={AXIS} tickFormatter={(v: number) => `${v}${yr}`} angle={90} />
            <Tooltip contentStyle={tip} formatter={(value, name) => [`${Number(value).toFixed(1)} ${lang === "en" ? "years" : "años"}`, name]} />
            <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
            {spec.names.map((n, i) => (
              <Radar key={n} dataKey={n} name={n} stroke={SERIES[i % SERIES.length]} fill={SERIES[i % SERIES.length]} fillOpacity={0.12} strokeWidth={2} />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      )}

      {spec.kind === "heatmap" && (
        <div className="overflow-x-auto">
          <div className="inline-grid gap-1 text-[0.7rem]" style={{ gridTemplateColumns: `auto repeat(${spec.cols.length}, minmax(48px, 1fr))` }}>
            <div />
            {spec.cols.map((c) => (
              <div key={c} className="px-1 pb-1 text-center font-semibold text-[var(--color-muted)]">{c}</div>
            ))}
            {spec.rows.map((rLabel, ri) => (
              <React.Fragment key={rLabel}>
                <div className="flex items-center pr-2 text-right font-medium text-[var(--color-ink)]">{rLabel}</div>
                {spec.cols.map((c, ci) => {
                  const cell = spec.m[ri][ci];
                  const ratio = cell.value == null ? 0 : cell.value / spec.max;
                  const bg = cell.value == null ? "var(--color-surface-soft)" : `color-mix(in srgb, var(--color-danger) ${Math.round(ratio * 85)}%, var(--color-surface))`;
                  return (
                    <div key={c} title={cell.value == null ? "—" : `${cell.value.toFixed(1)} ${spec.unit} (${cell.date})`}
                      className="flex h-9 items-center justify-center rounded font-mono tabular-nums"
                      style={{ background: bg, color: ratio > 0.5 ? "#fff" : "var(--color-ink)" }}>
                      {cell.value == null ? "—" : cell.value.toFixed(1)}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {spec.kind === "table" && (
        <>
        <div className="relative">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-[0.74rem]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-r border-border bg-[var(--color-bg)] px-2 py-1.5 text-left font-semibold text-[var(--color-muted)]">{lang === "en" ? "Category" : "Categoría"}</th>
                {spec.countries.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-center font-semibold text-[var(--color-ink)] whitespace-nowrap">{countryLabel(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spec.sections.map((sec) => (
                <React.Fragment key={sec.block}>
                  <tr>
                    <td colSpan={spec.countries.length + 1} className="bg-[var(--color-surface-soft)] px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">{sec.block}</td>
                  </tr>
                  {sec.rows.map((r) => (
                    <tr key={r.cat} className="border-t border-border">
                      <td className="sticky left-0 z-10 border-r border-border bg-[var(--color-bg)] px-2 py-1.5 font-semibold text-[var(--color-ink)] whitespace-nowrap">{r.cat}</td>
                      {r.cells.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1.5 text-center">
                          {cell.status === "C" ? (
                            <span className="inline-block rounded px-1.5 py-0.5 text-[0.66rem] font-bold" style={{ background: "color-mix(in srgb, var(--color-success) 18%, transparent)", color: "var(--color-success)" }} title={lang === "en" ? "Current" : "Al corriente"}>C</span>
                          ) : cell.status === "U" ? (
                            <span className="text-[var(--color-muted)]" title={lang === "en" ? "Unavailable" : "No disponible"}>U</span>
                          ) : cell.date ? (
                            <span className="whitespace-nowrap font-mono tabular-nums text-[var(--color-ink)]">{fmtDate(cell.date)}</span>
                          ) : (
                            <span className="text-[var(--color-muted)]">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-7 bg-gradient-to-l from-[var(--color-bg)] to-transparent sm:hidden" aria-hidden />
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[0.66rem] text-[var(--color-muted)] sm:hidden">
          <span aria-hidden>↔</span> {tr(lang, "acTableSwipe")}
        </p>
        </>
      )}

      {spec.kind === "compare" && (
        <ResponsiveContainer width="100%" height={Math.max(160, spec.data.length * 46)}>
          <BarChart data={spec.data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS} tickFormatter={(v: number) => `${v}${yr}`} />
            <YAxis type="category" dataKey="label" tick={AXIS} width={92} />
            <Tooltip
              contentStyle={tip}
              cursor={{ fill: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}
              formatter={(value, _n, item) => {
                const n = value == null ? NaN : Number(value);
                return [Number.isNaN(n) ? "—" : `${n.toFixed(1)} ${lang === "en" ? "years" : "años"} (${item?.payload?.date ?? "—"})`, lang === "en" ? "Wait" : "Espera"];
              }}
            />
            <Bar dataKey="years" radius={[0, 4, 4, 0]}>
              {spec.data.map((d, i) => (
                <Cell key={i} fill={i === 0 ? "var(--color-accent-2)" : "var(--color-accent)"} />
              ))}
              <LabelList dataKey="years" position="right" formatter={(v) => { const n = v == null ? NaN : Number(v); return Number.isNaN(n) ? "" : `${n.toFixed(1)}${yr}`; }} style={{ fill: "var(--color-muted)", fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {spec.kind === "movement" && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={spec.data} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickFormatter={(m: string) => m.slice(2, 7)} minTickGap={28} />
            <YAxis tick={AXIS} width={44} />
            <Tooltip contentStyle={tip} formatter={(value) => { const n = Number(value); return [`${n > 0 ? "+" : ""}${n} ${lang === "en" ? "days" : "días"}`, lang === "en" ? "Movement" : "Movimiento"]; }} />
            <Bar dataKey="movement">
              {spec.data.map((d, i) => (
                <Cell key={i} fill={d.movement >= 0 ? "var(--color-success)" : "var(--color-danger)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {spec.kind === "status" && (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={spec.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={84} innerRadius={44} paddingAngle={2}>
              {spec.data.map((d, i) => (
                <Cell key={i} fill={d.color} stroke="var(--color-bg)" />
              ))}
            </Pie>
            <Tooltip contentStyle={tip} formatter={(value, name) => [Number(value).toLocaleString(lang === "en" ? "en-US" : "es-MX"), name]} />
          </PieChart>
        </ResponsiveContainer>
      )}

      {spec.kind === "status" && (
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {spec.data.map((d) => (
            <span key={d.name} className="flex items-center gap-1.5 text-[0.7rem] text-[var(--color-muted)]">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: d.color }} />
              {d.name}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
