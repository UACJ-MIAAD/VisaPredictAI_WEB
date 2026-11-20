// Forecast-gallery model: enumerates the pre-generated production forecasts into
// a browsable country → block → category×table tree for the /resultados section.
// Pure data helpers (no React) so they're unit-testable. Every count is derived
// from the loaded store — never hand-typed (regla #0).
import { type ForecastStore, type SeriesMeta, type ForecastPoint, forecastFor } from "@/lib/data/forecasts";
import { PILOT, countryLabel } from "@/lib/data/visa-panel";
import { seriesSignals, type PanelIndex } from "@/lib/visabot/analytics";
import type { VisaPanelRow } from "@/lib/data/panel-core";
import { isoDays, epochToDate } from "./synthetic-builders.mjs";

export type GallerySeries = {
  key: string; // "country|category|table"
  country: string;
  category: string;
  table: string; // "FAD" | "DFF"
  block: "familia" | "empleo";
  mase: number | null;
  models: string[];
  lastMonth: string | null;
  nFObs: number | null;
  // derived signals (attachSignals) — null until enriched with the panel
  backlogYears?: number | null; // years of wait implied by the latest F cutoff
  movementDays?: number | null; // projected advance (>0) / retrogression (<0) over the horizon
  movementPerYear?: number | null; // same, normalized to days/year
};

// Canonical category order (mirrors analytics.buildMonthTable so cards order like
// the bulletin): family first, then employment with EB5 sub-buckets.
const CAT_ORDER = [
  "F1", "F2A", "F2B", "F3", "F4",
  "EB1", "EB2", "EB3", "EB3_OW", "EB4", "EB4_RW", "EB4_TRANS",
  "EB5", "EB5_UNRESERVED", "EB5_RURAL", "EB5_HIGHUNEMP", "EB5_INFRA", "EB5_NONRC", "EB5_TEA", "EB5_PILOT", "EB5_RC",
];
export const catRank = (c: string) => { const i = CAT_ORDER.indexOf(c); return i < 0 ? 99 : i; };
export const blockOf = (c: string): "familia" | "empleo" => (/^F/.test(c) ? "familia" : "empleo");
const tableRank = (t: string) => (t === "FAD" ? 0 : t === "DFF" ? 1 : 2); // FAD before DFF (not alphabetical)

// Enumerate the forecast universe (the gallery's leaf set) from the store.
export function buildGallerySeries(store: ForecastStore): GallerySeries[] {
  const out: GallerySeries[] = [];
  const seen = new Set<string>();
  const add = (key: string) => {
    if (seen.has(key)) return;
    const [country, category, table] = key.split("|");
    if (!country || !category || !table) return;
    seen.add(key);
    const meta = store.meta.get(key) as (SeriesMeta & { n_f_obs?: number }) | undefined;
    out.push({
      key, country, category, table, block: blockOf(category),
      mase: meta && Number.isFinite(meta.mase) ? meta.mase : null,
      models: meta?.models ?? [],
      lastMonth: meta?.last_month ?? null,
      nFObs: meta?.n_f_obs ?? null,
    });
  };
  // meta first (richer card face); union with series keys in case any CSV series lacks meta
  for (const k of store.meta.keys()) add(k);
  for (const k of store.series.keys()) add(k);
  return out.sort(
    (a, b) =>
      (PILOT.indexOf(a.country) - PILOT.indexOf(b.country)) ||
      (catRank(a.category) - catRank(b.category)) ||
      (tableRank(a.table) - tableRank(b.table)),
  );
}

// Enrich the leaf set with derived signals (backlog + projected movement) from
// the real panel. Uses a pre-built index so the whole set is O(n), not O(n·rows).
export function attachSignals(series: GallerySeries[], store: ForecastStore, index: PanelIndex): GallerySeries[] {
  return series.map((s) => {
    const sig = seriesSignals(index.get(s.key), forecastFor(store, s.country, s.category, s.table), store.horizonMonths);
    return { ...s, backlogYears: sig.backlogYears, movementDays: sig.movementDays, movementPerYear: sig.movementPerYear };
  });
}

// MASE quality terciles derived from the loaded distribution itself — never a
// typed cutoff (regla #0). Returns the two split points, or null if too few.
export function maseTerciles(series: GallerySeries[]): { t1: number; t2: number } | null {
  const vals = series.map((s) => s.mase).filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (vals.length < 3) return null;
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * (vals.length - 1)))];
  return { t1: q(1 / 3), t2: q(2 / 3) };
}
export type MaseTier = "good" | "mid" | "weak" | null;
export function maseTier(mase: number | null | undefined, t: { t1: number; t2: number } | null): MaseTier {
  if (mase == null || !Number.isFinite(mase) || !t) return null;
  return mase <= t.t1 ? "good" : mase <= t.t2 ? "mid" : "weak";
}

