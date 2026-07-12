// Domain analytics for the VisaBot console: entity detection + chart builders
// computed from the real panel (lib/data/visa-panel.ts). The "engineering"
// layer that turns a query (or a tool click) into a chart spec backed by actual
// Visa Bulletin data. No fabricated numbers.
//
// US I1 (PENDIENTES #30): the synthetic-context builders (month table, bulletin
// diff, forecast + their grounding texts, and every chart title) moved to
// synthetic-builders.mjs — a plain-ESM SINGLE SOURCE shared with the Netlify
// chat function, which recomputes the same text server-side from hash-verified
// release data. This module re-exports that surface unchanged for the app, and
// keeps the client-only pieces (entity detection, month parsing, the chart
// builders whose full data never leaves the browser, follow-ups, KPIs).
import { type Panel, type VisaPanelRow, countryLabel, statusColor, PILOT } from "@/lib/data/visa-panel";
import { localeOf } from "@/lib/i18n";
import { type ForecastStore, type ForecastPoint, forecastFor } from "@/lib/data/forecasts";
import {
  chartTitle, monthDays, isoDays, pdYear, epochToYear, epochToDate,
  genericChartNote, forecastText, bulletinDiffText,
  FAM, EMP, MONTHS_ES, MONTHS_EN,
} from "./synthetic-builders.mjs";

export type Lang = "es" | "en";
export { PILOT };

// Shared builders re-exported for the app (single source with the server).
export {
  bandOf, fitDrift, driftBands, buildForecast, forecastText,
  buildMonthTable, monthTableText, buildBulletinDiff, bulletinDiffText,
  monthLabel, chartTitle, genericChartNote,
} from "./synthetic-builders.mjs";
export type { DriftFit, ChartTitleKind } from "./synthetic-builders.mjs";

// ── entity detection (visa domain vocabulary) ───────────────────────────────
const COUNTRY_ALIASES: [RegExp, string][] = [
  [/m[eé]xico|mexican|mexico/i, "mexico"],
  [/\bindia\b|\bindi[oa]\b/i, "india"],
  [/\bchina\b|\bchin[oa]\b/i, "china"],
  [/filipin|philippin/i, "philippines"],
  // "all chargeability" residual area. The bare word "row" is NOT here: it
  // matched English "row" (e.g. "the first row"), a false all_chargeability
  // detection — only the UPPERCASE abbreviation ROW is accepted, below.
  [/all charge?ability|resto del mundo|todos los pa[ií]ses/i, "all_chargeability"],
];

// Collapse letter↔digit separators in category codes so "EB-5", "EB 5", "F2-A"
// match the panel codes EB5/F2A (finding 7). Uppercase form (detectEntities
// works on the uppercased query).
// The optional [AB] suffix must NOT be followed by another letter, or it would
// absorb the first letter of an adjacent word ("F1 backlog"→"F1BACKLOG",
// "EB2 based"→"EB2BASED") and break detection of the most common phrasings.
const normalizeCatsUp = (s: string) =>
  s.replace(/\b(EB|F)[ ._-]?(\d)(?:[ ._-]?([AB])(?![A-Z]))?/g, (_m, p, d, x) => p + d + (x || ""));

export type Entities = { country: string | null; category: string | null; table: string | null; block: string | null };

