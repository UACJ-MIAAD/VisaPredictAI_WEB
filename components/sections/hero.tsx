"use client";

import { useLang } from "@/components/lang-provider";
import { tr, localeOf } from "@/lib/i18n";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
import { PILOT } from "@/lib/data/visa-panel";
import { HomeObservatory } from "@/components/sections/home-observatory";

// Every number here is derived at build time (site-stats.generated.ts ← eda_facts.json)
// or from a domain constant — never typed by hand (regla #0).
const nf = (lang: string, n: number) => n.toLocaleString(localeOf(lang));

function monthLabel(ym: string, lang: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString(localeOf(lang), { month: "long", year: "numeric", timeZone: "UTC" })
    .replace(/\./g, "");
}

export function Hero() {
  const { lang } = useLang();
  const stats = [
    { num: nf(lang, SITE_STATS.nMonths), key: "statBulletins" },
    { num: nf(lang, SITE_STATS.nObs), key: "statObs" },
    { num: nf(lang, SITE_STATS.nSeriesStructural), key: "statSeries" },
    { num: nf(lang, PILOT.length), key: "statCountries" },
  ] as const;
  return (
    <section id="inicio" className="home-hero">
      <div className="home-inner">
        <p className="home-eyebrow">
          Visa Bulletin · {tr(lang, "heroDataThrough")} {monthLabel(SITE_STATS.dateLast, lang)}
        </p>
        <h1 className="home-h1">
          {tr(lang, "homeTitle")} <span>{tr(lang, "homeTitleAccent")}</span>
        </h1>
        <p className="home-lead">
          {tr(lang, "homeLead").replace("{year}", SITE_STATS.dateFirst.slice(0, 4))}
        </p>
        <div className="home-observatory">
          <HomeObservatory />
        </div>
        <dl className="home-stats">
          {stats.map((s) => (
            <div key={s.key}>
              <dd>{s.num}</dd>
              <dt>{tr(lang, s.key)}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
