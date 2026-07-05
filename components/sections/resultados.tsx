"use client";

// /resultados — the forecast gallery: a browsable, filterable, hierarchical view
// of every pre-generated production forecast (country × category × table). A
// meta-bar of derived counts + filters + three tiers (Featured grid / By country
// / By category accordions) of cheap sparkline cards; opening any card mounts the
// full fan chart in the lightbox (the only place Recharts loads). Data: the real
// panel + the pre-generated forecasts. Every count is derived (regla #0); nothing
// references anything outside the visa domain.
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { localeOf } from "@/lib/i18n";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
import { loadPanel, countryLabel, blockLabel, type Panel } from "@/lib/data/visa-panel";
import { loadForecasts, type ForecastStore } from "@/lib/data/forecasts";
import { monthLabel, buildPanelIndex, type PanelIndex } from "@/lib/visabot/analytics";
import {
  buildGallerySeries, buildGalleryTree, gallerySummary, filterSeries,
  attachSignals, sortSeries, maseTerciles, type GallerySeries, type SortKey,
} from "@/lib/visabot/gallery";
import { ForecastCard } from "./forecast-card";
import { ForecastLightbox } from "./forecast-lightbox";

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col text-xs text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// One collapsible tier group (a country or a category) → grid of cards, mounted
// only while open so sparklines don't compute for collapsed groups.
function TierGroup({ id, title, count, open, onToggle, series, panel, forecasts, index, terciles, onOpen }: {
  id: string; title: React.ReactNode; count: number; open: boolean; onToggle: (open: boolean) => void;
  series: GallerySeries[]; panel: Panel; forecasts: ForecastStore | null; index: PanelIndex | null;
  terciles: { t1: number; t2: number } | null; onOpen: (s: GallerySeries) => void;
}) {
  const { lang } = useLang();
  return (
    <details open={open} onToggle={(e) => onToggle(e.currentTarget.open)} className="overflow-hidden rounded-xl border border-border bg-[var(--color-surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 marker:content-none">
        <span className="font-serif text-sm font-bold text-[var(--color-ink)]">{title}</span>
        <span className="text-[0.66rem] text-[var(--color-muted)]">{count} {tr(lang, "resSeriesCount")}</span>
        <span className="flex-1" />
        <svg className={`h-3 w-3 text-[var(--color-muted)] transition ${open ? "rotate-180" : ""}`} viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M1 1l4 4 4-4" /></svg>
      </summary>
      {open && (
        <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2" id={id}>
          {series.map((s) => <ForecastCard key={s.key} series={s} panel={panel} forecasts={forecasts} index={index} terciles={terciles} onOpen={() => onOpen(s)} />)}
        </div>
      )}
    </details>
  );
}

