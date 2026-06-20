// Domain analytics for the VisaBot console: entity detection + chart builders
// computed from the real panel (lib/data/visa-panel.ts). This is the
// "engineering" layer EpiBot had — turning a query (or a tool click) into a
// chart spec backed by actual Visa Bulletin data. No fabricated numbers.
import { type Panel, type VisaPanelRow, countryLabel, statusColor } from "@/lib/data/visa-panel";

export type Lang = "es" | "en";
export const PILOT = ["mexico", "india", "china", "philippines", "all_chargeability"];

// ── entity detection (visa domain vocabulary) ───────────────────────────────
const COUNTRY_ALIASES: [RegExp, string][] = [
  [/m[eé]xico|mexican|mexico/i, "mexico"],
  [/\bindia\b|\bindi[oa]\b/i, "india"],
  [/\bchina\b|\bchin[oa]\b/i, "china"],
  [/filipin|philippin/i, "philippines"],
  [/all charge?ability|resto del mundo|todos los pa[ií]ses|\brow\b/i, "all_chargeability"],
];

export type Entities = { country: string | null; category: string | null; table: string | null; block: string | null };

export function detectEntities(q: string, panel: Panel): Entities {
  const country = COUNTRY_ALIASES.find(([re]) => re.test(q))?.[1] ?? null;
  const up = ` ${q.toUpperCase()} `;
  // longest category code first so EB5_RURAL wins over EB5
  const cats = [...panel.categories].sort((a, b) => b.length - a.length);
  let category: string | null = null;
  for (const c of cats) {
    const pat = c.replace(/[_]/g, "[ _-]?").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?<![A-Z0-9])${pat}(?![A-Z0-9])`).test(up)) { category = c; break; }
  }
  const table = /\bDFF\b|DATES FOR FILING|PRESENTACI/i.test(q)
    ? "DFF"
    : /\bFAD\b|FINAL ACTION|ACCI[OÓ]N FINAL/i.test(q)
      ? "FAD"
      : null;
  const block = /\bempleo\b|employment|\bEB\b/i.test(q) || /\bEB[1-5]/i.test(q)
    ? "empleo"
    : /\bfamilia\b|family|\bF[1-4]/i.test(q)
      ? "familia"
      : null;
  return { country, category, table, block };
}

// ── chart specs ─────────────────────────────────────────────────────────────
export type ChartSpec =
  | { kind: "line"; title: string; subtitle: string; yLabel: string; data: { month: string; year: number | null; date: string | null }[] }
  | { kind: "compare"; title: string; subtitle: string; data: { country: string; label: string; years: number | null; date: string | null }[] }
  | { kind: "movement"; title: string; subtitle: string; data: { month: string; movement: number }[] }
  | { kind: "status"; title: string; subtitle: string; data: { name: string; value: number; color: string }[] }
  | { kind: "multiline"; title: string; subtitle: string; yLabel: string; series: { key: string; label: string }[]; data: Record<string, number | string | null>[] }
  | { kind: "heatmap"; title: string; subtitle: string; rows: string[]; cols: string[]; m: ({ value: number | null; date: string | null })[][]; max: number; unit: string }
  | { kind: "radar"; title: string; subtitle: string; names: string[]; data: Record<string, number | string | null>[] };

function latestWaitYears(panel: Panel, country: string, category: string, table: string): { years: number | null; date: string | null } {
  const rows = panel.rows
    .filter((r) => r.country === country && r.category === category && r.table === table && r.status === "F" && r.priorityDate)
    .sort((a, b) => b.bulletinMonth.localeCompare(a.bulletinMonth));
  const latest = rows[0];
  if (!latest || !latest.priorityDate) return { years: null, date: null };
  return { years: Math.max(0, (monthDays(latest.bulletinMonth) - isoDays(latest.priorityDate)) / 365.25), date: latest.priorityDate };
}

const FAM = ["F1", "F2A", "F2B", "F3", "F4"];
const EMP = ["EB1", "EB2", "EB3", "EB4", "EB5"];

const monthDays = (m: string) => { const [y, mo] = m.split("-").map(Number); return Date.UTC(y, mo - 1, 1) / 86400000; };
const isoDays = (d: string) => { const [y, mo, da] = d.split("-").map(Number); return Date.UTC(y, mo - 1, da || 1) / 86400000; };
const pdYear = (d: string) => { const [y, mo, da] = d.split("-").map(Number); return y + (mo - 1) / 12 + (da - 1) / 365; };

const seriesTitle = (e: { country: string; category: string; table: string }) =>
  `${countryLabel(e.country)} · ${e.category} · ${e.table}`;

// evolution of the priority date over time (advancing = line goes up)
export function buildLine(panel: Panel, country: string, category: string, table: string, lang: Lang): ChartSpec | null {
  const rows = panel.rows
    .filter((r) => r.country === country && r.category === category && r.table === table)
    .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  if (!rows.some((r) => r.priorityDate)) return null;
  const data = rows.map((r) => ({ month: r.bulletinMonth, year: r.priorityDate ? pdYear(r.priorityDate) : null, date: r.priorityDate }));
  return {
    kind: "line",
    title: seriesTitle({ country, category, table }),
    subtitle: lang === "en" ? "Priority date over time (higher = the queue advancing)" : "Fecha de prioridad en el tiempo (más alto = la cola avanzando)",
    yLabel: lang === "en" ? "Priority year" : "Año de prioridad",
    data,
  };
}

// latest wait (backlog) by country for a category/table — the Latinometrics view
export function buildCompare(panel: Panel, category: string, table: string, lang: Lang): ChartSpec | null {
  const out: { country: string; label: string; years: number | null; date: string | null }[] = [];
  for (const c of PILOT) {
    if (!panel.countries.includes(c)) continue;
    const rows = panel.rows
      .filter((r) => r.country === c && r.category === category && r.table === table && r.status === "F" && r.priorityDate)
      .sort((a, b) => b.bulletinMonth.localeCompare(a.bulletinMonth));
    const latest = rows[0];
    if (!latest || !latest.priorityDate) { out.push({ country: c, label: countryLabel(c), years: null, date: null }); continue; }
    const years = (monthDays(latest.bulletinMonth) - isoDays(latest.priorityDate)) / 365.25;
    out.push({ country: c, label: countryLabel(c), years: Math.max(0, years), date: latest.priorityDate });
  }
  if (!out.some((d) => d.years != null)) return null;
  out.sort((a, b) => (b.years ?? -1) - (a.years ?? -1));
  return {
    kind: "compare",
    title: lang === "en" ? `Backlog by country · ${category} · ${table}` : `Espera por país · ${category} · ${table}`,
    subtitle: lang === "en" ? "Years between the bulletin and the current priority date (latest month)" : "Años entre el boletín y la fecha de prioridad vigente (último mes)",
    data: out,
  };
}

// month-to-month movement (advances vs retrogressions) for a series
export function buildMovement(panel: Panel, country: string, category: string, table: string, lang: Lang, last = 48): ChartSpec | null {
  const rows = panel.rows
    .filter((r) => r.country === country && r.category === category && r.table === table && r.movement != null)
    .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  if (!rows.length) return null;
  const data = rows.slice(-last).map((r) => ({ month: r.bulletinMonth, movement: r.movement as number }));
  return {
    kind: "movement",
    title: lang === "en" ? `Monthly movement · ${seriesTitle({ country, category, table })}` : `Movimiento mensual · ${seriesTitle({ country, category, table })}`,
    subtitle: lang === "en" ? "Δ days vs the previous month (green = advance, red = retrogression)" : "Δ días vs el mes anterior (verde = avance, rojo = retroceso)",
    data,
  };
}

// status distribution (C/F/U/UNK) — overall or for a slice
export function buildStatus(panel: Panel, lang: Lang, filter?: Partial<Pick<VisaPanelRow, "country" | "category" | "table">>): ChartSpec {
  const labelOf = (s: string) => (s === "F" ? (lang === "en" ? "Final (F)" : "Final (F)") : s === "C" ? "Current (C)" : s === "U" ? (lang === "en" ? "Unavailable (U)" : "No disp. (U)") : s);
  const counts: Record<string, number> = {};
  for (const r of panel.rows) {
    if (filter?.country && r.country !== filter.country) continue;
    if (filter?.category && r.category !== filter.category) continue;
    if (filter?.table && r.table !== filter.table) continue;
    counts[r.status] = (counts[r.status] || 0) + 1;
  }
  const data = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([s, value]) => ({ name: labelOf(s), value, color: statusColor(s) }));
  const scope = filter && (filter.country || filter.category || filter.table)
    ? [filter.country ? countryLabel(filter.country) : null, filter.category, filter.table].filter(Boolean).join(" · ")
    : (lang === "en" ? "whole panel" : "todo el panel");
  return {
    kind: "status",
    title: lang === "en" ? `Status mix · ${scope}` : `Mezcla de estado · ${scope}`,
    subtitle: lang === "en" ? "How observations split across regimes" : "Cómo se reparten las observaciones por régimen",
    data,
  };
}

// multi-country priority-date race for a category/table (one line per country)
export function buildMultiLine(panel: Panel, category: string, table: string, lang: Lang): ChartSpec | null {
  const byMonth = new Map<string, Record<string, number | string | null>>();
  const present = new Set<string>();
  for (const r of panel.rows) {
    if (r.category !== category || r.table !== table || !PILOT.includes(r.country) || !r.priorityDate) continue;
    let row = byMonth.get(r.bulletinMonth);
    if (!row) { row = { month: r.bulletinMonth }; byMonth.set(r.bulletinMonth, row); }
    row[r.country] = pdYear(r.priorityDate);
    present.add(r.country);
  }
  const series = PILOT.filter((c) => present.has(c)).map((c) => ({ key: c, label: countryLabel(c) }));
  if (series.length < 2) return null;
  const data = [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  return {
    kind: "multiline",
    title: lang === "en" ? `Priority-date race · ${category} · ${table}` : `Carrera de fechas · ${category} · ${table}`,
    subtitle: lang === "en" ? "Each line is a country's priority date over time — who advances fastest" : "Cada línea es la fecha de prioridad de un país en el tiempo — quién avanza más rápido",
    yLabel: lang === "en" ? "Priority year" : "Año de prioridad",
    series, data,
  };
}

// country × category matrix of current wait (years) — the brutal heat grid
export function buildHeatmap(panel: Panel, block: string, table: string, lang: Lang): ChartSpec | null {
  const cols = (block === "empleo" ? EMP : FAM).filter((c) => panel.categories.includes(c));
  const rows = PILOT.filter((c) => panel.countries.includes(c));
  if (!cols.length || !rows.length) return null;
  let max = 0;
  const m = rows.map((country) =>
    cols.map((cat) => { const w = latestWaitYears(panel, country, cat, table); if (w.years != null) max = Math.max(max, w.years); return { value: w.years, date: w.date }; }),
  );
  return {
    kind: "heatmap",
    title: lang === "en" ? `Wait heatmap · ${block === "empleo" ? "employment" : "family"} · ${table}` : `Mapa de calor de espera · ${block === "empleo" ? "empleo" : "familia"} · ${table}`,
    subtitle: lang === "en" ? "Years of wait by country × category (latest month; redder = longer)" : "Años de espera por país × categoría (último mes; más rojo = más larga)",
    rows: rows.map(countryLabel), cols, m, max: max || 1, unit: lang === "en" ? "y" : "a",
  };
}

// per-country wait fingerprint across family preferences — radar
export function buildRadar(panel: Panel, table: string, lang: Lang): ChartSpec | null {
  const cats = FAM.filter((c) => panel.categories.includes(c));
  const countries = PILOT.filter((c) => panel.countries.includes(c));
  if (cats.length < 3) return null;
  const names = countries.map(countryLabel);
  const data = cats.map((cat) => {
    const o: Record<string, number | string | null> = { cat };
    countries.forEach((c) => { o[countryLabel(c)] = Math.round((latestWaitYears(panel, c, cat, table).years ?? 0) * 10) / 10; });
    return o;
  });
  return {
    kind: "radar",
    title: lang === "en" ? `Wait fingerprint by country · ${table}` : `Huella de espera por país · ${table}`,
    subtitle: lang === "en" ? "Years of wait across family preferences (latest month)" : "Años de espera por preferencia familiar (último mes)",
    names, data,
  };
}

// ── KPI panorama (computed once from the panel) ─────────────────────────────
export type Kpi = { label: string; value: string; hint: string };
export function buildPanorama(panel: Panel, lang: Lang): Kpi[] {
  const seriesKeys = new Set(panel.rows.map((r) => `${r.country}|${r.category}|${r.table}`));
  const total = panel.rows.length;
  const fCount = panel.statusCounts["F"] || 0;
  const pctF = total ? Math.round((fCount / total) * 100) : 0;
  const fmt = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "es-MX");
  return [
    { label: lang === "en" ? "Series" : "Series", value: fmt(seriesKeys.size), hint: lang === "en" ? "country × category × table" : "país × categoría × tabla" },
    { label: lang === "en" ? "Observations" : "Observaciones", value: fmt(total), hint: lang === "en" ? "panel rows y(p,c,b,t)" : "filas del panel y(p,c,b,t)" },
    { label: lang === "en" ? "Predictable (F)" : "Predecibles (F)", value: `${pctF}%`, hint: lang === "en" ? "rows with a final date" : "filas con fecha final" },
    { label: lang === "en" ? "Areas" : "Áreas", value: String(panel.countries.length), hint: lang === "en" ? "countries / chargeability" : "países / cargabilidad" },
    { label: lang === "en" ? "Categories" : "Categorías", value: String(panel.categories.length), hint: lang === "en" ? "family + employment" : "familia + empleo" },
    { label: lang === "en" ? "Latest bulletin" : "Último boletín", value: panel.monthRange[1], hint: `${panel.monthRange[0]} → ${panel.monthRange[1]}` },
  ];
}
