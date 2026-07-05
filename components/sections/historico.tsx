"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { loadPanel, type Panel } from "@/lib/data/visa-panel";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";

// Recharts + TanStack live in panel-explorer; only fetched when it mounts.
const PanelExplorer = dynamic(() => import("./panel-explorer"), {
  ssr: false,
  loading: () => <ExplorerSkeleton />,
});

function ExplorerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[320px] w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  );
}

export function Historico() {
  const { lang } = useLang();
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [error, setError] = React.useState(false);
  const ref = React.useRef<HTMLElement | null>(null);
  const started = React.useRef(false);

  React.useEffect(() => {
    const start = () => {
      if (started.current) return;
      started.current = true;
      loadPanel().then(setPanel).catch(() => setError(true));
    };
    // A #historico deep link may never intersect (anchor scroll fires before
    // async sections above expand the layout) — start eagerly on hash. Also
    // for #scorecard (below us): the IO never fires for scrolled-past sections.
    if (["#historico", "#scorecard"].includes(window.location.hash)) {
      start();
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            start();
            io.disconnect();
          }
        }),
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="historico" ref={ref} className="section section--alt">
      <div className="section-inner">
        <span className="section-tag">{tr(lang, "histTag")}</span>
        <h2 className="section-title">
          Visa Bulletin · {lang === "en" ? "Historical data" : "Datos históricos"}
        </h2>
        <p className="section-sub">{tr(lang, "histSub")}</p>

        {error ? (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            {tr(lang, "histError")}
          </div>
        ) : !panel ? (
          <ExplorerSkeleton />
        ) : (
          <PanelExplorer panel={panel} />
        )}
      </div>
    </section>
  );
}
