// Domain analytics for the VisaBot console: entity detection + chart builders
// computed from the real panel (lib/data/visa-panel.ts). The "engineering"
// layer that turns a query (or a tool click) into a chart spec backed by actual
// Visa Bulletin data. No fabricated numbers.
import { type Panel, type VisaPanelRow, countryLabel, statusColor, PILOT } from "@/lib/data/visa-panel";
import { localeOf } from "@/lib/i18n";
import { type ForecastStore, type ForecastPoint, forecastFor, forecastMetaFor } from "@/lib/data/forecasts";

export type Lang = "es" | "en";
export { PILOT };

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

const FAM = ["F1", "F2A", "F2B", "F3", "F4"];
const EMP = ["EB1", "EB2", "EB3", "EB4", "EB5"];

const monthDays = (m: string) => { const [y, mo] = m.split("-").map(Number); return Date.UTC(y, mo - 1, 1) / 86400000; };
const isoDays = (d: string) => { const [y, mo, da] = d.split("-").map(Number); return Date.UTC(y, mo - 1, da || 1) / 86400000; };
// Decimal year of a priority date. Uses the SAME days→year transform as the
// forecast points (epochToYear = 1970 + days/365.25) so the history line and the
// projection meet continuously at the split (P3: history divided the day by 365
// and the month by 12, while forecast points used /365.25 — a visible kink).
const pdYear = (d: string) => 1970 + isoDays(d) / 365.25;

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

// ── forecast (the project's whole point) ────────────────────────────────────
// In-browser baseline: local-drift trend over the recent Final-status window,
// with a random-walk prediction interval that widens with the horizon. This is
// one of the project's own reference models (naïve drift / Theta family); the
// full evaluation also compares SARIMA, ETS and deep models. Real data only,
// no fabricated cutoffs — clearly labelled as an illustrative projection.
const Z80 = 1.2816, Z95 = 1.96, DAYS_Y = 365.25;
const nextMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
const epochToYear = (e: number) => 1970 + e / DAYS_Y;
const epochToDate = (e: number) => { const d = new Date(e * 86400000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };

// Band cells in the forecast data are typed `[number, number] | null` because
// history rows carry no band — but the projected points always do (both the
// production and the drift paths write them). Narrow once here instead of
// scattering `as [number, number]` casts; a (theoretically impossible) null
// degrades to NaN bounds, which render as "NaN" instead of throwing.
export const bandOf = (b: [number, number] | null | undefined): [number, number] => b ?? [NaN, NaN];

// ── drift-baseline primitives (pure; exported for unit tests) ───────────────
// OLS regression of the series on its observation index 0..n-1. `slope` is the
// per-month drift, `sigma` the residual std-dev (n−2 dof), `last` the final
// observed value — the anchor every projected point extends from.
export type DriftFit = { slope: number; sigma: number; last: number };

export function fitDrift(ys: number[]): DriftFit {
  const n = ys.length;
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (i - mx) ** 2; sxy += (i - mx) * (ys[i] - my); }
  const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (ys[i] - (intercept + slope * i)) ** 2;
  const sigma = Math.sqrt(ss / Math.max(1, n - 2));
  return { slope, sigma, last: ys[n - 1] };
}

// Point + 80/95 % bands at horizon h (months ahead). The half-width grows with
// √h — the random-walk spread of THIS illustrative in-browser baseline (its
// own documented method; the production bands ship pre-computed with
// per-horizon empirical quantiles and never go through here).
export function driftBands(fit: DriftFit, h: number): { point: number; lo80: number; hi80: number; lo95: number; hi95: number } {
  const point = fit.last + fit.slope * h, half = fit.sigma * Math.sqrt(h);
  return { point, lo80: point - Z80 * half, hi80: point + Z80 * half, lo95: point - Z95 * half, hi95: point + Z95 * half };
}

