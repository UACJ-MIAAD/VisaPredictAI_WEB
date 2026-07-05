"use client";

// Forecast-gallery lightbox: opens the full Recharts fan chart for a series,
// with prev/next through the (filtered) set and a view toggle — Full history /
// Zoom (recent + 12-mo projection) / Compare countries (the priority-date race
// for this category × table). This is the ONLY place the heavy chart mounts, so
// the card grid stays cheap. Focus-trapped, Esc + arrow-key navigable.
import * as React from "react";
import dynamic from "next/dynamic";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { countryLabel } from "@/lib/data/visa-panel";
import { buildForecast, buildMultiLine, monthLabel, type ChartSpec } from "@/lib/visabot/analytics";
import type { Panel } from "@/lib/data/panel-core";
import type { ForecastStore } from "@/lib/data/forecasts";
import type { GallerySeries } from "@/lib/visabot/gallery";

const VisaChart = dynamic(() => import("@/components/visabot/visa-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});

type View = "full" | "zoom" | "compare";

export function ForecastLightbox({ series, index, panel, forecasts, onIndex, onClose }: {
  series: GallerySeries[];
  index: number;
  panel: Panel;
  forecasts: ForecastStore | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const [view, setView] = React.useState<View>("zoom");
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const cur = series[index];

  const prev = React.useCallback(() => onIndex((index - 1 + series.length) % series.length), [index, series.length, onIndex]);
  const next = React.useCallback(() => onIndex((index + 1) % series.length), [index, series.length, onIndex]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      else if (e.key === "ArrowLeft") prev();
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
    if (view === "compare") return buildMultiLine(panel, cur.category, cur.table, lang);
    // full = wide window (covers the whole panel history); zoom = recent 48 mo
    return buildForecast(panel, cur.country, cur.category, cur.table, lang, 12, view === "full" ? 480 : 48, forecasts);
  }, [cur, view, panel, forecasts, lang]);

  if (!cur) return null;
  const views: { k: View; label: string }[] = [
    { k: "full", label: tr(lang, "resViewFull") },
    { k: "zoom", label: tr(lang, "resViewZoom") },
    { k: "compare", label: tr(lang, "resViewCompare") },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${countryLabel(cur.country, lang)} · ${cur.category} · ${cur.table}`}>
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden />
      <div ref={trapRef} className="relative flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-border bg-[var(--color-bg)] shadow-2xl">
        {/* header */}
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
          <span className="w-1 self-stretch rounded-full" style={{ background: cur.block === "familia" ? "var(--color-accent)" : "var(--color-accent-2)" }} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-base font-bold text-[var(--color-ink)]">
              {countryLabel(cur.country, lang)} · {cur.category} · {cur.table}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.66rem] text-[var(--color-muted)]">
              {cur.mase != null && <span className="tabular-nums">MASE {cur.mase.toFixed(3)}</span>}
              {cur.models.length > 0 && <span>{cur.models.join("+")}</span>}
              {cur.lastMonth && <span>· {monthLabel(cur.lastMonth, lang)}</span>}
              <span className="tabular-nums">{index + 1} / {series.length}</span>
            </div>
          </div>
          {/* view toggle */}
          <div className="flex rounded-lg border border-border p-0.5">
            {views.map((v) => (
              <button
                key={v.k}
                onClick={() => setView(v.k)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${view === v.k ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} aria-label={tr(lang, "resClose")} title={tr(lang, "resClose")} className="vb-iconbtn shrink-0">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {/* chart */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {spec ? <VisaChart spec={spec} /> : <p className="py-16 text-center text-sm text-[var(--color-muted)]">{tr(lang, "pronEmpty")}</p>}
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
