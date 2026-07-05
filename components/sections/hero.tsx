"use client";

import { ArrowRight } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { localePath } from "@/lib/site-map";
import { track } from "@/lib/analytics";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
import { PILOT } from "@/lib/data/visa-panel";

// Every number here is derived at build time (site-stats.generated.ts ← eda_facts.json)
// or from a domain constant — never typed by hand (regla #0).
const nf = (lang: string, n: number) => n.toLocaleString(lang === "en" ? "en-US" : "es-MX");

// "2026-07" → "jul 2026" / "Jul 2026"
function monthLabel(ym: string, lang: string): string {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return s.replace(/\./g, "");
}

export function Hero() {
  const { lang } = useLang();
  const stats = [
    { num: nf(lang, SITE_STATS.nMonths), key: "statBulletins" },
    { num: nf(lang, SITE_STATS.nObs), key: "statObs" },
    { num: nf(lang, SITE_STATS.nSeriesStructural), key: "statSeries" },
    { num: nf(lang, PILOT.length), key: "statCountries" },
    { num: "CRISP-DM", key: "statMethod" },
  ];
  return (
    <section
      id="inicio"
      className="border-b border-border px-5 pb-12 pt-10 md:pt-14"
    >
      <div className="mx-auto max-w-[1140px]">
        <span className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          <span className="h-0.5 w-6 bg-[var(--color-accent)]" aria-hidden />
          {tr(lang, "heroEyebrow")} · {tr(lang, "heroDataThrough")} {monthLabel(SITE_STATS.dateLast, lang)}
        </span>

        <h1 className="mt-5 max-w-[17ch] font-serif text-[2.6rem] font-black leading-[1.02] tracking-[-0.02em] md:text-[4.2rem]">
          {tr(lang, "heroTitlePre")}
          <em className="text-[var(--color-accent)]">Visa Bulletin</em>
          {tr(lang, "heroTitlePost")}
        </h1>

        <p className="mt-5 max-w-[66ch] text-[1.075rem] leading-relaxed text-muted-foreground">
          {tr(lang, "heroSub")}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href="#resumen"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            {tr(lang, "heroCtaRead")} <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
          <a
            href={localePath("/datos-historicos", lang)}
            onClick={() => track("Explore Historical CTA")}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-medium transition-colors hover:border-[var(--color-accent-2)]"
          >
            {tr(lang, "heroCtaExplore")}
          </a>
        </div>

        <dl className="mt-10 grid grid-cols-2 border-y border-border sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s, i) => (
            <div
              key={s.key}
              className={
                "px-4 py-5 " +
                (i === 0 ? "" : "border-l border-border")
              }
            >
              <dt className="text-xs text-muted-foreground">{tr(lang, s.key)}</dt>
              <dd className="mt-1 font-serif text-3xl font-extrabold tabular-nums tracking-tight text-[var(--color-accent)]">
                {s.num}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