// Sort keys for the gallery (default 'order' = canonical bulletin order).
export type SortKey = "order" | "mase" | "backlog" | "movement";
const nlast = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v);
export function sortSeries(series: GallerySeries[], key: SortKey): GallerySeries[] {
  if (key === "order") return series;
  const by = (f: (s: GallerySeries) => number | null, dir: 1 | -1) =>
    [...series].sort((a, b) => {
      const va = nlast(f(a)), vb = nlast(f(b));
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls always last
      if (vb == null) return -1;
      return (va - vb) * dir;
    });
  if (key === "mase") return by((s) => s.mase, 1); // sharpest (lowest) first
  if (key === "backlog") return by((s) => s.backlogYears ?? null, -1); // longest wait first
  return by((s) => s.movementPerYear ?? null, -1); // fastest advancing first
}

export type CountryGroup = { country: string; series: GallerySeries[] };
export type CategoryGroup = { category: string; block: "familia" | "empleo"; series: GallerySeries[] };
export type GalleryTree = { featured: GallerySeries[]; byCountry: CountryGroup[]; byCategory: CategoryGroup[] };

// Group the leaf set three ways (mirrors the reference's three tiers): a small
// featured grid, a by-country accordion and a by-category (cross-cut) accordion.
export function buildGalleryTree(series: GallerySeries[]): GalleryTree {
  // one headline series per pilot area — the MOST NOTABLE (largest current
  // backlog), not a fixed category, so 'Destacados' isn't five identical F1
  // cards. Falls back to first FAD / any when no backlog signal is attached.
  const featured: GallerySeries[] = [];
  for (const c of PILOT) {
    const inC = series.filter((x) => x.country === c);
    if (!inC.length) continue;
    const withB = inC.filter((x) => x.backlogYears != null);
    const pick = withB.length
      ? withB.reduce((a, b) => ((b.backlogYears as number) > (a.backlogYears as number) ? b : a))
      : (inC.find((x) => x.table === "FAD") ?? inC[0]);
    featured.push(pick);
  }
  const byCountry: CountryGroup[] = PILOT
    .map((c) => ({ country: c, series: series.filter((x) => x.country === c) }))
    .filter((g) => g.series.length);
  const cats = [...new Set(series.map((x) => x.category))].sort((a, b) => catRank(a) - catRank(b));
  const byCategory: CategoryGroup[] = cats.map((cat) => ({
    category: cat, block: blockOf(cat), series: series.filter((x) => x.category === cat),
  }));
  return { featured, byCountry, byCategory };
}

// Derived counts for the meta-bar (never hand-typed — regla #0).
export type GallerySummary = {
  nSeries: number; nAreas: number; nFamily: number; nEmployment: number; nFAD: number; nDFF: number;
  lastMonth: string | null;
};
export function gallerySummary(series: GallerySeries[]): GallerySummary {
  const lastMonths = series.map((s) => s.lastMonth).filter(Boolean) as string[];
  return {
    nSeries: series.length,
    nAreas: new Set(series.map((s) => s.country)).size,
    nFamily: series.filter((s) => s.block === "familia").length,
    nEmployment: series.filter((s) => s.block === "empleo").length,
    nFAD: series.filter((s) => s.table === "FAD").length,
    nDFF: series.filter((s) => s.table === "DFF").length,
    lastMonth: lastMonths.length ? lastMonths.sort()[lastMonths.length - 1] : null,
  };
}

// Export the pre-generated forecast of one series as CSV (traceable to the
// pipeline) — a data flex a static image gallery can't offer.
export function forecastToCsv(key: string, points: ForecastPoint[], base?: number | null): string {
  // With the series' base epoch the file also carries the cutoffs as ISO dates
  // (the raw `days` are days since that base, meaningless on their own).
  const iso = base != null;
  // a value at or past its bulletin's own month is "C" (Current), not a date
  const d0 = (x: number) => epochToDate(Math.round((base as number) + x));
  const head = "series,date,days,lo80,hi80,lo95,hi95" + (iso ? ",cutoff,lo80_date,hi80_date,lo95_date,hi95_date" : "");
  const rows = points.map((p) => {
    const cap = `${p.date.slice(0, 7)}-01`;
    const d = (x: number) => { const v = d0(x); return v >= cap ? "C" : v; };
    return `${key},${p.date},${p.days},${p.lo80},${p.hi80},${p.lo95},${p.hi95}` +
      (iso ? `,${d(p.days)},${d(p.lo80)},${d(p.hi80)},${d(p.lo95)},${d(p.hi95)}` : "");
  });
  return [head, ...rows].join("\n") + "\n";
}

