// Forecast-gallery model: enumerates the pre-generated production forecasts into
// a browsable country → block → category×table tree for the /resultados section.
// Pure data helpers (no React) so they're unit-testable. Every count is derived
// from the loaded store — never hand-typed (regla #0).
import { type ForecastStore, type SeriesMeta } from "@/lib/data/forecasts";
import { PILOT } from "@/lib/data/visa-panel";

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

export type CountryGroup = { country: string; series: GallerySeries[] };
export type CategoryGroup = { category: string; block: "familia" | "empleo"; series: GallerySeries[] };
export type GalleryTree = { featured: GallerySeries[]; byCountry: CountryGroup[]; byCategory: CategoryGroup[] };

// Group the leaf set three ways (mirrors the reference's three tiers): a small
// featured grid, a by-country accordion and a by-category (cross-cut) accordion.
export function buildGalleryTree(series: GallerySeries[]): GalleryTree {
  // one headline FAD series per pilot area (falls back to any table)
  const featured: GallerySeries[] = [];
  for (const c of PILOT) {
    const s = series.find((x) => x.country === c && x.table === "FAD") ?? series.find((x) => x.country === c);
    if (s) featured.push(s);
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

export type GalleryFilter = { country?: string; table?: string; block?: string; query?: string };
export function filterSeries(series: GallerySeries[], f: GalleryFilter): GallerySeries[] {
  const q = (f.query ?? "").trim().toLowerCase();
  return series.filter((s) => {
    if (f.country && s.country !== f.country) return false;
    if (f.table && s.table !== f.table) return false;
    if (f.block && s.block !== f.block) return false;
    if (q && !`${s.country} ${s.category} ${s.table}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
