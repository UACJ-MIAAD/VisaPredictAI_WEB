import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/sections/hero";
import { AskVisabot } from "@/components/sections/ask-visabot";
import { SectionHTML } from "@/components/section-html";
import { tr } from "@/lib/i18n";
import { localePath, type Lang } from "@/lib/site-map";

// Minimal home (redesign 19-nov-2026): the observatory first, one question box
// for VisaBot, three ways in, then the abstract, authors and contact.
const PATHS = [
  { path: "/resultados", t: "homeGoForecastsT", b: "homeGoForecastsB" },
  { path: "/datos-historicos", t: "homeGoDataT", b: "homeGoDataB" },
  { path: "/anteproyecto", t: "homeGoProjectT", b: "homeGoProjectB" },
] as const;

export function HomePage({ lang }: { lang: Lang }) {
  return (
    <>
      <Hero />
      <AskVisabot />
      <section className="home-band" aria-label={tr(lang, "homeGoLabel")}>
        <div className="home-inner">
          <ul className="home-go">
            {PATHS.map((p) => (
              <li key={p.path}>
                <Link href={localePath(p.path, lang)}>
                  <strong>{tr(lang, p.t)}</strong>
                  <span>{tr(lang, p.b)}</span>
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <SectionHTML id="resumen" lang={lang} className="section" />
      <SectionHTML id="autores" lang={lang} className="section" />
      <SectionHTML id="contacto" lang={lang} className="section" />
    </>
  );
}
