"use client";

// Heavy client module (Recharts + TanStack). Loaded via next/dynamic from
// historico.tsx so these libs are only fetched when the explorer mounts.
import * as React from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { PanelTable } from "@/components/tables/panel-table";
import { countryLabel, statusColor, movementColor, PILOT, type Panel, type VisaPanelRow } from "@/lib/data/visa-panel";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";

const SERIES_COLORS = [
  "var(--color-accent)", "var(--color-accent-2)", "var(--color-success)",
  "var(--color-danger)", "var(--color-muted)",
];
const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  color: "var(--color-ink)",
  fontSize: "0.8rem",
};

function Select({
  label, value, onChange, options, fmt,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; fmt?: (v: string) => string;
}) {
  return (
    <label className="flex flex-col text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // AX6: ≥16px on phones so iOS Safari doesn't auto-zoom on focus
        className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground sm:text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>{fmt ? fmt(o) : o}</option>
        ))}
      </select>
    </label>
  );
}

function ChartCard({
  title, desc, children,
}: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-1 font-serif text-lg font-bold">{title}</figcaption>
      <p className="mb-3 text-sm text-muted-foreground">{desc}</p>
      {children}
    </figure>
  );
}

function NoData({ msg }: { msg: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      {msg}
    </div>
  );
}

