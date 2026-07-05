import { Hero } from "@/components/sections/hero";
import { Problema } from "@/components/sections/problema";
import { Teasers } from "@/components/sections/teasers";
import { Explore } from "@/components/sections/explore";
import { SectionHTML } from "@/components/section-html";
import type { Lang } from "@/lib/site-map";

// Shared home body, rendered under both / and /en. Order mirrors lib/site-map:
// hero → the problem in one figure → forecast/evidence teasers → explore →
// abstract → authors → contact (AU1: the pitch first, the academic abstract after).
export function HomePage({ lang }: { lang: Lang }) {
  return (
    <>
      <Hero />
      <Problema lang={lang} />
      <Teasers />
      <Explore />
      <SectionHTML id="resumen" lang={lang} className="section" />
      <SectionHTML id="autores" lang={lang} className="section section--alt" />
      <SectionHTML id="contacto" lang={lang} className="section section--deep" />
    </>
  );
}