export function buildForecast(panel: Panel, country: string, category: string, table: string, lang: Lang, horizon = 12, window = 48, forecasts?: ForecastStore | null, index?: PanelIndex): ChartSpec | null {
  // When a pre-built index is supplied (gallery: many cards over one panel), use
  // the O(1) slice instead of scanning all panel.rows per call. Same rows, sorted.
  const series = index?.get(`${country}|${category}|${table}`) ??
    panel.rows
      .filter((r) => r.country === country && r.category === category && r.table === table)
      .sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  const fobs = series.filter((r) => r.status === "F" && r.daysSinceBase != null && r.priorityDate);
  if (fobs.length < 8) return null; // too short to anchor an honest forecast

  const win = fobs.slice(-Math.max(window, 12));
  const last = win[win.length - 1];
  const baseEpoch = isoDays(last.priorityDate as string) - (last.daysSinceBase as number); // → base epoch (days since 1970)
  const yr = (d: number) => epochToYear(baseEpoch + d);
  const data: Extract<ChartSpec, { kind: "forecast" }>["data"] = win.map((r) => ({
    month: r.bulletinMonth, hist: pdYear(r.priorityDate as string), fc: null, band80: null, band95: null, date: r.priorityDate,
  }));
  // seed the forecast line at the split so it connects to history
  data[data.length - 1].fc = data[data.length - 1].hist;
  data[data.length - 1].band80 = [data[data.length - 1].hist as number, data[data.length - 1].hist as number];
  data[data.length - 1].band95 = data[data.length - 1].band80;

  // 1) Real production-model forecast (pre-generated). 2) drift baseline fallback.
  const real = forecastFor(forecasts ?? null, country, category, table);
  let subtitle: string;
  let note: string | undefined;
  if (real && real.length) {
    for (const p of real)
      data.push({ month: p.date.slice(0, 7), hist: null, fc: yr(p.days), date: epochToDate(baseEpoch + p.days),
        band80: [yr(p.lo80), yr(p.hi80)], band95: [yr(p.lo95), yr(p.hi95)] });
    const meta = forecastMetaFor(forecasts ?? null, country, category, table);
    // Fallback label comes from the meta's method map (shipped with the forecasts),
    // never hardcoded — if the deployed champion changes, this follows automatically.
    const mlabel = meta?.models?.length
      ? meta.models.join("+")
      : (forecasts?.method?.[table] ?? (lang === "en" ? "production model" : "modelo de producción"));
    const mase = meta && Number.isFinite(meta.mase) ? (lang === "en" ? ` · hold-out MASE ${meta.mase}` : ` · MASE hold-out ${meta.mase}`) : "";
    subtitle = lang === "en"
      ? `Production-model forecast (${mlabel}) · 80 % / 95 % bands (conformal · per-horizon empirical quantiles)${mase}`
      : `Pronóstico del modelo de producción (${mlabel}) · bandas 80 % / 95 % (conformes · cuantiles empíricos por horizonte)${mase}`;
    // Prospective track record (real frozen forecasts vs realized cutoffs) — global.
    const sc = (forecasts ?? null)?.scorecard;
    if (sc) {
      // Guard each horizon: a missing by_horizon key must not render "±NaN d" (P2).
      const maeAt = (k: number) => { const v = sc.by_horizon[String(k)]?.mae_days; return Number.isFinite(v) ? Math.round(v as number) : null; };
      const hs = ([3, 6, 12] as const)
        .map((h) => [h, maeAt(h)] as const)
        .filter(([, v]) => v != null)
        .map(([h, v]) => (lang === "en" ? `±${v} d at ${h} mo` : `±${v} d a ${h} m`));
      const cov = Number.isFinite(sc.overall?.cov95) ? Math.round(sc.overall.cov95 * 100) : null;
      const errClause = hs.length ? (lang === "en" ? `typical error ${hs.join(" · ")}. ` : `error típico ${hs.join(" · ")}. `) : "";
      const covClause = cov != null
        ? (lang === "en" ? `The 95 % band held in ${cov} % of cases overall (lower at the longest horizons).` : `La banda al 95 % acertó en el ${cov} % de los casos en conjunto (menor a los horizontes más largos).`)
        : "";
      if (errClause || covClause) {
        note = lang === "en"
          ? `Verified accuracy, global across all series (${sc.n_scored} forecasts scored vs already-published cutoffs; a leakage-free backfill): ${errClause}${covClause}`
          : `Precisión verificada, global de todas las series (${sc.n_scored} pronósticos evaluados vs cortes ya publicados; backfill sin fuga de información): ${errClause}${covClause}`;
      }
    }
  } else {
    // fit.last === the window's final daysSinceBase (the old `anchorDays`).
    const fit = fitDrift(win.map((r) => r.daysSinceBase as number));
    let m = last.bulletinMonth;
    for (let h = 1; h <= horizon; h++) {
      m = nextMonth(m);
      const b = driftBands(fit, h);
      data.push({ month: m, hist: null, fc: yr(b.point), date: epochToDate(baseEpoch + b.point),
        band80: [yr(b.lo80), yr(b.hi80)],
        band95: [yr(b.lo95), yr(b.hi95)] });
    }
    const perYear = fit.slope * 12;
    const dir = lang === "en" ? (perYear >= 0 ? "advancing" : "retrogressing") : (perYear >= 0 ? "avanzando" : "retrocediendo");
    subtitle = lang === "en"
      ? `Illustrative ${horizon}-month projection (in-browser drift baseline, ${dir} ~${Math.abs(Math.round(perYear))} days/yr) with 80 % / 95 % bands`
      : `Proyección ilustrativa a ${horizon} meses (línea base de deriva en el navegador, ${dir} ~${Math.abs(Math.round(perYear))} días/año) con bandas al 80 % / 95 %`;
  }
  return {
    kind: "forecast", splitMonth: last.bulletinMonth, note, fallback: !(real && real.length),
    // Explicit fail-closed signal (I2): the store loaded with an error state, so
    // the drift chart may render (labelled illustrative) but the LLM grounding
    // note must not present forecast figures as the production model's.
    productionUnavailable: forecasts?.status === "production_unavailable" || undefined,
    title: lang === "en" ? `Forecast · ${seriesTitle({ country, category, table })}` : `Pronóstico · ${seriesTitle({ country, category, table })}`,
    subtitle,
    yLabel: lang === "en" ? "Priority year" : "Año de prioridad",
    data,
  };
}

