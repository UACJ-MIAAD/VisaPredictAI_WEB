"use client";

// /resultados — the forecast instrument (redesign 19-nov-2026). One series at a
// time: choose country, table and category, read the current cutoff and where
// the production model places it at the end of the horizon (with its 95 % band),
// see the fan chart, check a priority date, export, or hand the series to
// VisaBot. Replaces the old card-grid lightbox: the chart lives on the page.
import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Download, Image as ImageIcon, Link2, Check, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { localePath } from "@/lib/site-map";
import { countryLabel } from "@/lib/data/visa-panel";
import type { Panel } from "@/lib/data/panel-core";
import { forecastFor, type ForecastStore } from "@/lib/data/forecasts";
import { buildForecast, buildMultiLine, monthLabel, reachesPriorityDate, type ChartSpec, type PanelIndex } from "@/lib/visabot/analytics";
import { forecastToCsv, seriesReadout, catRank, type GallerySeries } from "@/lib/visabot/gallery";
import { forecastQuery } from "@/components/sections/home-observatory";

const VisaChart = dynamic(() => import("@/components/visabot/visa-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full" />,
});

const SHORT: Record<string, string> = { mexico: "MX", india: "IN", china: "CN", philippines: "PH", all_chargeability: "RoW" };

function download(name: string, data: Blob | string, type = "text/csv;charset=utf-8") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Rasterize a mounted chart SVG to PNG, resolving CSS custom properties (the
// chart strokes use var(--color-…), which don't survive a standalone SVG).
async function svgToPngBlob(svg: SVGSVGElement, bg: string): Promise<Blob | null> {
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w)); clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const cs = getComputedStyle(document.documentElement);
  const str = new XMLSerializer().serializeToString(clone)
    .replace(/var\((--[a-z0-9-]+)\)/gi, (_, v) => cs.getPropertyValue(v).trim() || "#000");
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str); });
  const canvas = document.createElement("canvas");
  canvas.width = w * 2; canvas.height = h * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(2, 2);
  ctx.fillStyle = bg || "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}

type View = "zoom" | "full" | "compare";

