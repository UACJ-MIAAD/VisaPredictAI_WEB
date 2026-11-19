"use client";

// /resultados — the forecast instrument (redesign 19-nov-2026, revised after
// the external audit). One series at a time: choose country, table and
// category; read the published cutoff and, only when there is something to
// project, the central projection and its 95 % range at the end of the horizon
// (month precision: the band is years wide, a day would be false precision);
// see the fan chart; check a priority date against the central path AND the
// band; export; or hand the series to VisaBot.
import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Download, Image as ImageIcon, Link2, Check, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { tr, localeOf } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { localePath } from "@/lib/site-map";
import { countryLabel } from "@/lib/data/visa-panel";
import type { Panel } from "@/lib/data/panel-core";
import { forecastFor, type ForecastStore } from "@/lib/data/forecasts";
import { buildForecast, buildLine, buildMultiLine, monthLabel, type ChartSpec, type PanelIndex } from "@/lib/visabot/analytics";
import { forecastToCsv, seriesReadout, reachVerdict, catRank, COUNTRY_SHORT, type GallerySeries } from "@/lib/visabot/gallery";
import { forecastQuery } from "@/components/sections/home-observatory";

const VisaChart = dynamic(() => import("@/components/visabot/visa-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full" />,
});

export type InstrumentView = "zoom" | "full" | "compare";
const TABLE_ORDER = ["FAD", "DFF"];

/** "2001-08-23" → "ago 2001" / "Aug 2001". */
export function monthOfDate(iso: string, lang: "es" | "en") {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(localeOf(lang), { month: "short", year: "numeric", timeZone: "UTC" }).replace(/\./g, "");
}

function download(name: string, data: Blob | string, type = "text/csv;charset=utf-8") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Rasterize the mounted chart SVG with its title. Styles come from the live
// computed values of every node (Recharts relies on CSS classes and var()
// tokens that a standalone SVG would lose: black serif labels on dark mode).
const STYLE_PROPS = ["display", "visibility", "fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity", "font-family", "font-size", "font-weight"];
async function chartPng(svg: SVGSVGElement, title: string, subtitle: string, bg: string, ink: string): Promise<Blob | null> {
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...svg.querySelectorAll("*")], dst = [clone, ...clone.querySelectorAll("*")];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    // computed url() paints are absolute ("http://…#id"); a standalone SVG needs "url(#id)"
    const style = STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";").replace(/url\("?[^)#"]*#([^)"]+)"?\)/g, "url(#$1)");
    (dst[i] as SVGElement).setAttribute("style", style);
  });
  const head = subtitle ? 54 : 34;
  const ns = "http://www.w3.org/2000/svg";
  const outer = document.createElementNS(ns, "svg");
  outer.setAttribute("xmlns", ns); outer.setAttribute("width", String(w)); outer.setAttribute("height", String(h + head));
  const t = document.createElementNS(ns, "text");
  t.setAttribute("x", "8"); t.setAttribute("y", "22");
  t.setAttribute("style", `fill:${ink};font-family:${getComputedStyle(document.body).fontFamily};font-size:15px;font-weight:600`);
  t.textContent = title;
  const st = document.createElementNS(ns, "text");
  st.setAttribute("x", "8"); st.setAttribute("y", "42");
  st.setAttribute("style", `fill:${ink};opacity:0.7;font-family:${getComputedStyle(document.body).fontFamily};font-size:12px`);
  st.textContent = subtitle;
  const g = document.createElementNS(ns, "g");
  g.setAttribute("transform", `translate(0,${head})`);
  clone.setAttribute("width", String(w)); clone.setAttribute("height", String(h));
  g.appendChild(clone); outer.appendChild(t); if (subtitle) outer.appendChild(st); outer.appendChild(g);
  const str = new XMLSerializer().serializeToString(outer);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str); });
  const canvas = document.createElement("canvas");
  canvas.width = w * 2; canvas.height = (h + head) * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(2, 2);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h + head);
  ctx.drawImage(img, 0, 0, w, h + head);
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}

