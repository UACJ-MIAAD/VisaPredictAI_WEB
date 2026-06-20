"use client";

// Recharts renderer for a VisaBot ChartSpec. Lazy-loaded (next/dynamic) so
// Recharts only ships when the first chart renders. Themed via tokens.
import * as React from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import type { ChartSpec } from "@/lib/visabot/analytics";
import { useLang } from "@/components/lang-provider";

const AXIS = { fontSize: 11, fill: "var(--color-muted)" };
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
    <figure className="mt-2 rounded-xl border border-border bg-[var(--color-bg)] p-3">
      <figcaption className="mb-0.5 font-serif text-sm font-bold text-[var(--color-ink)]">{spec.title}</figcaption>
      <p className="mb-2 text-[0.72rem] text-[var(--color-muted)]">{spec.subtitle}</p>

      {spec.kind === "line" && (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={spec.data} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickFormatter={(m: string) => m.slice(0, 4)} minTickGap={36} />
            <YAxis tick={AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => String(Math.round(v))} width={44} />
            <Tooltip
              contentStyle={tip}
              labelFormatter={(m) => String(m)}
              formatter={(_v, _n, item) => [item?.payload?.date ?? "—", lang === "en" ? "Priority date" : "Fecha prioridad"]}
            />
            <Line type="monotone" dataKey="year" stroke="var(--color-accent)" strokeWidth={2.2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
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
