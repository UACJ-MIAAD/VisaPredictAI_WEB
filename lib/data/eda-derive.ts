// Pure derivation of every EDA gallery caption value from EdaFacts. Extracted
// from eda-gallery.tsx (a client component) so this — the most regla-#0-critical
// logic on the site, ~25 caption numbers — is unit-testable without React
// (tests/eda-derive.test.ts). Every number here comes from the regenerated JSON;
// the anti-"0 de 74" guards (hasStationarity/hasAdvance) hide a figure rather
// than assert a confident lie when the census is missing.
import { localeOf } from "@/lib/i18n";
import { seriesLabel, type EdaFacts } from "@/lib/data/eda";

// ── Derived census values (computed once per facts+lang via useMemo; every
//    caption number comes from here and refreshes with the regenerated JSON) ──
export type Derived = {
  nObs: string; // e.g. "27,611" (locale)
  nSeries: number; // 194
  nWithF: number; // 136
  nEval: number; // 74
  nFamFad: number; // 25 family-FAD structural series (derived, audit B2)
  pctF: number; // 58
  pctFrozen: number; // 45 (panel-wide, round 0)
  pctRetro: string; // "2.4" (1 decimal)
  nRetro: string; // "382" (locale)
  worstYears: string; // "12.8" (1 decimal)
  worstLabel: string; // "México · F3"
  worstMonth: string; // "agosto de 2006" / "August 2006"
  aggMonth: string; // worst aggregate family-FAD month: "enero de 2011"
  aggCount: number; // 17 series retrogressed that month
  aggYears: number; // 34 accumulated years lost (round 0)
  typFrozen: number; // 27 (median pct_frozen, family FAD with data, round 0)
  famBacklogYears: number; // 25 (floor: years fully waited)
  famBacklogLabel: string; // "México · F4"
  empBacklogYears: number; // 12 (floor)
  empBacklogLabel: string; // "India · EB-3"
  gapMonths: number; // median FAD–DFF gap, current bulletin, in months (round 0)
  gapMaxYears: string; // "2.0" (1 decimal)
  gapMaxLabel: string; // "Filipinas · F1"
  nDiff: number; // 71
  nMixed: number; // 3
  nLevel: number; // 0 (stationary in level)
  hasStationarity: boolean; // census present → g09 caption is derivable
  advMin: number; // 0
  advMax: number; // 21
  hasAdvance: boolean; // advance map present → g06 caption is derivable
  dvRows: string; // "1,647" (locale)
};

