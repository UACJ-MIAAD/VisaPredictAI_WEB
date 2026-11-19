"use client";

// /resultados — forecasts (redesign 19-nov-2026). Two parts:
//   1. the instrument: one series, its readout and fan chart (forecast-instrument.tsx);
//   2. every series in ONE list grouped by country (no featured / by-country /
//      by-category triplication): sparkline, current cutoff and projected cutoff;
//      a row loads its series into the instrument. Pin 2–4 rows to overlay them.
// Data: the real panel + the pre-generated production forecasts. Every count is
// derived (regla #0). State is deep-linkable: ?series=, ?table=, ?block=, ?q=,
// ?sort=, ?pin=.
import * as React from "react";
import { Layers, Pin, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { tr, localeOf } from "@/lib/i18n";
import { loadPanel, countryLabel, type Panel } from "@/lib/data/visa-panel";
import { loadForecasts, forecastFor, type ForecastStore } from "@/lib/data/forecasts";
import { monthLabel, buildPanelIndex, buildForecast } from "@/lib/visabot/analytics";
import {
  buildGallerySeries, gallerySummary, filterSeries, attachSignals, sortSeries,
  maseTerciles, maseTier, seriesReadout, type GallerySeries, type SortKey,
} from "@/lib/visabot/gallery";
import { Sparkline } from "./sparkline";
import { ForecastInstrument } from "./forecast-instrument";
import { BasketCompare } from "./basket-compare";
import { CohortBadge } from "@/components/ui/cohort-badge";

const DEFAULT_KEY = "mexico|F3|FAD";
const SORTS: SortKey[] = ["order", "mase", "backlog", "movement"];

export function Resultados() {
  const { lang } = useLang();
  const en = lang === "en";
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [forecasts, setForecasts] = React.useState<ForecastStore | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    Promise.all([loadPanel(), loadForecasts()]).then(([p, f]) => { setPanel(p); setForecasts(f); }).catch(() => setError(true));
  }, []);

  const [selectedKey, setSelectedKey] = React.useState(DEFAULT_KEY);
  const [fTable, setFTable] = React.useState("");
  const [fBlock, setFBlock] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("order");
  const [basket, setBasket] = React.useState<string[]>([]);
  const [basketOpen, setBasketOpen] = React.useState(false);
  const hydrated = React.useRef(false);
  const instrumentRef = React.useRef<HTMLDivElement>(null);

  const index = React.useMemo(() => (panel ? buildPanelIndex(panel) : null), [panel]);
  const allSeries = React.useMemo(() => {
    if (!forecasts) return [];
    const base = buildGallerySeries(forecasts);
    return index ? attachSignals(base, forecasts, index) : base;
  }, [forecasts, index]);
  const byKey = React.useMemo(() => new Map(allSeries.map((s) => [s.key, s])), [allSeries]);
  const summary = React.useMemo(() => gallerySummary(allSeries), [allSeries]);
  const terciles = React.useMemo(() => maseTerciles(allSeries), [allSeries]);
  const filtered = React.useMemo(
    () => sortSeries(filterSeries(allSeries, { table: fTable, block: fBlock, query }), sort),
    [allSeries, fTable, fBlock, query, sort],
  );
  // One list: grouped by country while in bulletin order, a single flat ranking otherwise.
  const groups = React.useMemo(() => {
    if (sort !== "order") return [{ country: "", series: filtered }];
    const m = new Map<string, GallerySeries[]>();
    for (const s of filtered) (m.get(s.country) ?? m.set(s.country, []).get(s.country)!).push(s);
    return [...m].map(([country, series]) => ({ country, series }));
  }, [filtered, sort]);
  const selected = byKey.get(selectedKey) ?? byKey.get(DEFAULT_KEY) ?? allSeries[0];
  const basketItems = React.useMemo(() => basket.map((k) => byKey.get(k)).filter(Boolean) as GallerySeries[], [basket, byKey]);

  React.useEffect(() => {
    if (!allSeries.length) return;
    setBasket((b) => { const keep = b.filter((k) => byKey.has(k)); return keep.length === b.length ? b : keep; });
  }, [allSeries, byKey]);

  // deep-link in
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("series")) setSelectedKey(p.get("series") as string);
    if (p.get("table")) setFTable(p.get("table") as string);
    if (p.get("block")) setFBlock(p.get("block") as string);
    if (p.get("q")) setQuery(p.get("q") as string);
    const s = p.get("sort");
    if (s && (SORTS as string[]).includes(s)) setSort(s as SortKey);
    if (p.get("pin")) setBasket((p.get("pin") as string).split(",").filter(Boolean).slice(0, 4));
    hydrated.current = true;
  }, []);
  // deep-link out
  React.useEffect(() => {
    if (!hydrated.current) return;
    const p = new URLSearchParams();
    if (selected && selected.key !== DEFAULT_KEY) p.set("series", selected.key);
    if (fTable) p.set("table", fTable);
    if (fBlock) p.set("block", fBlock);
    if (query) p.set("q", query);
    if (sort !== "order") p.set("sort", sort);
    if (basket.length) p.set("pin", basket.join(","));
    const qs = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [selected, fTable, fBlock, query, sort, basket]);

  const togglePin = (key: string) => setBasket((b) => (b.includes(key) ? b.filter((k) => k !== key) : b.length >= 4 ? b : [...b, key]));
  const openSeries = (key: string) => {
    setSelectedKey(key);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    instrumentRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const nf = (n: number) => n.toLocaleString(localeOf(lang));
  const sc = forecasts?.scorecard;
  const seg = <T extends string>(label: string, value: T, set: (v: T) => void, opts: [T, string][]) => (
    <div className="fc-seg fc-seg--quiet" role="group" aria-label={label}>
      {opts.map(([v, l]) => <button key={v || "all"} type="button" aria-pressed={value === v} onClick={() => set(v)}>{l}</button>)}
    </div>
  );

  return (
    <section id="resultados" className="section fc-page">
      <div className="section-inner">
        {error ? (
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">{tr(lang, "histError")}</div>
        ) : !forecasts || !panel || !selected ? (
          <div className="space-y-3"><Skeleton className="h-[48px] w-full" /><Skeleton className="h-[120px] w-full" /><Skeleton className="h-[340px] w-full" /></div>
        ) : (
          <>

            <div ref={instrumentRef} className="fc-anchor">
              <ForecastInstrument all={allSeries} selected={selected} onSelect={setSelectedKey} panel={panel} forecasts={forecasts} index={index} />
            </div>

            <p className="fc-summary">
              {tr(lang, "resSummary")
                .replace("{n}", nf(summary.nSeries))
                .replace("{a}", String(summary.nAreas))
                .replace("{h}", String(forecasts.horizonMonths))
                .replace("{m}", summary.lastMonth ? monthLabel(summary.lastMonth, lang) : "—")}
              {sc && Number.isFinite(sc.overall?.mae_days) && (
                <> {tr(lang, "resSummaryScore").replace("{e}", String(Math.round(sc.overall.mae_days))).replace("{c}", String(Math.round(sc.overall.cov95 * 100)))}{" "}
                  <a href={`${en ? "/en" : ""}/datos-historicos/#scorecard`} title={tr(lang, "resScoreTip")}>{tr(lang, "resSummaryScoreLink")}</a></>
              )}
            </p>

            <div id="res-all" className="fc-all">
              <div className="fc-all-head">
                <h2>{tr(lang, "resAllTitle")}</h2>
                <p>{tr(lang, "resAllSub")}</p>
              </div>
              <div className="fc-filters">
                {seg(tr(lang, "selTableL"), fTable, setFTable, [["", tr(lang, "optAllF")], ["FAD", "FAD"], ["DFF", "DFF"]])}
                {seg(tr(lang, "resFilterBlock"), fBlock, setFBlock, [["", tr(lang, "optAll")], ["familia", tr(lang, "blockFamily")], ["empleo", tr(lang, "blockEmployment")]])}
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr(lang, "resSearchPh")} aria-label={tr(lang, "resSearch")} className="fc-search" />
                <label className="fc-sort">
                  <span>{tr(lang, "resSort")}</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    <option value="order">{tr(lang, "resSortOrder")}</option>
                    <option value="mase">{tr(lang, "resSortMase")}</option>
                    <option value="backlog">{tr(lang, "resSortBacklog")}</option>
                    <option value="movement">{tr(lang, "resSortMovement")}</option>
                  </select>
                </label>
                <span className="fc-count" aria-live="polite">{nf(filtered.length)} {tr(lang, "resSeriesLabel")}</span>
              </div>

              {basket.length > 0 && (
                <div className="fc-basket">
                  <span>{tr(lang, "resBasket")}</span>
                  {basketItems.map((s) => (
                    <button key={s.key} type="button" onClick={() => togglePin(s.key)} title={tr(lang, "resUnpin")}>
                      {countryLabel(s.country, lang)} · {s.category} · {s.table} <span aria-hidden>✕</span>
                    </button>
                  ))}
                  <span className="fc-basket-hint">{basket.length >= 4 ? tr(lang, "resBasketFull") : tr(lang, "resBasketHint")}</span>
                  <button type="button" className="fc-basket-clear" onClick={() => setBasket([])}>{tr(lang, "resClearBasket")}</button>
                  <button type="button" className="fc-basket-go" disabled={basket.length < 2} onClick={() => setBasketOpen(true)}>
                    <Layers className="h-3.5 w-3.5" aria-hidden /> {tr(lang, "resCompareN")} ({basket.length})
                  </button>
                </div>
              )}

              {filtered.length === 0 ? (
                <p className="fc-empty">{tr(lang, "resEmpty")}</p>
              ) : (
                groups.map((g) => (
                  <div key={g.country || "all"} className="fc-group">
                    {g.country && <h3>{countryLabel(g.country, lang)} <span>{g.series.length}</span></h3>}
                    <ul>
                      {g.series.map((s) => (
                        <SeriesRow key={s.key} s={s} showCountry={!g.country} active={s.key === selected.key} pinned={basket.includes(s.key)}
                          panel={panel} forecasts={forecasts} index={index} terciles={terciles} onOpen={() => openSeries(s.key)} onPin={() => togglePin(s.key)} />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {basketOpen && panel && basketItems.length >= 2 && (
          <BasketCompare items={basketItems} panel={panel} panelIndex={index} onClose={() => setBasketOpen(false)} />
        )}
      </div>
    </section>
  );
}

function SeriesRow({ s, showCountry, active, pinned, panel, forecasts, index, terciles, onOpen, onPin }: {
  s: GallerySeries; showCountry: boolean; active: boolean; pinned: boolean; panel: Panel; forecasts: ForecastStore;
  index: ReturnType<typeof buildPanelIndex> | null; terciles: { t1: number; t2: number } | null; onOpen: () => void; onPin: () => void;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  const r = React.useMemo(
    () => seriesReadout(index?.get(s.key) ?? [], forecastFor(forecasts, s.country, s.category, s.table)),
    [index, s, forecasts],
  );
  const spark = React.useMemo(
    () => buildForecast(panel, s.country, s.category, s.table, lang, forecasts.horizonMonths || undefined, 24, forecasts, index ?? undefined),
    [panel, s, lang, forecasts, index],
  );
  const tier = maseTier(s.mase, terciles);
  const cur = r.current;
  const now = !cur ? "—" : cur.status === "C" ? (en ? "Current" : "Al corriente") : cur.status === "U" ? (en ? "Unavailable" : "No disponible") : (cur.date ?? "—");
  const name = `${showCountry ? `${countryLabel(s.country, lang)} · ` : ""}${s.category} · ${s.table}`;
  return (
    <li className="fc-row" data-active={active || undefined}>
      <button type="button" className="fc-row-main" onClick={onOpen} aria-current={active || undefined} aria-label={`${countryLabel(s.country, lang)} · ${s.category} · ${s.table}`}>
        <span className="fc-row-name">
          <span className="fc-dot" data-block={s.block} aria-hidden />
          {name}
          <CohortBadge meta={s} />
        </span>
        <span className="fc-row-spark">{spark && spark.kind === "forecast" ? <Sparkline data={spark.data} w={120} h={30} /> : null}</span>
        <span className="fc-row-num"><small>{tr(lang, "resNowShort")}</small>{now}</span>
        <span className="fc-row-num"><small>{r.projected ? monthLabel(r.projected.month, lang) : tr(lang, "resProjectedShort")}</small>{r.projected?.date ?? "—"}</span>
        <span className="fc-row-mase" data-tier={tier ?? undefined}>{s.mase != null ? s.mase.toFixed(3) : "—"}</span>
        <ArrowUpRight className="fc-row-go h-4 w-4" aria-hidden />
      </button>
      <button type="button" className="fc-row-pin" onClick={onPin} aria-pressed={pinned} aria-label={tr(lang, pinned ? "resUnpin" : "resPin")} title={tr(lang, pinned ? "resUnpin" : "resPin")}>
        <Pin className="h-3.5 w-3.5" fill={pinned ? "currentColor" : "none"} aria-hidden />
      </button>
    </li>
  );
}
