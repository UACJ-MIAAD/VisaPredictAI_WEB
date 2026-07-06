"use client";

// Compare basket: overlays 2–4 user-pinned series (any country/category/table
// mix) in one chart — a user-driven analytical view the reference's fixed
// per-category compare can't offer. Reuses buildBasketCompare + VisaChart.
import * as React from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { buildBasketCompare, type PanelIndex } from "@/lib/visabot/analytics";
import { countryLabel } from "@/lib/data/visa-panel";
import type { Panel } from "@/lib/data/panel-core";
import type { GallerySeries } from "@/lib/visabot/gallery";

const VisaChart = dynamic(() => import("@/components/visabot/visa-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});

export function BasketCompare({ items, panel, panelIndex, onClose }: {
  items: GallerySeries[];
  panel: Panel;
  panelIndex?: PanelIndex | null;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const spec = React.useMemo(() => buildBasketCompare(panel, items, lang, panelIndex ?? undefined), [panel, items, lang, panelIndex]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={tr(lang, "resBasket")}>
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden />
      <div ref={trapRef} className="relative flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-border bg-[var(--color-bg)] shadow-2xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="font-serif text-base font-bold text-[var(--color-ink)]">{tr(lang, "resBasket")}</div>
            <div className="mt-0.5 truncate text-[0.66rem] text-[var(--color-muted)]">
              {items.map((s) => `${countryLabel(s.country, lang)} · ${s.category} · ${s.table}`).join("   ·   ")}
            </div>
          </div>
          <button onClick={onClose} aria-label={tr(lang, "resClose")} title={tr(lang, "resClose")} className="vb-iconbtn shrink-0">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {spec ? <VisaChart spec={spec} /> : <p className="py-16 text-center text-sm text-[var(--color-muted)]">{tr(lang, "resBasketHint")}</p>}
        </div>
      </div>
    </div>
  );
}