export function ForecastInstrument({ all, selected, onSelect, view, onView, panel, forecasts, index }: {
  all: GallerySeries[];
  selected: GallerySeries;
  onSelect: (key: string) => void;
  view: InstrumentView;
  onView: (v: InstrumentView) => void;
  panel: Panel;
  forecasts: ForecastStore;
  index: PanelIndex | null;
}) {
  const { lang } = useLang();
  const [pd, setPd] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const { country, category, table } = selected;
  const tableName = (t: string) => `${tr(lang, t === "DFF" ? "resTableDFF" : "resTableFAD")} (${t})`;

  const countries = React.useMemo(() => [...new Set(all.map((s) => s.country))], [all]);
  const compare = view === "compare";
  const tables = React.useMemo(
    () => [...new Set(all.filter((s) => s.country === country).map((s) => s.table))].sort((a, b) => TABLE_ORDER.indexOf(a) - TABLE_ORDER.indexOf(b)),
    [all, country],
  );
  const categories = React.useMemo(
    () => all.filter((s) => s.country === country && s.table === table).map((s) => s.category).sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b)),
    [all, country, table],
  );
  // Switching country or table keeps the category when that series exists,
  // otherwise falls back to the first category of the new combination.
  const pick = (c: string, t: string, cat: string) => {
    const byRank = (xs: GallerySeries[]) => [...xs].sort((a, b) => catRank(a.category) - catRank(b.category))[0];
    const next = all.find((s) => s.key === `${c}|${cat}|${t}`) ?? byRank(all.filter((s) => s.country === c && s.table === t)) ?? byRank(all.filter((s) => s.country === c));
    if (!next) return;
    track("Forecast Gallery Open", { country: next.country, category: next.category, table: next.table, view, from: "instrument" });
    onSelect(next.key);
  };

  React.useEffect(() => { setPd(""); }, [selected.key]);

  const rows = React.useMemo(() => index?.get(selected.key) ?? panel.rows.filter((r) => r.country === country && r.category === category && r.table === table), [index, selected.key, panel, country, category, table]);
  const points = forecastFor(forecasts, country, category, table);
  const readout = React.useMemo(() => seriesReadout(rows, points, panel.monthRange[1]), [rows, points, panel]);
  const projects = !!readout.projected;
  // Compare overlays only projections that would be shown for each country on
  // its own (no fan for a Current, Unavailable, discontinued or stale series).
  const compareStore = React.useMemo(() => {
    if (!compare) return forecasts;
    const series = new Map([...forecasts.series].filter(([k, pts]) => {
      const [c, cat, t] = k.split("|");
      if (cat !== category || t !== table) return true;
      return !!seriesReadout(index?.get(k) ?? panel.rows.filter((r) => r.country === c && r.category === cat && r.table === t), pts, panel.monthRange[1]).projected;
    }));
    return { ...forecasts, series };
  }, [compare, forecasts, category, table, index, panel]);
  const spec: ChartSpec | null = React.useMemo(() => {
    if (compare) return buildMultiLine(panel, category, table, lang, compareStore);
    // Nothing to project (Current, Unavailable, discontinued, stale): history
    // only, so the chart never contradicts the readout with a fan.
    if (!projects) return buildLine(panel, country, category, table, lang);
    const s = buildForecast(panel, country, category, table, lang, forecasts.horizonMonths || undefined, view === "full" ? 480 : 48, forecasts, index ?? undefined);
    // The track record lives once, in the page summary; not repeated in a box under the chart.
    // and plain words instead of pipeline jargon above the chart.
    return s && s.kind === "forecast" ? { ...s, note: undefined, subtitle: tr(lang, "resChartLegend") } : s;
  }, [view, compare, compareStore, projects, panel, country, category, table, lang, forecasts, index]);
  const reach = React.useMemo(() => (pd.trim() ? reachVerdict(readout, points, pd.trim()) : null), [readout, points, pd]);

  const cur = readout.current;
  const currentText = !cur ? "—" : cur.status === "C" ? tr(lang, "resCurrentC") : cur.status === "U" ? tr(lang, "resCurrentU") : (cur.date ?? "—");
  const dff = table === "DFF";
  const noneText = readout.none === "current" ? tr(lang, dff ? "resNoneCurrentDFF" : "resNoneCurrentFAD")
    : readout.none === "unavailable" ? tr(lang, dff ? "resNoneUnavailableDFF" : "resNoneUnavailableFAD")
    : readout.none === "discontinued" ? tr(lang, "resNoneDiscontinued").replace("{m}", cur ? monthLabel(cur.month, lang) : "—")
    : readout.none ? tr(lang, "resNoneStale") : null;
  const fileBase = `${country}_${category}_${table}`;
  const canExport = view !== "compare" && !!readout.projected && !!points?.length;
  const title = compare ? `${category} · ${tableName(table)}` : `${countryLabel(country, lang)} · ${category} · ${tableName(table)}`;
  const bound = (iso: string, isCurrent: boolean) => (isCurrent ? tr(lang, "resCurrentC") : monthOfDate(iso, lang));
  const exportPng = async () => {
    const svg = chartRef.current?.querySelector("svg.recharts-surface");
    if (!svg) return;
    try {
      const cs = getComputedStyle(document.documentElement);
      const p = readout.projected;
      const sub = p ? `${tr(lang, "resNow")}: ${currentText} · ${tr(lang, "resProjected").replace("{m}", monthLabel(p.month, lang))}: ${bound(p.date, p.dateCurrent)} · ${tr(lang, "resBand95")}: ${bound(p.lo95, p.lo95Current)} – ${bound(p.hi95, p.hi95Current)}` : "";
      const blob = await chartPng(svg as SVGSVGElement, title, sub, cs.getPropertyValue("--color-bg").trim() || "#fff", cs.getPropertyValue("--color-ink").trim() || "#000");
      if (blob) download(`${fileBase}.png`, blob, "image/png");
      track("Forecast Export", { format: "png" });
    } catch { /* rasterization unsupported: CSV export still available */ }
  };
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  };
  const m = (iso: string | null) => (iso ? monthLabel(iso, lang) : "");
  const short = (c: string) => (c === "all_chargeability" ? tr(lang, "resRowShort") : COUNTRY_SHORT[c] ?? countryLabel(c, lang));

  return (
    <section id="res-forecast" className="fc-instrument" aria-labelledby="fc-title">
      <div className="fc-controls">
        {!compare && <div className="fc-seg" role="group" aria-label={tr(lang, "resPickCountry")}>
          {countries.map((c) => (
            <button key={c} type="button" aria-pressed={c === country} title={countryLabel(c, lang)}
              onClick={() => pick(c, table, category)}>{short(c)}<span className="sr-only"> ({countryLabel(c, lang)})</span></button>
          ))}
        </div>}
        <div className="fc-seg" role="group" aria-label={tr(lang, "resPickTable")}>
          {tables.map((t) => (
            <button key={t} type="button" aria-pressed={t === table} onClick={() => pick(country, t, category)}>{tableName(t)}</button>
          ))}
        </div>
        <label className="fc-select">
          <span className="sr-only">{tr(lang, "resCategory")}</span>
          <select value={category} onChange={(e) => pick(country, table, e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
        </label>
      </div>
      <p className="fc-hint fc-tables-hint">{tr(lang, "resTablesHint")}</p>

      <h2 id="fc-title" tabIndex={-1} className="fc-title">{title}</h2>

      {view === "compare" ? (
        <p className="fc-compare-note">{tr(lang, "resCompareNote").replace("{c}", category).replace("{t}", tableName(table))}</p>
      ) : (
        <dl className="fc-readout">
          <div>
            <dt>{tr(lang, "resNow")}{cur ? ` · ${monthLabel(cur.month, lang)}` : ""}</dt>
            <dd data-fc-current>{currentText}</dd>
          </div>
          {readout.projected ? (
            <>
              <div>
                <dt>{tr(lang, "resProjected").replace("{m}", monthLabel(readout.projected.month, lang))}</dt>
                <dd data-fc-projected data-date={readout.projected.date}>
                  {bound(readout.projected.date, readout.projected.dateCurrent)}
                  {readout.projected.retro && <span className="fc-retro">{tr(lang, "resRetro")}</span>}
                </dd>
              </div>
              <div>
                <dt>{tr(lang, "resBand95")}</dt>
                <dd data-fc-band>{bound(readout.projected.lo95, readout.projected.lo95Current)} – {bound(readout.projected.hi95, readout.projected.hi95Current)}</dd>
              </div>
            </>
          ) : (
            <div className="fc-readout-none">
              <dt>{tr(lang, "resProjectedNone")}</dt>
              <dd data-fc-projected data-fc-none={readout.none ?? undefined}>{noneText}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="fc-toolbar">
        <div className="fc-seg fc-seg--quiet" role="group" aria-label={tr(lang, "resViewLabel")}>
          {(["zoom", "full", "compare"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => onView(k)}>
              {tr(lang, k === "zoom" ? "resViewZoom" : k === "full" ? "resViewFull" : "resViewCompare")}
            </button>
          ))}
        </div>
        <div className="fc-actions">
          {canExport && (
            <>
              <button type="button" className="fc-icon" aria-label={tr(lang, "resExportCsvTip")} title={tr(lang, "resExportCsvTip")}
                onClick={() => { if (points) download(`${fileBase}.csv`, forecastToCsv(selected.key, points, readout.base)); track("Forecast Export", { format: "csv" }); }}>
                <Download className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="fc-icon" onClick={exportPng} aria-label={tr(lang, "resExportPngTip")} title={tr(lang, "resExportPngTip")}><ImageIcon className="h-4 w-4" aria-hidden /></button>
            </>
          )}
          <button type="button" className="fc-icon" onClick={copyLink} aria-label={copied ? tr(lang, "resCopied") : tr(lang, "resCopyLink")} title={copied ? tr(lang, "resCopied") : tr(lang, "resCopyLink")}>
            {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <div ref={chartRef} className="fc-chart">
        {spec ? <VisaChart spec={spec} /> : <p className="py-16 text-center text-sm text-[var(--color-muted)]">{tr(lang, "pronEmpty")}</p>}
      </div>

      <div className="fc-bottom">
        {projects && !compare && (
          <div className="fc-reach">
            <label htmlFor="fc-pd">{tr(lang, "resReachTitle")}</label>
            <input id="fc-pd" type="date" value={pd} onChange={(e) => setPd(e.target.value)} aria-describedby="fc-pd-hint" />
            <span id="fc-pd-hint" className="fc-hint">{tr(lang, "resReachHintBand")}</span>
            {reach && (
              <p role="status" aria-live="polite" data-fc-reach={reach.status}>
                {pd && reach.status !== "invalid" && <strong>{new Date(`${pd}T00:00:00Z`).toLocaleDateString(localeOf(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}: </strong>}
                {reach.status === "past" && tr(lang, "resReachPast")}
                {(reach.status === "current" || reach.status === "unavailable" || reach.status === "discontinued" || reach.status === "noForecast") && tr(lang, "resReachNoForecast")}
                {reach.status === "invalid" && tr(lang, "resReachBad")}
                {reach.status === "within" && (reach.late
                  ? tr(lang, "resReachCentral").replace("{c}", m(reach.central)).replace("{e}", m(reach.early)).replace("{l}", m(reach.late))
                  : tr(lang, "resReachCentralOpen").replace("{c}", m(reach.central)).replace("{e}", m(reach.early)).replace("{m}", m(reach.last)))}
                {reach.status === "crossedBack" && tr(lang, "resReachCrossedBack").replace("{c}", m(reach.central)).replace("{m}", m(reach.last))}
                {reach.status === "band" && tr(lang, "resReachBandOnly").replace("{e}", m(reach.early)).replace("{m}", m(reach.last))}
                {reach.status === "beyond" && tr(lang, "resReachBeyond").replace("{m}", m(reach.last))}
              </p>
            )}
          </div>
        )}
        <Link className="fc-ask" href={`${localePath("/asistente", lang)}/?q=${encodeURIComponent(forecastQuery(country, category, table, lang))}`}
          onClick={() => track("Forecast CTA", { from: "gallery" })}>
          {tr(lang, "resAskBot")} <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