// Grounding text so the LLM references the rendered forecast instead of denying
// it can show charts. Carries the real numbers it can quote.
export function forecastText(spec: Extract<ChartSpec, { kind: "forecast" }>, lang: Lang): string {
  const lastHist = [...spec.data].filter((d) => d.hist != null).pop();
  // I2 fail-closed: the production forecast store did not load. Do NOT fabricate
  // forecast context for the LLM — declare the outage (the UI may still show the
  // drift chart, which is labelled "illustrative" on its own subtitle) and give
  // only real panel facts (title + last published cutoff). Fixed template: it
  // must keep matching its NOTE_SKELETON in netlify/functions/chat.mjs.
  if (spec.productionUnavailable) {
    return lang === "en"
      ? `A FORECAST CHART could not be grounded: the production forecast feed is unavailable right now. ${spec.title}. Last real cutoff: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). The interface may show an in-browser drift projection clearly labelled as illustrative, but do NOT present its figures as the system's forecast and do NOT give any projected date or estimate. Tell the user the production forecast is temporarily unavailable and refer them to the official Visa Bulletin (travel.state.gov).`
      : `No fue posible anclar el GRÁFICO DE PRONÓSTICO: el pronóstico del modelo de producción no está disponible en este momento. ${spec.title}. Último corte real: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). La interfaz puede mostrar una proyección de deriva en el navegador claramente etiquetada como ilustrativa, pero NO presentes sus cifras como el pronóstico del sistema y NO des ninguna fecha proyectada ni estimación. Indica al usuario que el pronóstico de producción no está disponible temporalmente y remítelo al boletín oficial (travel.state.gov).`;
  }
  const end = spec.data[spec.data.length - 1];
  const b95 = bandOf(end.band95);
  const fmt = (yr: number) => (yr).toFixed(1);
  const h = spec.data.length - spec.data.findIndex((d) => d.month === spec.splitMonth) - 1;
  // spec.subtitle already states whether this is the PRODUCTION model or the in-browser
  // drift baseline; spec.note carries the verified out-of-sample track record (leakage-free backfill) when available.
  // Pass both through verbatim (do NOT re-label the production model as "illustrative").
  // I2: beyond the h validated months the note orders ABSTENTION — last validated
  // band + official bulletin — never a pace-extrapolated guess (the old wording
  // that ordered such an estimate is dead and rejected by the server skeletons).
  const acc = spec.note ? ` ${spec.note}` : "";
  return lang === "en"
    ? `A FORECAST CHART is being shown to the user right now — describe and interpret it; do NOT say you cannot show charts, and do NOT refuse. ${spec.title}. ${spec.subtitle}. Last real cutoff: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). Projection at the ${h}-month horizon (${end.month}): about ${end.date} (priority year ≈ ${fmt(end.fc as number)}), 95% band [${fmt(b95[0])}, ${fmt(b95[1])}].${acc} If the user gave a priority date, say whether this projected cutoff reaches it within the ${h}-month horizon. If reaching it lies BEYOND the ${h} months shown, say so frankly, give the ${h}-month projection above (with its 95% band) as the furthest validated reading, refer the user to the official Visa Bulletin (travel.state.gov) for anything past the horizon, and do NOT give any date or estimate beyond the validated horizon. Frame it as an aggregate statistical forecast, not legal advice.`
    : `Se está mostrando al usuario un GRÁFICO DE PRONÓSTICO en este momento — descríbelo e interprétalo; NO digas que no puedes mostrar gráficos y NO te niegues. ${spec.title}. ${spec.subtitle}. Último corte real: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). Proyección al horizonte de ${h} meses (${end.month}): alrededor de ${end.date} (año de prioridad ≈ ${fmt(end.fc as number)}), banda al 95 % [${fmt(b95[0])}, ${fmt(b95[1])}].${acc} Si el usuario dio su fecha de prioridad, di si el corte proyectado la alcanza dentro del horizonte de ${h} meses. Si alcanzarla queda MÁS ALLÁ de los ${h} meses mostrados, dilo con franqueza, ofrece como última lectura validada la proyección al mes ${h} de arriba (con su banda al 95 %), remite al usuario al boletín oficial (travel.state.gov) para lo que quede más allá del horizonte y NO des ninguna fecha ni estimación más allá del horizonte validado. Enmárcalo como pronóstico estadístico agregado, no asesoría legal.`;
}