export type GalleryFilter = { country?: string; table?: string; block?: string; query?: string };
// ── Category names (19-nov-2026) ─────────────────────────────────────────────
// Bulletin codes (EB3_OW, EB5_HIGHUNEMP…) are not words. Short human names, ES/EN,
// per the INA preference definitions; an unknown code falls back to itself.
const CATEGORY_NAMES: Record<string, [string, string]> = {
  F1: ["Hijos solteros de ciudadanos", "Unmarried sons and daughters of citizens"],
  F2A: ["Cónyuges e hijos menores de residentes", "Spouses and children of permanent residents"],
  F2B: ["Hijos solteros (21+) de residentes", "Unmarried sons and daughters (21+) of permanent residents"],
  F3: ["Hijos casados de ciudadanos", "Married sons and daughters of citizens"],
  F4: ["Hermanos de ciudadanos", "Brothers and sisters of adult citizens"],
  EB1: ["Trabajadores prioritarios", "Priority workers"],
  EB2: ["Posgrado o habilidad excepcional", "Advanced degree or exceptional ability"],
  EB3: ["Profesionales y trabajadores calificados", "Skilled workers and professionals"],
  EB3_OW: ["Otros trabajadores", "Other workers"],
  EB4: ["Inmigrantes especiales", "Certain special immigrants"],
  EB4_RW: ["Trabajadores religiosos", "Certain religious workers"],
  EB4_TRANS: ["Traductores iraquíes y afganos", "Iraqi and Afghan translators"],
  EB5: ["Inversionistas", "Investors"],
  EB5_UNRESERVED: ["Inversionistas · no reservado", "Investors · unreserved"],
  EB5_RURAL: ["Inversionistas · rural (reservado)", "Investors · rural (set-aside)"],
  EB5_HIGHUNEMP: ["Inversionistas · alto desempleo (reservado)", "Investors · high unemployment (set-aside)"],
  EB5_INFRA: ["Inversionistas · infraestructura (reservado)", "Investors · infrastructure (set-aside)"],
  EB5_RC: ["Inversionistas · centro regional", "Investors · regional center"],
  EB5_NONRC: ["Inversionistas · fuera de centro regional", "Investors · non-regional center"],
  EB5_TEA: ["Inversionistas · zona de empleo objetivo", "Investors · targeted employment area"],
  EB5_PILOT: ["Inversionistas · programa piloto", "Investors · pilot program"],
};
/** "EB3_OW" → "EB3 OW": the code as printed (no underscores). */
export const categoryCode = (c: string) => c.replace(/_/g, " ");
/** Human name of a category in the page language; the code itself when unknown. */
export const categoryName = (c: string, lang: "es" | "en") => CATEGORY_NAMES[c]?.[lang === "en" ? 1 : 0] ?? categoryCode(c);