export default function PanelExplorer({ panel }: { panel: Panel }) {
  const { lang } = useLang();
  const cats = panel.categories;
  const [country, setCountry] = React.useState(
    panel.countries.includes("mexico") ? "mexico" : panel.countries[0],
  );
  const [category, setCategory] = React.useState(cats.includes("F1") ? "F1" : cats[0]);
  const [table, setTable] = React.useState(
    panel.tables.includes("FAD") ? "FAD" : panel.tables[0],
  );

  const timeSeries = React.useMemo(
    () =>
      panel.rows
        .filter((r) => r.country === country && r.category === category && r.table === table)
        .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth))
        .map((r) => ({ month: r.bulletinMonth, days: r.daysSinceBase })),
    [panel, country, category, table],
  );
  const hasSeries = timeSeries.some((d) => d.days != null);

  const comparison = React.useMemo(() => {
    const byMonth = new Map<string, Record<string, number | string | null>>();
    for (const r of panel.rows) {
      if (r.category !== category || r.table !== table) continue;
      if (!PILOT.includes(r.country)) continue;
      let row = byMonth.get(r.bulletinMonth);
      if (!row) { row = { month: r.bulletinMonth }; byMonth.set(r.bulletinMonth, row); }
      row[r.country] = r.daysSinceBase;
    }
    return [...byMonth.values()].sort((a, b) =>
      String(a.month).localeCompare(String(b.month)),
    );
  }, [panel, category, table]);
  const compCountries = PILOT.filter((c) => panel.countries.includes(c));
  const hasComparison = comparison.length > 0;

  const movement = React.useMemo(
    () =>
      panel.rows
        .filter((r) => r.country === country && r.category === category && r.table === table && r.movement != null)
        .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth))
        .map((r) => ({ month: r.bulletinMonth, movement: r.movement as number })),
    [panel, country, category, table],
  );
  const hasMovement = movement.length > 0;

  const statusData = React.useMemo(() => {
    const total = Object.values(panel.statusCounts).reduce((a, b) => a + b, 0);
    return Object.entries(panel.statusCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, pct: ((value / total) * 100).toFixed(1) }));
  }, [panel]);

  const [fCountry, setFCountry] = React.useState("todos");
  const [fCategory, setFCategory] = React.useState("todos");
  const [fTable, setFTable] = React.useState("todos");
  const [fStatus, setFStatus] = React.useState("todos");
  const tableRows = React.useMemo<VisaPanelRow[]>(
    () =>
      panel.rows.filter(
        (r) =>
          (fCountry === "todos" || r.country === fCountry) &&
          (fCategory === "todos" || r.category === fCategory) &&
          (fTable === "todos" || r.table === fTable) &&
          (fStatus === "todos" || r.status === fStatus),
      ),
    [panel, fCountry, fCategory, fTable, fStatus],
  );
  const statuses = Object.keys(panel.statusCounts);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4">
        <Select label={tr(lang, "selCountry")} value={country} onChange={(v) => { track("Explorer Filter", { dim: "country" }); setCountry(v); }} options={panel.countries} fmt={(v) => countryLabel(v, lang)} />
        <Select label={tr(lang, "selCategoryL")} value={category} onChange={(v) => { track("Explorer Filter", { dim: "category" }); setCategory(v); }} options={cats} />
        <Select label={tr(lang, "selTableL")} value={table} onChange={(v) => { track("Explorer Filter", { dim: "table" }); setTable(v); }} options={panel.tables} />
      </div>

      <ChartCard
        title={tr(lang, "chart1Title")}
        desc={`${countryLabel(country, lang)} · ${category} · ${table}. ${tr(lang, "chart1Desc")}`}
      >
        {hasSeries ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={timeSeries} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted)" }} minTickGap={48} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={56} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="days" name={tr(lang, "seriesDays")} stroke="var(--color-accent)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <NoData msg={tr(lang, "chart1Empty")} />
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={tr(lang, "chart2Title")} desc={`${category} · ${table}. ${tr(lang, "chart2Desc")}`}>
          {hasComparison ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={comparison} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted)" }} minTickGap={48} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={56} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                {compCountries.map((c, i) => (
                  <Line key={c} type="monotone" dataKey={c} name={countryLabel(c, lang)} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} dot={false} strokeWidth={1.6} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <NoData msg={tr(lang, "chart2Empty")} />
          )}
        </ChartCard>

        <ChartCard title={tr(lang, "chart3Title")} desc={`${countryLabel(country, lang)} · ${category} · ${table}. ${tr(lang, "chart3Desc")}`}>
          {hasMovement ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={movement} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted)" }} minTickGap={48} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={56} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="movement" name={tr(lang, "seriesDelta")}>
                  {movement.map((m, i) => (
                    <Cell key={i} fill={movementColor(m.movement)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoData msg={tr(lang, "chart3Empty")} />
          )}
        </ChartCard>
      </div>

      <ChartCard title={tr(lang, "chart4Title")} desc={tr(lang, "chart4Desc")}>
        <div className="flex flex-col items-center gap-6 md:flex-row">
          {/* AX8: size via a plain wrapper instead of !important on the
              ResponsiveContainer (md:!w-1/2 fought its inline width) */}
          <div className="w-full md:w-1/2">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={2}>
                  {statusData.map((d) => (
                    <Cell key={d.name} fill={statusColor(d.name)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-2 md:w-1/2">
            {statusData.map((d) => (
              <li key={d.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: statusColor(d.name) }} />
                  <strong className="font-mono">{d.name}</strong>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {d.value.toLocaleString(lang === "en" ? "en-US" : "es-MX")} · {d.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </ChartCard>

      <div>
        <h3 className="mb-1 font-serif text-2xl font-bold">{tr(lang, "tableTitle")}</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          {panel.rows.length.toLocaleString(lang === "en" ? "en-US" : "es-MX")}{" "}
          {tr(lang, "tableDescA")}
        </p>
        <div className="mb-3 flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4">
          <Select label={tr(lang, "selCountry")} value={fCountry} onChange={setFCountry} options={["todos", ...panel.countries]} fmt={(v) => (v === "todos" ? tr(lang, "optAll") : countryLabel(v, lang))} />
          <Select label={tr(lang, "selCategoryL")} value={fCategory} onChange={setFCategory} options={["todos", ...cats]} fmt={(v) => (v === "todos" ? tr(lang, "optAllF") : v)} />
          <Select label={tr(lang, "selTableL")} value={fTable} onChange={setFTable} options={["todos", ...panel.tables]} fmt={(v) => (v === "todos" ? tr(lang, "optAllF") : v)} />
          <Select label={tr(lang, "selStatusL")} value={fStatus} onChange={setFStatus} options={["todos", ...statuses]} fmt={(v) => (v === "todos" ? tr(lang, "optAll") : v)} />
        </div>
        {tableRows.length ? (
          <PanelTable rows={tableRows} lang={lang} />
        ) : (
          <NoData msg={tr(lang, "tableEmpty")} />
        )}
      </div>
    </div>
  );
}