// Generic note for the non-table charts so the LLM complements the visual.
export function chartContextNote(chart: ChartSpec, lang: Lang): string | null {
  if (chart.kind === "forecast") return forecastText(chart, lang);
  if (chart.kind === "table") return null; // handled by monthTableText (richer)
  if (chart.kind === "bulletinDiff") return bulletinDiffText(chart, lang);
  return lang === "en"
    ? `A chart titled "${chart.title}" is being rendered to the user from the real data panel — reference and interpret it; do NOT say you cannot show charts.`
    : `Se está mostrando al usuario un gráfico titulado «${chart.title}» generado con el panel de datos real — descríbelo e interprétalo; NO digas que no puedes mostrar gráficos.`;
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
    title: lang === "en" ? `Priority-date race · ${category} · ${table}` : `Carrera de fechas · ${category} · ${table}`,
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
    title: lang === "en" ? `Wait heatmap · ${block === "empleo" ? "employment" : "family"} · ${table}` : `Mapa de calor de espera · ${block === "empleo" ? "empleo" : "familia"} · ${table}`,
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
    title: lang === "en" ? `Wait fingerprint by country · ${table}` : `Huella de espera por país · ${table}`,
    subtitle: lang === "en" ? "Years of wait across family preferences (latest month)" : "Años de espera por preferencia familiar (último mes)",
    names, data,
  };
}