export function Resultados() {
  const { lang } = useLang();
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [forecasts, setForecasts] = React.useState<ForecastStore | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    Promise.all([loadPanel(), loadForecasts()])
      .then(([p, f]) => { setPanel(p); setForecasts(f); })
      .catch(() => setError(true));
  }, []);

  const [fCountry, setFCountry] = React.useState("");
  const [fTable, setFTable] = React.useState("");
  const [fBlock, setFBlock] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("order");
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  const [openCountry, setOpenCountry] = React.useState<Set<string>>(new Set());
  const [openCat, setOpenCat] = React.useState<Set<string>>(new Set());
  // a series key parsed from the URL on first load, opened once data is ready
  const pendingSeries = React.useRef<string | null>(null);
  const hydrated = React.useRef(false);

  // Panel index (built once) — feeds buildForecast per card and the derived
  // signals, so no card re-scans the whole panel (perf).
  const index = React.useMemo(() => (panel ? buildPanelIndex(panel) : null), [panel]);
  const allSeries = React.useMemo(() => {
    if (!forecasts) return [];
    const base = buildGallerySeries(forecasts);
    return index ? attachSignals(base, forecasts, index) : base;
  }, [forecasts, index]);
  const summary = React.useMemo(() => gallerySummary(allSeries), [allSeries]);
  const terciles = React.useMemo(() => maseTerciles(allSeries), [allSeries]);
  const filtered = React.useMemo(
    () => sortSeries(filterSeries(allSeries, { country: fCountry, table: fTable, block: fBlock, query }), sort),
    [allSeries, fCountry, fTable, fBlock, query, sort],
  );
  const tree = React.useMemo(() => buildGalleryTree(filtered), [filtered]);
  const idx = React.useMemo(() => { const m = new Map<string, number>(); filtered.forEach((s, i) => m.set(s.key, i)); return m; }, [filtered]);
  const openLightbox = (s: GallerySeries) => setLightbox(idx.get(s.key) ?? 0);

  // ── deep-link: hydrate filters/sort + pending series from the URL on mount
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("country")) setFCountry(p.get("country") as string);
    if (p.get("table")) setFTable(p.get("table") as string);
    if (p.get("block")) setFBlock(p.get("block") as string);
    if (p.get("q")) setQuery(p.get("q") as string);
    const s = p.get("sort");
    if (s && ["order", "mase", "backlog", "movement"].includes(s)) setSort(s as SortKey);
    const series = p.get("series");
    if (series) pendingSeries.current = series;
    hydrated.current = true;
  }, []);

  // open the pending (deep-linked) series once the filtered set is ready
  React.useEffect(() => {
    const k = pendingSeries.current;
    if (!k || !filtered.length) return;
    const i = idx.get(k);
    if (i != null) { setLightbox(i); pendingSeries.current = null; }
  }, [filtered, idx]);

  // ── deep-link: reflect filters/sort + open series in the URL (shareable)
  React.useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
    const p = new URLSearchParams();
    if (fCountry) p.set("country", fCountry);
    if (fTable) p.set("table", fTable);
    if (fBlock) p.set("block", fBlock);
    if (query) p.set("q", query);
    if (sort !== "order") p.set("sort", sort);
    if (lightbox != null && filtered[lightbox]) p.set("series", filtered[lightbox].key);
    const qs = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [fCountry, fTable, fBlock, query, sort, lightbox, filtered]);

  const nf = (n: number) => n.toLocaleString(localeOf(lang));
  const countries = React.useMemo(() => [...new Set(allSeries.map((s) => s.country))], [allSeries]);
  const tables = React.useMemo(() => [...new Set(allSeries.map((s) => s.table))], [allSeries]);

  const chip = (label: string, value: React.ReactNode) => (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--color-surface)] px-2.5 py-1 text-[0.72rem] text-[var(--color-muted)]">
      {label} <strong className="font-semibold text-[var(--color-ink)]">{value}</strong>
    </span>
  );

  return (
    <section id="resultados" className="section">
      <div className="section-inner">
        <span className="section-tag">{tr(lang, "resTag")}</span>
        <h2 className="section-title">{tr(lang, "resTitle")}</h2>
        <p className="section-sub">{tr(lang, "resSub").replace("{n}", String(SITE_STATS.horizonMonths))}</p>

        {error ? (
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">{tr(lang, "histError")}</div>
        ) : !forecasts || !panel ? (
          <div className="space-y-3">
            <Skeleton className="h-[56px] w-full" />
            <Skeleton className="h-[64px] w-full" />
            <Skeleton className="h-[220px] w-full" />
          </div>
        ) : (
          <>
            {/* meta-bar — every count derived (regla #0) */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--color-surface)] px-2.5 py-1 text-[0.72rem] text-[var(--color-muted)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" aria-hidden />
                {tr(lang, "resMetaThrough")} <strong className="font-semibold text-[var(--color-ink)]">{summary.lastMonth ? monthLabel(summary.lastMonth, lang) : "—"}</strong>
              </span>
              {chip(tr(lang, "resMetaHorizon"), tr(lang, "resHorizonVal").replace("{n}", String(forecasts.horizonMonths)))}
              {forecasts.scorecard && Number.isFinite(forecasts.scorecard.overall?.mae_days) && (
                <span title={tr(lang, "resScoreTip")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-2.5 py-1 text-[0.72rem] text-[var(--color-muted)]">
                  {tr(lang, "resScoreLabel")}{" "}
                  <strong className="font-semibold text-[var(--color-ink)] tabular-nums">
                    ±{Math.round(forecasts.scorecard.overall.mae_days)} d
                    {Number.isFinite(forecasts.scorecard.overall?.cov95) ? ` · 95 % ${Math.round(forecasts.scorecard.overall.cov95 * 100)} %` : ""}
                  </strong>
                </span>
              )}
              {chip("", `${nf(summary.nSeries)} ${tr(lang, "resSeriesLabel")}`)}
              {chip("", `${summary.nAreas} ${tr(lang, "resAreasLabel")}`)}
              {chip(tr(lang, "blockFamily"), summary.nFamily)}
              {chip(tr(lang, "blockEmployment"), summary.nEmployment)}
              {chip("FAD", summary.nFAD)}
              {chip("DFF", summary.nDFF)}
            </div>

            {/* controls */}
            <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
              <Select label={tr(lang, "selCountry")} value={fCountry} onChange={setFCountry}
                options={[{ value: "", label: tr(lang, "optAll") }, ...countries.map((c) => ({ value: c, label: countryLabel(c, lang) }))]} />
              <Select label={tr(lang, "selTableL")} value={fTable} onChange={setFTable}
                options={[{ value: "", label: tr(lang, "optAllF") }, ...tables.map((t) => ({ value: t, label: t }))]} />
              <Select label={tr(lang, "resFilterBlock")} value={fBlock} onChange={setFBlock}
                options={[{ value: "", label: tr(lang, "optAll") }, { value: "familia", label: tr(lang, "blockFamily") }, { value: "empleo", label: tr(lang, "blockEmployment") }]} />
              <label className="flex flex-col text-xs text-muted-foreground">
                {tr(lang, "resSearch")}
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr(lang, "resSearchPh")}
                  className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
              </label>
              {/* sort — turns the wall into an analytic instrument */}
              <div className="flex flex-col text-xs text-muted-foreground">
                {tr(lang, "resSort")}
                <div className="mt-1 flex rounded-lg border border-border p-0.5">
                  {([["order", "resSortOrder"], ["mase", "resSortMase"], ["backlog", "resSortBacklog"], ["movement", "resSortMovement"]] as const).map(([k, key]) => (
                    <button key={k} onClick={() => setSort(k)} aria-pressed={sort === k}
                      className={`rounded-md px-2 py-1 text-xs transition ${sort === k ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}>
                      {tr(lang, key)}
                    </button>
                  ))}
                </div>
              </div>
              <span className="ml-auto inline-flex items-center rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-xs font-bold text-white tabular-nums">{nf(filtered.length)}</span>
            </div>

            {/* tier-nav */}
            <div className="mb-5 flex flex-wrap gap-2 text-xs">
              <a href="#res-featured" className="rounded-full border border-border px-3 py-1.5 text-muted-foreground transition hover:border-[var(--color-accent)] hover:text-foreground">★ {tr(lang, "resTierFeatured")} <span className="tabular-nums">{tree.featured.length}</span></a>
              <a href="#res-country" className="rounded-full border border-border px-3 py-1.5 text-muted-foreground transition hover:border-[var(--color-accent)] hover:text-foreground">⊞ {tr(lang, "resTierByCountry")} <span className="tabular-nums">{tree.byCountry.length}</span></a>
              <a href="#res-category" className="rounded-full border border-border px-3 py-1.5 text-muted-foreground transition hover:border-[var(--color-accent)] hover:text-foreground">◈ {tr(lang, "resTierByCategory")} <span className="tabular-nums">{tree.byCategory.length}</span></a>
            </div>

            {filtered.length === 0 ? (
              <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">{tr(lang, "resEmpty")}</div>
            ) : (
              <div className="space-y-10">
                {/* Tier 1 · Featured */}
                <div id="res-featured">
                  <div className="mb-3">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">★ {tr(lang, "resTierFeatured")}</span>
                    <h3 className="font-serif text-lg font-bold text-[var(--color-ink)]">{tr(lang, "resTierFeatured")}</h3>
                    <p className="text-[0.8rem] text-[var(--color-muted)]">{tr(lang, "resTierFeaturedSub")}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {tree.featured.map((s) => <ForecastCard key={s.key} series={s} panel={panel} forecasts={forecasts} index={index} terciles={terciles} onOpen={() => openLightbox(s)} />)}
                  </div>
                </div>

                {/* Tier 2 · By country */}
                <div id="res-country">
                  <div className="mb-3 flex flex-wrap items-end gap-3">
                    <div>
                      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">⊞ {tr(lang, "resTierByCountry")}</span>
                      <h3 className="font-serif text-lg font-bold text-[var(--color-ink)]">{tr(lang, "resTierByCountry")}</h3>
                      <p className="text-[0.8rem] text-[var(--color-muted)]">{tr(lang, "resByCountrySub")}</p>
                    </div>
                    <div className="ml-auto flex gap-2 text-xs">
                      <button className="rounded-lg border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground" onClick={() => setOpenCountry(new Set(tree.byCountry.map((g) => g.country)))}>{tr(lang, "resExpandAll")}</button>
                      <button className="rounded-lg border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground" onClick={() => setOpenCountry(new Set())}>{tr(lang, "resCollapseAll")}</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {tree.byCountry.map((g) => (
                      <TierGroup key={g.country} id={`res-c-${g.country}`} title={countryLabel(g.country, lang)} count={g.series.length}
                        open={openCountry.has(g.country)} onToggle={(o) => setOpenCountry((s) => { const n = new Set(s); if (o) n.add(g.country); else n.delete(g.country); return n; })}
                        series={g.series} panel={panel} forecasts={forecasts} index={index} terciles={terciles} onOpen={openLightbox} />
                    ))}
                  </div>
                </div>

                {/* Tier 3 · By category */}
                <div id="res-category">
                  <div className="mb-3 flex flex-wrap items-end gap-3">
                    <div>
                      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">◈ {tr(lang, "resTierByCategory")}</span>
                      <h3 className="font-serif text-lg font-bold text-[var(--color-ink)]">{tr(lang, "resTierByCategory")}</h3>
                      <p className="text-[0.8rem] text-[var(--color-muted)]">{tr(lang, "resByCategorySub")}</p>
                    </div>
                    <div className="ml-auto flex gap-2 text-xs">
                      <button className="rounded-lg border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground" onClick={() => setOpenCat(new Set(tree.byCategory.map((g) => g.category)))}>{tr(lang, "resExpandAll")}</button>
                      <button className="rounded-lg border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground" onClick={() => setOpenCat(new Set())}>{tr(lang, "resCollapseAll")}</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {tree.byCategory.map((g) => (
                      <TierGroup key={g.category} id={`res-cat-${g.category}`} title={<>{g.category} <span className="text-[0.66rem] font-normal text-[var(--color-muted)]">· {blockLabel(g.block, lang)}</span></>} count={g.series.length}
                        open={openCat.has(g.category)} onToggle={(o) => setOpenCat((s) => { const n = new Set(s); if (o) n.add(g.category); else n.delete(g.category); return n; })}
                        series={g.series} panel={panel} forecasts={forecasts} index={index} terciles={terciles} onOpen={openLightbox} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="mt-5 text-xs text-[var(--color-muted)]">{tr(lang, "resOpenHint")}</p>
          </>
        )}

        {lightbox != null && panel && filtered[lightbox] && (
          <ForecastLightbox series={filtered} index={lightbox} panel={panel} forecasts={forecasts} panelIndex={index}
            onIndex={setLightbox} onClose={() => setLightbox(null)} />
        )}
      </div>
    </section>
  );
}
