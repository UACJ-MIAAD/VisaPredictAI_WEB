"use client";

// Heavy client module (Recharts). Loaded via next/dynamic from
// components/sections/eda.tsx so the library is only fetched when the
// EDA section mounts. All colors are semantic tokens (light/dark safe).

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
} from "recharts";
import { useLang } from "@/components/lang-provider";
import { seriesLabel, type EdaFacts } from "@/lib/data/eda";

const T = {
  es: {
    backlogTitle: "La fila hoy, serie por serie",
    backlogDesc:
      "Rezago acumulado hoy por serie familiar (tabla Final Action Dates): años entre la fecha de prioridad publicada y el boletín vigente. Las series de México van resaltadas.",
    backlogAxis: "Años de fila",
    years: "años",
    regimeTitle: "Composición de régimen",
    regimeDesc:
      "Cada celda del panel vive en un régimen administrativo: fecha específica (F, la única entrenable), Current (C), Unavailable (U) o sin dato (UNK).",
    regF: "Fecha específica (F)",
    regC: "Current (C)",
    regU: "Unavailable (U)",
    regUNK: "Sin dato (UNK)",
    obsUnit: "celdas",
    retroTitle: "Cronología de retrogresiones",
    retroDesc:
      "{n} eventos de retroceso —{pct} % de los movimientos mensuales observados— agrupados por año: la fila no siempre avanza.",
    retroAxis: "Retrogresiones",
    retroUnit: "eventos",
  },
  en: {
    backlogTitle: "Today\u2019s line, series by series",
    backlogDesc:
      "Backlog accumulated today per family series (Final Action Dates table): years between the published priority date and the current bulletin. Mexico's series are highlighted.",
    backlogAxis: "Years in line",
    years: "years",
    regimeTitle: "Regime composition",
    regimeDesc:
      "Every panel cell lives in an administrative regime: specific date (F, the only trainable one), Current (C), Unavailable (U) or no data (UNK).",
    regF: "Specific date (F)",
    regC: "Current (C)",
    regU: "Unavailable (U)",
    regUNK: "No data (UNK)",
    obsUnit: "cells",
    retroTitle: "Retrogression chronology",
    retroDesc:
      "{n} retrogression events —{pct}% of observed monthly movements— grouped by year: the line does not always move forward.",
    retroAxis: "Retrogressions",
    retroUnit: "events",
  },
};

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-ink)",
};

// AX4: compact chart geometry on narrow phones (category axis + tick size).
// Charts here render client-only (next/dynamic, ssr:false), so reading
// matchMedia inside an effect never causes a hydration mismatch.
function useNarrow(query = "(max-width: 480px)") {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return narrow;
}

// AX1: editorial module (hairline rule), not a bordered card.
function Figure({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="mt-10 border-t-2 border-[var(--color-rule)] pt-4">
      <figcaption className="mb-1 font-serif text-lg font-bold text-[var(--color-ink)]">{title}</figcaption>
      <p className="mb-3 max-w-3xl text-sm text-[var(--color-muted)]">{desc}</p>
      <div role="img" aria-label={`${title}. ${desc}`}>
        {children}
      </div>
    </figure>
  );
}

const fmt = (n: number, lang: string) => n.toLocaleString(lang === "es" ? "es-MX" : "en-US");