// ── monthly bulletin table (full panel history, any month) ──────────────────
const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON_ABBR: Record<string, number> = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12, dec: 12 };
export const monthLabel = (m: string, lang: Lang) => { const [y, mo] = m.split("-").map(Number); return `${(lang === "en" ? MONTHS_EN : MONTHS_ES)[mo - 1]} ${y}`; };

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

// Beautiful monthly snapshot: categories × pilot countries for one table (FAD/DFF).
export function buildMonthTable(panel: Panel, month: string, tableType: string, lang: Lang): ChartSpec | null {
  const rows = panel.rows.filter((r) => r.bulletinMonth === month && r.table === tableType);
  if (!rows.length) return null;
  const countries = PILOT.filter((c) => rows.some((r) => r.country === c));
  const order = [...FAM, "EB1", "EB2", "EB3", "EB3_OW", "EB4", "EB4_RW", "EB4_TRANS", "EB5", "EB5_UNRESERVED", "EB5_RURAL", "EB5_HIGHUNEMP", "EB5_INFRA", "EB5_NONRC", "EB5_TEA", "EB5_PILOT", "EB5_RC"];
  const present = [...new Set(rows.map((r) => r.category))].sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  const cell = (cat: string, country: string) => { const r = rows.find((x) => x.category === cat && x.country === country); return { status: r?.status ?? "", date: r?.priorityDate ?? null }; };
  const mk = (cats: string[]) => cats.map((cat) => ({ cat, cells: countries.map((c) => cell(cat, c)) }));
  const fam = present.filter((c) => /^F/.test(c)), emp = present.filter((c) => /^EB/.test(c));
  const sections: { block: string; rows: { cat: string; cells: ({ status: string; date: string | null })[] }[] }[] = [];
  if (fam.length) sections.push({ block: lang === "en" ? "Family-sponsored" : "Familiar", rows: mk(fam) });
  if (emp.length) sections.push({ block: lang === "en" ? "Employment-based" : "Empleo", rows: mk(emp) });
  return {
    kind: "table", month, tableType, countries,
    title: lang === "en" ? `Visa Bulletin · ${monthLabel(month, lang)} · ${tableType}` : `Visa Bulletin · ${monthLabel(month, lang)} · ${tableType}`,
    subtitle: lang === "en"
      ? "Priority-date cutoff per category × country. C = current, U = unavailable."
      : "Fecha de corte por categoría × país. C = al corriente (current), U = no disponible.",
    sections,
  };
}

// Compact real-data summary of a month table → grounding source so the LLM can
// answer any cell and never looks "limited to recent years".
export function monthTableText(spec: Extract<ChartSpec, { kind: "table" }>, lang: Lang): string {
  const head = spec.countries.map((c) => countryLabel(c)).join(" / ");
  const lines = spec.sections.flatMap((s) => s.rows.map((r) =>
    `${r.cat}: ${r.cells.map((c, i) => `${countryLabel(spec.countries[i])} ${c.status === "C" ? "C" : c.status === "U" ? "U" : c.date || "—"}`).join("; ")}`));
  return (lang === "en"
    ? `U.S. Visa Bulletin ${monthLabel(spec.month, lang)}, ${spec.tableType} (columns: ${head}). C = current, U = unavailable, otherwise the priority-date cutoff:\n`
    : `Visa Bulletin de EE. UU. ${monthLabel(spec.month, lang)}, ${spec.tableType} (columnas: ${head}). C = al corriente, U = no disponible, en otro caso la fecha de corte:\n`) + lines.join("\n");
}

// ── compare two bulletins (the "what changed between month A and month B" view) ─
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