export function detectEntities(q: string, panel: Panel): Entities {
  const country =
    COUNTRY_ALIASES.find(([re]) => re.test(q))?.[1] ?? (/\bROW\b/.test(q) ? "all_chargeability" : null);
  const up = ` ${normalizeCatsUp(q.toUpperCase())} `;
  // longest category code first so EB5_RURAL wins over EB5
  const cats = [...panel.categories].sort((a, b) => b.length - a.length);
  let category: string | null = null;
  for (const c of cats) {
    // Escape BEFORE widening "_" into [ _-]? — the old inverted order escaped
    // the freshly inserted brackets, turning every underscored code (EB5_RURAL,
    // EB4_RW…) into unmatched literal text that silently degraded to its parent.
    const pat = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/_/g, "[ _-]?");
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
  | { kind: "multiline"; title: string; subtitle: string; yLabel: string; series: { key: string; label: string }[]; data: Record<string, number | string | null>[]; hasForecast?: boolean }
  | { kind: "heatmap"; title: string; subtitle: string; rows: string[]; cols: string[]; m: ({ value: number | null; date: string | null })[][]; max: number; unit: string }
  | { kind: "radar"; title: string; subtitle: string; names: string[]; data: Record<string, number | string | null>[] }
  | { kind: "forecast"; title: string; subtitle: string; yLabel: string; splitMonth: string; note?: string; fallback?: boolean;
      // true when the production forecast STORE failed to load (fetch error), as
      // opposed to `fallback` (this one series has no pre-generated forecast).
      // forecastText must then declare the outage instead of fabricating context.
      productionUnavailable?: boolean;
      data: { month: string; hist: number | null; fc: number | null; band80: [number, number] | null; band95: [number, number] | null; date: string | null }[] }
  | { kind: "table"; title: string; subtitle: string; month: string; tableType: string;
      countries: string[];
      sections: { block: string; rows: { cat: string; cells: ({ status: string; date: string | null })[] }[] }[] }
  | { kind: "bulletinDiff"; title: string; subtitle: string; monthA: string; monthB: string; tableType: string;
      countries: string[];
      summary: { advanced: number; retrogressed: number; toCurrent: number; toUnavailable: number; unchanged: number; other: number;
                 topAdvance: { cat: string; country: string; days: number } | null;
                 topRetro: { cat: string; country: string; days: number } | null };
      sections: { block: string; rows: { cat: string; cells: DiffCell[] }[] }[] };

// One category×country cell of a bulletin-to-bulletin comparison.
export type DiffKind = "advance" | "retro" | "flat" | "toCurrent" | "fromCurrent" | "toUnavailable" | "fromUnavailable" | "appeared" | "disappeared" | "na";
export type DiffCell = {
  kind: DiffKind;
  days: number | null; // signed Δ days (advance > 0, retrogression < 0) when both months are dated F
  fromDate: string | null;
  toDate: string | null;
  fromStatus: string;
  toStatus: string;
};

function latestWaitYears(panel: Panel, country: string, category: string, table: string): { years: number | null; date: string | null } {
  const rows = panel.rows
    .filter((r) => r.country === country && r.category === category && r.table === table && r.status === "F" && r.priorityDate)
    .sort((a, b) => b.bulletinMonth.localeCompare(a.bulletinMonth));
  const latest = rows[0];
  if (!latest || !latest.priorityDate) return { years: null, date: null };
  return { years: Math.max(0, (monthDays(latest.bulletinMonth) - isoDays(latest.priorityDate)) / 365.25), date: latest.priorityDate };
}

// A panel pre-indexed by "country|category|table" → the series' rows sorted asc.
// Built once so the gallery's many buildForecast/seriesSignals calls don't each
// re-scan the whole (~27k-row) panel.
export type PanelIndex = Map<string, VisaPanelRow[]>;
export function buildPanelIndex(panel: Panel): PanelIndex {
  const m: PanelIndex = new Map();
  for (const r of panel.rows) {
    const k = `${r.country}|${r.category}|${r.table}`;
    const arr = m.get(k);
    if (arr) arr.push(r); else m.set(k, [r]);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  return m;
}

// Derived per-series signals for the gallery (backlog + projected movement),
// computed from the real panel + the pre-generated forecast — never hand-typed.
// backlogYears = wait implied by the latest F cutoff; movementDays = how far the
// cutoff is projected to advance (>0) or retrogress (<0) over the whole horizon.
export type SeriesSignals = { backlogYears: number | null; backlogDate: string | null; movementDays: number | null; movementPerYear: number | null };
export function seriesSignals(rows: VisaPanelRow[] | undefined, fc: ForecastPoint[] | null | undefined, horizonMonths: number): SeriesSignals {
  const empty: SeriesSignals = { backlogYears: null, backlogDate: null, movementDays: null, movementPerYear: null };
  if (!rows || !rows.length) return empty;
  const fobs = rows.filter((r) => r.status === "F" && r.priorityDate && r.daysSinceBase != null);
  const last = fobs[fobs.length - 1];
  if (!last || !last.priorityDate) return empty;
  const backlogYears = Math.max(0, (monthDays(last.bulletinMonth) - isoDays(last.priorityDate)) / 365.25);
  let movementDays: number | null = null, movementPerYear: number | null = null;
  if (fc && fc.length && last.daysSinceBase != null) {
    movementDays = fc[fc.length - 1].days - (last.daysSinceBase as number);
    if (horizonMonths > 0) movementPerYear = movementDays / (horizonMonths / 12);
  }
  return { backlogYears, backlogDate: last.priorityDate, movementDays, movementPerYear };
}

// "Does the projected cutoff reach a user's priority date within the horizon?"
// Answered from the already-computed forecast — a static gallery can't do this.
// The base epoch is derived from the data (never a hardcoded 1975).
export function reachesPriorityDate(
  rows: VisaPanelRow[] | undefined, fc: ForecastPoint[] | null | undefined, priorityDate: string,
): { status: "past" | "within" | "beyond" | "invalid"; month: string | null } {
  const bad = { status: "invalid" as const, month: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(priorityDate) || !rows) return bad;
  const m = isoDays(priorityDate);
  if (!Number.isFinite(m)) return bad;
  const fobs = rows.filter((r) => r.status === "F" && r.priorityDate && r.daysSinceBase != null);
  const last = fobs[fobs.length - 1];
  if (!last || last.priorityDate == null || last.daysSinceBase == null) return bad;
  const baseEpoch = isoDays(last.priorityDate) - (last.daysSinceBase as number);
  const pdDays = m - baseEpoch; // user's date in the forecast's daysSinceBase units
  if ((last.daysSinceBase as number) >= pdDays) return { status: "past", month: null };
  if (!fc || !fc.length) return { status: "beyond", month: null };
  const hit = fc.find((p) => p.days >= pdDays);
  return hit ? { status: "within", month: hit.date.slice(0, 7) } : { status: "beyond", month: null };
}

// evolution of the priority date over time (advancing = line goes up)
export function buildLine(panel: Panel, country: string, category: string, table: string, lang: Lang): ChartSpec | null {
  const rows = panel.rows
    .filter((r) => r.country === country && r.category === category && r.table === table)
    .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  if (!rows.some((r) => r.priorityDate)) return null;
  const data = rows.map((r) => ({ month: r.bulletinMonth, year: r.priorityDate ? pdYear(r.priorityDate) : null, date: r.priorityDate }));
  return {
    kind: "line",
    title: chartTitle("line", { country, category, table }, lang),
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
    title: chartTitle("compare", { category, table }, lang),
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
    title: chartTitle("movement", { country, category, table }, lang),
    subtitle: lang === "en" ? "Δ days vs the previous month (green = advance, red = retrogression)" : "Δ días vs el mes anterior (verde = avance, rojo = retroceso)",
    data,
  };
}

// Generic note for the non-table charts so the LLM complements the visual.
export function chartContextNote(chart: ChartSpec, lang: Lang): string | null {
  if (chart.kind === "forecast") return forecastText(chart, lang);
  if (chart.kind === "table") return null; // handled by monthTableText (richer)
  if (chart.kind === "bulletinDiff") return bulletinDiffText(chart, lang);
  return genericChartNote(chart.title, lang);
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
  return {
    kind: "status",
    title: chartTitle("status", filter ?? {}, lang),
    subtitle: lang === "en" ? "How observations split across regimes" : "Cómo se reparten las observaciones por régimen",
    data,
  };
}

// multi-country priority-date race for a category/table (one line per country)
export function buildMultiLine(panel: Panel, category: string, table: string, lang: Lang, forecasts?: ForecastStore | null): ChartSpec | null {
  const byMonth = new Map<string, Record<string, number | string | null>>();
  const present = new Set<string>();
  // last F history row per country → anchors that country's forecast baseline.
  const lastF = new Map<string, { priorityDate: string; daysSinceBase: number; bulletinMonth: string }>();
  for (const r of panel.rows) {
    if (r.category !== category || r.table !== table || !PILOT.includes(r.country) || !r.priorityDate) continue;
    let row = byMonth.get(r.bulletinMonth);
    if (!row) { row = { month: r.bulletinMonth }; byMonth.set(r.bulletinMonth, row); }
    row[r.country] = pdYear(r.priorityDate);
    row[`${r.country}__d`] = r.priorityDate; // real date for the tooltip (not the fractional year)
    present.add(r.country);
    if (r.status === "F" && r.daysSinceBase != null) lastF.set(r.country, { priorityDate: r.priorityDate, daysSinceBase: r.daysSinceBase, bulletinMonth: r.bulletinMonth });
  }
  const series = PILOT.filter((c) => present.has(c)).map((c) => ({ key: c, label: countryLabel(c, lang) }));
  if (series.length < 2) return null;

  // Forecast continuation per country: a dashed same-colour line beyond each
  // country's OWN last history point (real production-model forecast, same maths
  // as buildForecast). Keys `${c}__fc` (value) / `${c}__fcd` (date).
  let hasForecast = false;
  if (forecasts) {
    for (const { key: c } of series) {
      const fc = forecastFor(forecasts, c, category, table);
      const lf = lastF.get(c);
      if (!fc?.length || !lf) continue;
      const baseEpoch = isoDays(lf.priorityDate) - lf.daysSinceBase;
      const seed = byMonth.get(lf.bulletinMonth);
      if (seed) { seed[`${c}__fc`] = seed[c]; seed[`${c}__fcd`] = seed[`${c}__d`]; } // connect the dash to history
      for (const p of fc) {
        const mo = p.date.slice(0, 7);
        let row = byMonth.get(mo);
        if (!row) { row = { month: mo }; byMonth.set(mo, row); }
        row[`${c}__fc`] = epochToYear(baseEpoch + p.days);
        row[`${c}__fcd`] = epochToDate(baseEpoch + p.days);
      }
      hasForecast = true;
    }
  }
  const data = [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  return {
    kind: "multiline",
    title: chartTitle("multiline", { category, table }, lang),
    subtitle: lang === "en"
      ? "Each line is a country's priority date over time (dashed = forecast) — who advances fastest"
      : "Cada línea es la fecha de prioridad de un país en el tiempo (punteado = pronóstico) — quién avanza más rápido",
    yLabel: lang === "en" ? "Priority year" : "Año de prioridad",
    series, data, hasForecast,
  };
}

// Overlay an ARBITRARY set of series (any country/category/table mix) — the
// user's compare basket. Each line is one series' priority date over time; the
// multiline renderer colours by index, so composite keys are fine.
export function buildBasketCompare(
  panel: Panel, items: { country: string; category: string; table: string }[], lang: Lang, index?: PanelIndex,
): ChartSpec | null {
  const byMonth = new Map<string, Record<string, number | string | null>>();
  const series: { key: string; label: string }[] = [];
  for (const it of items) {
    const key = `${it.country}|${it.category}|${it.table}`;
    if (series.some((s) => s.key === key)) continue;
    const rows = (index?.get(key) ?? panel.rows.filter((r) => r.country === it.country && r.category === it.category && r.table === it.table)).filter((r) => r.priorityDate);
    if (!rows.length) continue;
    series.push({ key, label: `${countryLabel(it.country, lang)} · ${it.category} · ${it.table}` });
    for (const r of rows) {
      let row = byMonth.get(r.bulletinMonth);
      if (!row) { row = { month: r.bulletinMonth }; byMonth.set(r.bulletinMonth, row); }
      row[key] = pdYear(r.priorityDate as string);
      row[`${key}__d`] = r.priorityDate as string; // real date for the tooltip
    }
  }
  if (series.length < 2) return null;
  const data = [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  return {
    kind: "multiline",
    title: lang === "en" ? "Compare basket · priority dates" : "Cesta de comparación · fechas de prioridad",
    subtitle: lang === "en" ? "Each line is a pinned series' priority date over time — who advances fastest" : "Cada línea es la fecha de prioridad de una serie fijada — quién avanza más rápido",
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
    title: chartTitle("heatmap", { block, table }, lang),
    subtitle: lang === "en" ? "Years of wait by country × category (latest month; redder = longer)" : "Años de espera por país × categoría (último mes; más rojo = más larga)",
    rows: rows.map((c) => countryLabel(c)), cols, m, max: max || 1, unit: lang === "en" ? "y" : "a",
  };
}

// per-country wait fingerprint across family preferences — radar
export function buildRadar(panel: Panel, table: string, lang: Lang): ChartSpec | null {
  const cats = FAM.filter((c) => panel.categories.includes(c));
  const countries = PILOT.filter((c) => panel.countries.includes(c));
  if (cats.length < 3) return null;
  const names = countries.map((c) => countryLabel(c));
  const data = cats.map((cat) => {
    const o: Record<string, number | string | null> = { cat };
    countries.forEach((c) => { o[countryLabel(c)] = Math.round((latestWaitYears(panel, c, cat, table).years ?? 0) * 10) / 10; });
    return o;
  });
  return {
    kind: "radar",
    title: chartTitle("radar", { table }, lang),
    subtitle: lang === "en" ? "Years of wait across family preferences (latest month)" : "Años de espera por preferencia familiar (último mes)",
    names, data,
  };
}

// ── bulletin-month parsing (client-only: the server receives resolved months) ─
const MON_ABBR: Record<string, number> = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12, dec: 12 };

// Parse a bulletin month from free text → "YYYY-MM" present in the panel, else null.
// Handles "julio 2026", "March 2020", "2026-07", "jul 2010", "3/2018".
export function parseMonth(q: string, panel: Panel): string | null {
  const have = new Set(panel.rows.map((r) => r.bulletinMonth));
  const pick = (y: number, mo: number) => { const s = `${y}-${String(mo).padStart(2, "0")}`; return have.has(s) ? s : null; };
  const t = q.toLowerCase();
  // relative "latest / most recent / último boletín / this month" → newest month.
  // Fold accents first: \b does not fire before an accented "ú" (non-ASCII), so
  // "\búltimo\b" never matched on the raw string.
  const tf = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/\b(latest|most recent|newest|last bulletin|ultimo|mas reciente|este mes|this month)\b/.test(tf)) {
    const all = [...have].sort();
    return all.length ? all[all.length - 1] : null;
  }
  // quarter "Q3 2024" / "tercer trimestre de 2024" → last available month of the quarter
  const qMap: Record<string, number> = { primer: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4 };
  const qm = t.match(/\bq([1-4])\b/) || t.match(/\b(primer|segundo|tercer|tercero|cuarto)\s+trimestre/);
  if (qm) {
    const quarter = qm[1].length === 1 ? +qm[1] : qMap[qm[1]];
    const yq = t.match(/\b(19|20)\d{2}\b/);
    if (yq) for (const mo of [quarter * 3, quarter * 3 - 1, quarter * 3 - 2]) { const s = pick(+yq[0], mo); if (s) return s; }
  }
  // unambiguous numeric forms
  const iso = t.match(/(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  if (iso) return pick(+iso[1], +iso[2]);
  const ym = t.match(/\b(0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (ym) return pick(+ym[2], +ym[1]);

  const yrMatch = t.match(/\b(19|20)\d{2}\b/);
  const yr = yrMatch ? +yrMatch[0] : null;
  const yrPos = yrMatch ? (yrMatch.index ?? -1) : -1;

  // Month by name (full + abbreviation), word-bounded. The English modal "may"
  // is only accepted as a month when it sits next to the year (finding 19: a
  // stray "may" + any year used to resolve to a wrong month). When several
  // months appear, the one nearest the year wins.
  const NAMES: { re: RegExp; mo: number; ambiguous?: boolean }[] = [
    ...MONTHS_ES.map((n, i) => ({ re: new RegExp(`\\b${n}\\b`), mo: i + 1 })),
    ...MONTHS_EN.map((n, i) => ({ re: new RegExp(`\\b${n}\\b`), mo: i + 1, ambiguous: n === "may" })),
    ...Object.entries(MON_ABBR).map(([a, mo]) => ({ re: new RegExp(`\\b${a}\\b`), mo, ambiguous: a === "may" })),
  ];
  let mo: number | null = null, best = Infinity;
  for (const { re, mo: m, ambiguous } of NAMES) {
    const mm = re.exec(t);
    if (!mm) continue;
    const dist = yrPos >= 0 ? Math.abs((mm.index ?? 0) - yrPos) : 0;
    if (ambiguous && (yrPos < 0 || dist > 8)) continue;
    if (dist < best) { best = dist; mo = m; }
  }
  if (mo && yr) return pick(yr, mo);
  // bare year + table intent → latest available month of that year
  if (yr && !mo) { const ms = [...have].filter((s) => s.startsWith(`${yr}-`)).sort(); return ms[ms.length - 1] || null; }
  return null;
}

// Extract TWO distinct bulletin months from free text, e.g. "compara julio 2025
// con julio 2026", "qué cambió entre 2015 y 2026", "diff 2020-07 vs 2026-07",
// "julio y agosto 2026". Returns [older, newer] (both present in the panel) or null.
export function parseTwoMonths(q: string, panel: Panel): [string, string] | null {
  const have = [...new Set(panel.rows.map((r) => r.bulletinMonth))];
  const haveSet = new Set(have);
  const pick = (y: number, mo: number) => { const s = `${y}-${String(mo).padStart(2, "0")}`; return haveSet.has(s) ? s : null; };
  const latestOfYear = (y: number) => { const ms = have.filter((s) => s.startsWith(`${y}-`)).sort(); return ms[ms.length - 1] || null; };
  const t = q.toLowerCase();
  const months = new Set<string>();

  // 1) explicit ISO YYYY-MM
  for (const m of t.matchAll(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/g)) { const s = pick(+m[1], +m[2]); if (s) months.add(s); }

  // 2) year occurrences (position-tagged) → pair each named month with its nearest year
  const years: { y: number; pos: number }[] = [];
  for (const m of t.matchAll(/\b(19|20)\d{2}\b/g)) years.push({ y: +m[0], pos: m.index ?? 0 });
  const nearestYear = (pos: number): number | null =>
    years.length ? years.reduce((best, y) => (Math.abs(y.pos - pos) < Math.abs(best.pos - pos) ? y : best)).y : null;
  const nearestYearDist = (pos: number): number =>
    years.length ? Math.min(...years.map((y) => Math.abs(y.pos - pos))) : Infinity;

  // 3) named / abbreviated months, each resolved with its nearest year
  const NAMES: [string, number][] = [
    ...MONTHS_ES.map((n, i) => [n, i + 1] as [string, number]),
    ...MONTHS_EN.map((n, i) => [n, i + 1] as [string, number]),
    ...Object.entries(MON_ABBR).map(([a, mo]) => [a, mo] as [string, number]),
  ];
  for (const [name, mo] of NAMES) {
    for (const m of t.matchAll(new RegExp(`\\b${name}\\b`, "g"))) {
      const y = nearestYear(m.index ?? 0);
      // modal "may" only counts as a month when it sits NEXT TO the year (mirror
      // parseMonth) — a stray "may" + two bare years otherwise fabricates May.
      if (name === "may" && (y == null || nearestYearDist(m.index ?? 0) > 8)) continue;
      if (y != null) { const s = pick(y, mo); if (s) months.add(s); }
    }
  }

  // 4) two DISTINCT bare years, no resolvable month → latest available month of each
  const distinctYears = [...new Set(years.map((y) => y.y))];
  if (months.size < 2 && distinctYears.length >= 2) for (const y of distinctYears) { const s = latestOfYear(y); if (s) months.add(s); }

  const out = [...months].sort();
  return out.length >= 2 ? [out[0], out[out.length - 1]] : null;
}

// Contextual "next question" chips shown under the latest answer. Entity-aware
// when a panel is available (console); the caller passes a few discovery nudges
// otherwise. Returns up to 3 localized prompts.
export function buildFollowUps(lastUserQ: string, lang: Lang, panel: Panel): string[] {
  const cl = (c: string) => countryLabel(c, lang);
  const e = detectEntities(lastUserQ, panel);
  const other = e.country === "india" ? "mexico" : "india"; // a contrasting pilot country
  const out: string[] = [];
  if (e.country && e.category) {
    out.push(lang === "en" ? `Compare ${cl(e.country)} ${e.category} with ${cl(other)} ${e.category}` : `Compara ${cl(e.country)} ${e.category} con ${cl(other)} ${e.category}`);
    out.push(lang === "en" ? `Monthly movement of ${cl(e.country)} ${e.category}` : `Movimiento mensual de ${cl(e.country)} ${e.category}`);
    out.push(lang === "en" ? `When will ${cl(e.country)} ${e.category} advance?` : `¿Cuándo avanza ${cl(e.country)} ${e.category}?`);
  } else if (e.category) {
    out.push(lang === "en" ? `Compare the wait across countries for ${e.category}` : `Compara la espera entre países en ${e.category}`);
    out.push(lang === "en" ? `Forecast for Mexico ${e.category}` : `Pronóstico de México ${e.category}`);
  } else if (e.country) {
    out.push(lang === "en" ? `Status mix for ${cl(e.country)}` : `Mezcla de estado de ${cl(e.country)}`);
    out.push(lang === "en" ? `Forecast for ${cl(e.country)} F2A` : `Pronóstico de ${cl(e.country)} F2A`);
  }
  const nudges = lang === "en"
    ? ["Compare two bulletins", "Which models does the project compare and which one wins?", "What changed in the latest bulletin?"]
    : ["Compara dos boletines", "¿Qué modelos compara el proyecto y cuál gana?", "¿Qué cambió en el último boletín?"];
  for (const n of nudges) { if (out.length >= 3) break; if (!out.includes(n)) out.push(n); }
  return out.slice(0, 3);
}

// ── KPI panorama (computed once from the panel) ─────────────────────────────
export type Kpi = { label: string; value: string; hint: string };
export function buildPanorama(panel: Panel, lang: Lang): Kpi[] {
  const seriesKeys = new Set(panel.rows.map((r) => `${r.country}|${r.category}|${r.table}`));
  const total = panel.rows.length;
  const fCount = panel.statusCounts["F"] || 0;
  const pctF = total ? Math.round((fCount / total) * 100) : 0;
  const fmt = (n: number) => n.toLocaleString(localeOf(lang));
  return [
    { label: lang === "en" ? "Series" : "Series", value: fmt(seriesKeys.size), hint: lang === "en" ? "country × category × table" : "país × categoría × tabla" },
    { label: lang === "en" ? "Observations" : "Observaciones", value: fmt(total), hint: lang === "en" ? "panel rows y(p,c,b,t)" : "filas del panel y(p,c,b,t)" },
    { label: lang === "en" ? "Predictable (F)" : "Predecibles (F)", value: `${pctF}%`, hint: lang === "en" ? "rows with a final date" : "filas con fecha final" },
    { label: lang === "en" ? "Areas" : "Áreas", value: String(panel.countries.length), hint: lang === "en" ? "countries / chargeability" : "países / cargabilidad" },
    { label: lang === "en" ? "Categories" : "Categorías", value: String(panel.categories.length), hint: lang === "en" ? "family + employment" : "familia + empleo" },
    { label: lang === "en" ? "Latest bulletin" : "Último boletín", value: panel.monthRange[1], hint: `${panel.monthRange[0]} → ${panel.monthRange[1]}` },
  ];
}
