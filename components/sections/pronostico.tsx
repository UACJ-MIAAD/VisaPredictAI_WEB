"use client";

// First-class forecast section (/datos-historicos#pronostico): the deployed
// production model's 12-month forecast for any pilot country × category ×
// table, rendered with the same fan chart the VisaBot console uses
// (components/visabot/visa-chart). Data: the real panel CSV (loadPanel) plus
// the pre-generated production forecasts (loadForecasts). When a series has no
// pre-generated forecast, buildForecast falls back to its in-browser drift
// baseline, whose subtitle labels it as illustrative. When a combination lacks
// enough published F dates, an honest empty state is shown. NO fabricated
// numbers anywhere (regla #0): every figure comes from fetched data.

import * as React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { loadPanel, countryLabel, PILOT, type Panel } from "@/lib/data/visa-panel";
import { loadForecasts, type ForecastStore } from "@/lib/data/forecasts";
import { buildForecast } from "@/lib/visabot/analytics";

// Recharts lives in visa-chart; only fetched when this section mounts.
const VisaChart = dynamic(() => import("@/components/visabot/visa-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full" />,
});

function Select({
  label, value, onChange, options, fmt,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; fmt?: (v: string) => string;
}) {
  return (
    <label className="flex flex-col text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
      >
        {options.map((o) => (
          <option key={o} value={o}>{fmt ? fmt(o) : o}</option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}

export function Pronostico() {
  const { lang } = useLang();
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [forecasts, setForecasts] = React.useState<ForecastStore | null>(null);
  const [error, setError] = React.useState(false);
  const ref = React.useRef<HTMLElement | null>(null);
  const started = React.useRef(false);

  // Same lazy-load pattern as historico.tsx: fetch the 1.5 MB panel only when
  // the section approaches the viewport. A #pronostico deep link does NOT
  // reliably intersect (the native anchor scroll fires before the async
  // sections above expand the layout — audit finding), so the hash starts the
  // load eagerly and HashRescroll re-anchors the viewport.
  React.useEffect(() => {
    const start = () => {
      if (started.current) return;
      started.current = true;
      Promise.all([loadPanel(), loadForecasts()])
        .then(([p, f]) => {
          setPanel(p);
          setForecasts(f);
        })
        .catch(() => setError(true));
    };
    // Also eager for hashes BELOW this section: a #historico/#scorecard deep
    // link scrolls past us, so the IO never intersects an already-passed
    // section and the page above the target would stay skeletal (audit r2).
    if (["#pronostico", "#historico", "#scorecard"].includes(window.location.hash)) {
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

  const [country, setCountry] = React.useState("mexico");
  const [category, setCategory] = React.useState("F1");
  const [table, setTable] = React.useState("FAD");

  const countries = React.useMemo(
    () => (panel ? PILOT.filter((c) => panel.countries.includes(c)) : PILOT),
    [panel],
  );

  // Snap defaults to values that actually exist once the real panel arrives.
  React.useEffect(() => {
    if (!panel) return;
    if (!countries.includes(country)) setCountry(countries[0] ?? panel.countries[0]);
    if (!panel.categories.includes(category)) setCategory(panel.categories[0]);
    if (!panel.tables.includes(table)) setTable(panel.tables[0]);
  }, [panel, countries, country, category, table]);

  const spec = React.useMemo(
    () => (panel ? buildForecast(panel, country, category, table, lang, 12, 48, forecasts) : null),
    [panel, country, category, table, lang, forecasts],
  );

  React.useEffect(() => {
    if (panel) track("Forecast View", { country, category, table });
  }, [panel, country, category, table]);

  return (
    <section id="pronostico" ref={ref} className="section">
      <div className="section-inner">
        <span className="section-tag">{tr(lang, "pronTag")}</span>
        <h2 className="section-title">{tr(lang, "pronTitle")}</h2>
        <p className="section-sub">{tr(lang, "pronSub")}</p>

        {error ? (
          <EmptyState msg={tr(lang, "histError")} />
        ) : !panel ? (
          <div className="space-y-4">
            <Skeleton className="h-[72px] w-full" />
            <Skeleton className="h-[340px] w-full" />
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4">
              <Select
                label={tr(lang, "selCountry")}
                value={country}
                onChange={setCountry}
                options={countries}
                fmt={(v) => countryLabel(v, lang)}
              />
              <Select
                label={tr(lang, "selCategoryL")}
                value={category}
                onChange={setCategory}
                options={panel.categories}
              />
              <Select
                label={tr(lang, "selTableL")}
                value={table}
                onChange={setTable}
                options={panel.tables}
              />
            </div>

            {spec ? <VisaChart spec={spec} /> : <EmptyState msg={tr(lang, "pronEmpty")} />}
          </>
        )}

        <p className="mt-4 text-xs text-[var(--color-muted)]">{tr(lang, "pronScope")}</p>
      </div>
    </section>
  );
}
