"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip, Movement } from "@/components/ui/data-cells";
import { countryLabel } from "@/lib/data/visa-panel";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";

const FEED =
  "https://raw.githubusercontent.com/UACJ-MIAAD/VisaPredictAI/main/data/processed/bulletins.json";
// AZ8b — same-origin mirror, refreshed at build by scripts/fetch-data.mjs (plus
// a committed fallback): if the raw host is blocked/unreachable the section
// still renders the feed as of the last deploy.
const FEED_FALLBACK = "/data/bulletins.json";

const fetchFeed = async (): Promise<Feed> => {
  for (const url of [FEED, FEED_FALLBACK]) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as Feed;
    } catch {
      // try the next source
    }
  }
  throw new Error("bulletins feed unavailable");
};

type Row = {
  country: string;
  block: string;
  category: string;
  table: string;
  status: "C" | "F" | "U" | string;
  raw_value: string | null;
  delta_days: number | null;
};
type Feed = {
  generated_utc: string;
  latest_month: string;
  available_months: string[];
  months: Record<string, Row[]>;
};

const MES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function Boletines() {
  const { lang } = useLang();
  const [data, setData] = React.useState<Feed | null>(null);
  const [error, setError] = React.useState(false);
  const [month, setMonth] = React.useState("");
  const [filter, setFilter] = React.useState("");
  const ref = React.useRef<HTMLElement | null>(null);
  const loaded = React.useRef(false);

  const MES = lang === "en" ? MES_EN : MES_ES;
  const mLabel = (m: string) => {
    const [y, mo] = m.split("-");
    return `${MES[+mo - 1]} ${y}`;
  };
  const blockLabel = React.useCallback(
    (b: string) =>
      b === "employment" ? tr(lang, "blockEmployment") : b === "family" ? tr(lang, "blockFamily") : b,
    [lang],
  );

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting && !loaded.current) {
            loaded.current = true;
            fetchFeed()
              .then((d) => {
                setData(d);
                setMonth(d.latest_month);
              })
              .catch(() => setError(true));
            io.disconnect();
          }
        });
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const rows = React.useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    return (data.months[month] || []).filter(
      (r) =>
        !q ||
        `${countryLabel(r.country)} ${blockLabel(r.block)} ${r.category} ${r.table}`
          .toLowerCase()
          .includes(q),
    );
  }, [data, month, filter, blockLabel]);

  // summary reflects the SELECTED month so it always matches the table below
  const news = React.useMemo(() => {
    if (!data) return null;
    const r = data.months[month] || [];
    return {
      adv: r.filter((x) => (x.delta_days ?? 0) > 0).length,
      ret: r.filter((x) => (x.delta_days ?? 0) < 0).length,
      n: r.length,
    };
  }, [data, month]);

  const headers = [
    tr(lang, "colCountry"), tr(lang, "colBlock"), tr(lang, "colCategory"),
    tr(lang, "colTable"), tr(lang, "colStatus"), tr(lang, "colDate"), tr(lang, "colMovement"),
  ];

  return (
    <section id="boletines" ref={ref} className="section">
      <div className="section-inner">
        <span className="section-tag">{tr(lang, "blnTag")}</span>
        <h2 className="section-title">{tr(lang, "blnTitle")}</h2>
        <p className="section-sub">{tr(lang, "blnSub")}</p>

        {error ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-muted-foreground">{tr(lang, "blnError")}</p>
          </div>
        ) : !data ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <div className="flex gap-3">
              <Skeleton className="h-11 w-48" />
              <Skeleton className="h-11 w-64" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="mb-5 border-t-2 border-[var(--color-rule)] pt-4">
              {month === data.latest_month && (
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-accent)]">
                  {tr(lang, "blnBadge")}
                </span>
              )}
              <h3 className="mt-1 font-serif text-2xl font-bold">
                {tr(lang, "blnOf")} {mLabel(month)}
              </h3>
              <p className="mt-1 text-muted-foreground">
                <strong className="text-foreground">{news?.adv}</strong> {tr(lang, "blnAdvanced")} ·{" "}
                <strong className="text-foreground">{news?.ret}</strong> {tr(lang, "blnRetreated")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {news?.n} {tr(lang, "blnSeries")} · {tr(lang, "blnWindow")} {data.available_months.length}{" "}
                {tr(lang, "blnMonths")} · {tr(lang, "blnUpdated")} {data.generated_utc}
              </p>
            </div>

            <div className="mb-4 flex flex-wrap gap-4">
              <label className="text-sm text-muted-foreground">
                {tr(lang, "blnMonth")}
                <select
                  className="mt-1 block rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground sm:text-sm"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {[...data.available_months].reverse().map((m) => (
                    <option key={m} value={m}>{mLabel(m)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-muted-foreground">
                {tr(lang, "blnFilter")}
                <input
                  type="text"
                  placeholder={tr(lang, "blnFilterPh")}
                  className="mt-1 block w-64 max-w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground sm:text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
            </div>

            {/* AX4: fixed floor + .scroll-x-shadow edge scrims (content.css) as
                the horizontal-scroll affordance on phones */}
            <div className="scroll-x-shadow overflow-x-auto border-t-2 border-[var(--color-rule)]">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left">
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2 font-medium uppercase tracking-wide text-muted-foreground" style={{ fontSize: "0.72rem" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                        {tr(lang, "blnEmpty")}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={`${r.country}-${r.block}-${r.category}-${r.table}`} className="border-t border-border">
                        <td className="px-3 py-2">{countryLabel(r.country)}</td>
                        <td className="px-3 py-2">{blockLabel(r.block)}</td>
                        <td className="px-3 py-2">{r.category}</td>
                        <td className="px-3 py-2">{r.table}</td>
                        <td className="px-3 py-2"><StatusChip s={r.status} /></td>
                        <td className="px-3 py-2">{r.raw_value || "—"}</td>
                        <td className="px-3 py-2"><Movement d={r.delta_days} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {rows.length} {tr(lang, "blnSeries")} {tr(lang, "blnIn")} {mLabel(month)}
              {filter ? ` ${tr(lang, "blnFiltered")}` : ""}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
