"use client";

// Forecast-gallery lightbox: opens the full Recharts fan chart for a series,
// with prev/next through the (filtered) set and a view toggle — Full history /
// Zoom (recent + projection) / Compare countries (the priority-date race
// for this category × table). This is the ONLY place the heavy chart mounts, so
// the card grid stays cheap. Focus-trapped, Esc + arrow-key navigable.
import * as React from "react";
import dynamic from "next/dynamic";
import { X, ChevronLeft, ChevronRight, Link2, Check, Download, Image as ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { countryLabel } from "@/lib/data/visa-panel";
import { buildForecast, buildMultiLine, monthLabel, reachesPriorityDate, type ChartSpec, type PanelIndex } from "@/lib/visabot/analytics";
import { forecastFor, type ForecastStore } from "@/lib/data/forecasts";
import { forecastToCsv } from "@/lib/visabot/gallery";
import type { Panel } from "@/lib/data/panel-core";
import type { GallerySeries } from "@/lib/visabot/gallery";

// Trigger a client download of a Blob/string.
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
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = bg || "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}

const VisaChart = dynamic(() => import("@/components/visabot/visa-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});

type View = "full" | "zoom" | "compare";

export function ForecastLightbox({ series, index, panel, forecasts, panelIndex, onIndex, onClose }: {
  series: GallerySeries[];
  index: number;
  panel: Panel;
  forecasts: ForecastStore | null;
  panelIndex?: PanelIndex | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const [view, setView] = React.useState<View>("zoom");
  const [copied, setCopied] = React.useState(false);
  const [pd, setPd] = React.useState("");
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const cur = series[index];

  const prev = React.useCallback(() => onIndex((index - 1 + series.length) % series.length), [index, series.length, onIndex]);
  const next = React.useCallback(() => onIndex((index + 1) % series.length), [index, series.length, onIndex]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      // don't hijack arrow keys typed inside a form field (e.g. the native date
      // input steps day/month/year with Left/Right) — only navigate series otherwise
      const el = e.target as HTMLElement | null;
      if (el && el.closest("input, select, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, prev, next]);

  React.useEffect(() => {
    if (cur) track("Forecast Gallery Open", { country: cur.country, category: cur.category, table: cur.table, view });
  }, [cur, view]);

  const spec: ChartSpec | null = React.useMemo(() => {
    if (!cur) return null;
    if (view === "compare") return buildMultiLine(panel, cur.category, cur.table, lang, forecasts);
    // full = wide window (covers the whole panel history); zoom = recent 48 mo.
    // horizon = pipeline value (forecasts.horizonMonths); undefined → buildForecast default.
    return buildForecast(panel, cur.country, cur.category, cur.table, lang, forecasts?.horizonMonths || undefined, view === "full" ? 480 : 48, forecasts, panelIndex ?? undefined);
  }, [cur, view, panel, forecasts, lang, panelIndex]);

  // "reaches my priority date?" — answered from the already-computed forecast
  const reach = React.useMemo(() => {
    if (!cur || !pd.trim()) return null;
    const rows = panelIndex?.get(cur.key) ?? panel.rows.filter((r) => r.country === cur.country && r.category === cur.category && r.table === cur.table);
    return reachesPriorityDate(rows, forecastFor(forecasts, cur.country, cur.category, cur.table), pd.trim());
  }, [cur, pd, panelIndex, panel, forecasts]);

  const copyLink = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  }, []);

  if (!cur) return null;
  const views: { k: View; label: string }[] = [
    { k: "full", label: tr(lang, "resViewFull") },
    { k: "zoom", label: tr(lang, "resViewZoom") },
    { k: "compare", label: tr(lang, "resViewCompare") },
  ];

  // export: only for a real (pre-generated) forecast, and not the compare overlay
  const points = forecastFor(forecasts, cur.country, cur.category, cur.table);
  const canExport = view !== "compare" && !!points && points.length > 0;
  const fileBase = `${cur.country}_${cur.category}_${cur.table}`;
  const exportCsv = () => { if (points) download(`${fileBase}.csv`, forecastToCsv(cur.key, points)); };
  const exportPng = async () => {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg) return;
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim() || "#ffffff";
      const blob = await svgToPngBlob(svg as SVGSVGElement, bg);
      if (blob) download(`${fileBase}.png`, blob, "image/png");
    } catch { /* rasterization unsupported → no-op (CSV export still available) */ }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${countryLabel(cur.country, lang)} · ${cur.category} · ${cur.table}`}>
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden />
      <div ref={trapRef} className="relative flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-border bg-[var(--color-bg)] shadow-2xl">
        {/* header — on mobile the title keeps its own row (stays readable) and the
            controls wrap below; on sm+ they sit inline as one row. */}
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:flex-nowrap sm:px-5">
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
            <span className="w-1 self-stretch rounded-full" style={{ background: cur.block === "familia" ? "var(--color-accent)" : "var(--color-accent-2)" }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-base font-bold text-[var(--color-ink)]">
                {countryLabel(cur.country, lang)} · {cur.category} · {cur.table}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.66rem] text-[var(--color-muted)]">
                {cur.mase != null && <span className="tabular-nums">MASE {cur.mase.toFixed(3)}</span>}
                {cur.models.length > 0 && <span className="truncate">{cur.models.join("+")}</span>}
                {cur.lastMonth && <span>· {monthLabel(cur.lastMonth, lang)}</span>}
                <span className="tabular-nums">{index + 1} / {series.length}</span>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            {/* view toggle */}
            <div className="flex rounded-lg border border-border p-0.5">
              {views.map((v) => (
                <button
                  key={v.k}
                  onClick={() => setView(v.k)}
                  className={`rounded-md px-2.5 py-1 text-xs transition ${view === v.k ? "bg-[var(--color-accent-btn)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {canExport && (
              <>
                <button onClick={exportCsv} aria-label={tr(lang, "resExportCsvTip")} title={tr(lang, "resExportCsvTip")} className="vb-iconbtn shrink-0">
                  <Download className="h-4 w-4" aria-hidden />
                </button>
                <button onClick={exportPng} aria-label={tr(lang, "resExportPngTip")} title={tr(lang, "resExportPngTip")} className="vb-iconbtn shrink-0">
                  <ImageIcon className="h-4 w-4" aria-hidden />
                </button>
              </>
            )}
            <button onClick={copyLink} aria-label={copied ? tr(lang, "resCopied") : tr(lang, "resCopyLink")} title={copied ? tr(lang, "resCopied") : tr(lang, "resCopyLink")} className="vb-iconbtn shrink-0">
              {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
            </button>
            <button onClick={onClose} aria-label={tr(lang, "resClose")} title={tr(lang, "resClose")} className="vb-iconbtn shrink-0">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        {/* screen-reader announcement of the current series + position */}
        <p className="sr-only" role="status" aria-live="polite">
          {countryLabel(cur.country, lang)} · {cur.category} · {cur.table}, {index + 1} / {series.length}
        </p>

        {/* chart */}
        <div ref={chartRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {spec ? <VisaChart spec={spec} /> : <p className="py-16 text-center text-sm text-[var(--color-muted)]">{tr(lang, "pronEmpty")}</p>}

          {/* "reaches my priority date?" — personalization a static gallery can't do */}
          <div className="mt-4 rounded-xl border border-border bg-[var(--color-surface)] px-3 py-3">
            <label htmlFor="reach-pd" className="block text-xs font-semibold text-[var(--color-ink)]">{tr(lang, "resReachTitle")}</label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input id="reach-pd" type="date" value={pd} onChange={(e) => setPd(e.target.value)}
                aria-label={tr(lang, "resReachTitle")}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground" />
              <span className="text-[0.7rem] text-[var(--color-muted)]">{tr(lang, "resReachHint")}</span>
            </div>
            {reach && (
              <p className="mt-2 text-[0.8rem]" role="status" aria-live="polite"
                style={{ color: reach.status === "within" || reach.status === "past" ? "var(--color-success)" : reach.status === "beyond" ? "var(--color-danger)" : "var(--color-muted)" }}>
                {reach.status === "within" && tr(lang, "resReachYes").replace("{m}", reach.month ? monthLabel(reach.month, lang) : "—")}
                {reach.status === "beyond" && tr(lang, "resReachNo").replace("{n}", String(forecasts?.horizonMonths ?? ""))}
                {reach.status === "past" && tr(lang, "resReachPast")}
                {reach.status === "invalid" && tr(lang, "resReachBad")}
              </p>
            )}
          </div>
        </div>

        {/* prev / next */}
        {series.length > 1 && (
          <>
            <button onClick={prev} aria-label={tr(lang, "resPrev")} title={tr(lang, "resPrev")}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full border border-border bg-[var(--color-surface)] p-1.5 shadow-md transition hover:border-[var(--color-accent)]">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button onClick={next} aria-label={tr(lang, "resNext")} title={tr(lang, "resNext")}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full border border-border bg-[var(--color-surface)] p-1.5 shadow-md transition hover:border-[var(--color-accent)]">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