export default function EdaCharts({ facts }: { facts: EdaFacts }) {
  const { lang } = useLang();
  const t = T[lang];
  const narrow = useNarrow();

  // ── a. Today's backlog: family FAD series, longest wait first ──────────────
  const backlog = facts.backlog_today
    .filter((b) => b.block === "family" && b.table === "FAD")
    .map((b) => ({
      // audit B4: same normalized label as the gallery captions, so one series
      // reads identically across the whole page
      name: seriesLabel(b.country, b.category, lang),
      years: b.backlog_years,
      mexico: b.country === "mexico",
    }))
    .sort((a, b) => b.years - a.years);

  // ── b. Regime composition ───────────────────────────────────────────────────
  const regime = [
    // audit M5: same semantic mapping as statusColor (panel explorer, same page):
    // F=success (trainable/good), C=accent, U=danger, UNK=muted.
    { key: "F", name: t.regF, value: facts.regime.F, fill: "var(--color-success)" },
    { key: "C", name: t.regC, value: facts.regime.C, fill: "var(--color-accent)" },
    { key: "U", name: t.regU, value: facts.regime.U, fill: "var(--color-danger)" },
    { key: "UNK", name: t.regUNK, value: facts.regime.UNK, fill: "var(--color-muted)" },
  ].filter((d) => d.value > 0);
  const regimeTotal = regime.reduce((s, d) => s + d.value, 0);
  const pctOf = (v: number) => (regimeTotal ? (v / regimeTotal) * 100 : 0);
  // tiny-but-nonzero shares (UNK = 1 cell) read as "<0.01%", never "0.00%"
  const pctLabel = (v: number) => {
    const pct = pctOf(v);
    if (pct > 0 && pct < 0.01) return "<0.01%";
    return `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
  };

  // ── c. Retrogressions per year ──────────────────────────────────────────────
  const byYear = new Map<number, number>();
  for (const e of facts.retro_events) {
    const y = Number(e.date.slice(0, 4));
    if (Number.isFinite(y)) byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const yearKeys = [...byYear.keys()];
  const retro: { year: number; count: number }[] = [];
  if (yearKeys.length) {
    const y0 = Math.min(...yearKeys);
    const y1 = Math.max(...yearKeys);
    for (let y = y0; y <= y1; y++) retro.push({ year: y, count: byYear.get(y) ?? 0 });
  }
  const retroDesc = t.retroDesc
    .replace("{n}", fmt(facts.retro_events.length, lang))
    .replace("{pct}", facts.panel.pct_retro.toFixed(1));

  return (
    <>
      <Figure title={t.backlogTitle} desc={t.backlogDesc}>
        <ResponsiveContainer width="100%" height={Math.max(240, backlog.length * 26 + 48)}>
          <BarChart data={backlog} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--color-muted)" }}
              label={{ value: t.backlogAxis, position: "insideBottom", offset: -2, fontSize: 11, fill: "var(--color-muted)" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={narrow ? 96 : 148}
              tick={{ fontSize: narrow ? 10 : 11, fill: "var(--color-muted)" }}
              interval={0}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ${t.years}`, t.backlogAxis]} />
            <Bar dataKey="years" name={t.backlogAxis} radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {backlog.map((d) => (
                <Cell key={d.name} fill={d.mexico ? "var(--color-accent)" : "var(--color-muted)"} />
              ))}
              <LabelList
                dataKey="years"
                position="right"
                formatter={(v: React.ReactNode) => `${v}`}
                style={{ fontSize: 11, fill: "var(--color-muted)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Figure>

      <Figure title={t.regimeTitle} desc={t.regimeDesc}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={regime}
              dataKey="value"
              nameKey="name"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              stroke="var(--color-surface)"
              labelLine={false}
              isAnimationActive={false}
              label={({ percent }) =>
                percent != null && percent >= 0.05 ? `${Math.round(percent * 100)}%` : ""
              }
            >
              {regime.map((d) => (
                <Cell key={d.key} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, name) => [`${fmt(Number(v ?? 0), lang)} ${t.obsUnit} (${pctLabel(Number(v ?? 0))})`, name]}
            />
            <Legend
              formatter={(value, entry) => {
                const v = (entry?.payload as { value?: number } | undefined)?.value ?? 0;
                return (
                  <span style={{ color: "var(--color-muted)", fontSize: 12 }}>
                    {value} · {pctLabel(v)}
                  </span>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Figure>

      <Figure title={t.retroTitle} desc={retroDesc}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={retro} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--color-muted)" }} interval={3} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={36} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ${t.retroUnit}`, t.retroAxis]} />
            <Bar dataKey="count" name={t.retroAxis} fill="var(--color-danger)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Figure>
    </>
  );
}
