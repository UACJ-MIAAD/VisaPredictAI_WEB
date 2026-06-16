"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { loadPanel, type Panel } from "@/lib/data/visa-panel";

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
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [error, setError] = React.useState(false);
  const ref = React.useRef<HTMLElement | null>(null);
  const started = React.useRef(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            loadPanel().then(setPanel).catch(() => setError(true));
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
        <span className="section-tag">Datos históricos · panel multiserie</span>
        <h2 className="section-title">Visa Bulletin · Datos históricos</h2>
        <p className="section-sub">
          El corazón empírico del proyecto: el panel real{" "}
          <em>
            y<sub>p,c,b,t</sub>
          </em>{" "}
          del <em>U.S. Visa Bulletin</em>, desde dic-2001 hasta 2026. Explore la
          evolución de las fechas de prioridad, compare países bajo el límite del
          7&nbsp;%, observe retrogresiones e inspeccione cada serie disponible.
          Todas las cifras provienen del CSV publicado; no hay valores inventados.
        </p>

        {error ? (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Datos no encontrados: no se pudo cargar visa_panel_long.csv.
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