export function ForecastInstrument({ all, selected, onSelect, panel, forecasts, index }: {
  all: GallerySeries[];
  selected: GallerySeries;
  onSelect: (key: string) => void;
  panel: Panel;
  forecasts: ForecastStore;
  index: PanelIndex | null;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  const [view, setView] = React.useState<View>("zoom");
  const [pd, setPd] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const { country, category, table } = selected;

  const countries = React.useMemo(() => [...new Set(all.map((s) => s.country))], [all]);
  const tables = React.useMemo(() => [...new Set(all.filter((s) => s.country === country).map((s) => s.table))].sort(), [all, country]);
  const categories = React.useMemo(
    () => all.filter((s) => s.country === country && s.table === table).map((s) => s.category).sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b)),
    [all, country, table],
  );
  // Switching country or table keeps the category when that series exists,
  // otherwise falls back to the first category of the new combination.
  const pick = (c: string, t: string, cat: string) => {
    if (all.some((s) => s.key === `${c}|${cat}|${t}`)) return onSelect(`${c}|${cat}|${t}`);
    const byRank = (xs: GallerySeries[]) => [...xs].sort((a, b) => catRank(a.category) - catRank(b.category))[0];
    const next = byRank(all.filter((s) => s.country === c && s.table === t)) ?? byRank(all.filter((s) => s.country === c));
    if (next) onSelect(next.key);
  };

  React.useEffect(() => { setPd(""); }, [selected.key]);
  React.useEffect(() => { track("Forecast Gallery Open", { country, category, table, view }); }, [country, category, table, view]);

  const rows = React.useMemo(() => index?.get(selected.key) ?? panel.rows.filter((r) => r.country === country && r.category === category && r.table === table), [index, selected.key, panel, country, category, table]);
  const points = forecastFor(forecasts, country, category, table);
  const readout = React.useMemo(() => seriesReadout(rows, points), [rows, points]);
  const spec: ChartSpec | null = React.useMemo(() => {
    if (view === "compare") return buildMultiLine(panel, category, table, lang, forecasts);
    return buildForecast(panel, country, category, table, lang, forecasts.horizonMonths || undefined, view === "full" ? 480 : 48, forecasts, index ?? undefined);
  }, [view, panel, country, category, table, lang, forecasts, index]);
  const reach = React.useMemo(() => (pd.trim() ? reachesPriorityDate(rows, points, pd.trim()) : null), [rows, points, pd]);

  const cur = readout.current;
  const currentText = !cur ? "—" : cur.status === "C" ? (en ? "Current" : "Al corriente") : cur.status === "U" ? (en ? "Unavailable" : "No disponible") : (cur.date ?? "—");
  const fileBase = `${country}_${category}_${table}`;
  const canExport = view !== "compare" && !!points?.length;
  const exportPng = async () => {
    const svg = chartRef.current?.querySelector("svg.recharts-surface") ?? chartRef.current?.querySelector("svg");
    if (!svg) return;
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim() || "#ffffff";
      const blob = await svgToPngBlob(svg as SVGSVGElement, bg);
      if (blob) download(`${fileBase}.png`, blob, "image/png");
    } catch { /* rasterization unsupported: CSV export still available */ }
  };
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  };
  const views: { k: View; label: string }[] = [
    { k: "zoom", label: tr(lang, "resViewZoom") },
    { k: "full", label: tr(lang, "resViewFull") },
    { k: "compare", label: tr(lang, "resViewCompare") },
  ];

  return (
    <section id="res-forecast" className="fc-instrument" aria-labelledby="fc-title">
      <div className="fc-controls">
        <div className="fc-seg" role="group" aria-label={tr(lang, "selCountry")}>
          {countries.map((c) => (
            <button key={c} type="button" aria-pressed={c === country} aria-label={`${countryLabel(c, lang)}${SHORT[c] ? ` (${SHORT[c]})` : ""}`}
              onClick={() => pick(c, table, category)}>{SHORT[c] ?? countryLabel(c, lang)}</button>
          ))}
        </div>
        <div className="fc-seg" role="group" aria-label={tr(lang, "selTableL")}>
          {tables.map((t) => (
            <button key={t} type="button" aria-pressed={t === table} onClick={() => pick(country, t, category)}>{t}</button>
          ))}
        </div>
        <label className="fc-select">
          <span className="sr-only">{tr(lang, "resCategory")}</span>
          <select value={category} aria-label={tr(lang, "resCategory")} onChange={(e) => onSelect(`${country}|${e.target.value}|${table}`)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <h2 id="fc-title" className="fc-title">
        {countryLabel(country, lang)} <span>·</span> {category} <span>·</span> {table}
      </h2>

      <dl className="fc-readout" aria-live="polite">
        <div>
          <dt>{tr(lang, "resNow")}{cur ? ` · ${monthLabel(cur.month, lang)}` : ""}</dt>
          <dd data-fc-current>{currentText}</dd>
        </div>
        <div>
          <dt>{readout.projected ? tr(lang, "resProjected").replace("{m}", monthLabel(readout.projected.month, lang)) : tr(lang, "resProjectedNone")}</dt>
          <dd data-fc-projected>{readout.projected?.date ?? "—"}</dd>
        </div>
        <div>
          <dt>{tr(lang, "resBand95")}</dt>
          <dd className="fc-small">{readout.projected ? `${readout.projected.lo95} – ${readout.projected.hi95}` : "—"}</dd>
        </div>
        <div>
          <dt title={tr(lang, "resMaseTip")}>MASE</dt>
          <dd className="fc-small">{selected.mase != null ? selected.mase.toFixed(3) : "—"}{selected.models.length > 0 && <span className="fc-models">{selected.models.join(" + ")}</span>}</dd>
        </div>
      </dl>

      <div className="fc-toolbar">
        <div className="fc-seg fc-seg--quiet" role="group" aria-label={tr(lang, "resViewLabel")}>
          {views.map((v) => <button key={v.k} type="button" aria-pressed={view === v.k} onClick={() => setView(v.k)}>{v.label}</button>)}
        </div>
        <div className="fc-actions">
          {canExport && (
            <>
              <button type="button" className="vb-iconbtn" onClick={() => points && download(`${fileBase}.csv`, forecastToCsv(selected.key, points))} aria-label={tr(lang, "resExportCsvTip")} title={tr(lang, "resExportCsvTip")}><Download className="h-4 w-4" aria-hidden /></button>
              <button type="button" className="vb-iconbtn" onClick={exportPng} aria-label={tr(lang, "resExportPngTip")} title={tr(lang, "resExportPngTip")}><ImageIcon className="h-4 w-4" aria-hidden /></button>
            </>
          )}
          <button type="button" className="vb-iconbtn" onClick={copyLink} aria-label={copied ? tr(lang, "resCopied") : tr(lang, "resCopyLink")} title={copied ? tr(lang, "resCopied") : tr(lang, "resCopyLink")}>
            {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <div ref={chartRef} className="fc-chart">
        {spec ? <VisaChart spec={spec} /> : <p className="py-16 text-center text-sm text-[var(--color-muted)]">{tr(lang, "pronEmpty")}</p>}
      </div>

      <div className="fc-bottom">
        <div className="fc-reach">
          <label htmlFor="fc-pd">{tr(lang, "resReachTitle")}</label>
          <input id="fc-pd" type="date" value={pd} onChange={(e) => setPd(e.target.value)} />
          {reach && (
            <p role="status" aria-live="polite" data-fc-reach={reach.status}
              style={{ color: reach.status === "within" || reach.status === "past" ? "var(--color-success)" : reach.status === "beyond" ? "var(--color-danger)" : "var(--color-muted)" }}>
              {reach.status === "within" && tr(lang, "resReachYes").replace("{m}", reach.month ? monthLabel(reach.month, lang) : "—")}
              {reach.status === "beyond" && tr(lang, "resReachNo").replace("{n}", String(forecasts.horizonMonths))}
              {reach.status === "past" && tr(lang, "resReachPast")}
              {reach.status === "invalid" && tr(lang, "resReachBad")}
            </p>
          )}
        </div>
        <Link className="fc-ask" href={`${localePath("/asistente", lang)}/?q=${encodeURIComponent(forecastQuery(country, category, table, lang))}`}
          onClick={() => track("Forecast CTA", { from: "gallery" })}>
          <Sparkles className="h-4 w-4" aria-hidden /> {tr(lang, "resAskBot")}
        </Link>
      </div>
    </section>
  );
}
