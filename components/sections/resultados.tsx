"use client";

// /resultados — forecasts (redesign 19-nov-2026, revised after the external
// audit). Two parts:
//   1. the instrument: one series, its readout and fan chart (forecast-instrument.tsx);
//   2. every series in ONE list (no featured / by-country / by-category
//      triplication): published cutoff with its bulletin month, the projection
//      at the end of the horizon (month precision) or the reason there is none,
//      MASE against the naive forecast; a row loads its series into the
//      instrument and moves focus there. Pin 2–4 rows to overlay them.
// Every count is derived (regla #0). State is deep-linkable (?series, ?view,
// ?country, ?table, ?block, ?q, ?sort, ?pin); other parameters are preserved.
import * as React from "react";
import { Layers, Pin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { tr, localeOf } from "@/lib/i18n";
import { localePath } from "@/lib/site-map";
import { track } from "@/lib/analytics";
import { loadPanel, countryLabel, type Panel } from "@/lib/data/visa-panel";
import { loadForecasts, forecastFor, type ForecastStore } from "@/lib/data/forecasts";
import { monthLabel, buildPanelIndex, buildForecast, type PanelIndex } from "@/lib/visabot/analytics";
import {
  buildGallerySeries, gallerySummary, filterSeries, attachSignals, sortSeries,
  maseVsNaive, seriesReadout, COUNTRY_SHORT, type GallerySeries, type SortKey,
} from "@/lib/visabot/gallery";
import { Sparkline } from "./sparkline";
import { ForecastInstrument, monthOfDate, type InstrumentView } from "./forecast-instrument";
import { BasketCompare } from "./basket-compare";
import { CohortBadge } from "@/components/ui/cohort-badge";

const DEFAULT_KEY = "mexico|F3|FAD";
const SORTS: SortKey[] = ["order", "mase", "backlog", "movement"];
const VIEWS: InstrumentView[] = ["zoom", "full", "compare"];
const OWN = ["series", "view", "country", "table", "block", "q", "sort", "pin"];

export function Resultados() {
  const { lang } = useLang();
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [forecasts, setForecasts] = React.useState<ForecastStore | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    Promise.all([loadPanel(), loadForecasts()]).then(([p, f]) => { setPanel(p); setForecasts(f); }).catch(() => setError(true));
  }, []);

  const [selectedKey, setSelectedKey] = React.useState(DEFAULT_KEY);
  const [view, setView] = React.useState<InstrumentView>("zoom");
  const [fCountry, setFCountry] = React.useState("");
  const [fTable, setFTable] = React.useState("");
  const [fBlock, setFBlock] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("order");
  const [basket, setBasket] = React.useState<string[]>([]);
  const [basketOpen, setBasketOpen] = React.useState(false);
  const [capMsg, setCapMsg] = React.useState("");
  const instrumentRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const changeView = React.useCallback((v: InstrumentView) => { setView(v); track("Forecast View", { view: v }); }, []);

  const index = React.useMemo(() => (panel ? buildPanelIndex(panel) : null), [panel]);
  const allSeries = React.useMemo(() => {
    if (!forecasts) return [];
    const base = buildGallerySeries(forecasts);
    return index ? attachSignals(base, forecasts, index) : base;
  }, [forecasts, index]);
  const byKey = React.useMemo(() => new Map(allSeries.map((s) => [s.key, s])), [allSeries]);
  const summary = React.useMemo(() => gallerySummary(allSeries), [allSeries]);
  const filtered = React.useMemo(
    () => sortSeries(filterSeries(allSeries, { country: fCountry, table: fTable, block: fBlock, query }), sort),
    [allSeries, fCountry, fTable, fBlock, query, sort],
  );
  // Grouped by country in bulletin order; one ranking when sorted by a metric.
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

  // URL → state, once.
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("series")) setSelectedKey(p.get("series") as string);
    const v = p.get("view");
    if (v && (VIEWS as string[]).includes(v)) setView(v as InstrumentView);
    if (p.get("country")) setFCountry(p.get("country") as string);
    if (p.get("table")) setFTable(p.get("table") as string);
    if (p.get("block")) setFBlock(p.get("block") as string);
    if (p.get("q")) setQuery(p.get("q") as string);
    const s = p.get("sort");
    if (s && (SORTS as string[]).includes(s)) setSort(s as SortKey);
    if (p.get("pin")) setBasket((p.get("pin") as string).split(",").filter(Boolean).slice(0, 4));
  }, []);
  // State → URL, only once the data (and therefore the parsed state) is in
  // place, rewriting our own parameters and keeping anyone else's.
  React.useEffect(() => {
    if (!allSeries.length || !selected) return;
    const p = new URLSearchParams(window.location.search);
    OWN.forEach((k) => p.delete(k));
    p.set("series", selected.key);
    if (view !== "zoom") p.set("view", view);
    if (fCountry) p.set("country", fCountry);
    if (fTable) p.set("table", fTable);
    if (fBlock) p.set("block", fBlock);
    if (query) p.set("q", query);
    if (sort !== "order") p.set("sort", sort);
    if (basket.length) p.set("pin", basket.join(","));
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}${window.location.hash}`);
  }, [allSeries, selected, view, fCountry, fTable, fBlock, query, sort, basket]);

  const togglePin = React.useCallback((key: string) => {
    setBasket((b) => {
      if (!b.includes(key) && b.length >= 4) { setCapMsg(tr(lang, "resBasketFull")); return b; }
      setCapMsg("");
      const next = b.includes(key) ? b.filter((k) => k !== key) : [...b, key];
      if (!next.length) requestAnimationFrame(() => searchRef.current?.focus());
      return next;
    });
  }, [lang]);
  const openSeries = React.useCallback((key: string) => {
    setSelectedKey(key);
    const [country, category, table] = key.split("|");
    track("Forecast Gallery Open", { country, category, table, from: "list" });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    instrumentRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    document.getElementById("fc-title")?.focus({ preventScroll: true });
  }, []);
  const nf = (n: number) => n.toLocaleString(localeOf(lang));
  const sc = forecasts?.scorecard;
  const h = forecasts?.horizonMonths ?? 0;
  const atH = sc?.by_horizon?.[String(h)];
  const countries = [...new Set(allSeries.map((s) => s.country))];
  const seg = <T extends string>(label: string, value: T, set: (v: T) => void, opts: [T, string, string?][]) => (
    <div className="fc-seg fc-seg--quiet" role="group" aria-label={label}>
      {opts.map(([v, l, full]) => <button key={v || "all"} type="button" aria-pressed={value === v} title={full} onClick={() => set(v)}>{l}{full && <span className="sr-only"> ({full})</span>}</button>)}
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
              <ForecastInstrument all={allSeries} selected={selected} onSelect={setSelectedKey} view={view} onView={changeView} panel={panel} forecasts={forecasts} index={index} />
            </div>

            <div id="res-all" className="fc-all">
              <div className="fc-all-head">
                <h2>{tr(lang, "resAllTitle")}</h2>
                <p>
                  {tr(lang, "resSummary").replace("{n}", nf(summary.nSeries)).replace("{a}", String(summary.nAreas)).replace("{h}", String(h))
                    .replace("{m}", panel.monthRange[1] ? monthLabel(panel.monthRange[1], lang) : "—")}
                  {atH && Number.isFinite(atH.mae_days) && (
                    <> {tr(lang, "resSummaryScore").replace("{h}", String(h)).replace("{e}", String(Math.round(atH.mae_days))).replace("{c}", String(Math.round(atH.cov95 * 100)))}{" "}
                      <a href={`${localePath("/datos-historicos", lang)}/#scorecard`}>{tr(lang, "resSummaryScoreLink")}</a></>
                  )}
                </p>
              </div>
              {summary.lastMonth && panel.monthRange[1] && summary.lastMonth < panel.monthRange[1] && (
                <p className="fc-stale" role="note">{tr(lang, "resStaleNotice").replace("{f}", monthLabel(summary.lastMonth, lang)).replace("{p}", monthLabel(panel.monthRange[1], lang))}</p>
              )}
              <div className="fc-filters">
                {seg(tr(lang, "resFilterCountry"), fCountry, setFCountry, [["", tr(lang, "optAll")], ...countries.map((c) => [c, c === "all_chargeability" ? tr(lang, "resRowShort") : COUNTRY_SHORT[c] ?? c, countryLabel(c, lang)] as [string, string, string])])}
                {seg(tr(lang, "resFilterTable"), fTable, setFTable, [["", tr(lang, "optAllF")], ["FAD", "FAD", `${tr(lang, "resTableFAD")} (FAD)`], ["DFF", "DFF", `${tr(lang, "resTableDFF")} (DFF)`]])}
                {seg(tr(lang, "resFilterBlock"), fBlock, setFBlock, [["", tr(lang, "optAll")], ["familia", tr(lang, "blockFamily")], ["empleo", tr(lang, "blockEmployment")]])}
                <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr(lang, "resSearchPh")} aria-label={tr(lang, "resSearch")} className="fc-search" />
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
                    <button key={s.key} type="button" onClick={() => togglePin(s.key)} aria-label={`${tr(lang, "resUnpin")}: ${countryLabel(s.country, lang)} · ${s.category} · ${s.table}`}>
                      {countryLabel(s.country, lang)} · {s.category} · {s.table} <span aria-hidden>✕</span>
                    </button>
                  ))}
                  <span className="fc-basket-hint" aria-live="polite">{capMsg || (basket.length < 2 ? tr(lang, "resBasketHint") : "")}</span>
                  <button type="button" className="fc-basket-clear" onClick={() => { setBasket([]); setCapMsg(""); requestAnimationFrame(() => searchRef.current?.focus()); }}>{tr(lang, "resClearBasket")}</button>
                  <button type="button" className="fc-basket-go" disabled={basket.length < 2} onClick={() => setBasketOpen(true)}>
                    <Layers className="h-3.5 w-3.5" aria-hidden /> {tr(lang, "resCompareN")} ({basket.length})
                  </button>
                </div>
              )}

              {filtered.length === 0 ? (
                <p className="fc-empty">{tr(lang, "resEmpty")}</p>
              ) : (
                <>
                  <div className="fc-colhead" aria-hidden>
                    <span>{tr(lang, "resColSeries")}</span><span />
                    <span>{tr(lang, "resColNow")}</span>
                    <span>{tr(lang, "resColProj").replace("{h}", String(h))}</span>
                    <span>{sort === "backlog" ? tr(lang, "resColWait") : sort === "movement" ? tr(lang, "resColMove") : "MASE"}</span>
                  </div>
                  {groups.map((g) => (
                    <div key={g.country || "all"} className="fc-group">
                      {g.country && <h3>{countryLabel(g.country, lang)} <span>{g.series.length}</span></h3>}
                      <ul>
                        {g.series.map((s) => (
                          <SeriesRow key={s.key} s={s} showCountry={!g.country} active={s.key === selected.key} pinned={basket.includes(s.key)} full={basket.length >= 4} sort={sort} h={h}
                            panel={panel} forecasts={forecasts} index={index} onOpen={openSeries} onPin={togglePin} />
                        ))}
                      </ul>
                    </div>
                  ))}
                  {(sort === "order" || sort === "mase") && <p className="fc-footnote">{tr(lang, "resMaseTip")}</p>}
                </>
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

const SeriesRow = React.memo(function SeriesRow({ s, showCountry, active, pinned, full, sort, h, panel, forecasts, index, onOpen, onPin }: {
  s: GallerySeries; showCountry: boolean; active: boolean; pinned: boolean; full: boolean; sort: SortKey; h: number; panel: Panel; forecasts: ForecastStore;
  index: PanelIndex | null; onOpen: (key: string) => void; onPin: (key: string) => void;
}) {
  const { lang } = useLang();
  const r = React.useMemo(
    () => seriesReadout(index?.get(s.key) ?? [], forecastFor(forecasts, s.country, s.category, s.table), panel.monthRange[1]),
    [index, s, forecasts, panel],
  );
  const spark = React.useMemo(
    () => (r.projected ? buildForecast(panel, s.country, s.category, s.table, lang, forecasts.horizonMonths || undefined, 24, forecasts, index ?? undefined) : null),
    [r.projected, panel, s, lang, forecasts, index],
  );
  const cur = r.current, p = r.projected;
  const now = !cur ? "—" : cur.status === "C" ? tr(lang, "resCurrentC") : cur.status === "U" ? tr(lang, "resCurrentU") : (cur.date ?? "—");
  const none = r.none === "current" ? tr(lang, "resRowNoneCurrent") : r.none === "discontinued" ? tr(lang, "resRowNoneDiscontinued") : "—";
  const bound = (iso: string, isCurrent: boolean) => (isCurrent ? tr(lang, "resCurrentC") : monthOfDate(iso, lang));
  const verdict = maseVsNaive(s.mase);
  const metricName = sort === "backlog" ? tr(lang, "resColWait") : sort === "movement" ? tr(lang, "resColMove") : "MASE";
  const metric = sort === "backlog" ? (s.backlogYears != null && cur?.status === "F" ? `${s.backlogYears.toFixed(1)} ${tr(lang, "resYears")}` : "—")
    : sort === "movement" ? (p && s.movementPerYear != null ? `${s.movementPerYear >= 0 ? "+" : "−"}${Math.abs(Math.round(s.movementPerYear))} ${tr(lang, "resDaysYear")}` : "—")
    : (s.mase != null ? s.mase.toFixed(2) : "—");
  const cat = s.category.replace(/_/g, " ");
  return (
    <li className="fc-row" data-active={active || undefined}>
      <button type="button" className="fc-row-main" onClick={() => onOpen(s.key)} aria-current={active || undefined}>
        <span className="fc-row-name">
          {showCountry ? <>{countryLabel(s.country, lang)} · </> : <span className="sr-only">{countryLabel(s.country, lang)} · </span>}
          {cat} · {s.table}<span className="sr-only">,</span>
          <CohortBadge meta={s} />
        </span>
        <span className="fc-row-spark" aria-hidden>{spark && spark.kind === "forecast" ? <Sparkline data={spark.data} w={112} h={28} /> : null}</span>
        <span className="fc-row-num">
          <span className="sr-only">{tr(lang, "resNow")}, </span>
          <small>{cur ? monthLabel(cur.month, lang) : ""}</small><span className="sr-only">: </span>{now}<span className="sr-only">.</span>
        </span>
        <span className="fc-row-num">
          {p ? (
            <>
              <span className="sr-only">{tr(lang, "resProjected").replace("{m}", monthLabel(p.month, lang))}: </span>
              <small>{p.months !== h ? `${monthLabel(p.month, lang)} · ` : ""}<span className="sr-only">{tr(lang, "resBand95")}: </span>{bound(p.lo95, p.lo95Current)} – {bound(p.hi95, p.hi95Current)}<span className="sr-only">; </span></small>
              <span>{bound(p.date, p.dateCurrent)}{p.retro && <span className="fc-retro">{tr(lang, "resRetro")}</span>}</span><span className="sr-only">.</span>
            </>
          ) : <span className="fc-row-none">{none}</span>}
        </span>
        <span className="fc-row-metric" data-verdict={sort === "order" || sort === "mase" ? (verdict ?? undefined) : undefined}>
          <span className="fc-metric-label">{metricName} </span>{metric}
          {(sort === "order" || sort === "mase") && verdict && <span className="sr-only"> ({tr(lang, verdict === "beats" ? "resMaseBeats" : "resMaseLoses")})</span>}
        </span>
      </button>
      <button type="button" className="fc-row-pin" onClick={() => onPin(s.key)} aria-pressed={pinned} disabled={!pinned && full}
        aria-label={`${tr(lang, pinned ? "resUnpin" : "resPin")}: ${countryLabel(s.country, lang)} · ${cat} · ${s.table}`} title={tr(lang, pinned ? "resUnpin" : full ? "resBasketFull" : "resPin")}>
        <Pin className="h-3.5 w-3.5" fill={pinned ? "currentColor" : "none"} aria-hidden />
      </button>
    </li>
  );
});