// "2006-08" -> "agosto de 2006" / "August 2006" (UTC-pinned).
function monthYear(ym: string, lang: "es" | "en"): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat(localeOf(lang), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function derive(facts: EdaFacts, lang: "es" | "en"): Derived {
  const locale = localeOf(lang);
  const p = facts.panel;

  // Worst single retrogression event.
  const retro = facts.retro_events ?? [];
  const worst = retro.length ? retro.reduce((a, b) => (b.days > a.days ? b : a)) : null;

  // Worst aggregate family-FAD month (the collective quake the trajectories
  // figure annotates): group by date, take the date with the most days lost.
  const sums = new Map<string, { days: number; n: number }>();
  for (const e of retro) {
    if (e.block !== "family" || e.table !== "FAD") continue;
    const s = sums.get(e.date) ?? { days: 0, n: 0 };
    s.days += e.days;
    s.n += 1;
    sums.set(e.date, s);
  }
  let aggDate = "";
  let aggDays = -1;
  let aggCount = 0;
  for (const [date, s] of sums) {
    if (s.days > aggDays) {
      aggDate = date;
      aggDays = s.days;
      aggCount = s.n;
    }
  }

  // Typical frozen share among family-FAD series that have dates.
  const frozenShares = (facts.series ?? [])
    .filter((s) => s.block === "family" && s.table === "FAD" && s.n_F > 0)
    .map((s) => s.pct_frozen);

  // Today's deepest backlog per block (FAD table, matching the figure).
  // floor(): "years fully waited" — 25.2 reads as 25 years, 12.5 as 12.
  const fadBacklog = (facts.backlog_today ?? []).filter((b) => b.table === "FAD");
  const maxBy = (xs: typeof fadBacklog) =>
    xs.length ? xs.reduce((a, b) => (b.backlog_years > a.backlog_years ? b : a)) : null;
  const famMax = maxBy(fadBacklog.filter((b) => b.block === "family"));
  const empMax = maxBy(fadBacklog.filter((b) => b.block === "employment"));

  // FAD–DFF gap in the CURRENT bulletin (the figure shows today's gap; the
  // JSON also carries historical rows, so filter to the latest date).
  const gaps = facts.fad_dff_gap ?? [];
  const latestGapDate = gaps.length ? gaps.reduce((a, b) => (b.date > a.date ? b : a)).date : "";
  const currentGaps = gaps.filter((g) => g.date === latestGapDate);
  const gapMax = currentGaps.length
    ? currentGaps.reduce((a, b) => (b.gap_days > a.gap_days ? b : a))
    : null;

  const nDiff = facts.stationarity_summary?.difference ?? 0;
  const nMixed = facts.stationarity_summary?.mixed ?? 0;
  const nLevel = facts.stationarity_summary?.stationary ?? 0;

  const advances = Object.values(facts.monthly_advance_median ?? {});

  return {
    nObs: p.n_obs.toLocaleString(locale),
    nSeries: p.n_series_structural,
    nWithF: p.n_series_with_F,
    nEval: p.n_series_evaluable,
    // derived, not literal: a 26th family-FAD series must update the caption
    nFamFad: (facts.series ?? []).filter((s) => s.block === "family" && s.table === "FAD").length,
    pctF: p.pct_trainable_F,
    pctFrozen: Math.round(p.pct_frozen),
    pctRetro: p.pct_retro.toFixed(1),
    nRetro: retro.length.toLocaleString(locale),
    worstYears: worst ? (worst.days / 365.25).toFixed(1) : "0",
    worstLabel: worst ? seriesLabel(worst.country, worst.category, lang) : "",
    worstMonth: worst ? monthYear(worst.date, lang) : "",
    aggMonth: aggDate ? monthYear(aggDate, lang) : "",
    aggCount,
    aggYears: Math.round(Math.max(0, aggDays) / 365.25),
    typFrozen: Math.round(median(frozenShares) * 100),
    famBacklogYears: famMax ? Math.floor(famMax.backlog_years) : 0,
    famBacklogLabel: famMax ? seriesLabel(famMax.country, famMax.category, lang) : "",
    empBacklogYears: empMax ? Math.floor(empMax.backlog_years) : 0,
    empBacklogLabel: empMax ? seriesLabel(empMax.country, empMax.category, lang) : "",
    gapMonths: Math.round(median(currentGaps.map((g) => g.gap_days)) / 30.44),
    gapMaxYears: gapMax ? (gapMax.gap_days / 365.25).toFixed(1) : "0",
    gapMaxLabel: gapMax ? seriesLabel(gapMax.country, gapMax.category, lang) : "",
    nDiff,
    nMixed,
    // "stationary" viene del summary; NO por resta (un veredicto centinela
    // "failed" del censo inflaría la resta y mentiría "N estacionarias").
    nLevel,
    // audit B3: with an empty/missing census the g09 caption would read
    // "0 de 74" — hide the figure instead of asserting a confident lie.
    hasStationarity: nDiff + nMixed + nLevel > 0,
    advMin: advances.length ? Math.round(Math.min(...advances)) : 0,
    advMax: advances.length ? Math.round(Math.max(...advances)) : 0,
    // same guard for g06's "entre 0 y 0"
    hasAdvance: advances.length > 0 && advances.some((a) => a !== 0),
    dvRows: (facts.dv?.n_rows ?? 0).toLocaleString(locale),
  };
}
