// Domain analytics for the VisaBot console: entity detection + chart builders
// computed from the real panel (lib/data/visa-panel.ts). This is the
// "engineering" layer EpiBot had — turning a query (or a tool click) into a
// chart spec backed by actual Visa Bulletin data. No fabricated numbers.
import { type Panel, type VisaPanelRow, countryLabel, statusColor } from "@/lib/data/visa-panel";
import { type ForecastStore, forecastFor, forecastMetaFor } from "@/lib/data/forecasts";

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
  | { kind: "radar"; title: string; subtitle: string; names: string[]; data: Record<string, number | string | null>[] }
  | { kind: "forecast"; title: string; subtitle: string; yLabel: string; splitMonth: string; note?: string;
      data: { month: string; hist: number | null; fc: number | null; band80: [number, number] | null; band95: [number, number] | null; date: string | null }[] }
  | { kind: "table"; title: string; subtitle: string; month: string; tableType: string;
      countries: string[];
      sections: { block: string; rows: { cat: string; cells: ({ status: string; date: string | null })[] }[] }[] };

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

export function buildForecast(panel: Panel, country: string, category: string, table: string, lang: Lang, horizon = 12, window = 48, forecasts?: ForecastStore | null): ChartSpec | null {
  const series = panel.rows
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
    const mlabel = meta?.models?.length ? meta.models.join("+") : (table === "DFF" ? "SARIMA" : "Theta+ETS+SARIMA");
    const mase = meta && Number.isFinite(meta.mase) ? (lang === "en" ? ` · hold-out MASE ${meta.mase}` : ` · MASE hold-out ${meta.mase}`) : "";
    subtitle = lang === "en"
      ? `Production-model forecast (${mlabel}) · 80 % / 95 % bands (conformal · per-horizon empirical quantiles)${mase}`
      : `Pronóstico del modelo de producción (${mlabel}) · bandas 80 % / 95 % (conformes · cuantiles empíricos por horizonte)${mase}`;
    // Prospective track record (real frozen forecasts vs realized cutoffs) — global.
    const sc = (forecasts ?? null)?.scorecard;
    if (sc) {
      const mae = (k: number) => Math.round(sc.by_horizon[String(k)]?.mae_days ?? NaN);
      const cov = Math.round(sc.overall.cov95 * 100);
      note = lang === "en"
        ? `Real-world accuracy, global across all series (${sc.n_scored} forecasts scored vs already-published cutoffs): typical error ±${mae(3)} d at 3 mo · ±${mae(6)} d at 6 mo · ±${mae(12)} d at 12 mo. The 95 % band held in ${cov} % of cases overall (lower at the longest horizons).`
        : `Precisión real, global de todas las series (${sc.n_scored} pronósticos evaluados vs cortes ya publicados): error típico ±${mae(3)} d a 3 m · ±${mae(6)} d a 6 m · ±${mae(12)} d a 12 m. La banda al 95 % acertó en el ${cov} % de los casos en conjunto (menor a los horizontes más largos).`;
    }
  } else {
    const xs = win.map((_, i) => i), ys = win.map((r) => r.daysSinceBase as number);
    const n = xs.length, mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
    const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
    let ss = 0; for (let i = 0; i < n; i++) ss += (ys[i] - (intercept + slope * xs[i])) ** 2;
    const sigma = Math.sqrt(ss / Math.max(1, n - 2));
    const anchorDays = last.daysSinceBase as number;
    let m = last.bulletinMonth;
    for (let h = 1; h <= horizon; h++) {
      m = nextMonth(m);
      const fcDays = anchorDays + slope * h, half = sigma * Math.sqrt(h);
      data.push({ month: m, hist: null, fc: yr(fcDays), date: epochToDate(baseEpoch + fcDays),
        band80: [yr(fcDays - Z80 * half), yr(fcDays + Z80 * half)],
        band95: [yr(fcDays - Z95 * half), yr(fcDays + Z95 * half)] });
    }
    const perYear = slope * 12;
    const dir = lang === "en" ? (perYear >= 0 ? "advancing" : "retrogressing") : (perYear >= 0 ? "avanzando" : "retrocediendo");
    subtitle = lang === "en"
      ? `Illustrative ${horizon}-month projection (in-browser drift baseline, ${dir} ~${Math.abs(Math.round(perYear))} days/yr) with 80 % / 95 % bands`
      : `Proyección ilustrativa a ${horizon} meses (línea base de deriva en el navegador, ${dir} ~${Math.abs(Math.round(perYear))} días/año) con bandas al 80 % / 95 %`;
  }
  return {
    kind: "forecast", splitMonth: last.bulletinMonth, note,
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
  const end = spec.data[spec.data.length - 1];
  const fmt = (yr: number) => (yr).toFixed(1);
  const h = spec.data.length - spec.data.findIndex((d) => d.month === spec.splitMonth) - 1;
  // spec.subtitle already states whether this is the PRODUCTION model or the in-browser
  // drift baseline; spec.note carries the real prospective track record when available.
  // Pass both through verbatim (do NOT re-label the production model as "illustrative").
  const acc = spec.note ? ` ${spec.note}` : "";
  return lang === "en"
    ? `A FORECAST CHART is being shown to the user right now — describe and interpret it; do NOT say you cannot show charts, and do NOT refuse. ${spec.title}. ${spec.subtitle}. Last real cutoff: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). Projection at the ${h}-month horizon (${end.month}): about ${end.date} (priority year ≈ ${fmt(end.fc as number)}), 95% band [${fmt((end.band95 as [number, number])[0])}, ${fmt((end.band95 as [number, number])[1])}].${acc} If the user gave a priority date, say whether this projected cutoff reaches it within the horizon; if reaching it lies BEYOND the 12 months shown, say so frankly and give a rough pace-based estimate with its uncertainty. Frame it as an aggregate statistical forecast, not legal advice — but DO give the estimate.`
    : `Se está mostrando al usuario un GRÁFICO DE PRONÓSTICO en este momento — descríbelo e interprétalo; NO digas que no puedes mostrar gráficos y NO te niegues. ${spec.title}. ${spec.subtitle}. Último corte real: ${lastHist?.date ?? "—"} (${lastHist?.month ?? "—"}). Proyección al horizonte de ${h} meses (${end.month}): alrededor de ${end.date} (año de prioridad ≈ ${fmt(end.fc as number)}), banda al 95 % [${fmt((end.band95 as [number, number])[0])}, ${fmt((end.band95 as [number, number])[1])}].${acc} Si el usuario dio su fecha de prioridad, di si el corte proyectado la alcanza dentro del horizonte; si alcanzarla queda MÁS ALLÁ de los 12 meses mostrados, dilo con franqueza y da una estimación aproximada por el ritmo, con su incertidumbre. Enmárcalo como pronóstico estadístico agregado, no asesoría legal — pero SÍ da la estimación.`;
}

// Generic note for the non-table charts so the LLM complements the visual.
export function chartContextNote(chart: ChartSpec, lang: Lang): string | null {
  if (chart.kind === "forecast") return forecastText(chart, lang);
  if (chart.kind === "table") return null; // handled by monthTableText (richer)
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

// ── monthly bulletin table (full 291-month history, any month) ──────────────
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
  let mo: number | null = null, yr: number | null = null;
  const iso = t.match(/(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  if (iso) return pick(+iso[1], +iso[2]);
  const ym = t.match(/\b(0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (ym) return pick(+ym[2], +ym[1]);
  const names = MONTHS_ES.concat(MONTHS_EN);
  for (let i = 0; i < names.length; i++) if (t.includes(names[i])) { mo = (i % 12) + 1; break; }
  if (mo === null) { const a = t.match(/\b(ene|jan|feb|mar|abr|apr|may|jun|jul|ago|aug|sept?|oct|nov|dic|dec)\b/); if (a) mo = MON_ABBR[a[1]]; }
  const ym2 = t.match(/\b(19|20)\d{2}\b/);
  if (ym2) yr = +ym2[0];
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