// Accent-, case- and punctuation-insensitive; every word must match, in any
// order, against the code AND both labels ("México", "Filipinas", "RoW", "EB-2").
const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-_.·]/g, "");
export const COUNTRY_SHORT: Record<string, string> = { mexico: "MX", india: "IN", china: "CN", philippines: "PH", all_chargeability: "RoW" };
export function filterSeries(series: GallerySeries[], f: GalleryFilter): GallerySeries[] {
  const words = fold(f.query ?? "").split(/\s+/).filter(Boolean);
  return series.filter((s) => {
    if (f.country && s.country !== f.country) return false;
    if (f.table && s.table !== f.table) return false;
    if (f.block && s.block !== f.block) return false;
    if (words.length) {
      const hay = fold(`${s.country} ${countryLabel(s.country, "es")} ${countryLabel(s.country, "en")} ${COUNTRY_SHORT[s.country] ?? ""} ${s.category} ${categoryName(s.category, "es")} ${categoryName(s.category, "en")} ${s.table}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

/** MASE against the naive forecast it is scaled by: < 1 beats it. Absolute, not a page-relative tercile. */
export const maseVsNaive = (mase: number | null | undefined): "beats" | "loses" | null =>
  mase == null || !Number.isFinite(mase) ? null : mase < 1 ? "beats" : "loses";

// ── Instrument readout (redesign 19-nov-2026) ──────────────────────────────
// What the forecast instrument prints, derived from the panel rows of one
// series and its production forecast points:
//   • current: the latest published bulletin cell (F date, C = Current, U = Unavailable);
//   • projected: the last horizon month, its central cutoff and 95 % band, as
//     ISO dates (base anchored on the latest dated F observation, exactly like
//     buildForecast). Only when the latest cell is a date AND the forecast
//     starts after it, and the series is still in the latest bulletin; otherwise
//     `none` says why (a Current category is not waiting for any date; a
//     discontinued series or a forecast fit before its latest bulletin is history).
export type SeriesReadout = {
  current: { month: string; status: string; date: string | null } | null;
  // Dates are ISO; `current: true` on a bound means it reaches the bulletin's own
  // month, i.e. the category would be Current (no bulletin publishes a cutoff
  // later than its own month). `retro` = central projection behind today's cutoff.
  projected: {
    month: string; date: string; lo95: string; hi95: string; months: number;
    dateCurrent: boolean; hi95Current: boolean; lo95Current: boolean; retro: boolean;
  } | null;
  none: "current" | "unavailable" | "discontinued" | "stale" | "noForecast" | null;
  base: number | null;
};
export function seriesBase(sorted: VisaPanelRow[]): number | null {
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i];
    if (r.status === "F" && r.priorityDate && r.daysSinceBase != null) return isoDays(r.priorityDate) - r.daysSinceBase;
  }
  return null;
}
export function seriesReadout(rows: VisaPanelRow[], points: ForecastPoint[] | null | undefined, latestMonth?: string | null): SeriesReadout {
  const sorted = [...rows].sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
  const last = sorted.at(-1);
  const current = last
    ? { month: last.bulletinMonth, status: last.status, date: last.status === "F" ? (last.priorityDate ?? null) : null }
    : null;
  const base = seriesBase(sorted);
  const out = (none: SeriesReadout["none"]): SeriesReadout => ({ current, projected: null, none, base });
  // A series absent from the latest bulletin is no longer published: its last
  // cell is history, and nothing should be projected from it.
  if (current && latestMonth && current.month < latestMonth) return out("discontinued");
  if (current?.status === "C") return out("current");
  if (current?.status === "U") return out("unavailable");
  const first = points?.[0], end = points?.at(-1);
  if (!current || current.status !== "F" || base == null || !first || !end) return out("noForecast");
  if (first.date.slice(0, 7) <= current.month) return out("stale");
  const cap = `${end.date.slice(0, 7)}-01`;
  const d = (x: number) => epochToDate(Math.round(base + x));
  const date = d(end.days), lo95 = d(end.lo95), hi95 = d(end.hi95);
  return {
    current, base, none: null,
    projected: {
      month: end.date.slice(0, 7), date, lo95, hi95, months: points!.length,
      dateCurrent: date >= cap, hi95Current: hi95 >= cap, lo95Current: lo95 >= cap,
      retro: !!current.date && date < current.date,
    },
  };
}

// A bulletin cannot publish a cutoff later than its own month (by then the
// category is Current), so every projected value is capped at the start of its
// point's month before it reaches a chart, an export or the checker.
export function capPoints(points: ForecastPoint[] | null | undefined, base: number | null): ForecastPoint[] | null {
  if (!points || base == null) return points ?? null;
  return points.map((p) => {
    const cap = isoDays(`${p.date.slice(0, 7)}-01`) - base;
    const c = (v: number) => Math.min(v, cap);
    return { ...p, days: c(p.days), lo80: c(p.lo80), hi80: c(p.hi80), lo95: c(p.lo95), hi95: c(p.hi95) };
  });
}

// "Does it reach my priority date?" A priority date is reached when it is
// EARLIER than the cutoff (State Department rule), so equal is not yet. With the
// uncertainty spelled out: the month the central path first passes it, and the
// 95 % range of months (optimistic edge first, pessimistic edge last). A path
// that passes the date and is behind it again by the horizon end is reported as
// such, never as "reached".
export type ReachVerdict =
  | { status: "invalid" | "current" | "unavailable" | "discontinued" | "noForecast" | "past" }
  | { status: "within" | "crossedBack" | "band" | "beyond"; central: string | null; early: string | null; late: string | null; last: string };
export function reachVerdict(r: SeriesReadout, points: ForecastPoint[] | null | undefined, pd: string): ReachVerdict {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pd) || epochToDate(isoDays(pd)) !== pd) return { status: "invalid" };
  if (r.none === "current") return { status: "current" };
  if (r.none === "unavailable") return { status: "unavailable" };
  if (r.none === "discontinued") return { status: "discontinued" };
  if (r.current?.date && pd < r.current.date) return { status: "past" };
  if (!r.projected || r.base == null || !points?.length) return { status: "noForecast" };
  const x = isoDays(pd);
  const at = (v: number) => Math.round((r.base as number) + v);
  const month = (p: ForecastPoint | undefined) => (p ? p.date.slice(0, 7) : null);
  const end = points.at(-1)!;
  const central = month(points.find((p) => at(p.days) > x));
  // each band edge only counts once it stays past the date to the horizon end
  const from = (pick: (p: ForecastPoint) => number) => {
    const i = points.findIndex((_, k) => points.slice(k).every((q) => at(pick(q)) > x));
    return i >= 0 ? month(points[i]) : null;
  };
  const early = from((p) => p.hi95);
  const late = from((p) => p.lo95);
  const last = month(end) as string;
  const status = central ? (at(end.days) > x ? "within" : "crossedBack") : early ? "band" : "beyond";
  return { status, central, early, late, last };
}