// Diff every category × pilot country between two bulletins of the same table.
export function buildBulletinDiff(panel: Panel, monthA: string, monthB: string, tableType: string, lang: Lang): ChartSpec | null {
  if (monthA === monthB) return null;
  const [mA, mB] = monthA < monthB ? [monthA, monthB] : [monthB, monthA]; // A earlier, B later
  const rowsA = panel.rows.filter((r) => r.bulletinMonth === mA && r.table === tableType);
  const rowsB = panel.rows.filter((r) => r.bulletinMonth === mB && r.table === tableType);
  if (!rowsA.length && !rowsB.length) return null;
  const countries = PILOT.filter((c) => rowsA.some((r) => r.country === c) || rowsB.some((r) => r.country === c));
  if (!countries.length) return null;
  const order = [...FAM, "EB1", "EB2", "EB3", "EB3_OW", "EB4", "EB4_RW", "EB4_TRANS", "EB5", "EB5_UNRESERVED", "EB5_RURAL", "EB5_HIGHUNEMP", "EB5_INFRA", "EB5_NONRC", "EB5_TEA", "EB5_PILOT", "EB5_RC"];
  const cats = [...new Set([...rowsA, ...rowsB].map((r) => r.category))].sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });

  const findRow = (rows: VisaPanelRow[], cat: string, country: string) => rows.find((r) => r.category === cat && r.country === country) || null;
  let advanced = 0, retrogressed = 0, toCurrent = 0, toUnavailable = 0, unchanged = 0, other = 0;
  let topAdvance: { cat: string; country: string; days: number } | null = null;
  let topRetro: { cat: string; country: string; days: number } | null = null;

  const classify = (cat: string, country: string): DiffCell => {
    const a = findRow(rowsA, cat, country), b = findRow(rowsB, cat, country);
    const base = { fromDate: a?.priorityDate ?? null, toDate: b?.priorityDate ?? null, fromStatus: a?.status ?? "", toStatus: b?.status ?? "", days: null as number | null };
    if (!a && !b) return { ...base, kind: "na" };
    if (!a && b) { other++; return { ...base, kind: "appeared" }; }
    if (a && !b) { other++; return { ...base, kind: "disappeared" }; }
    if (base.toStatus === "C") { if (base.fromStatus === "C") { unchanged++; return { ...base, kind: "flat" }; } toCurrent++; return { ...base, kind: "toCurrent" }; }
    if (base.toStatus === "U") { if (base.fromStatus === "U") { unchanged++; return { ...base, kind: "flat" }; } toUnavailable++; return { ...base, kind: "toUnavailable" }; }
    if (base.fromStatus === "C") { other++; return { ...base, kind: "fromCurrent" }; } // Current → a date = retrogression
    if (base.fromStatus === "U") { other++; return { ...base, kind: "fromUnavailable" }; } // Unavailable → a date = opened up
    const dd = (a!.daysSinceBase != null && b!.daysSinceBase != null)
      ? (b!.daysSinceBase as number) - (a!.daysSinceBase as number)
      : (base.fromDate && base.toDate ? isoDays(base.toDate) - isoDays(base.fromDate) : null);
    if (dd == null) { unchanged++; return { ...base, kind: "flat" }; }
    if (dd > 0) { advanced++; if (!topAdvance || dd > topAdvance.days) topAdvance = { cat, country, days: dd }; return { ...base, kind: "advance", days: dd }; }
    if (dd < 0) { retrogressed++; if (!topRetro || dd < topRetro.days) topRetro = { cat, country, days: dd }; return { ...base, kind: "retro", days: dd }; }
    unchanged++; return { ...base, kind: "flat", days: 0 };
  };

  const mk = (cs: string[]) => cs.map((cat) => ({ cat, cells: countries.map((c) => classify(cat, c)) }));
  const fam = cats.filter((c) => /^F/.test(c)), emp = cats.filter((c) => /^EB/.test(c));
  const sections: { block: string; rows: { cat: string; cells: DiffCell[] }[] }[] = [];
  if (fam.length) sections.push({ block: lang === "en" ? "Family-sponsored" : "Familiar", rows: mk(fam) });
  if (emp.length) sections.push({ block: lang === "en" ? "Employment-based" : "Empleo", rows: mk(emp) });

  return {
    kind: "bulletinDiff", monthA: mA, monthB: mB, tableType, countries,
    title: lang === "en" ? `Bulletin comparison · ${monthLabel(mA, lang)} → ${monthLabel(mB, lang)} · ${tableType}` : `Comparación de boletines · ${monthLabel(mA, lang)} → ${monthLabel(mB, lang)} · ${tableType}`,
    subtitle: lang === "en"
      ? "How each category × country moved between the two bulletins (▲ advance, ▼ retrogression, →C became current, →U became unavailable)"
      : "Cómo se movió cada categoría × país entre los dos boletines (▲ avance, ▼ retroceso, →C pasó a current, →U pasó a no disponible)",
    summary: { advanced, retrogressed, toCurrent, toUnavailable, unchanged, other, topAdvance, topRetro },
    sections,
  };
}

// Grounding text so the LLM can answer any cell of the comparison it renders.
export function bulletinDiffText(spec: Extract<ChartSpec, { kind: "bulletinDiff" }>, lang: Lang): string {
  const s = spec.summary;
  const head = spec.countries.map((c) => countryLabel(c, lang)).join(" / ");
  const cellLabel = (cell: DiffCell, i: number) => {
    const cn = countryLabel(spec.countries[i], lang);
    const st = (status: string, date: string | null) => (status === "C" ? "C" : status === "U" ? "U" : date || "—");
    const delta = cell.kind === "advance" ? ` (+${cell.days}d)` : cell.kind === "retro" ? ` (${cell.days}d)` : "";
    return `${cn} ${st(cell.fromStatus, cell.fromDate)}→${st(cell.toStatus, cell.toDate)}${delta}`;
  };
  const lines = spec.sections.flatMap((sec) => sec.rows.map((r) => `${r.cat}: ${r.cells.map((c, i) => cellLabel(c, i)).join("; ")}`));
  const top: string[] = [];
  if (s.topAdvance) top.push(lang === "en" ? `biggest advance ${s.topAdvance.cat}/${countryLabel(s.topAdvance.country, lang)} +${s.topAdvance.days} d` : `mayor avance ${s.topAdvance.cat}/${countryLabel(s.topAdvance.country, lang)} +${s.topAdvance.days} d`);
  if (s.topRetro) top.push(lang === "en" ? `biggest retrogression ${s.topRetro.cat}/${countryLabel(s.topRetro.country, lang)} ${s.topRetro.days} d` : `mayor retroceso ${s.topRetro.cat}/${countryLabel(s.topRetro.country, lang)} ${s.topRetro.days} d`);
  const header = lang === "en"
    ? `A BULLETIN COMPARISON chart is shown to the user right now — describe and interpret it, do NOT refuse. ${monthLabel(spec.monthA, lang)} → ${monthLabel(spec.monthB, lang)}, ${spec.tableType} (columns: ${head}). Summary: ${s.advanced} advanced, ${s.retrogressed} retrogressed, ${s.toCurrent} became Current, ${s.toUnavailable} became Unavailable, ${s.unchanged} unchanged.${top.length ? " " + top.join("; ") + "." : ""} These are official published cutoffs, not predictions. Per cell (from→to; C=current, U=unavailable):\n`
    : `Se está mostrando al usuario una COMPARACIÓN DE BOLETINES — descríbela e interprétala, NO te niegues. ${monthLabel(spec.monthA, lang)} → ${monthLabel(spec.monthB, lang)}, ${spec.tableType} (columnas: ${head}). Resumen: ${s.advanced} avanzaron, ${s.retrogressed} retrocedieron, ${s.toCurrent} pasaron a Current, ${s.toUnavailable} a No disponible, ${s.unchanged} sin cambio.${top.length ? " " + top.join("; ") + "." : ""} Son cortes oficiales publicados, no predicciones. Por celda (de→a; C=al corriente, U=no disponible):\n`;
  return header + lines.join("\n");
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
